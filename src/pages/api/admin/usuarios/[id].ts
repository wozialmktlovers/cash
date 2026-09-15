import type { APIRoute } from 'astro';
import { and, count, eq } from 'drizzle-orm';
import { db, users, sessions } from '@/db';
import { validarCambioUsuario } from '@/lib/usuarios';
import type { Rol } from '@/lib/permisos';
import { esUuid } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const ROLES: Rol[] = ['admin', 'operador', 'cliente'];

// La ruta ya es admin-only por el middleware (/api/admin/*), pero
// validarCambioUsuario repite la comprobación: es una función pura y sus
// pruebas cubren el caso de un actor que no es admin.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const actor = locals.usuario;
  const id = params.id!;
  // Un id sin forma de UUID nunca existe (M2 punto 5): 404 antes de tocar la
  // base, en vez del 500 que daba Postgres al comparar la columna uuid.
  if (!esUuid(id)) return json({ ok: false, error: 'no-existe' }, 404);

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, error: 'json-invalido' }, 400);
  }

  const { rol: rolCrudo, activo: activoCrudo } = (crudo ?? {}) as { rol?: unknown; activo?: unknown };

  if (rolCrudo !== undefined && (typeof rolCrudo !== 'string' || !ROLES.includes(rolCrudo as Rol))) {
    return json({ ok: false, error: 'rol-invalido' }, 400);
  }
  if (activoCrudo !== undefined && typeof activoCrudo !== 'boolean') {
    return json({ ok: false, error: 'activo-invalido' }, 400);
  }

  const cambio: { rol?: Rol; activo?: boolean } = {};
  if (rolCrudo !== undefined) cambio.rol = rolCrudo as Rol;
  if (activoCrudo !== undefined) cambio.activo = activoCrudo;
  if (cambio.rol === undefined && cambio.activo === undefined) return json({ ok: false, error: 'sin-cambios' }, 400);

  const [objetivo] = await db.select({ id: users.id, rol: users.rol, activo: users.activo, clientId: users.clientId }).from(users).where(eq(users.id, id)).limit(1);
  if (!objetivo) return json({ ok: false, error: 'no-existe' }, 404);

  // Se cuenta dentro de la misma petición, justo antes de validar: aceptable
  // sin transacción (ver ruling del controlador), aunque en teoría dos
  // peticiones concurrentes podrían leer el mismo conteo antes de escribir.
  const [{ valor: adminsActivos }] = await db
    .select({ valor: count() })
    .from(users)
    .where(and(eq(users.rol, 'admin'), eq(users.activo, true)));

  const validacion = validarCambioUsuario(actor, objetivo, cambio, adminsActivos);
  if (!validacion.ok) return json({ ok: false, error: validacion.error }, 400);

  const [actualizado] = await db
    .update(users)
    .set(cambio)
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, nombre: users.nombre, rol: users.rol, activo: users.activo, clientId: users.clientId });

  if (!actualizado) return json({ ok: false, error: 'no-existe' }, 404);

  // Al desactivar, se cierran sus sesiones: no basta con que deje de poder
  // iniciar sesión, la que ya tenía abierta también se corta.
  if (cambio.activo === false) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  return json({ ok: true, usuario: actualizado });
};
