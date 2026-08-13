type Tarifa = { entrada: number; salida: number };

/**
 * Dólares por millón de tokens, según la lista de precios vigente al
 * 2026-08-12. Revisar antes de cada despliegue: si estas cifras se
 * desactualizan, el tope de COST_LIMIT_USD corta investigaciones antes o
 * después de lo debido.
 */
const TARIFAS: Record<string, Tarifa> = {
  'claude-opus-5':   { entrada: 5,  salida: 25 },
  'claude-sonnet-5': { entrada: 3,  salida: 15 },
  'claude-opus-4-8': { entrada: 5,  salida: 25 },
  'claude-haiku-4-5': { entrada: 1, salida: 5 },
};

const POR_DEFECTO: Tarifa = { entrada: 5, salida: 25 };

export function calcularCosto(modelo: string, entrada: number, salida: number): number {
  const t = TARIFAS[modelo] ?? POR_DEFECTO;
  const usd = (entrada / 1_000_000) * t.entrada + (salida / 1_000_000) * t.salida;
  return Math.round(usd * 10_000) / 10_000;
}
