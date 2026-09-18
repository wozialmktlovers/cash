// Las consultas a la base del arte de los anuncios, y nada más: ni permisos
// ni reglas. Viven aparte de `./artes.ts` para que las pruebas de permisos
// cambien la base por datos en memoria sin simular Drizzle, y comprueben las
// decisiones reales del servicio (quién sube, quién ve, qué token abre qué).

import { and, asc, eq, max } from 'drizzle-orm';
import { db, growthArtes, growthResults, clients, clienteEtapas, documentoVersiones } from '@/db';
import { leerShareLink } from '@/lib/share';
import type { ArteGrowth } from './artes-reglas';

/** El manual y lo mínimo de su cliente para decidir permisos. */
export type ManualConCliente = {
  growthId: string;
  datos: unknown;
  cliente: { id: string; operadorId: string | null };
};

export async function manualConCliente(growthId: string): Promise<ManualConCliente | null> {
  const [fila] = await db
    .select({ growthId: growthResults.id, datos: growthResults.datos, clienteId: clients.id, operadorId: clients.operadorId })
    .from(growthResults)
    .innerJoin(clients, eq(clients.id, growthResults.clientId))
    .where(eq(growthResults.id, growthId))
    .limit(1);
  if (!fila) return null;
  return { growthId: fila.growthId, datos: fila.datos, cliente: { id: fila.clienteId, operadorId: fila.operadorId } };
}

const COLUMNAS_VISTA = {
  id: growthArtes.id,
  creativo: growthArtes.creativo,
  orden: growthArtes.orden,
  tipo: growthArtes.tipo,
  mime: growthArtes.mime,
  url: growthArtes.url,
  nombreOriginal: growthArtes.nombreOriginal,
};

/** Todos los artes guardados de un manual, huérfanos incluidos (los filtra `acomodarArtes`). */
export async function artesDelManual(growthId: string): Promise<ArteGrowth[]> {
  const filas = await db.select(COLUMNAS_VISTA).from(growthArtes)
    .where(eq(growthArtes.growthId, growthId))
    .orderBy(asc(growthArtes.creativo), asc(growthArtes.orden));
  return filas as ArteGrowth[];
}

/** El orden más alto guardado para un anuncio, o -1 si no tiene ninguno. */
export async function maxOrden(growthId: string, creativo: number): Promise<number> {
  const [fila] = await db.select({ m: max(growthArtes.orden) }).from(growthArtes)
    .where(and(eq(growthArtes.growthId, growthId), eq(growthArtes.creativo, creativo)));
  return fila?.m ?? -1;
}

/** Un arte guardado, con lo necesario para servirlo o borrarlo. */
export type ArteGuardado = ArteGrowth & { growthId: string; ruta: string | null };

/** Un arte de ESE manual: el id solo no basta, tiene que colgar del documento que se pide. */
export async function arteDelManual(growthId: string, arteId: string): Promise<ArteGuardado | null> {
  const [fila] = await db.select({ ...COLUMNAS_VISTA, growthId: growthArtes.growthId, ruta: growthArtes.ruta })
    .from(growthArtes)
    .where(and(eq(growthArtes.id, arteId), eq(growthArtes.growthId, growthId)))
    .limit(1);
  return (fila as ArteGuardado | undefined) ?? null;
}

export type NuevoArte = {
  growthId: string;
  creativo: number;
  orden: number;
  autorId: string;
} & (
  | { tipo: 'archivo'; ruta: string; mime: string; nombreOriginal: string; bytes: number }
  | { tipo: 'enlace'; url: string }
);

/**
 * Pone un arte en su hueco, quitando el que hubiera, en una sola transacción.
 * Devuelve el arte nuevo y la ruta del archivo reemplazado (si era archivo),
 * para que quien llama lo borre del disco DESPUÉS de confirmar: si la
 * transacción falla, el archivo viejo sigue siendo el bueno.
 */
export async function ponerArte(n: NuevoArte): Promise<{ arte: ArteGrowth; rutaAnterior: string | null }> {
  return db.transaction(async (tx) => {
    const [anterior] = await tx.delete(growthArtes)
      .where(and(eq(growthArtes.growthId, n.growthId), eq(growthArtes.creativo, n.creativo), eq(growthArtes.orden, n.orden)))
      .returning({ ruta: growthArtes.ruta });
    const [arte] = await tx.insert(growthArtes).values({
      growthId: n.growthId,
      creativo: n.creativo,
      orden: n.orden,
      tipo: n.tipo,
      autorId: n.autorId,
      ...(n.tipo === 'archivo'
        ? { ruta: n.ruta, mime: n.mime, nombreOriginal: n.nombreOriginal, bytes: n.bytes }
        : { url: n.url }),
    }).returning(COLUMNAS_VISTA);
    return { arte: arte as ArteGrowth, rutaAnterior: anterior?.ruta ?? null };
  });
}

/** Quita un arte de ESE manual; devuelve su ruta en disco (o `null` si era enlace), o `undefined` si no existía. */
export async function quitarArte(growthId: string, arteId: string): Promise<{ ruta: string | null } | undefined> {
  const [borrado] = await db.delete(growthArtes)
    .where(and(eq(growthArtes.id, arteId), eq(growthArtes.growthId, growthId)))
    .returning({ ruta: growthArtes.ruta });
  return borrado;
}

/** El cliente de un manual por su id, para el permiso del portal. */
export async function cliente(clientId: string): Promise<{ id: string; operadorId: string | null } | null> {
  const [c] = await db.select({ id: clients.id, operadorId: clients.operadorId }).from(clients)
    .where(eq(clients.id, clientId)).limit(1);
  return c ?? null;
}

/** La etapa del portal y, si la tiene, el documento de su versión autorizada. */
export async function etapaConVersion(etapaId: string): Promise<{
  clientId: string; contratada: boolean; interna: boolean;
  version: { documentoTipo: string; documentoId: string } | null;
} | null> {
  const [e] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, etapaId)).limit(1);
  if (!e) return null;
  let version: { documentoTipo: string; documentoId: string } | null = null;
  if (e.versionAprobadaId) {
    const [v] = await db.select({ documentoTipo: documentoVersiones.documentoTipo, documentoId: documentoVersiones.documentoId })
      .from(documentoVersiones).where(eq(documentoVersiones.id, e.versionAprobadaId)).limit(1);
    version = v ?? null;
  }
  return { clientId: e.clientId, contratada: e.contratada, interna: e.interna, version };
}

/** El enlace público vigente (existe y no está revocado), sin contar visita. */
export async function enlacePublico(token: string) {
  return leerShareLink(token);
}
