// Servicio del flujo de etapas por cliente (spec §3): contratación, consulta
// de etapas, transiciones y registro de entregables generados por los
// pipelines. Aquí sí hay acceso a base de datos; las reglas puras viven en
// ./reglas.ts (B2) y no se tocan.

import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import {
  db, clients, clienteEtapas, etapaEventos, comentarios, documentoVersiones,
  researchResults, growthResults, pilaresResults,
} from '@/db';
import {
  ETAPAS, NOMBRE_ETAPA, aplicarAccion, dependenciasCumplidas, estadoTrasGenerar, tipoDocumentoDe, etapaDeTipo,
  type Etapa, type Accion, type EtapaCliente, type TipoDocumento,
} from './reglas';
import { investigacionUtil } from '@/lib/precheck';
import { clienteOperable } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';
import { avisarJob, avisarTransicion, type EventoAviso } from './avisos';

/** Ruta interna para ver el documento vigente de una etapa (spec §3, Avisos: «enlace»). Exportada: la ficha (B5) la usa para el botón «Ver documento». */
export function enlaceDocumento(tipo: TipoDocumento, documentoId: string): string {
  if (tipo === 'growth') return `/growth/${documentoId}`;
  if (tipo === 'pilares') return `/pilares/${documentoId}`;
  return `/resultados/${documentoId}`;
}

/** Evento de aviso de cada acción que lo dispara; `iniciar` no avisa a nadie. */
const EVENTO_POR_ACCION: Partial<Record<Accion, EventoAviso>> = {
  solicitar: 'solicitud',
  pedir_cambios: 'cambios_pedidos',
  reabrir: 'reabierta',
  aprobar: 'aprobada',
};

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
 *
 * Acepta un `ejecutor` opcional para que quien ya tiene abierta una
 * transacción propia (el alta de cliente: insertar la fila de `clients` y
 * contratar sus etapas debe ser todo o nada) pase su `tx` y esto no abra una
 * segunda transacción anidada. Sin `ejecutor`, abre la suya.
 */
export async function aplicarPlanContratacion(clientId: string, seleccion: Etapa[], ejecutor?: Ejecutor): Promise<void> {
  const plan = planContratacion(seleccion);
  const aplicar = async (tx: Ejecutor) => {
    for (const p of plan) {
      await tx.insert(clienteEtapas)
        .values({ clientId, etapa: p.etapa, contratada: p.contratada, interna: p.interna })
        .onConflictDoUpdate({
          target: [clienteEtapas.clientId, clienteEtapas.etapa],
          set: { contratada: p.contratada, interna: p.interna, actualizadoEn: new Date() },
        });
    }
  };
  if (ejecutor) await aplicar(ejecutor);
  else await db.transaction((tx) => aplicar(tx));
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

/**
 * La etapa cuyo documento vigente es exactamente (tipo, documentoId); si
 * ninguna calza (se está editando/restaurando una versión que ya no es la
 * vigente de su etapa), cae a la etapa de ese tipo del cliente — B6 permite
 * editar igual un documento que no es el vigente (spec §3).
 */
export async function etapaDelDocumento(clientId: string, tipo: TipoDocumento, documentoId: string): Promise<FilaEtapa | null> {
  const etapas = await etapasDelCliente(clientId);
  const vigente = etapas.find((e) => e.documentoTipo === tipo && e.documentoId === documentoId);
  if (vigente) return vigente;
  return etapas.find((e) => e.etapa === etapaDeTipo(tipo)) ?? null;
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

  await db.transaction(async (tx) => {
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
  });

  // El aviso va después de que la transacción cerró, y nunca espera: un
  // fallo al avisar no debe tumbar el job que acaba de terminar.
  if (usuarioId) {
    const [clienteFila] = await db.select({ nombre: clients.nombre }).from(clients).where(eq(clients.id, clientId)).limit(1);
    void avisarJob({
      evento: 'entregable_generado',
      creadoPor: usuarioId,
      cliente: clienteFila?.nombre ?? 'Cliente',
      etapa: NOMBRE_ETAPA[etapa],
      enlace: enlaceDocumento(tipo, documentoId),
    }).catch((e) => console.error('[avisos] entregable_generado:', e));
  }
}

/**
 * Comentarios abiertos del documento vigente de cada etapa dada, en una sola
 * consulta agrupada (evita el N+1 de preguntar etapa por etapa al pintar la
 * línea de etapas completa — spec §3, ficha). Cuenta por `documentoTipo`+
 * `documentoId`, sin filtrar por `versionNumero`: un comentario se deja sobre
 * una versión concreta, pero sigue pendiente aunque `guardarVersion` guarde
 * una versión más nueva encima — una versión nueva nunca debe hacer
 * desaparecer en silencio un comentario sin atender. Solo cuenta comentarios
 * de primer nivel (`respuestaDe IS NULL`): una respuesta no es un pendiente
 * aparte, es parte del hilo del comentario al que respondió.
 *
 * El resultado trae una entrada en 0 para cada etapa recibida, aunque no
 * tenga comentarios (o no tenga documento todavía), para que el llamador
 * pueda indexar con `.get(etapaId)!` sin comprobar `undefined`.
 */
export async function comentariosAbiertosPorEtapa(filas: FilaEtapa[], ejecutor: Ejecutor = db): Promise<Map<string, number>> {
  const resultado = new Map<string, number>(filas.map((f) => [f.id, 0]));
  const conDocumento = filas.filter((f) => f.documentoId && tipoDocumentoDe(f.etapa));
  if (conDocumento.length === 0) return resultado;

  // Una condición OR por etapa (a lo más 4): cada una ancla el conteo al
  // documentoId vigente de esa etapa en concreto, igual que la versión de
  // una sola etapa que sustituye.
  const condicion = or(...conDocumento.map((f) =>
    and(eq(comentarios.etapaId, f.id), eq(comentarios.documentoTipo, tipoDocumentoDe(f.etapa)!), eq(comentarios.documentoId, f.documentoId!)),
  ))!;

  const filasConteo = await ejecutor
    .select({ etapaId: comentarios.etapaId, n: sql<number>`count(*)::int` })
    .from(comentarios)
    .where(and(condicion, eq(comentarios.estado, 'abierto'), isNull(comentarios.respuestaDe)))
    .groupBy(comentarios.etapaId);

  for (const f of filasConteo) resultado.set(f.etapaId, f.n);
  return resultado;
}

/** Comentarios abiertos del documento vigente de una sola etapa (0 si todavía no hay documento). */
async function comentariosAbiertosVigentes(ejecutor: Ejecutor, fila: FilaEtapa): Promise<number> {
  return (await comentariosAbiertosPorEtapa([fila], ejecutor)).get(fila.id) ?? 0;
}

export type ResultadoTransicion =
  | { ok: true; etapa: FilaEtapa }
  | { ok: false; status: 404 | 409; razon: string };

/**
 * `ejecutarTransicion`: carga la etapa y el cliente, aplica `aplicarAccion` y
 * actualiza de forma segura frente a carreras (la condición del UPDATE exige
 * el estado y el documento vigente leídos; si cualquiera de los dos cambió
 * mientras tanto, 409 «cambió mientras tanto»). Si aprueba, guarda la versión
 * aprobada; si pide cambios o reabre con comentario general, lo crea con
 * ancla `general`. Todo en una sola transacción.
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

  // `dependencias` solo lo mira `aplicarAccion` para `iniciar` (las demás
  // acciones ignoran el campo): para el resto no vale la pena la consulta de
  // investigación ni la de las 4 etapas del cliente.
  let dependencias: { ok: boolean; razon: string } = { ok: true, razon: '' };
  if (accion === 'iniciar') {
    let hayInvestigacionConDatos = true;
    if (fila.etapa === 'pilares' || fila.etapa === 'manual_campana') {
      const investigaciones = await db
        .select({ datos: researchResults.datos, version: researchResults.version })
        .from(researchResults)
        .where(eq(researchResults.clientId, cliente.id));
      hayInvestigacionConDatos = Boolean(investigacionUtil(investigaciones));
    }
    const etapasCliente = await db.select().from(clienteEtapas).where(eq(clienteEtapas.clientId, cliente.id));
    dependencias = dependenciasCumplidas(fila.etapa, etapasCliente.map(paraReglas), hayInvestigacionConDatos);
  }

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

  // La condición del UPDATE también fija `documento_id` al leído: sin esto,
  // un `generado` que llega entre la lectura y el UPDATE (el operador pide
  // autorización justo cuando el pipeline termina un documento nuevo) deja
  // pasar la condición de `estado` igual y `aprobar` enlazaría la versión del
  // documento nuevo como si fuera la que el admin acaba de revisar.
  const condicionDocumento = fila.documentoId === null
    ? isNull(clienteEtapas.documentoId)
    : eq(clienteEtapas.documentoId, fila.documentoId);

  try {
    const actualizada = await db.transaction(async (tx) => {
      const [fresca] = await tx
        .update(clienteEtapas)
        .set({ estado: r.nuevo, actualizadoEn: new Date() })
        .where(and(eq(clienteEtapas.id, fila.id), eq(clienteEtapas.estado, fila.estado), condicionDocumento))
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

    // El aviso va después de que la transacción cerró (nunca dentro), y sin
    // esperarlo: un fallo al avisar no debe tumbar la respuesta de la transición.
    const evento = EVENTO_POR_ACCION[accion];
    if (evento) {
      void avisarTransicion({
        evento,
        actorId: usuario.id,
        clientId: cliente.id,
        operadorId: cliente.operadorId,
        etapaVisibleCliente: fila.contratada && !fila.interna,
        cliente: cliente.nombre,
        etapa: NOMBRE_ETAPA[fila.etapa],
        autor: usuario.nombre ?? usuario.email,
        enlace: `/clientes/${cliente.id}`,
      }).catch((e) => console.error('[avisos] transicion:', e));
    }

    return { ok: true, etapa: actualizada };
  } catch (e) {
    if (e instanceof CambioConcurrenteError) return { ok: false, status: 409, razon: 'La etapa cambió mientras tanto, recarga' };
    throw e;
  }
}
