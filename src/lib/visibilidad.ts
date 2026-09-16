import { eq } from 'drizzle-orm';
import { db, clients, contenidoLotes, contenidoPiezas, researchJobs, researchResults, growthResults, pilaresResults } from '@/db';
import { puedeVerCliente, puedeOperarCliente, type UsuarioSesion } from './permisos';

export type Cliente = typeof clients.$inferSelect;
export type Job = typeof researchJobs.$inferSelect;
export type Lote = typeof contenidoLotes.$inferSelect;
export type Pieza = typeof contenidoPiezas.$inferSelect;
export type DocumentoTipo = 'research' | 'growth' | 'pilares';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un id que no tiene forma de UUID nunca va a existir en la base: cortar
 * aquí hace que la página conteste 404, en vez de que Postgres tire un 500
 * porque el tipo de la columna no calza con lo que llegó en la URL. */
export function esUuid(id: string): boolean {
  return UUID_RE.test(id);
}

/**
 * Condición SQL para filtrar la tabla `clients` según el rol de `u`.
 * `undefined` para admin (sin filtro); el resto siempre trae una condición
 * definida, aunque el usuario no tenga cliente asignado (ese caso no
 * devuelve nunca filas, en vez de tronar).
 */
export function condicionClientes(u: UsuarioSesion) {
  if (u.rol === 'admin') return undefined;
  if (u.rol === 'operador') return eq(clients.operadorId, u.id);
  return eq(clients.id, u.clientId ?? '');
}

/** El cliente si `u` puede verlo; `null` si no existe, el id no es UUID o no tiene permiso. */
export async function clienteVisible(u: UsuarioSesion, clientId: string): Promise<Cliente | null> {
  if (!esUuid(clientId)) return null;
  const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!c || !puedeVerCliente(u, c)) return null;
  return c;
}

/** El cliente si `u` puede operarlo (crear, editar, lanzar); `null` si no. */
export async function clienteOperable(u: UsuarioSesion, clientId: string): Promise<Cliente | null> {
  if (!esUuid(clientId)) return null;
  const [c] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!c || !puedeOperarCliente(u, c)) return null;
  return c;
}

/** El documento (research, growth o pilares) y su cliente, si `u` puede verlo. */
export async function documentoVisible<T extends DocumentoTipo>(
  u: UsuarioSesion,
  tipo: T,
  documentoId: string,
): Promise<{ resultado: typeof researchResults.$inferSelect; cliente: Cliente } | null> {
  if (!esUuid(documentoId)) return null;
  // La tabla se elige una sola vez y se usa tanto en el FROM como en la
  // proyección: repartir el ternario deja el SELECT apuntando a una tabla
  // distinta del FROM y Drizzle revienta (ver src/pages/api/share.ts).
  const tabla = tipo === 'growth' ? growthResults : tipo === 'pilares' ? pilaresResults : researchResults;
  const [fila] = await db
    .select({ resultado: tabla, cliente: clients })
    .from(tabla)
    .innerJoin(clients, eq(clients.id, tabla.clientId))
    .where(eq(tabla.id, documentoId))
    .limit(1);
  if (!fila || !puedeVerCliente(u, fila.cliente)) return null;
  return fila;
}

/** El job y su cliente, si `u` puede verlo. */
export async function jobVisible(u: UsuarioSesion, jobId: string): Promise<{ job: Job; cliente: Cliente } | null> {
  if (!esUuid(jobId)) return null;
  const [fila] = await db
    .select({ job: researchJobs, cliente: clients })
    .from(researchJobs)
    .innerJoin(clients, eq(clients.id, researchJobs.clientId))
    .where(eq(researchJobs.id, jobId))
    .limit(1);
  if (!fila || !puedeVerCliente(u, fila.cliente)) return null;
  return fila;
}

/**
 * El lote mensual de contenido y su cliente, si `u` puede verlo.
 *
 * Mismo molde que `documentoVisible` y `jobVisible`: se resuelve el permiso
 * por el CLIENTE del lote, en una sola consulta con `innerJoin`, y se contesta
 * `null` tanto si el id no tiene forma de UUID como si el lote no existe o el
 * usuario no tiene nada que hacer ahí. Quien llama traduce ese `null` a un 404
 * y nunca a un 403: un operador no debe poder averiguar, por el código de
 * respuesta, qué lotes existen en clientes que no son suyos.
 *
 * Devuelve VISIBLE, no operable. El filtro de `puedeOperarCliente` lo pone la
 * ruta —igual que en `PATCH /api/pilares/[id]/temas/[temaId]`—, porque el
 * portal del cliente (fase C) va a necesitar ver este mismo lote sin poder
 * editarlo.
 */
export async function loteVisible(u: UsuarioSesion, loteId: string): Promise<{ lote: Lote; cliente: Cliente } | null> {
  if (!esUuid(loteId)) return null;
  const [fila] = await db
    .select({ lote: contenidoLotes, cliente: clients })
    .from(contenidoLotes)
    .innerJoin(clients, eq(clients.id, contenidoLotes.clientId))
    .where(eq(contenidoLotes.id, loteId))
    .limit(1);
  if (!fila || !puedeVerCliente(u, fila.cliente)) return null;
  return fila;
}

/**
 * Una pieza, su lote y su cliente, si `u` puede verla. Mismo criterio que
 * `loteVisible`; el lote viene de regreso porque toda operación sobre una
 * pieza necesita después recalcular el estado de su lote.
 */
export async function piezaVisible(
  u: UsuarioSesion,
  piezaId: string,
): Promise<{ pieza: Pieza; lote: Lote; cliente: Cliente } | null> {
  if (!esUuid(piezaId)) return null;
  const [fila] = await db
    .select({ pieza: contenidoPiezas, lote: contenidoLotes, cliente: clients })
    .from(contenidoPiezas)
    .innerJoin(contenidoLotes, eq(contenidoLotes.id, contenidoPiezas.loteId))
    .innerJoin(clients, eq(clients.id, contenidoLotes.clientId))
    .where(eq(contenidoPiezas.id, piezaId))
    .limit(1);
  if (!fila || !puedeVerCliente(u, fila.cliente)) return null;
  return fila;
}
