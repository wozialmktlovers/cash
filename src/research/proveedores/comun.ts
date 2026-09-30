import type { ZodType } from 'zod';
import { rescatarParcial, ajustarAlEsquema } from '../normalizar';

/**
 * Lo que comparten los dos proveedores de IA (Anthropic y OpenAI): el tipo de
 * entrada/salida de `pedirJson`, la extracción de JSON de un texto y la
 * evaluación contra el esquema (con el ajuste de forma de `normalizar.ts`).
 * Nada de esto sabe qué proveedor lo llama; por eso vive aparte de
 * `anthropic.ts` y `openai.ts`.
 */

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

/** Opciones de `pedirJson`, iguales para los dos proveedores. */
export type PedirJsonOpts<T> = {
  modelo: string;
  sistema: string;
  usuario: string;
  schema: ZodType<T>;
  buscarWeb?: boolean;
  maxTokens?: number;
  /**
   * Se llama con el consumo de cada respuesta, incluidas las reanudaciones
   * propias del proveedor (p. ej. `pause_turn` en Anthropic). Si devuelve
   * false, se deja de reanudar: es el único punto donde se puede frenar el
   * gasto DENTRO de una etapa, y con búsqueda web una sola etapa puede
   * encadenar muchas llamadas.
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
};

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
export const MAX_TOKENS_CORRECCION = 12_000;

export function extraerJson(texto: string): unknown {
  const enBloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = enBloque ? enBloque[1] : texto;
  const inicio = candidato.indexOf('{');
  const fin = candidato.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error('La respuesta no contiene JSON');
  return JSON.parse(candidato.slice(inicio, fin + 1));
}

/**
 * Intenta leer y validar `texto`. Devuelve los datos si cumple; si no, el
 * error legible y, si al menos era JSON, el objeto crudo para el rescate.
 */
export function evaluar<T>(texto: string, schema: ZodType<T>, preparar?: (crudo: unknown) => unknown):
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

/** Último recurso, compartido: intenta rescatar la mejor de las respuestas crudas vistas. */
export function intentarRescate<T>(schema: ZodType<T>, crudos: unknown[]):
  { datos: T; descartes: string[] } | null {
  for (const crudo of crudos) {
    const r = rescatarParcial(schema, crudo);
    if (r) {
      console.warn(`[pedirJson] respuesta rescatada a medias; se descartó: ${r.descartes.join(' | ') || 'nada'}`);
      return r;
    }
  }
  return null;
}
