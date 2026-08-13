import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';

let cliente: Anthropic | null = null;

function obtenerCliente(): Anthropic {
  if (!cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY');
    cliente = new Anthropic({ apiKey });
  }
  return cliente;
}

export function extraerJson(texto: string): unknown {
  const enBloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = enBloque ? enBloque[1] : texto;
  const inicio = candidato.indexOf('{');
  const fin = candidato.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error('La respuesta no contiene JSON');
  return JSON.parse(candidato.slice(inicio, fin + 1));
}

/** Cuántas veces se reanuda un turno pausado por la búsqueda web antes de rendirse. */
const MAX_PAUSAS = 6;

export async function pedirJson<T>(opts: {
  modelo: string;
  sistema: string;
  usuario: string;
  schema: ZodType<T>;
  buscarWeb?: boolean;
  maxTokens?: number;
  /**
   * Se llama con el consumo de cada respuesta, incluidas las reanudaciones de
   * `pause_turn`. Si devuelve false, se deja de reanudar: es el único punto
   * donde se puede frenar el gasto DENTRO de una etapa, y con búsqueda web una
   * sola etapa puede encadenar muchas llamadas.
   */
  onUso?: (tokensEntrada: number, tokensSalida: number) => boolean;
}): Promise<{ datos: T; tokensEntrada: number; tokensSalida: number }> {
  const { modelo, sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000, onUso } = opts;
  const api = obtenerCliente();

  let entrada = 0, salida = 0, ultimoError = '';

  for (let intento = 0; intento < 2; intento++) {
    const mensaje = intento === 0
      ? usuario
      : `${usuario}\n\nTu respuesta anterior no cumplió el esquema. Error: ${ultimoError}\nDevuelve únicamente JSON válido.`;

    const mensajes: any[] = [{ role: 'user', content: mensaje }];

    // Siempre en streaming. El SDK estima cuánto tardará una petición a partir
    // de `max_tokens` y rechaza de entrada, sin llegar a la red, cualquiera que
    // pase de diez minutos: con los 32k de la síntesis eso saltaba siempre
    // ("Streaming is required for operations that may take longer than 10
    // minutes"). `finalMessage()` acumula los eventos y devuelve el mismo
    // objeto Message que `create`, con `usage` y `stop_reason` incluidos, así
    // que el resto de la función no cambia.
    const pedir = () => api.messages.stream({
      model: modelo,
      max_tokens: maxTokens,
      system: sistema,
      messages: mensajes,
      // `web_search_20260209` trae filtrado dinámico: el servidor ejecuta código
      // para descartar resultados irrelevantes antes de que ocupen contexto.
      // No se declara `code_execution` aparte: ya va incluido, y un segundo
      // entorno de ejecución confunde al modelo.
      ...(buscarWeb ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }] } : {}),
    } as any).finalMessage() as Promise<any>;

    const contabilizar = (r: any): boolean => {
      const e = r.usage?.input_tokens ?? 0, s = r.usage?.output_tokens ?? 0;
      entrada += e; salida += s;
      return onUso ? onUso(e, s) : true;
    };

    let res: any = await pedir();
    let hayPresupuesto = contabilizar(res);

    // Con herramientas de servidor, el turno se pausa cada 10 iteraciones.
    // Se reanuda devolviendo el turno del asistente sin agregar mensaje nuevo.
    let pausas = 0;
    while (res.stop_reason === 'pause_turn' && pausas < MAX_PAUSAS && hayPresupuesto) {
      mensajes.push({ role: 'assistant', content: res.content });
      res = await pedir();
      hayPresupuesto = contabilizar(res);
      pausas++;
    }

    if (!hayPresupuesto && res.stop_reason === 'pause_turn') {
      throw new Error(
        'Se agotó el presupuesto a media búsqueda: el turno quedó pausado y no se reanudó.',
      );
    }

    if (res.stop_reason === 'max_tokens') {
      ultimoError = `La respuesta se agotó por max_tokens (${maxTokens}). Sube el límite o reduce el alcance.`;
      continue;
    }

    if (res.stop_reason === 'refusal') {
      throw new Error(
        `El modelo declinó la petición (${res.stop_details?.category ?? 'sin categoría'}).`,
      );
    }

    const texto = (res.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    try {
      const crudo = extraerJson(texto);
      const parsed = schema.safeParse(crudo);
      if (parsed.success) {
        return { datos: parsed.data, tokensEntrada: entrada, tokensSalida: salida };
      }
      ultimoError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(`El modelo no devolvió JSON válido tras dos intentos. Último error: ${ultimoError}`);
}
