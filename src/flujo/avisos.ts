// Avisos del flujo de trabajo (spec §3, «Avisos»): quién se entera de cada
// evento, qué dice el aviso, y cómo se entrega (fila en `notificaciones` +
// correo con `enviarCorreo`). Cubre toda la tabla de eventos del spec menos
// la invitación, que ya se manda desde /api/invitaciones (A4) con su propio
// correo — no hay que duplicarla aquí.

import { and, eq } from 'drizzle-orm';
import { db, notificaciones, users } from '@/db';
import { enviarCorreo } from '@/lib/correo';
import type { Rol } from './reglas';

export type Usuario = { id: string; email: string; nombre: string | null; rol: Rol; activo: boolean };

export type EventoAviso =
  | 'solicitud'
  | 'cambios_pedidos'
  | 'reabierta'
  | 'aprobada'
  | 'comentario_cliente'
  | 'respuesta_cliente'
  | 'cliente_reasignado'
  | 'entregable_generado'
  | 'job_fallido';

/**
 * Contexto para calcular destinatarios (spec §3, tabla «Eventos»).
 * - `operador` es «el operador al que le toca enterarse»: el asignado para
 *   cambios/reabierta/aprobada/comentario, o el nuevo operador en una
 *   reasignación.
 * - `autor` es «quien lanzó el job», para entregable generado y job fallido.
 * - `actorId`, si se da, nunca aparece en el resultado: quien causa el
 *   evento no se notifica a sí mismo (p. ej. el admin que aprueba).
 */
export type ContextoDestinatarios = {
  admins: Usuario[];
  operador: Usuario | null;
  autor: Usuario | null;
  usuariosCliente: Usuario[];
  etapaVisibleCliente: boolean;
  actorId?: string | null;
};

function candidatosDe(evento: EventoAviso, ctx: ContextoDestinatarios): (Usuario | null)[] {
  switch (evento) {
    case 'solicitud':
      return ctx.admins;
    case 'cambios_pedidos':
    case 'reabierta':
    case 'cliente_reasignado':
      return [ctx.operador];
    case 'aprobada':
      return ctx.etapaVisibleCliente ? [ctx.operador, ...ctx.usuariosCliente] : [ctx.operador];
    case 'comentario_cliente':
      return [ctx.operador, ...ctx.admins];
    case 'respuesta_cliente':
      // El único destinatario es quien abrió el hilo (el autor del
      // comentario padre): se pasa en `ctx.usuariosCliente` con esa única
      // entrada, igual que `aprobada` reutiliza el mismo campo.
      return ctx.usuariosCliente;
    case 'entregable_generado':
    case 'job_fallido':
      return [ctx.autor];
  }
  // Inalcanzable: EventoAviso es una unión cerrada y todos los casos regresan arriba.
  throw new Error(`Evento de aviso desconocido: ${evento}`);
}

/**
 * Destinatarios según la tabla del spec: pura, sin duplicados (por id) y solo
 * con usuarios activos. Nunca incluye a `ctx.actorId`.
 */
export function destinatarios(evento: EventoAviso, ctx: ContextoDestinatarios): Usuario[] {
  const vistos = new Set<string>();
  const resultado: Usuario[] = [];
  for (const u of candidatosDe(evento, ctx)) {
    if (!u || !u.activo) continue;
    if (ctx.actorId && u.id === ctx.actorId) continue;
    if (vistos.has(u.id)) continue;
    vistos.add(u.id);
    resultado.push(u);
  }
  return resultado;
}

export type DatosAviso = { cliente: string; etapa: string; autor?: string };

/**
 * Nombre que ve un cliente en vez de la identidad real de quien actuó (spec
 * §3, «Avisos»: el cliente nunca debe enterarse de qué operador o admin en
 * particular aprobó, pidió cambios o reabrió su etapa — solo `aprobada`
 * llega hoy a destinatarios cliente, pero esto cubre cualquier evento futuro
 * que también les llegue). Mismo criterio que `nombreInterno` en
 * `servicio.ts` y que `respuesta_cliente`, que ya ignoraba `autor` del todo.
 */
const AUTOR_PARA_CLIENTE = 'El equipo de Wozial';

/**
 * `DatosAviso` ajustado al rol de un destinatario concreto: pura. Si el
 * destinatario es un usuario `cliente` y el aviso trae `autor`, lo sustituye
 * por «El equipo de Wozial»; para cualquier otro rol, o si no hay `autor`,
 * regresa `datos` sin tocar.
 */
export function datosParaDestinatario(destinatario: Usuario, datos: DatosAviso): DatosAviso {
  if (destinatario.rol !== 'cliente' || datos.autor === undefined) return datos;
  return { ...datos, autor: AUTOR_PARA_CLIENTE };
}

/** Título y texto del aviso, en español. Pura: `enviarCorreo`/`plantillaCorreo` escapan lo que haga falta al mandarlo por correo. */
export function textoAviso(evento: EventoAviso, datos: DatosAviso): { titulo: string; texto: string } {
  const { cliente, etapa, autor } = datos;
  switch (evento) {
    case 'solicitud':
      return {
        titulo: `${cliente} · ${etapa} espera tu autorización`,
        texto: `${autor ? `${autor} solicitó` : 'Se solicitó'} autorización para ${etapa} de ${cliente}.`,
      };
    case 'cambios_pedidos':
      return {
        titulo: `${cliente} · ${etapa} tiene cambios pedidos`,
        texto: `${autor ?? 'Un administrador'} pidió cambios en ${etapa} de ${cliente}.`,
      };
    case 'reabierta':
      return {
        titulo: `${cliente} · ${etapa} se reabrió`,
        texto: `${autor ?? 'Un administrador'} reabrió ${etapa} de ${cliente} para nuevos cambios.`,
      };
    case 'aprobada':
      return {
        titulo: `${cliente} · ${etapa} fue aprobada`,
        texto: `${autor ?? 'Un administrador'} aprobó ${etapa} de ${cliente}.`,
      };
    case 'comentario_cliente':
      return {
        titulo: `${cliente} comentó en ${etapa}`,
        texto: `${cliente} dejó un comentario en ${etapa}. Revísalo cuando puedas.`,
      };
    case 'respuesta_cliente':
      // Nunca el nombre de quien respondió (fix round 1): al cliente le
      // habla «Equipo Wozial», nunca la identidad de un operador o admin
      // en particular — mismo criterio que `nombreInterno` en el GET de
      // comentarios. `autor` se ignora a propósito en este caso.
      return {
        titulo: `Nueva respuesta en ${etapa}`,
        texto: `El equipo de Wozial respondió tu observación en ${etapa}.`,
      };
    case 'cliente_reasignado':
      return {
        titulo: `${cliente} es ahora tu cliente`,
        texto: `Te asignaron ${cliente}. Ya puedes ver su ficha y sus etapas.`,
      };
    case 'entregable_generado':
      return {
        titulo: `${etapa} de ${cliente} está lista`,
        texto: `El documento de ${etapa} para ${cliente} se generó correctamente.`,
      };
    case 'job_fallido':
      return {
        titulo: `${etapa} de ${cliente} falló`,
        texto: `El trabajo para generar ${etapa} de ${cliente} falló. Puedes volver a intentarlo.`,
      };
  }
  // Inalcanzable: mismo cierre que candidatosDe, por si el switch deja de ser exhaustivo.
  throw new Error(`Evento de aviso desconocido: ${evento}`);
}

const CAMPOS_USUARIO = { id: users.id, email: users.email, nombre: users.nombre, rol: users.rol, activo: users.activo };

/** Todos los admins activos (evento `solicitud`). */
export async function adminsActivos(): Promise<Usuario[]> {
  return db.select(CAMPOS_USUARIO).from(users).where(and(eq(users.rol, 'admin'), eq(users.activo, true)));
}

/** Los usuarios (rol `cliente`) de un cliente dado, activos. */
export async function usuariosDeCliente(clientId: string): Promise<Usuario[]> {
  return db.select(CAMPOS_USUARIO).from(users).where(and(eq(users.clientId, clientId), eq(users.rol, 'cliente'), eq(users.activo, true)));
}

/** Un usuario por id, o `null` si no existe o no se dio id. No filtra por activo: `destinatarios` ya lo hace. */
export async function usuarioPorId(id: string | null | undefined): Promise<Usuario | null> {
  if (!id) return null;
  const [fila] = await db.select(CAMPOS_USUARIO).from(users).where(eq(users.id, id)).limit(1);
  return fila ?? null;
}

export type ContextoAviso = ContextoDestinatarios & { datos: DatosAviso };

/**
 * Calcula destinatarios y texto, inserta una fila por destinatario en
 * `notificaciones` (un solo insert multi-fila) y manda un correo por
 * destinatario con `enviarCorreo`. Nunca lanza: un fallo de la base o del
 * correo se registra y sigue, para no tumbar la acción que originó el aviso.
 * Quien llama debe hacerlo después de que su transacción cerró, sin esperar:
 * `void notificar(...).catch((e) => console.error('[avisos] …', e))`.
 *
 * `enlace` es la ruta interna (ficha o vista del documento); los usuarios con
 * rol `cliente` siempre reciben `/portal` en su lugar, tanto en la fila como
 * en el botón del correo — el cliente nunca ve rutas internas del Studio.
 */
export async function notificar(evento: EventoAviso, ctx: ContextoAviso, enlace: string): Promise<void> {
  const lista = destinatarios(evento, ctx);
  if (lista.length === 0) return;

  const enlaceDe = (u: Usuario) => (u.rol === 'cliente' ? '/portal' : enlace);
  // Texto por destinatario, no uno solo para toda la lista: `datosParaDestinatario`
  // le quita el nombre real de quien actuó a los destinatarios `cliente` (fix
  // wave, punto 2) — sin esto, un aviso de `aprobada` que llega al operador Y a
  // los usuarios del cliente les mostraría a todos el mismo texto con el nombre
  // del admin o del operador que aprobó.
  const textoPara = (u: Usuario) => textoAviso(evento, datosParaDestinatario(u, ctx.datos));

  try {
    await db.insert(notificaciones).values(
      lista.map((u) => {
        const { titulo, texto } = textoPara(u);
        return { usuarioId: u.id, tipo: evento, titulo, texto, enlace: enlaceDe(u) };
      }),
    );
  } catch (e) {
    console.error('[avisos] no se pudo guardar la notificación:', e);
  }

  // Un correo por persona: con varios destinatarios en `to` cada uno vería los
  // correos de los demás (por ejemplo, todos los admins o todos los usuarios de
  // un cliente). Los envíos van en paralelo y enviarCorreo nunca lanza.
  const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
  await Promise.all(lista.map((u) => {
    const { titulo, texto } = textoPara(u);
    // Sin PUBLIC_BASE_URL no hay a dónde apuntar el botón (una ruta relativa
    // no sirve en un correo): se manda solo el título y el texto, sin botón.
    const url = base ? `${base}${enlaceDe(u)}` : '';
    return enviarCorreo({
      para: u.email,
      asunto: titulo,
      titulo,
      texto,
      boton: url ? { texto: 'Ver en Wozial Studio', url } : undefined,
    });
  }));
}

/** Aviso de un job de pipeline: entregable generado o job fallido, solo a quien lo lanzó. */
export async function avisarJob(o: {
  evento: 'entregable_generado' | 'job_fallido';
  creadoPor: string | null;
  cliente: string;
  etapa: string;
  enlace: string;
}): Promise<void> {
  const autor = await usuarioPorId(o.creadoPor);
  if (!autor) return;
  await notificar(
    o.evento,
    { admins: [], operador: null, autor, usuariosCliente: [], etapaVisibleCliente: false, datos: { cliente: o.cliente, etapa: o.etapa } },
    o.enlace,
  );
}

/** Aviso de una transición de etapa: solicitud (admins), cambios pedidos o reabierta (operador), aprobada (operador y, si la etapa es visible, los usuarios del cliente). */
export async function avisarTransicion(o: {
  evento: 'solicitud' | 'cambios_pedidos' | 'reabierta' | 'aprobada';
  actorId: string;
  clientId: string;
  operadorId: string | null;
  etapaVisibleCliente: boolean;
  cliente: string;
  etapa: string;
  autor: string;
  enlace: string;
}): Promise<void> {
  const [admins, operador, usuariosCliente] = await Promise.all([
    o.evento === 'solicitud' ? adminsActivos() : Promise.resolve([]),
    usuarioPorId(o.operadorId),
    o.evento === 'aprobada' && o.etapaVisibleCliente ? usuariosDeCliente(o.clientId) : Promise.resolve([]),
  ]);
  await notificar(
    o.evento,
    {
      admins, operador, autor: null, usuariosCliente, etapaVisibleCliente: o.etapaVisibleCliente,
      actorId: o.actorId, datos: { cliente: o.cliente, etapa: o.etapa, autor: o.autor },
    },
    o.enlace,
  );
}

/** Aviso de reasignación de cliente: al nuevo operador. */
export async function avisarReasignacion(o: { actorId: string; nuevoOperadorId: string; cliente: string; enlace: string }): Promise<void> {
  const operador = await usuarioPorId(o.nuevoOperadorId);
  await notificar(
    'cliente_reasignado',
    { admins: [], operador, autor: null, usuariosCliente: [], etapaVisibleCliente: false, actorId: o.actorId, datos: { cliente: o.cliente, etapa: '' } },
    o.enlace,
  );
}

/** Aviso de un comentario del cliente (B7, spec §3): al operador asignado y a los admins, sin incluir a quien comentó (el cliente nunca se avisa a sí mismo). */
export async function avisarComentarioCliente(o: {
  actorId: string; clientId: string; operadorId: string | null; cliente: string; etapa: string; enlace: string;
}): Promise<void> {
  const [admins, operador] = await Promise.all([adminsActivos(), usuarioPorId(o.operadorId)]);
  await notificar(
    'comentario_cliente',
    { admins, operador, autor: null, usuariosCliente: [], etapaVisibleCliente: false, actorId: o.actorId, datos: { cliente: o.cliente, etapa: o.etapa } },
    o.enlace,
  );
}

/**
 * Aviso de una respuesta del equipo a un comentario que dejó el cliente
 * (B7, spec §3 «Responder»; spec §4 «Actividad reciente»): solo a quien
 * escribió el comentario original, y solo si sigue activo. El enlace es
 * siempre `/portal` (lo fija `notificar` para cualquier destinatario con rol
 * `cliente`), así que aquí no hace falta pasarlo. A propósito NO recibe
 * quién respondió (fix round 1, punto 2): `textoAviso('respuesta_cliente')`
 * nunca menciona un nombre, para no filtrarle al cliente la identidad de un
 * operador o admin en particular.
 */
export async function avisarRespuestaCliente(o: {
  actorId: string; autorComentarioId: string; cliente: string; etapa: string;
}): Promise<void> {
  const autorComentario = await usuarioPorId(o.autorComentarioId);
  if (!autorComentario || autorComentario.rol !== 'cliente') return;
  await notificar(
    'respuesta_cliente',
    {
      admins: [], operador: null, autor: null, usuariosCliente: [autorComentario], etapaVisibleCliente: false,
      actorId: o.actorId, datos: { cliente: o.cliente, etapa: o.etapa },
    },
    '/portal',
  );
}
