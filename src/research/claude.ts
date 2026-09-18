import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';
import { rescatarParcial, ajustarAlEsquema } from './normalizar';

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

/**
 * Prefijos exactos de los dos errores que significan «esta respuesta no
 * sirve, no tiene caso reintentarla mañana» (a diferencia de un error de
 * saldo o de red, que sí puede resolverse solo). Se exportan para que
 * `esRespuestaInvalida` en `convertir-lecturas.ts` los reconozca por el
 * mismo texto que lanza esta función, en vez de duplicar la cadena a mano.
 */
export const MENSAJE_JSON_INVALIDO = 'El modelo no devolvió JSON válido tras dos intentos.';
export const MENSAJE_DECLINO = 'El modelo declinó la petición';

/** Sistema del pedido de corrección: solo forma, nunca contenido nuevo. */
export const SISTEMA_CORRECCION = `Corriges el formato de una respuesta JSON que no cumplió su esquema.
- Conserva el contenido: no agregues datos, cifras, fuentes ni nombres que no estén en la respuesta.
- Solo ajusta la forma: un campo de texto que venga como arreglo u objeto se escribe como un solo texto; lo que falte y no puedas sacar de la respuesta se deja como "" o se quita el elemento.
- Si la respuesta está cortada, ciérrala con lo que ya trae, sin completar a mano lo que falta.
- Responde solo con JSON válido, sin texto antes ni después.`;

/** Tope de salida del pedido de corrección: es reescribir un JSON, no investigar. */
const MAX_TOKENS_CORRECCION = 12_000;

export type ResultadoJson<T> = {
  datos: T;
  tokensEntrada: number;
  tokensSalida: number;
  /**
   * `true` si la respuesta no cumplió el esquema ni tras corregirla y se
   * guardó lo que sí validaba (`descartes` dice qué se quitó y por qué).
   */
  parcial?: boolean;
  descartes?: string[];
};

function textoDe(res: any): string {
  return (res?.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
}

/**
 * Intenta leer y validar `texto`. Devuelve los datos si cumple; si no, el
 * error legible y, si al menos era JSON, el objeto crudo para el rescate.
 */
function evaluar<T>(texto: string, schema: ZodType<T>, preparar?: (crudo: unknown) => unknown):
  { ok: true; datos: T } | { ok: false; error: string; crudo?: unknown } {
  let crudo: unknown;
  try {
    crudo = extraerJson(texto);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  // La forma propia de cada agente (llaves con acento, un objeto por clave
  // donde va una lista…) se arregla antes de validar, para que el ajuste y el
  // rescate trabajen ya sobre las rutas del esquema.
  if (preparar) {
    try {
      crudo = preparar(structuredClone(crudo));
    } catch (e) {
      console.warn('[pedirJson] preparar falló; se valida la respuesta tal cual:', e);
    }
  }
  const parsed = schema.safeParse(crudo);
  if (parsed.success) return { ok: true, datos: parsed.data };
  // Antes de dar la respuesta por mala, se ajusta su forma al esquema
  // (texto largo, arreglo donde va texto, enum mal escrito…): arreglarlo aquí
  // no cuesta una llamada más.
  const { valor, ajustes } = ajustarAlEsquema(schema as ZodType<unknown>, crudo);
  const ajustado = schema.safeParse(valor);
  if (ajustado.success) {
    if (ajustes.length) console.warn(`[pedirJson] respuesta ajustada al esquema: ${ajustes.slice(0, 10).join(' | ')}`);
    return { ok: true, datos: ajustado.data };
  }
  crudo = valor;
  const error = ajustado.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  return { ok: false, error, crudo };
}

/**
 * Pide al modelo un JSON validado con `schema`.
 *
 * Dos estrategias de reintento, según lo caro que sea repetir:
 *
 * - Sin búsqueda web (síntesis, lectura, growth…): se repite el pedido
 *   completo con el error anotado. El contexto es texto propio y barato, y
 *   las reglas de la lectura (cifras con respaldo) necesitan los datos.
 * - Con búsqueda web: NO se repite. Repetir era volver a pagar todas las
 *   búsquedas y todos sus resultados (el grueso de los 15.70 USD de «Mar de
 *   miel»: tres etapas investigaron dos veces cada una). Se manda solo la
 *   respuesta ya obtenida, sin herramientas ni contexto del cliente, y se
 *   pide que corrija la forma. Y si ni así valida, se rescata lo que sí
 *   valida (`rescatarParcial`) en vez de tirar la etapa.
 */
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
  /** La forma esperada del JSON, en texto. Se la lleva el pedido de corrección. */
  forma?: string;
  /**
   * Si al final nada valida, guardar lo que sí valida en vez de fallar.
   * Por omisión, solo con búsqueda web: es donde perder la etapa sale caro.
   */
  rescatar?: boolean;
  /**
   * Arreglo de forma propio del agente, aplicado a la respuesta ya leída y
   * antes de validar (p. ej. un objeto indexado por clave → lista).
   */
  preparar?: (crudo: unknown) => unknown;
}): Promise<ResultadoJson<T>> {
  const { modelo, sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000, onUso, forma, preparar } = opts;
  const rescatar = opts.rescatar ?? buscarWeb;
  const api = obtenerCliente();

  let entrada = 0, salida = 0;

  const contabilizar = (r: any): boolean => {
    const e = r.usage?.input_tokens ?? 0, s = r.usage?.output_tokens ?? 0;
    entrada += e; salida += s;
    return onUso ? onUso(e, s) : true;
  };

  // Siempre en streaming. El SDK estima cuánto tardará una petición a partir
  // de `max_tokens` y rechaza de entrada, sin llegar a la red, cualquiera que
  // pase de diez minutos: con los 32k de la síntesis eso saltaba siempre
  // ("Streaming is required for operations that may take longer than 10
  // minutes"). `finalMessage()` acumula los eventos y devuelve el mismo
  // objeto Message que `create`, con `usage` y `stop_reason` incluidos.
  const pedir = (cuerpo: Record<string, unknown>) =>
    api.messages.stream(cuerpo as any).finalMessage() as Promise<any>;

  // `web_search_20260209` trae filtrado dinámico: el servidor ejecuta código
  // para descartar resultados irrelevantes antes de que ocupen contexto.
  // No se declara `code_execution` aparte: ya va incluido, y un segundo
  // entorno de ejecución confunde al modelo.
  const herramientas = buscarWeb
    ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 12 }] }
    : {};

  /** Un turno completo del modelo, con sus reanudaciones de `pause_turn`. */
  const turno = async (mensajeUsuario: string): Promise<any> => {
    const mensajes: any[] = [{ role: 'user', content: mensajeUsuario }];
    const cuerpo = () => ({ model: modelo, max_tokens: maxTokens, system: sistema, messages: mensajes, ...herramientas });

    let res: any = await pedir(cuerpo());
    let hayPresupuesto = contabilizar(res);

    // Con herramientas de servidor, el turno se pausa cada 10 iteraciones.
    // Se reanuda devolviendo el turno del asistente sin agregar mensaje nuevo.
    let pausas = 0;
    while (res.stop_reason === 'pause_turn' && pausas < MAX_PAUSAS && hayPresupuesto) {
      mensajes.push({ role: 'assistant', content: res.content });
      res = await pedir(cuerpo());
      hayPresupuesto = contabilizar(res);
      pausas++;
    }

    // Se acabó el presupuesto (o las pausas) a media búsqueda. Antes se tiraba
    // la etapa con todo lo ya buscado; ahora se le pide que cierre con lo que
    // encontró, sin buscar más (`tool_choice: none`). Cuesta releer el
    // contexto una vez, mucho menos que perder la etapa.
    if (res.stop_reason === 'pause_turn') {
      mensajes.push({ role: 'assistant', content: res.content });
      mensajes.push({
        role: 'user',
        content: 'Se acabó el presupuesto de búsqueda. No busques más: responde ya, solo con el JSON, usando lo que encontraste.',
      });
      res = await pedir({ ...cuerpo(), tool_choice: { type: 'none' } });
      contabilizar(res);
      if (res.stop_reason === 'pause_turn') {
        throw new Error('Se agotó el presupuesto a media búsqueda: el turno quedó pausado y no se pudo cerrar.');
      }
    }

    if (res.stop_reason === 'refusal') {
      throw new Error(`${MENSAJE_DECLINO} (${res.stop_details?.category ?? 'sin categoría'}).`);
    }
    return res;
  };

  const errorDeCorte = () =>
    `La respuesta se agotó por max_tokens (${maxTokens}). Sube el límite o reduce el alcance.`;

  // ---- Primer intento: el pedido completo.
  const res = await turno(usuario);
  const texto = textoDe(res);
  const primero = evaluar(texto, schema, preparar);
  if (primero.ok && res.stop_reason !== 'max_tokens') {
    return { datos: primero.datos, tokensEntrada: entrada, tokensSalida: salida };
  }
  let ultimoError = res.stop_reason === 'max_tokens' ? errorDeCorte() : (primero as { error: string }).error;
  const crudos: unknown[] = [];
  if (!primero.ok && primero.crudo !== undefined) crudos.push(primero.crudo);

  // ---- Segundo intento.
  if ((buscarWeb || forma) && texto.trim()) {
    // Corrección barata: la respuesta ya obtenida, sin herramientas ni contexto.
    const correccion = await pedir({
      model: modelo,
      max_tokens: Math.min(maxTokens, MAX_TOKENS_CORRECCION),
      system: SISTEMA_CORRECCION,
      messages: [{
        role: 'user',
        content: `${forma ? `Forma esperada:\n${forma}\n\n` : ''}Problemas encontrados: ${ultimoError}\n\nRespuesta a corregir:\n${texto}\n\nDevuelve únicamente el JSON corregido.`,
      }],
    });
    contabilizar(correccion);
    if (correccion.stop_reason === 'refusal') {
      throw new Error(`${MENSAJE_DECLINO} (${correccion.stop_details?.category ?? 'sin categoría'}).`);
    }
    const segundo = evaluar(textoDe(correccion), schema, preparar);
    if (segundo.ok && correccion.stop_reason !== 'max_tokens') {
      return { datos: segundo.datos, tokensEntrada: entrada, tokensSalida: salida };
    }
    if (!segundo.ok) {
      ultimoError = segundo.error;
      if (segundo.crudo !== undefined) crudos.unshift(segundo.crudo);
    }
  } else if (!buscarWeb) {
    const res2 = await turno(
      `${usuario}\n\nTu respuesta anterior no cumplió el esquema. Error: ${ultimoError}\nDevuelve únicamente JSON válido.`,
    );
    const segundo = evaluar(textoDe(res2), schema, preparar);
    if (segundo.ok && res2.stop_reason !== 'max_tokens') {
      return { datos: segundo.datos, tokensEntrada: entrada, tokensSalida: salida };
    }
    ultimoError = res2.stop_reason === 'max_tokens' ? errorDeCorte() : (segundo as { error: string }).error;
    if (!segundo.ok && segundo.crudo !== undefined) crudos.unshift(segundo.crudo);
  }

  // ---- Rescate: lo que valide de la mejor respuesta, en vez de nada.
  if (rescatar) {
    for (const crudo of crudos) {
      const r = rescatarParcial(schema, crudo);
      if (r) {
        console.warn(`[pedirJson] respuesta rescatada a medias; se descartó: ${r.descartes.join(' | ') || 'nada'}`);
        return { datos: r.datos, tokensEntrada: entrada, tokensSalida: salida, parcial: true, descartes: r.descartes };
      }
    }
  }

  throw new Error(`${MENSAJE_JSON_INVALIDO} Último error: ${ultimoError}`);
}
