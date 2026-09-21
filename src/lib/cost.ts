type Tarifa = { entrada: number; salida: number };

/**
 * Dólares por millón de tokens. Sonnet 5 a 2/10 se dedujo el 2026-09-21
 * cuadrando el gasto de la consola de Anthropic (31.39 USD) contra los tokens
 * registrados: a 3/15 el sistema sobrestimaba cerca de un 50 %. Revisar
 * contra la consola antes de cada despliegue: si estas cifras se
 * desactualizan, el tope de COST_LIMIT_USD corta investigaciones antes o
 * después de lo debido.
 */
const TARIFAS: Record<string, Tarifa> = {
  'claude-opus-5':   { entrada: 5,  salida: 25 },
  'claude-sonnet-5': { entrada: 2,  salida: 10 },
  'claude-opus-4-8': { entrada: 5,  salida: 25 },
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
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

export function calcularCosto(modelo: string, entrada: number, salida: number): number {
  const t = tarifaDe(modelo);
  const usd = (entrada / 1_000_000) * t.entrada + (salida / 1_000_000) * t.salida;
  return Math.round(usd * 10_000) / 10_000;
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
