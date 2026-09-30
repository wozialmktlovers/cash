// Servicio de responsables por etapa (rediseño 2026-09-30: puestos y
// asignación por etapa, no por cliente). Sustituye a `clients.operador_id`
// para todo lo que decide QUIÉN puede actuar y a QUIÉN avisar: cada etapa
// (una fila de `cliente_etapas`) tiene sus propios responsables, elegidos
// entre los usuarios cuyo `puesto` corresponde a esa etapa
// (`PUESTOS_POR_ETAPA`, ./reglas.ts). Acceso a base de datos; las reglas puras
// siguen en ./reglas.ts y no cambian de forma (`esOperadorAsignado` sigue
// siendo un booleano — lo único que cambia es CÓMO se calcula).

import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { db, etapaResponsables, users, clienteEtapas, clients } from '@/db';
import { PUESTOS_POR_ETAPA, type Etapa, type Puesto } from './reglas';

export type Responsable = {
  id: string;
  puesto: Puesto;
  nombre: string | null;
  apellido: string | null;
  email: string;
  activo: boolean;
};

const CAMPOS = {
  id: users.id, puesto: etapaResponsables.puesto,
  nombre: users.nombre, apellido: users.apellido, email: users.email, activo: users.activo,
};

/** Los responsables de una etapa (cualquier estado de la cuenta; filtrar por `activo` lo hace quien llama). */
export async function responsablesDeEtapa(etapaId: string): Promise<Responsable[]> {
  const mapa = await responsablesDeEtapas([etapaId]);
  return mapa.get(etapaId) ?? [];
}

/**
 * Los responsables de varias etapas en una sola consulta, indexados por
 * `etapaId` — el mismo molde que `comentariosAbiertosPorEtapa` y
 * `eventosDeEntrada` (src/flujo/servicio.ts): nunca una consulta por etapa.
 * Una etapa sin responsables no viene en el `Map`.
 */
export async function responsablesDeEtapas(etapaIds: string[]): Promise<Map<string, Responsable[]>> {
  const resultado = new Map<string, Responsable[]>();
  const ids = [...new Set(etapaIds)];
  if (ids.length === 0) return resultado;

  const filas = await db
    .select({ etapaId: etapaResponsables.etapaId, ...CAMPOS })
    .from(etapaResponsables)
    .innerJoin(users, eq(users.id, etapaResponsables.usuarioId))
    .where(inArray(etapaResponsables.etapaId, ids));

  for (const { etapaId, ...r } of filas) {
    const lista = resultado.get(etapaId);
    if (lista) lista.push(r);
    else resultado.set(etapaId, [r]);
  }
  return resultado;
}

/**
 * `true` si `usuarioId` está entre los responsables ACTIVOS de esa etapa —
 * lo que antes decidía `cliente.operadorId === usuario.id`. Solo se consulta
 * para un operador: al admin `esOperadorAsignado` nunca lo usa
 * (`aplicarAccion`, ./reglas.ts), así que no vale la pena la consulta.
 */
export async function esResponsableDeEtapa(etapaId: string, usuarioId: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: etapaResponsables.id })
    .from(etapaResponsables)
    .innerJoin(users, eq(users.id, etapaResponsables.usuarioId))
    .where(and(eq(etapaResponsables.etapaId, etapaId), eq(etapaResponsables.usuarioId, usuarioId), eq(users.activo, true)))
    .limit(1);
  return !!fila;
}

/**
 * El único responsable de una etapa de un solo puesto (investigación, mapa de
 * pilares, manual de campaña: `PUESTOS_POR_ETAPA` les da un solo puesto, así
 * que como mucho hay una fila). `desarrollo_mensual` tiene dos puestos a la
 * vez y no pasa por aquí — usa `responsablesDeEtapa` directamente.
 */
export async function responsableUnicoDeEtapa(etapaId: string): Promise<Responsable | null> {
  const lista = await responsablesDeEtapa(etapaId);
  return lista[0] ?? null;
}

/** `true` si `puesto` es uno de los que responden por `etapa` (`PUESTOS_POR_ETAPA`). */
export function puestoValidoParaEtapa(etapa: Etapa, puesto: Puesto): boolean {
  return PUESTOS_POR_ETAPA[etapa].includes(puesto);
}

export type ResultadoAsignacion =
  | { ok: true }
  | { ok: false; razon: string };

/**
 * Asigna (o quita, con `usuarioId: null`) al responsable de UN puesto de una
 * etapa. Como `etapa_responsables_etapa_puesto` es único, asignar reemplaza
 * a quien estuviera antes en ese puesto — es exactamente el selector único
 * que pide la ficha (Strategist, Content Creator, Contenido, Diseño,
 * Trafficker): nunca una lista, una persona o «Sin asignar».
 *
 * Valida que `puesto` le corresponda a `etapa` y que `usuarioId` (si se da)
 * sea un operador activo con ESE puesto — nadie puede asignar, por ejemplo,
 * a un strategist como responsable de `pilares`.
 */
export async function asignarResponsable(o: {
  etapaId: string;
  etapa: Etapa;
  puesto: Puesto;
  usuarioId: string | null;
  asignadoPor: string;
}): Promise<ResultadoAsignacion> {
  if (!puestoValidoParaEtapa(o.etapa, o.puesto)) {
    return { ok: false, razon: `${o.puesto} no responde por esta etapa` };
  }

  if (o.usuarioId === null) {
    await db.delete(etapaResponsables).where(and(eq(etapaResponsables.etapaId, o.etapaId), eq(etapaResponsables.puesto, o.puesto)));
    return { ok: true };
  }

  const [candidato] = await db
    .select({ id: users.id, rol: users.rol, puesto: users.puesto, activo: users.activo })
    .from(users)
    .where(eq(users.id, o.usuarioId))
    .limit(1);
  if (!candidato || !candidato.activo || candidato.rol !== 'operador' || candidato.puesto !== o.puesto) {
    return { ok: false, razon: 'Ese usuario no es un operador activo de ese puesto' };
  }

  await db.transaction(async (tx) => {
    await tx.delete(etapaResponsables).where(and(eq(etapaResponsables.etapaId, o.etapaId), eq(etapaResponsables.puesto, o.puesto)));
    await tx.insert(etapaResponsables).values({
      etapaId: o.etapaId, usuarioId: o.usuarioId!, puesto: o.puesto, asignadoPor: o.asignadoPor,
    });
  });
  return { ok: true };
}

/** El id de la fila de `cliente_etapas` de (cliente, etapa), o `null` si no existe. */
export async function etapaIdDe(clientId: string, etapa: Etapa): Promise<string | null> {
  const [fila] = await db.select({ id: clienteEtapas.id }).from(clienteEtapas)
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, etapa))).limit(1);
  return fila?.id ?? null;
}

/**
 * Condición sobre `clients`: «clientes donde `usuarioId` es responsable de al
 * menos una etapa». Es el filtro `?responsable=` de /clientes y /desempeno,
 * que sustituye al viejo `?operador=` (por `clients.operador_id`).
 */
export function clientesDeResponsable(usuarioId: string): SQL {
  return sql`${clients.id} IN (SELECT ${clienteEtapas.clientId} FROM ${etapaResponsables} INNER JOIN ${clienteEtapas} ON ${clienteEtapas.id} = ${etapaResponsables.etapaId} WHERE ${etapaResponsables.usuarioId} = ${usuarioId})`;
}
