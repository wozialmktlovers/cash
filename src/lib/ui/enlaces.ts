// Rutas internas a los documentos de una etapa. Puras: solo arman una cadena
// a partir del tipo y el id, sin tocar la base ni la sesión, así que las puede
// importar tanto una página del Studio como `@/flujo/servicio`.
//
// Vivían en dos sitios: `enlaceDocumento` en `src/flujo/servicio.ts` (para el
// botón «Ver documento» de la ficha y para los avisos) y una copia con el
// respaldo a la ficha del cliente dentro de `src/pages/pendientes.astro`. El
// Inicio necesita la segunda, y una tercera copia habría dejado tres versiones
// de la misma tabla de rutas, listas para separarse en cuanto cambie una.

import type { Etapa, TipoDocumento } from '@/flujo/reglas';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A dónde lleva el aviso de una etapa: a donde se resuelve, que es su
 * documento vigente —ahí está la barra con «Autorizar»/«Solicitar
 * autorización» y los comentarios—, no la ficha del cliente.
 *
 * - `comentarioId`: el documento con ESE hilo abierto y su bloque resaltado
 *   (`#comentario-<id>`, lo atiende `SCRIPT_FLUJO`).
 * - `primerComentario`: el documento en el primer comentario abierto del
 *   recorrido (`#primer-comentario`): el orden del recorrido es el del
 *   documento en pantalla, y solo el script lo conoce.
 *
 * Respaldo: la ficha, si la etapa no tiene documento todavía o es el
 * desarrollo mensual (su pantalla es la del mes, y la arma quien llama).
 *
 * Siempre una ruta relativa interna armada con ids con forma de UUID: nada
 * de lo que llega se pega tal cual (un id raro cae al respaldo o se ignora),
 * así el enlace no puede apuntar fuera del Studio ni inyectar nada.
 */
export function enlaceEtapa(
  e: { clientId: string; etapa: Etapa; documentoTipo: TipoDocumento | null; documentoId: string | null },
  destino: { comentarioId?: string | null; primerComentario?: boolean } = {},
): string {
  if (e.etapa === 'desarrollo_mensual' || !e.documentoTipo || !e.documentoId || !UUID.test(e.documentoId)) {
    return `/clientes/${encodeURIComponent(e.clientId)}`;
  }
  const documento = enlaceDocumento(e.documentoTipo, e.documentoId);
  if (destino.comentarioId && UUID.test(destino.comentarioId)) return `${documento}#comentario-${destino.comentarioId.toLowerCase()}`;
  if (destino.primerComentario) return `${documento}#primer-comentario`;
  return documento;
}
