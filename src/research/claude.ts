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
}): Promise<{ datos: T; tokensEntrada: number; tokensSalida: number }> {
  const { modelo, sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000 } = opts;
  const api = obtenerCliente();

  let entrada = 0, salida = 0, ultimoError = '';

  for (let intento = 0; intento < 2; intento++) {
    const mensaje = intento === 0
      ? usuario
      : `${usuario}\n\nTu respuesta anterior no cumplió el esquema. Error: ${ultimoError}\nDevuelve únicamente JSON válido.`;

    const mensajes: any[] = [{ role: 'user', content: mensaje }];

    const pedir = () => api.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system: sistema,
      messages: mensajes,
      // `web_search_20260209` trae filtrado dinámico: el servidor ejecuta código
      // para descartar resultados irrelevantes antes de que ocupen contexto.
      // No se declara `code_execution` aparte: ya va incluido, y un segundo
      // entorno de ejecución confunde al modelo.
      ...(buscarWeb ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }] } : {}),
    }) as Promise<any>;

    let res: any = await pedir();
    entrada += res.usage?.input_tokens ?? 0;
    salida += res.usage?.output_tokens ?? 0;

    // Con herramientas de servidor, el turno se pausa cada 10 iteraciones.
    // Se reanuda devolviendo el turno del asistente sin agregar mensaje nuevo.
    let pausas = 0;
    while (res.stop_reason === 'pause_turn' && pausas < MAX_PAUSAS) {
      mensajes.push({ role: 'assistant', content: res.content });
      res = await pedir();
      entrada += res.usage?.input_tokens ?? 0;
      salida += res.usage?.output_tokens ?? 0;
      pausas++;
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
