// Helper centralizado de fechas visibles (fix menores, punto 2): el servidor
// corre en UTC, así que sin fijar la zona una fecha cercana a la medianoche
// en México se leía como el día siguiente. El portal ya lo hacía bien
// (`portal/index.astro`); este archivo evita que cada página del Studio
// reimplemente su propio `toLocaleDateString`/`toLocaleString` sin
// `timeZone`, como pasaba en `pendientes.astro`, `clientes/[id].astro` y
// `entregables.astro` antes de este arreglo.
export const ZONA_MX = 'America/Mexico_City';

/** Fecha corta, ej. «15 sep 2026», en hora de Ciudad de México. */
export function fechaCorta(d: Date): string {
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', timeZone: ZONA_MX });
}

/**
 * Fecha larga con día de la semana, ej. «miércoles, 16 de septiembre de 2026»,
 * en hora de Ciudad de México. La usa el saludo del Inicio, que es el único
 * sitio donde la fecha es una frase y no un dato de tabla.
 */
export function fechaLarga(d: Date): string {
  return d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_MX });
}

/** Fecha y hora, ej. «15 sep 2026, 10:30», en hora de Ciudad de México. */
export function fechaHora(d: Date): string {
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: ZONA_MX });
}
