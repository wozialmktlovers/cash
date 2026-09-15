import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, clients, invitaciones, users } from '@/db';
import { generarInvitacion, vencimiento, puedeInvitar } from '@/lib/invitaciones';
import { enviarCorreo } from '@/lib/correo';
import type { Rol } from '@/lib/permisos';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const ROLES: Rol[] = ['admin', 'operador', 'cliente'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ error: 'json-invalido' }, 400);
  }

  const { email: emailCrudo, rol: rolCrudo, clientId: clientIdCrudo } = (crudo ?? {}) as {
    email?: unknown;
    rol?: unknown;
    clientId?: unknown;
  };

  const email = String(emailCrudo ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'correo-invalido' }, 400);

  if (typeof rolCrudo !== 'string' || !ROLES.includes(rolCrudo as Rol)) return json({ error: 'rol-invalido' }, 400);
  const rol = rolCrudo as Rol;

  const clientIdSolicitado = typeof clientIdCrudo === 'string' && clientIdCrudo ? clientIdCrudo : null;

  // El cliente se resuelve y valida ANTES de comprobar el permiso, para que
  // `puedeInvitar` reciba el cliente real (o null) y no un id inventado.
  let cliente: { id: string; operadorId: string | null } | null = null;
  if (rol === 'cliente') {
    if (!clientIdSolicitado) return json({ error: 'cliente-obligatorio' }, 400);
    const [c] = await db.select({ id: clients.id, operadorId: clients.operadorId }).from(clients).where(eq(clients.id, clientIdSolicitado)).limit(1);
    if (!c) return json({ error: 'cliente-invalido' }, 400);
    cliente = c;
  }

  // El permiso se comprueba ANTES de revelar si el correo ya está en uso: así
  // un operador sin autorización para este rol/cliente no puede usar esta
  // ruta para averiguar si una cuenta existe.
  if (!puedeInvitar(usuario, rol, cliente)) return json({ error: 'prohibido' }, 403);

  // Seguridad (ruling del controlador): jamás se hace upsert por correo. Si ya
  // hay una cuenta con ese email (de cualquier rol, activa o no), la invitación
  // se rechaza aquí para que un operador no pueda invitar el correo de un
  // admin existente y, al aceptar, sobrescribir su contraseña y su rol.
  const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existente) return json({ error: 'ya-existe' }, 409);

  const { token, tokenHash } = generarInvitacion();
  await db.insert(invitaciones).values({
    tokenHash,
    email,
    rol,
    // El clientId de la invitación es la fuente de verdad al aceptar; para
    // admin/operador siempre queda null, nunca lo que mande el formulario.
    clientId: rol === 'cliente' ? cliente!.id : null,
    creadoPor: usuario.id,
    expiraEn: vencimiento(new Date()),
  });

  const base = (process.env.PUBLIC_BASE_URL ?? new URL(request.url).origin).replace(/\/+$/, '');
  const enlace = `${base}/invitacion/${token}`;

  const { enviado } = await enviarCorreo({
    para: email,
    asunto: 'Te invitaron a Wozial Studio',
    titulo: 'Te invitaron a Wozial Studio',
    texto: 'Alguien de tu equipo te dio de alta en Wozial Studio. Usa el botón para crear tu acceso; el enlace vence en 7 días.',
    boton: { texto: 'Crear mi acceso', url: enlace },
  });

  return json({ ok: true, enlace, correoEnviado: enviado }, 201);
};
