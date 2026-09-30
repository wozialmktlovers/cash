type Tarifa = { entrada: number; salida: number };

/**
 * Dólares por millón de tokens. Sonnet 5 a 2/10 se dedujo el 2026-09-21
 * cuadrando el gasto de la consola de Anthropic (31.39 USD) contra los tokens
 * registrados: a 3/15 el sistema sobrestimaba cerca de un 50 %. Revisar
 * contra la consola antes de cada despliegue: si estas cifras se
 * desactualizan, el tope de COST_LIMIT_USD corta investigaciones antes o
 * después de lo debido.
 */
/**
 * Tarifas de OpenAI (dólares por millón de tokens), para cuando
 * `PROVEEDOR_IA=openai` (ver `src/research/proveedores/openai.ts`). Tomadas
 * de la página pública de precios de OpenAI (platform.openai.com/docs/pricing)
 * el 2026-09-30: gpt-5 a 1.25/10, gpt-5-mini a 0.125/1. Igual que las de
 * Anthropic arriba: revisar contra la consola de OpenAI si ha pasado tiempo
 * desde esa fecha, antes de confiar en el tope de gasto.
 */
const TARIFAS: Record<string, Tarifa> = {
  'claude-opus-5':   { entrada: 5,  salida: 25 },
  'claude-sonnet-5': { entrada: 2,  salida: 10 },
  'claude-opus-4-8': { entrada: 5,  salida: 25 },
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
  'gpt-5':      { entrada: 1.25,  salida: 10 },
  'gpt-5-mini': { entrada: 0.125, salida: 1 },
};

const POR_DEFECTO: Tarifa = { entrada: 5, salida: 25 };

/** Busca por nombre exacto o por prefijo, para ids con fecha (`claude-haiku-4-5-20251001`). */
function tarifaDe(modelo: string): Tarifa {
  if (TARIFAS[modelo]) return TARIFAS[modelo];
  const clave = Object.keys(TARIFAS).find((k) => modelo.startsWith(`${k}-`));
  return clave ? TARIFAS[clave] : POR_DEFECTO;
}

/**
 * Tokens de entrada «equivalentes» a precio normal, cuando hay caché de
 * prompts: escribir en caché cuesta 1.25× y leerlo 0.1×. Así `calcularCosto`
 * y los topes siguen trabajando con un solo número de entrada.
 */
export function entradaEquivalente(uso: { input_tokens?: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | undefined): number {
  if (!uso) return 0;
  return (uso.input_tokens ?? 0) + 1.25 * (uso.cache_creation_input_tokens ?? 0) + 0.1 * (uso.cache_read_input_tokens ?? 0);
}

/**
 * Lo mismo que `entradaEquivalente`, pero para el uso que reporta la Responses
 * API de OpenAI. Ahí no hay que avisar por separado que se escribió en caché
 * (OpenAI cachea el prompt solo, sin marcas explícitas de por medio): lo
 * único que cambia es que una parte de `input_tokens` ya viene leída del
 * caché (`input_tokens_details.cached_tokens`) y se cobra a la mitad.
 */
export function entradaEquivalenteOpenAI(uso: { input_tokens?: number; input_tokens_details?: { cached_tokens?: number } } | undefined): number {
  if (!uso) return 0;
  const total = uso.input_tokens ?? 0;
  const cacheados = uso.input_tokens_details?.cached_tokens ?? 0;
  return total - 0.5 * cacheados;
}

export function calcularCosto(modelo: string, entrada: number, salida: number): number {
  const t = tarifaDe(modelo);
  const usd = (entrada / 1_000_000) * t.entrada + (salida / 1_000_000) * t.salida;
  return Math.round(usd * 10_000) / 10_000;
}

/**
 * Costo aproximado (USD) de UNA llamada a la herramienta de búsqueda web
 * integrada de OpenAI (Responses API), aparte de los tokens de entrada/salida
 * normales que ya cubre `calcularCosto`. Según la documentación y los reportes
 * de la comunidad de OpenAI consultados el 2026-09-30: unos 10 USD por 1000
 * llamadas con GPT-4.1/GPT-4o y unos 25 USD por 1000 con la familia GPT-5; se
 * usa la tarifa de GPT-5 porque es el modelo económico (`MODEL_BUSQUEDA_OPENAI`,
 * por omisión gpt-5-mini) el que hace estas búsquedas. Es una cifra estimada,
 * y probablemente una SUBESTIMACIÓN: una sola llamada visible puede disparar
 * varias sub-búsquedas internas que también se cobran y que la API no expone.
 * Revisar contra la consola de OpenAI antes de confiar en el tope de gasto.
 */
export const COSTO_BUSQUEDA_WEB_OPENAI_USD = 0.025;

/**
 * Convierte un monto en dólares a su equivalente en tokens de entrada del
 * modelo indicado, a la tarifa de hoy. Sirve para meter un costo que no es
 * por token (como `COSTO_BUSQUEDA_WEB_OPENAI_USD`) dentro del mismo conteo de
 * tokens que ya usan `onUso`/`frenoDeGasto`, sin cambiarles la forma.
 */
export function usdAEntradaEquivalente(modelo: string, usd: number): number {
  if (!usd) return 0;
  const t = tarifaDe(modelo);
  if (!t.entrada) return 0;
  return (usd / t.entrada) * 1_000_000;
}

/**
 * Lee un tope de costo (en USD) de una variable de entorno. Si no está
 * definida, no es un número o no es positiva, se usa el valor por defecto y
 * se avisa: un tope inválido no debe tumbar el job (NaN nunca supera nada,
 * así que sin esta guarda un typo deja el gasto sin límite) ni impedir que
 * arranque (por eso no se lanza un error).
 */
export function leerTopeUsd(valor: string | undefined, porDefecto: number, nombre: string): number {
  if (valor === undefined || valor === '') return porDefecto;
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[costo] ${nombre}="${valor}" no es un número positivo; se usa ${porDefecto}.`);
    return porDefecto;
  }
  return n;
}
