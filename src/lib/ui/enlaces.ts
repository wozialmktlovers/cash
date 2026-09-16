// Rutas internas a los documentos de una etapa. Puras: solo arman una cadena
// a partir del tipo y el id, sin tocar la base ni la sesión, así que las puede
// importar tanto una página del Studio como `@/flujo/servicio`.
//
// Vivían en dos sitios: `enlaceDocumento` en `src/flujo/servicio.ts` (para el
// botón «Ver documento» de la ficha y para los avisos) y una copia con el
// respaldo a la ficha del cliente dentro de `src/pages/pendientes.astro`. El
// Inicio necesita la segunda, y una tercera copia habría dejado tres versiones
// de la misma tabla de rutas, listas para separarse en cuanto cambie una.

import type { TipoDocumento } from '@/flujo/reglas';

/** Ruta del documento vigente de una etapa (spec §3, Avisos: «enlace»). */
export function enlaceDocumento(tipo: TipoDocumento, documentoId: string): string {
  if (tipo === 'growth') return `/growth/${documentoId}`;
  if (tipo === 'pilares') return `/pilares/${documentoId}`;
  return `/resultados/${documentoId}`;
}

/**
 * A dónde lleva el botón «Ver» de un pendiente: a su documento si ya lo hay, y
 * si no a la ficha del cliente, que es donde se genera. Una etapa `en_proceso`
 * todavía no tiene documento, así que ese es el camino normal, no un error.
 *
 * Recibe el pendiente entero (`EtapaPendiente` de `@/lib/pendientes` encaja
 * tal cual) en vez de tres argumentos sueltos, que en el orden equivocado
 * habrían compilado igual: los tres eran cadenas.
 */
export function enlacePendiente(
  p: { documentoTipo: TipoDocumento | null; documentoId: string | null; clientId: string },
): string {
  if (p.documentoTipo && p.documentoId) return enlaceDocumento(p.documentoTipo, p.documentoId);
  return `/clientes/${p.clientId}`;
}
