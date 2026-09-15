import type { APIRoute } from 'astro';
import { eq, and, isNull } from 'drizzle-orm';
import { db, invitaciones, users } from '@/db';
import { hashPassword, crearSesion } from '@/lib/auth';
import { destinoTrasLogin } from '@/lib/permisos';
import { hashToken, estadoInvitacion, validarAceptacion } from '@/lib/invitaciones';

/** Señales internas para saber, tras el rollback de la transacción, qué pasó. */
class YaExisteError extends Error {}
class UsadaError extends Error {}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const token = String(form.get('token') ?? '');
  const nombre = String(form.get('nombre') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const confirmacion = String(form.get('confirmacion') ?? '');

  const volver = (error: string) => redirect(`/invitacion/${encodeURIComponent(token)}?error=${error}`);

  if (!token) return volver('inexistente');

  const [inv] = await db.select().from(invitaciones).where(eq(invitaciones.tokenHash, hashToken(token))).limit(1);
  const estado = estadoInvitacion(inv ?? null, new Date());
  if (estado !== 'valida') return volver(estado);

  const validacion = validarAceptacion({ nombre, password, confirmacion });
  if (!validacion.ok) return volver('datos');

  let creadoId: string | undefined;
  try {
    await db.transaction(async (tx) => {
      // Nunca se actualiza una cuenta existente (ver ruling de seguridad de la
      // tarea): si el correo ya está tomado, se corta y no se toca nada.
      const [existente] = await tx.select({ id: users.id }).from(users).where(eq(users.email, inv!.email)).limit(1);
      if (existente) throw new YaExisteError();

      // Marca de uso condicional (`usada_en is null`): si dos peticiones
      // concurrentes llegan con el mismo token, solo una actualiza la fila;
      // la otra ve 0 filas y aborta sin crear un segundo usuario.
      const marcada = await tx
        .update(invitaciones)
        .set({ usadaEn: new Date() })
        .where(and(eq(invitaciones.id, inv!.id), isNull(invitaciones.usadaEn)))
        .returning({ id: invitaciones.id });
      if (marcada.length === 0) throw new UsadaError();

      const passwordHash = await hashPassword(password);
      // rol y clientId salen de la invitación, nunca del formulario.
      const [creado] = await tx
        .insert(users)
        .values({
          email: inv!.email,
          passwordHash,
          rol: inv!.rol,
          nombre,
          clientId: inv!.rol === 'cliente' ? inv!.clientId : null,
          activo: true,
        })
        // Dos invitaciones distintas del mismo correo aceptadas a la vez pueden
        // pasar ambas la consulta de arriba; la restricción única decide y la
        // perdedora sale como «ya existe» en lugar de un 500.
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id });
      if (!creado) throw new YaExisteError();
      creadoId = creado.id;
    });
  } catch (e) {
    if (e instanceof YaExisteError) return volver('ya-existe');
    if (e instanceof UsadaError) return volver('usada');
    throw e;
  }

  const sesion = await crearSesion(creadoId!);
  cookies.set('sesion', sesion, {
    httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax',
    path: '/', maxAge: 30 * 86400,
  });
  return redirect(destinoTrasLogin(inv!.rol));
};
