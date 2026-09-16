// El periodo de un lote (`YYYY-MM`) dicho para una persona, y la aritmética
// mínima para moverse de un mes al siguiente (tarea B3).
//
// Puro y sin base de datos: lo usan la ficha del cliente —para saber a qué mes
// lleva la tarjeta de la etapa 3— y la pantalla del lote. Vive en `lib/ui`
// porque es formato y navegación, no regla: quién es el lote activo y qué
// periodos son válidos ya lo contestan `src/contenido/servicio.ts` y
// `periodoValido` (src/contenido/reglas.ts), y esto no los repite.
//
// El mes en curso se lee en el reloj de Ciudad de México, igual que las fechas
// visibles (`./fecha.ts`) y que el plazo de revisión (`ZONA_MX` en
// `src/contenido/reglas.ts`): el 1 de octubre a las 00:30 de México todavía es
// 30 de septiembre en UTC, y abrir «el mes en curso» desde el Studio debe
// significar el mes que ve quien está mirando la pantalla.

import { ZONA_MX } from './fecha';

/** El mes en curso en México, en `YYYY-MM`. */
export function periodoActual(ahora: Date = new Date()): string {
  // `en-CA` da `YYYY-MM-DD` sin tener que recomponer las partes a mano.
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA_MX }).slice(0, 7);
}

/** Año y mes (1–12) de un periodo; `null` si no tiene la forma `YYYY-MM`. */
function partes(periodo: string): { anio: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { anio, mes } : null;
}

/**
 * El periodo `meses` más adelante (o atrás, con negativo). Devuelve el mismo
 * periodo si el texto no tiene forma de mes: quien navega no debe acabar en un
 * `NaN-NaN` por un enlace mal escrito.
 */
export function periodoVecino(periodo: string, meses: number): string {
  const p = partes(periodo);
  if (!p) return periodo;
  const d = new Date(Date.UTC(p.anio, p.mes - 1 + meses, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * «Septiembre 2026». Con mayúscula inicial porque encabeza la página; el
 * `es-MX` de Intl lo devuelve en minúscula.
 *
 * Se construye en UTC y se formatea en UTC a propósito: el periodo es un mes
 * del calendario, no un instante, y pasarlo por la zona de México movería el
 * día 1 a las 00:00 UTC al mes anterior.
 */
export function nombrePeriodo(periodo: string): string {
  const p = partes(periodo);
  if (!p) return periodo;
  const texto = new Date(Date.UTC(p.anio, p.mes - 1, 1))
    .toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    // es-MX escribe «septiembre de 2026»; en un título el «de» sobra.
    .replace(' de ', ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
