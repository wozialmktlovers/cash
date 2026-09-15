// Servicio del flujo de etapas por cliente (spec §3): contratación, consulta
// de etapas, transiciones y registro de entregables generados por los
// pipelines. Aquí sí hay acceso a base de datos; las reglas puras viven en
// ./reglas.ts (B2) y no se tocan.

import { and, desc, eq, sql } from 'drizzle-orm';
import {
  db, clienteEtapas, etapaEventos, comentarios, documentoVersiones,
  researchResults, growthResults, pilaresResults,
} from '@/db';
import {
  ETAPAS, aplicarAccion, dependenciasCumplidas, estadoTrasGenerar, tipoDocumentoDe, etapaDeTipo,
  type Etapa, type Accion, type EtapaCliente, type TipoDocumento,
} from './reglas';
import { investigacionUtil } from '@/lib/precheck';
import { clienteOperable } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';
import { notificar } from './avisos';

/** Tipo del `tx` que entrega `db.transaction`, reutilizado para pasar el mismo ejecutor a los helpers. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ejecutor = Tx | typeof db;

type MotivoVersion = 'generado' | 'edicion' | 'aprobada' | 'restaurada';
type FilaEtapa = typeof clienteEtapas.$inferSelect;

/** Se lanza cuando la actualización condicional pierde la carrera contra otra petición; nunca sale de este módulo. */
class CambioConcurrenteError extends Error {}

function paraReglas(f: FilaEtapa): EtapaCliente {
  return { id: f.id, etapa: f.etapa, contratada: f.contratada, interna: f.interna, estado: f.estado, documentoId: f.documentoId };
}

/**
 * `planContratacion`: pura. Devuelve las 4 etapas con su `contratada`/`interna`
 * a partir de la selección. Si se contratan `pilares` o `manual_campana` sin
 * `investigacion`, esta última queda interna (no se muestra al cliente ni
 * cuenta en su avance) — spec §3, Contratación.
 */
export function planContratacion(seleccion: Etapa[]): { etapa: Etapa; contratada: boolean; interna: boolean }[] {
  const set = new Set(seleccion);
  const necesitaInvestigacion = set.has('pilares') || set.has('manual_campana');
  return ETAPAS.map((etapa) => {
    const contratada = set.has(etapa);
    if (etapa === 'investigacion' && !contratada && necesitaInvestigacion) {
      return { etapa, contratada: false, interna: true };
    }
    return { etapa, contratada, interna: false };
  });
}

/**
 * Aplica `planContratacion` a un cliente: crea o actualiza las 4 filas.
 * Idempotente, así que sirve tanto para el alta (todo nuevo) como para el
 * PUT de la ficha (upsert sobre lo que ya exista).
 */
export async function aplicarPlanContratacion(clientId: string, seleccion: Etapa[]): Promise<void> {
  const plan = planContratacion(seleccion);
  await db.transaction(async (tx) => {
    for (const p of plan) {
      await tx.insert(clienteEtapas)
        .values({ clientId, etapa: p.etapa, contratada: p.contratada, interna: p.interna })
        .onConflictDoUpdate({
          target: [clienteEtapas.clientId, clienteEtapas.etapa],
          set: { contratada: p.contratada, interna: p.interna, actualizadoEn: new Date() },
        });
    }
  });
}

/**
 * Las 4 etapas del cliente, en el orden de `ETAPAS`. Crea las filas que
 * falten con el plan por omisión (investigación, pilares y manual
 * contratadas; desarrollo mensual no) — cubre clientes dados de alta antes
 * de B3, cuya migración ya las creó, pero deja la función correcta también
 * para cualquier hueco futuro.
 */
export async function etapasDelCliente(clientId: string): Promise<FilaEtapa[]> {
  const existentes = await db.select({ etapa: clienteEtapas.etapa }).from(clienteEtapas).where(eq(clienteEtapas.clientId, clientId));
  const presentes = new Set(existentes.map((e) => e.etapa));
  const faltantes = ETAPAS.filter((e) => !presentes.has(e));

  if (faltantes.length > 0) {
    const plan = planContratacion(['investigacion', 'pilares', 'manual_campana']).filter((p) => faltantes.includes(p.etapa));
    await db.insert(clienteEtapas)
      .values(plan.map((p) => ({ clientId, etapa: p.etapa, contratada: p.contratada, interna: p.interna })))
      .onConflictDoNothing({ target: [clienteEtapas.clientId, clienteEtapas.etapa] });
  }

  const filas = await db.select().from(clienteEtapas).where(eq(clienteEtapas.clientId, clientId));
  const orden = new Map(ETAPAS.map((e, i) => [e, i]));
  return filas.sort((a, b) => (orden.get(a.etapa) ?? 0) - (orden.get(b.etapa) ?? 0));
}

/** Datos vigentes del documento (research, growth o pilares) por su id. */
async function datosDelDocumento(ejecutor: Ejecutor, tipo: TipoDocumento, documentoId: string): Promise<unknown> {
  const tabla = tipo === 'growth' ? growthResults : tipo === 'pilares' ? pilaresResults : researchResults;
  const [fila] = await ejecutor.select({ datos: tabla.datos }).from(tabla).where(eq(tabla.id, documentoId)).limit(1);
  return fila?.datos ?? null;
}

/** Número de la última versión guardada de un documento, o `undefined` si no tiene ninguna (documentos previos a B3). */
async function ultimaVersion(ejecutor: Ejecutor, tipo: TipoDocumento, documentoId: string): Promise<number | undefined> {
  const [fila] = await ejecutor
    .select({ numero: documentoVersiones.numero })
    .from(documentoVersiones)
    .where(and(eq(documentoVersiones.documentoTipo, tipo), eq(documentoVersiones.documentoId, documentoId)))
    .orderBy(desc(documentoVersiones.numero))
    .limit(1);
  return fila?.numero;
}

/**
 * `guardarVersion`: numero = coalesce(max,0)+1 sobre las versiones existentes
 * del documento. Funciona igual para documentos previos a B3, que no tienen
 * ninguna versión guardada todavía (empiezan en 1).
 */
export async function guardarVersion(
  tipo: TipoDocumento,
  documentoId: string,
  datos: unknown,
  motivo: MotivoVersion,
  autorId: string | null,
  ejecutor: Ejecutor = db,
) {
  const [{ siguiente }] = await ejecutor
    .select({ siguiente: sql<number>`coalesce(max(${documentoVersiones.numero}), 0) + 1` })
    .from(documentoVersiones)
    .where(and(eq(documentoVersiones.documentoTipo, tipo), eq(documentoVersiones.documentoId, documentoId)));

  const [creada] = await ejecutor
    .insert(documentoVersiones)
    .values({ documentoTipo: tipo, documentoId, numero: siguiente, datos, motivo, autorId })
    .returning();
  return creada;
}

/** La fila de `cliente_etapas` para (clientId, etapa); la crea si no existe todavía. */
async function obtenerOCrearEtapa(tx: Tx, clientId: string, etapa: Etapa): Promise<FilaEtapa> {
  const [existente] = await tx.select().from(clienteEtapas)
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, etapa))).limit(1);
  if (existente) return existente;

  // El pipeline puede terminar antes de que exista la fila (cliente dado de
  // alta antes de B3, o un hueco en la migración): se crea contratada por
  // omisión, igual que `etapasDelCliente`, para no perder el entregable.
  await tx.insert(clienteEtapas).values({ clientId, etapa, contratada: true, interna: false })
    .onConflictDoNothing({ target: [clienteEtapas.clientId, clienteEtapas.etapa] });

  const [creada] = await tx.select().from(clienteEtapas)
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, etapa))).limit(1);
  if (!creada) throw new Error(`No se pudo crear la etapa ${etapa} para el cliente ${clientId}`);
  return creada;
}

/**
 * `registrarEntregable`: un pipeline llama a esto justo tras insertar su
 * resultado. Pone el documento como vigente, calcula el nuevo estado, guarda
 * una versión `generado`, inserta el evento y avisa al autor (no-op en B3).
 * Quien llama debe envolver esto en try/catch: un fallo aquí nunca debe
 * tumbar el job.
 */
export async function registrarEntregable(
  clientId: string,
  tipo: TipoDocumento,
  documentoId: string,
  usuarioId: string | null,
): Promise<void> {
  const etapa = etapaDeTipo(tipo);

  const { etapaId } = await db.transaction(async (tx) => {
    const fila = await obtenerOCrearEtapa(tx, clientId, etapa);
    const nuevoEstado = estadoTrasGenerar(fila.estado);

    await tx.update(clienteEtapas)
      .set({ documentoTipo: tipo, documentoId, estado: nuevoEstado, actualizadoEn: new Date() })
      .where(eq(clienteEtapas.id, fila.id));

    const datos = await datosDelDocumento(tx, tipo, documentoId);
    await guardarVersion(tipo, documentoId, datos, 'generado', usuarioId, tx);

    await tx.insert(etapaEventos).values({
      etapaId: fila.id, accion: 'generado', de: fila.estado, a: nuevoEstado, usuarioId, comentario: null,
    });

    return { etapaId: fila.id };
  });

  if (usuarioId) await notificar([usuarioId], { tipo: 'entregable_generado', etapaId, clientId, documentoTipo: tipo, documentoId });
}

/** Comentarios abiertos de la versión vigente de la etapa (0 si todavía no hay documento). */
async function comentariosAbiertosVigentes(ejecutor: Ejecutor, fila: FilaEtapa): Promise<number> {
  const tipo = tipoDocumentoDe(fila.etapa);
  if (!fila.documentoId || !tipo) return 0;
  const numero = await ultimaVersion(ejecutor, tipo, fila.documentoId);
  if (numero === undefined) return 0;
  const [{ n }] = await ejecutor
    .select({ n: sql<number>`count(*)::int` })
    .from(comentarios)
    .where(and(eq(comentarios.etapaId, fila.id), eq(comentarios.versionNumero, numero), eq(comentarios.estado, 'abierto')));
  return n;
}

export type ResultadoTransicion =
  | { ok: true; etapa: FilaEtapa }
  | { ok: false; status: 404 | 409; razon: string };

/**
 * `ejecutarTransicion`: carga la etapa y el cliente, aplica `aplicarAccion` y
 * actualiza de forma segura frente a carreras (la condición del UPDATE exige
 * el estado leído; si otra petición ya lo cambió, 409 «cambió mientras
 * tanto»). Si aprueba, guarda la versión aprobada; si pide cambios o reabre
 * con comentario general, lo crea con ancla `general`. Todo en una sola
 * transacción.
 */
export async function ejecutarTransicion(o: {
  etapaId: string;
  accion: Accion;
  usuario: UsuarioSesion;
  comentario?: string;
}): Promise<ResultadoTransicion> {
  const { etapaId, accion, usuario, comentario } = o;

  const [fila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, etapaId)).limit(1);
  if (!fila) return { ok: false, status: 404, razon: 'La etapa no existe' };

  // No visible u operable (incluye al cliente, que nunca opera aquí): 404, nunca 403,
  // para no confirmar la existencia de una etapa que ese usuario no puede tocar.
  const cliente = await clienteOperable(usuario, fila.clientId);
  if (!cliente) return { ok: false, status: 404, razon: 'La etapa no existe' };

  let hayInvestigacionConDatos = true;
  if (fila.etapa === 'pilares' || fila.etapa === 'manual_campana') {
    const investigaciones = await db
      .select({ datos: researchResults.datos, version: researchResults.version })
      .from(researchResults)
      .where(eq(researchResults.clientId, cliente.id));
    hayInvestigacionConDatos = Boolean(investigacionUtil(investigaciones));
  }

  const etapasCliente = await db.select().from(clienteEtapas).where(eq(clienteEtapas.clientId, cliente.id));
  const dependencias = dependenciasCumplidas(fila.etapa, etapasCliente.map(paraReglas), hayInvestigacionConDatos);
  const comentariosAbiertos = await comentariosAbiertosVigentes(db, fila);
  const comentarioGeneral = (comentario ?? '').trim();
  const esOperadorAsignado = cliente.operadorId === usuario.id;

  const r = aplicarAccion({
    etapa: paraReglas(fila),
    accion,
    rol: usuario.rol,
    esOperadorAsignado,
    comentariosAbiertos,
    comentarioGeneral,
    dependencias,
  });
  if (!r.ok) return { ok: false, status: 409, razon: r.razon };

  try {
    const actualizada = await db.transaction(async (tx) => {
      const [fresca] = await tx
        .update(clienteEtapas)
        .set({ estado: r.nuevo, actualizadoEn: new Date() })
        .where(and(eq(clienteEtapas.id, fila.id), eq(clienteEtapas.estado, fila.estado)))
        .returning();
      if (!fresca) throw new CambioConcurrenteError();

      if (accion === 'aprobar' && fila.documentoId) {
        const tipo = tipoDocumentoDe(fila.etapa)!;
        const datos = await datosDelDocumento(tx, tipo, fila.documentoId);
        const version = await guardarVersion(tipo, fila.documentoId, datos, 'aprobada', usuario.id, tx);
        await tx.update(clienteEtapas).set({ versionAprobadaId: version.id }).where(eq(clienteEtapas.id, fila.id));
        fresca.versionAprobadaId = version.id;
      }

      if ((accion === 'pedir_cambios' || accion === 'reabrir') && comentarioGeneral !== '' && fila.documentoId) {
        const tipo = tipoDocumentoDe(fila.etapa)!;
        const numero = (await ultimaVersion(tx, tipo, fila.documentoId)) ?? 1;
        await tx.insert(comentarios).values({
          etapaId: fila.id, documentoTipo: tipo, documentoId: fila.documentoId, versionNumero: numero,
          ancla: 'general', texto: comentarioGeneral, autorId: usuario.id, autorRol: usuario.rol, estado: 'abierto',
        });
      }

      await tx.insert(etapaEventos).values({
        etapaId: fila.id, accion, de: fila.estado, a: r.nuevo, usuarioId: usuario.id, comentario: comentario ?? null,
      });

      return fresca;
    });

    return { ok: true, etapa: actualizada };
  } catch (e) {
    if (e instanceof CambioConcurrenteError) return { ok: false, status: 409, razon: 'La etapa cambió mientras tanto, recarga' };
    throw e;
  }
}
