// Servicio del flujo de etapas por cliente (spec §3): contratación, consulta
// de etapas, transiciones y registro de entregables generados por los
// pipelines. Aquí sí hay acceso a base de datos; las reglas puras viven en
// ./reglas.ts (B2) y no se tocan.

import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  db, clients, clienteEtapas, etapaEventos, comentarios, documentoVersiones, users,
  researchResults, growthResults, pilaresResults,
} from '@/db';
import {
  ETAPAS, NOMBRE_ETAPA, aplicarAccion, dependenciasCumplidas, estadoTrasGenerar, estadoTrasComentarioCliente,
  tipoDocumentoDe, etapaDeTipo, puedeComentar,
  type Etapa, type Accion, type EtapaCliente, type TipoDocumento, type Rol,
} from './reglas';
import { puedeCambiarEstadoComentario, comentariosVisibles, esDeOtraVersion, type EstadoComentario } from './comentarios';
import { investigacionUtil } from '@/lib/precheck';
import { clienteOperable, clienteVisible, esUuid } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';
import { avisarJob, avisarTransicion, avisarComentarioCliente, avisarRespuestaCliente, type EventoAviso } from './avisos';

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
 * Registra un evento por cada cambio de contratación que un operador no
 * podría hacer (`cambiosContratacionRiesgosos`, fix I1 punto 3) pero que un
 * admin sí aplicó — regla del dueño: «el admin sí puede, pero el cambio
 * queda registrado». La contratación no toca `estado`, así que `de` y `a`
 * quedan iguales (la columna es NOT NULL); lo que cambió va en el
 * `comentario`, con la misma razón que hubiera bloqueado a un operador.
 * Se llama DESPUÉS de `aplicarPlanContratacion`, así que lee las etapas ya
 * actualizadas solo para resolver el `etapaId` de cada una.
 */
export async function registrarEventosContratacion(
  clientId: string,
  riesgos: { etapa: Etapa; razon: string }[],
  usuarioId: string,
): Promise<void> {
  if (riesgos.length === 0) return;
  const actuales = await db.select().from(clienteEtapas).where(eq(clienteEtapas.clientId, clientId));
  const porEtapa = new Map(actuales.map((f) => [f.etapa, f]));

  for (const riesgo of riesgos) {
    const fila = porEtapa.get(riesgo.etapa);
    if (!fila) continue;
    await db.insert(etapaEventos).values({
      etapaId: fila.id, accion: 'contratacion', de: fila.estado, a: fila.estado, usuarioId, comentario: riesgo.razon,
    });
  }
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

/**
 * La fila de `cliente_etapas` para (clientId, etapa), BLOQUEADA (`FOR
 * UPDATE`) hasta que la transacción de quien llama cierre — la crea primero
 * si no existe todavía. Mismo candado que ya usan las rutas de edición de
 * documentos (`api/documentos/[tipo]/[id].ts`) para su propia fila de etapa:
 * sin él, `registrarEntregable` podía leer el estado con un SELECT suelto y
 * hacer un UPDATE incondicional después, pisando una transición concurrente
 * (`solicitar` o `aprobar` cerrando justo cuando el job termina) — fix wave,
 * punto 1.
 */
async function obtenerOCrearEtapaBloqueada(tx: Tx, clientId: string, etapa: Etapa): Promise<FilaEtapa> {
  // El pipeline puede terminar antes de que exista la fila (cliente dado de
  // alta antes de B3, o un hueco en la migración): se crea contratada por
  // omisión, igual que `etapasDelCliente`, para no perder el entregable.
  // `onConflictDoNothing` la deja intacta si ya existía — el candado real es
  // el SELECT ... FOR UPDATE de abajo, no este insert.
  await tx.insert(clienteEtapas).values({ clientId, etapa, contratada: true, interna: false })
    .onConflictDoNothing({ target: [clienteEtapas.clientId, clienteEtapas.etapa] });

  const [fila] = await tx.select().from(clienteEtapas)
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, etapa)))
    .for('update').limit(1);
  if (!fila) throw new Error(`No se pudo crear la etapa ${etapa} para el cliente ${clientId}`);
  return fila;
}

/**
 * `registrarEntregable`: un pipeline llama a esto justo tras insertar su
 * resultado. Pone el documento como vigente, calcula el nuevo estado, guarda
 * una versión `generado`, inserta el evento y avisa al autor (no-op en B3).
 * Quien llama debe envolver esto en try/catch: un fallo aquí nunca debe
 * tumbar el job.
 *
 * La fila de etapa se lee con `FOR UPDATE` (`obtenerOCrearEtapaBloqueada`)
 * ANTES de calcular `estadoTrasGenerar`, y todo — lectura, cálculo y UPDATE —
 * ocurre dentro de la misma transacción, sobre esa fila bloqueada: si
 * `solicitar` o `aprobar` está a la mitad de su propia transacción sobre la
 * misma fila, esta espera a que termine (y lee el estado ya actualizado);
 * si esta corre primero, la otra transición espera al revés. Sin el candado,
 * un SELECT suelto seguido de un UPDATE incondicional podía leer el estado
 * de antes de una transición concurrente y luego pisarla sin condición
 * alguna — por ejemplo, un `aprobar` que cierra justo cuando este job
 * termina quedaría sobreescrito a `con_cambios` aunque el admin ya hubiera
 * aprobado el documento anterior (fix wave, punto 1).
 */
export async function registrarEntregable(
  clientId: string,
  tipo: TipoDocumento,
  documentoId: string,
  usuarioId: string | null,
): Promise<void> {
  const etapa = etapaDeTipo(tipo);

  await db.transaction(async (tx) => {
    const fila = await obtenerOCrearEtapaBloqueada(tx, clientId, etapa);
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
 * Comentarios abiertos de cada etapa dada, en una sola consulta agrupada
 * (evita el N+1 de preguntar etapa por etapa al pintar la línea de etapas
 * completa — spec §3, ficha). Cuenta por `etapaId`, SIN filtrar por
 * documento (fix round 1): una observación pendiente no debe desaparecer ni
 * dejar de bloquear `solicitar` solo porque el pipeline regeneró el
 * documento y la etapa apunta ahora a otro `documentoId` — quien la dejó
 * sigue esperando una respuesta, y el conteo es justo lo que `aplicarAccion`
 * usa para decidir si `solicitar` está permitido. Solo cuenta comentarios de
 * primer nivel (`respuestaDe IS NULL`): una respuesta no es un pendiente
 * aparte, es parte del hilo del comentario al que respondió.
 *
 * El resultado trae una entrada en 0 para cada etapa recibida, aunque no
 * tenga comentarios, para que el llamador pueda indexar con `.get(etapaId)!`
 * sin comprobar `undefined`.
 *
 * Solo necesita el `id` de cada etapa (fix wave, punto 6): el tipo del
 * parámetro es deliberadamente más angosto que `FilaEtapa[]` para que
 * también sirva con proyecciones parciales de `cliente_etapas` — como la
 * lista `conCambios` de `/pendientes`, que no trae `contratada`/`interna` —
 * sin forzar a quien llama a pedir la fila completa solo para este conteo.
 */
export async function comentariosAbiertosPorEtapa(filas: { id: string }[], ejecutor: Ejecutor = db): Promise<Map<string, number>> {
  const resultado = new Map<string, number>(filas.map((f) => [f.id, 0]));
  if (filas.length === 0) return resultado;

  const filasConteo = await ejecutor
    .select({ etapaId: comentarios.etapaId, n: sql<number>`count(*)::int` })
    .from(comentarios)
    .where(and(inArray(comentarios.etapaId, filas.map((f) => f.id)), eq(comentarios.estado, 'abierto'), isNull(comentarios.respuestaDe)))
    .groupBy(comentarios.etapaId);

  for (const f of filasConteo) resultado.set(f.etapaId, f.n);
  return resultado;
}

/** Comentarios abiertos de una sola etapa, en cualquier documento (0 si no hay ninguno). */
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

  // Un id sin forma de UUID nunca va a existir (fix wave, punto 4): cortar
  // aquí da 404, igual que el resto de estas funciones (`crearComentarioInterno`,
  // `listarComentarios`…) — sin esto, Postgres tira un error de tipo y la
  // ruta responde 500 en vez del 404 que le toca a un id inventado.
  if (!esUuid(etapaId)) return { ok: false, status: 404, razon: 'La etapa no existe' };

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

// ─────────────────────────────────────────────────────────────────────────
// Comentarios anclados (B7, spec §3 «Comentarios anclados» y §4 «observaciones
// del cliente»). Las reglas puras viven en ./comentarios; aquí solo hay
// acceso a base de datos: cargar la etapa y el cliente, decidir visibilidad
// y permiso, y aplicar el cambio. `texto` y `ancla` ya llegan validados
// (`validarComentario`, en las rutas) — estas funciones no repiten esa
// validación de forma, solo la de permiso y estado.
// ─────────────────────────────────────────────────────────────────────────

type FilaComentario = typeof comentarios.$inferSelect;

export type ResultadoComentario =
  | { ok: true; comentario: FilaComentario }
  | { ok: false; status: 404 | 409; razon: string };

const RAZON_ETAPA_INEXISTENTE = 'La etapa no existe';
const RAZON_COMENTARIO_INEXISTENTE = 'El comentario no existe';

/**
 * Comentario de un usuario interno (admin u operador asignado): sobre el
 * documento VIGENTE de la etapa (spec §3, «el documento y la versión vienen
 * de la etapa: vigente para usuarios internos»). Sin permiso de ver el
 * cliente, 404; sin documento todavía, 409 «Esta etapa aún no tiene
 * documento» (misma razón que usa `aplicarAccion` para `solicitar`).
 */
export async function crearComentarioInterno(o: {
  etapaId: string; usuario: UsuarioSesion; ancla: string; texto: string;
}): Promise<ResultadoComentario> {
  if (!esUuid(o.etapaId)) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  const [fila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, o.etapaId)).limit(1);
  if (!fila) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  const cliente = await clienteVisible(o.usuario, fila.clientId);
  if (!cliente) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  const esOperadorAsignado = cliente.operadorId === o.usuario.id;
  if (!puedeComentar(o.usuario.rol, esOperadorAsignado, fila.etapa)) {
    return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  }
  if (!fila.documentoTipo || !fila.documentoId) {
    return { ok: false, status: 409, razon: 'Esta etapa aún no tiene documento' };
  }

  const numero = (await ultimaVersion(db, fila.documentoTipo, fila.documentoId)) ?? 1;
  const [creado] = await db.insert(comentarios).values({
    etapaId: fila.id, documentoTipo: fila.documentoTipo, documentoId: fila.documentoId, versionNumero: numero,
    ancla: o.ancla, texto: o.texto, autorId: o.usuario.id, autorRol: o.usuario.rol,
  }).returning();

  return { ok: true, comentario: creado };
}

/**
 * Comentario (observación) del cliente: solo `manual_campana` y
 * `desarrollo_mensual`, contratada y no interna, y solo sobre la versión
 * APROBADA (spec §4, «rinde la versión aprobada»). En una sola transacción:
 * inserta el comentario, aplica `estadoTrasComentarioCliente` con un UPDATE
 * condicionado al estado leído (si cambió mientras tanto, 409 «cambió
 * mientras tanto, recarga» — mismo criterio que `ejecutarTransicion`) e
 * inserta el evento `comentario_cliente`. El aviso va después de que la
 * transacción cerró, sin esperarlo.
 */
export async function crearComentarioCliente(o: {
  etapaId: string; usuario: UsuarioSesion; ancla: string; texto: string;
}): Promise<ResultadoComentario> {
  const { usuario } = o;
  if (usuario.rol !== 'cliente' || !usuario.clientId) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  if (!esUuid(o.etapaId)) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  const [fila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, o.etapaId)).limit(1);
  if (!fila) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  if (fila.clientId !== usuario.clientId) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  if (!fila.contratada || fila.interna) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
  if (!puedeComentar('cliente', false, fila.etapa)) {
    return { ok: false, status: 409, razon: 'Aquí no se pueden dejar observaciones' };
  }
  if (!fila.versionAprobadaId) {
    return { ok: false, status: 409, razon: 'Todavía no hay una versión aprobada para comentar' };
  }

  const [version] = await db.select().from(documentoVersiones).where(eq(documentoVersiones.id, fila.versionAprobadaId)).limit(1);
  if (!version) return { ok: false, status: 409, razon: 'Todavía no hay una versión aprobada para comentar' };

  const [clienteFila] = await db.select({ nombre: clients.nombre, operadorId: clients.operadorId }).from(clients).where(eq(clients.id, fila.clientId)).limit(1);
  if (!clienteFila) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  try {
    let creado!: FilaComentario;
    let nuevoEstado = fila.estado;

    await db.transaction(async (tx) => {
      [creado] = await tx.insert(comentarios).values({
        etapaId: fila.id, documentoTipo: version.documentoTipo, documentoId: version.documentoId, versionNumero: version.numero,
        ancla: o.ancla, texto: o.texto, autorId: usuario.id, autorRol: 'cliente',
      }).returning();

      nuevoEstado = estadoTrasComentarioCliente(fila.etapa, fila.estado);
      if (nuevoEstado !== fila.estado) {
        const actualizada = await tx.update(clienteEtapas)
          .set({ estado: nuevoEstado, actualizadoEn: new Date() })
          .where(and(eq(clienteEtapas.id, fila.id), eq(clienteEtapas.estado, fila.estado)))
          .returning();
        if (!actualizada.length) throw new CambioConcurrenteError();
      }

      await tx.insert(etapaEventos).values({
        etapaId: fila.id, accion: 'comentario_cliente', de: fila.estado, a: nuevoEstado, usuarioId: usuario.id, comentario: null,
      });
    });

    void avisarComentarioCliente({
      actorId: usuario.id,
      clientId: fila.clientId,
      operadorId: clienteFila.operadorId,
      cliente: clienteFila.nombre,
      etapa: NOMBRE_ETAPA[fila.etapa],
      enlace: `/clientes/${fila.clientId}`,
    }).catch((e) => console.error('[avisos] comentario_cliente:', e));

    return { ok: true, comentario: creado };
  } catch (e) {
    if (e instanceof CambioConcurrenteError) return { ok: false, status: 409, razon: 'La etapa cambió mientras tanto, recarga' };
    throw e;
  }
}

/**
 * Respuesta a un comentario de primer nivel (spec §3, «Responder»): el
 * cliente solo responde en sus propios hilos; el personal, en cualquiera que
 * pueda ver. Nunca a una respuesta (un solo nivel de anidado). Si quien
 * responde no es el cliente y el hilo lo abrió un cliente, avisa a su autor
 * (evento `respuesta_cliente`, spec §4 «Actividad reciente»).
 */
export async function responderComentario(o: {
  comentarioId: string; usuario: UsuarioSesion; texto: string;
}): Promise<ResultadoComentario> {
  const { usuario } = o;
  if (!esUuid(o.comentarioId)) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  const [padre] = await db.select().from(comentarios).where(eq(comentarios.id, o.comentarioId)).limit(1);
  if (!padre) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  const [etapaFila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, padre.etapaId)).limit(1);
  if (!etapaFila) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  // Visibilidad ANTES que cualquier otra cosa que distinga por qué falla
  // (fix round 1, punto 4): si no lo puede ver, siempre 404 «no existe» —
  // nunca un 409 que confirme que el id sí corresponde a una respuesta real
  // que esta persona no tiene por qué poder mirar.
  if (usuario.rol === 'cliente') {
    if (usuario.clientId !== etapaFila.clientId || padre.autorRol !== 'cliente' || padre.autorId !== usuario.id) {
      return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };
    }
  } else {
    const cliente = await clienteVisible(usuario, etapaFila.clientId);
    if (!cliente) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };
  }

  if (padre.respuestaDe !== null) return { ok: false, status: 409, razon: 'Solo se puede responder a un comentario principal' };

  const [creado] = await db.insert(comentarios).values({
    etapaId: padre.etapaId, documentoTipo: padre.documentoTipo, documentoId: padre.documentoId, versionNumero: padre.versionNumero,
    ancla: padre.ancla, texto: o.texto, autorId: usuario.id, autorRol: usuario.rol, respuestaDe: padre.id,
  }).returning();

  if (usuario.rol !== 'cliente' && padre.autorRol === 'cliente' && padre.autorId) {
    const [clienteFila] = await db.select({ nombre: clients.nombre }).from(clients).where(eq(clients.id, etapaFila.clientId)).limit(1);
    void avisarRespuestaCliente({
      actorId: usuario.id,
      autorComentarioId: padre.autorId,
      cliente: clienteFila?.nombre ?? 'Cliente',
      etapa: NOMBRE_ETAPA[etapaFila.etapa],
    }).catch((e) => console.error('[avisos] respuesta_cliente:', e));
  }

  return { ok: true, comentario: creado };
}

/**
 * Cambia el estado de un comentario de primer nivel (spec §3, «Marcar
 * atendido»/«Descartar»): `puedeCambiarEstadoComentario` decide quién puede.
 * El cliente nunca llega aquí (sin permiso, 404). `resueltoPor`/`resueltoEn`
 * se fijan al marcar `atendido`/`descartado` y se limpian al reabrir.
 */
export async function cambiarEstadoComentario(o: {
  comentarioId: string; usuario: UsuarioSesion; estado: EstadoComentario;
}): Promise<ResultadoComentario> {
  const { usuario } = o;
  if (!esUuid(o.comentarioId)) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  const [fila] = await db.select().from(comentarios).where(eq(comentarios.id, o.comentarioId)).limit(1);
  if (!fila) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  // Visibilidad ANTES que la forma del comentario (fix round 1, punto 4):
  // el cliente nunca puede, y sin poder ver al cliente dueño, 404 — ninguno
  // de los dos debe distinguirse de «no existe» por un 409 que confirme que
  // el id sí es una respuesta real.
  if (usuario.rol === 'cliente') return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  const [etapaFila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, fila.etapaId)).limit(1);
  if (!etapaFila) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  const cliente = await clienteVisible(usuario, etapaFila.clientId);
  if (!cliente) return { ok: false, status: 404, razon: RAZON_COMENTARIO_INEXISTENTE };

  if (fila.respuestaDe !== null) return { ok: false, status: 409, razon: 'Solo se puede cambiar el estado de un comentario principal' };

  const esOperadorAsignado = cliente.operadorId === usuario.id;
  if (!puedeCambiarEstadoComentario(usuario.rol, esOperadorAsignado, o.estado)) {
    return { ok: false, status: 409, razon: 'No tienes permiso para cambiar el estado de este comentario' };
  }

  const resuelto = o.estado !== 'abierto';
  const [actualizado] = await db.update(comentarios).set({
    estado: o.estado,
    resueltoPor: resuelto ? usuario.id : null,
    resueltoEn: resuelto ? new Date() : null,
  }).where(eq(comentarios.id, fila.id)).returning();

  return { ok: true, comentario: actualizado };
}

export type ComentarioSalida = {
  id: string;
  ancla: string;
  texto: string;
  estado: EstadoComentario;
  respuestaDe: string | null;
  /**
   * `null` cuando quien lo ve es el cliente y el autor es del equipo (fix
   * wave, punto 7): `autor` ya se anonimiza como «Equipo Wozial», pero
   * mandar el rol real dejaba que el panel del portal pintara «Equipo
   * Wozial · Admin» o «Equipo Wozial · Operador» — la misma fuga de
   * identidad que el punto 2 le cerró a los avisos. Para el personal (que sí
   * ve el rol de todos) siempre trae el valor real.
   */
  autorRol: Rol | null;
  autor: string;
  versionNumero: number;
  creadoEn: Date;
  /** `true` si este comentario quedó en un documento que ya no es el vigente de la etapa (fix round 1): el panel lo marca «De una versión anterior» y deshabilita «Ir». Siempre `false` para el cliente, que no distingue versión. */
  deOtraVersion: boolean;
};

function nombreInterno(nombre: string | null, email: string): string {
  return nombre ?? email;
}

type FilaComentarioConAutor = {
  id: string; ancla: string; texto: string; estado: EstadoComentario; respuestaDe: string | null;
  autorId: string | null; autorRol: Rol; versionNumero: number; creadoEn: Date;
  documentoTipo: TipoDocumento; documentoId: string;
  autorNombre: string | null; autorEmail: string | null;
};

const CAMPOS_COMENTARIO = {
  id: comentarios.id, ancla: comentarios.ancla, texto: comentarios.texto, estado: comentarios.estado,
  respuestaDe: comentarios.respuestaDe, autorId: comentarios.autorId, autorRol: comentarios.autorRol,
  versionNumero: comentarios.versionNumero, creadoEn: comentarios.creadoEn,
  documentoTipo: comentarios.documentoTipo, documentoId: comentarios.documentoId,
  autorNombre: users.nombre, autorEmail: users.email,
};

function paraSalidaInterna(f: FilaComentarioConAutor, doc: { tipo: TipoDocumento; id: string } | null): ComentarioSalida {
  return {
    id: f.id, ancla: f.ancla, texto: f.texto, estado: f.estado, respuestaDe: f.respuestaDe,
    autorRol: f.autorRol, autor: nombreInterno(f.autorNombre, f.autorEmail ?? 'Wozial'),
    versionNumero: f.versionNumero, creadoEn: f.creadoEn,
    deOtraVersion: esDeOtraVersion({ documentoTipo: f.documentoTipo, documentoId: f.documentoId }, doc),
  };
}

/**
 * Lista de comentarios de una etapa (spec §3, `GET /api/comentarios?etapa=`).
 *
 * El personal ve, por omisión, los del documento vigente MÁS todos los
 * comentarios de primer nivel todavía `abierto` que quedaron en un documento
 * anterior de la misma etapa (con sus respuestas), marcados
 * `deOtraVersion: true` — fix round 1: una observación no atendida no debe
 * volverse invisible solo porque el pipeline regeneró el documento antes de
 * que alguien la resolviera. Con `?todos=1` no hay filtro de documento en
 * absoluto (todas las versiones, cualquier estado), pero `deOtraVersion`
 * sigue calculándose igual contra el documento vigente de hoy.
 *
 * El cliente ve sus propios hilos (`comentariosVisibles`) en CUALQUIER
 * documento de la etapa, no solo el de la versión aprobada actual — fix
 * round 1: si el admin reabre y vuelve a aprobar sobre un documento nuevo,
 * el cliente no debe perder de vista lo que ya comentó. Los autores internos
 * se anonimizan como «Equipo Wozial» (spec §3).
 */
export async function listarComentarios(o: {
  etapaId: string; usuario: UsuarioSesion; todasVersiones: boolean;
}): Promise<{ ok: true; comentarios: ComentarioSalida[] } | { ok: false; status: 404; razon: string }> {
  const { usuario } = o;
  if (!esUuid(o.etapaId)) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  const [fila] = await db.select().from(clienteEtapas).where(eq(clienteEtapas.id, o.etapaId)).limit(1);
  if (!fila) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  if (usuario.rol === 'cliente') {
    if (usuario.clientId !== fila.clientId || !fila.contratada || fila.interna) {
      return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };
    }

    // Sin filtro de documento: el cliente ve sus hilos aunque hayan quedado
    // en una versión que ya no es la aprobada actual.
    const todos = await db.select(CAMPOS_COMENTARIO).from(comentarios)
      .leftJoin(users, eq(users.id, comentarios.autorId))
      .where(eq(comentarios.etapaId, fila.id))
      .orderBy(desc(comentarios.creadoEn));

    const visibles = comentariosVisibles('cliente', usuario.id, todos);
    return {
      ok: true,
      comentarios: visibles.map((f) => ({
        id: f.id, ancla: f.ancla, texto: f.texto, estado: f.estado, respuestaDe: f.respuestaDe,
        // Mismo criterio que `autor`: el cliente nunca ve el rol real de un
        // autor del equipo, solo el suyo propio (fix wave, punto 7).
        autorRol: f.autorRol === 'cliente' ? f.autorRol : null,
        autor: f.autorRol === 'cliente' ? nombreInterno(f.autorNombre, f.autorEmail ?? 'Tú') : 'Equipo Wozial',
        versionNumero: f.versionNumero, creadoEn: f.creadoEn, deOtraVersion: false,
      })),
    };
  }

  const cliente = await clienteVisible(usuario, fila.clientId);
  if (!cliente) return { ok: false, status: 404, razon: RAZON_ETAPA_INEXISTENTE };

  const doc = fila.documentoTipo && fila.documentoId ? { tipo: fila.documentoTipo, id: fila.documentoId } : null;

  if (o.todasVersiones) {
    const todos = await db.select(CAMPOS_COMENTARIO).from(comentarios)
      .leftJoin(users, eq(users.id, comentarios.autorId))
      .where(eq(comentarios.etapaId, fila.id))
      .orderBy(desc(comentarios.creadoEn));
    return { ok: true, comentarios: todos.map((f) => paraSalidaInterna(f, doc)) };
  }

  // Del documento vigente, cualquier estado (igual que antes de este fix).
  const delVigente = doc
    ? await db.select(CAMPOS_COMENTARIO).from(comentarios)
        .leftJoin(users, eq(users.id, comentarios.autorId))
        .where(and(eq(comentarios.etapaId, fila.id), eq(comentarios.documentoTipo, doc.tipo), eq(comentarios.documentoId, doc.id)))
        .orderBy(desc(comentarios.creadoEn))
    : [];

  // De primer nivel, `abierto`, en cualquier OTRO documento de la etapa —
  // los que `comentariosAbiertosPorEtapa` sigue contando aunque ya no estén
  // en el documento vigente.
  const otrosCondicion = doc
    ? or(ne(comentarios.documentoTipo, doc.tipo), ne(comentarios.documentoId, doc.id))!
    : sql`true`;
  const otrosPrincipales = await db.select(CAMPOS_COMENTARIO).from(comentarios)
    .leftJoin(users, eq(users.id, comentarios.autorId))
    .where(and(eq(comentarios.etapaId, fila.id), eq(comentarios.estado, 'abierto'), isNull(comentarios.respuestaDe), otrosCondicion))
    .orderBy(desc(comentarios.creadoEn));

  // Sus respuestas (de cualquier documento — heredan el del padre), para que
  // el panel pueda pintar el hilo completo aunque quedó en una versión vieja.
  const otrosIds = otrosPrincipales.map((f) => f.id);
  const otrasRespuestas = otrosIds.length
    ? await db.select(CAMPOS_COMENTARIO).from(comentarios)
        .leftJoin(users, eq(users.id, comentarios.autorId))
        .where(inArray(comentarios.respuestaDe, otrosIds))
        .orderBy(desc(comentarios.creadoEn))
    : [];

  const todos = [...delVigente, ...otrosPrincipales, ...otrasRespuestas];
  return { ok: true, comentarios: todos.map((f) => paraSalidaInterna(f, doc)) };
}
