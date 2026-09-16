import type { APIRoute } from 'astro';
import { and, count, eq } from 'drizzle-orm';
import { db, users, sessions } from '@/db';
import { validarCambioUsuario, validarDatosUsuario, type DatosUsuario } from '@/lib/usuarios';
import type { Rol } from '@/lib/permisos';
import { violaRestriccionUnica } from '@/lib/unicidad';
import { esUuid } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const ROLES: Rol[] = ['admin', 'operador', 'cliente'];

/** Nombre de la restricción única del correo (migración 0000). */
const RESTRICCION_CORREO = 'users_email_unique';

/**
 * ¿Este error es el choque del correo con el de otra cuenta?
 *
 * El 409 se decide con el error de Postgres y no con un `SELECT` previo: entre
 * la consulta y la escritura cabe otra petición con el mismo correo, así que la
 * restricción única de la base es la única comprobación libre de carreras.
 * Cómo se reconoce ese error —recorrer la cadena de `cause` que arma Drizzle y
 * exigir que se nombre esta restricción y no otra— vive en `violaRestriccionUnica`,
 * que comparte con la API de lotes y piezas.
 */
function esCorreoOcupado(error: unknown): boolean {
  return violaRestriccionUnica(error, RESTRICCION_CORREO);
}

// La ruta ya es admin-only por el middleware (/api/admin/*), y aun así se
// vuelve a comprobar aquí. Antes esa segunda barrera la ponía
// validarCambioUsuario, pero ahora solo se llama cuando el cuerpo trae rol o
// activo: un cuerpo de pura identidad pasa por validarDatosUsuario, que deja
// a cualquiera editarse a sí mismo. La comprobación explícita mantiene la
// defensa en profundidad aunque alguien mueva la ruta o toque RUTAS_ADMIN.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const actor = locals.usuario;
  if (actor.rol !== 'admin') return json({ ok: false, error: 'solo-admin' }, 403);
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

  const { rol: rolCrudo, activo: activoCrudo, nombre: nombreCrudo, apellido: apellidoCrudo, email: emailCrudo } =
    (crudo ?? {}) as { rol?: unknown; activo?: unknown; nombre?: unknown; apellido?: unknown; email?: unknown };

  if (rolCrudo !== undefined && (typeof rolCrudo !== 'string' || !ROLES.includes(rolCrudo as Rol))) {
    return json({ ok: false, error: 'rol-invalido' }, 400);
  }
  if (activoCrudo !== undefined && typeof activoCrudo !== 'boolean') {
    return json({ ok: false, error: 'activo-invalido' }, 400);
  }
  // `nombre` y `apellido` aceptan `null` a propósito: así es como se borran.
  // El correo no: una cuenta sin correo no podría iniciar sesión.
  for (const [campo, valor] of [['nombre', nombreCrudo], ['apellido', apellidoCrudo]] as const) {
    if (valor !== undefined && valor !== null && typeof valor !== 'string') {
      return json({ ok: false, error: `${campo}-invalido` }, 400);
    }
  }
  if (emailCrudo !== undefined && typeof emailCrudo !== 'string') {
    return json({ ok: false, error: 'email-invalido' }, 400);
  }

  const cambio: { rol?: Rol; activo?: boolean } = {};
  if (rolCrudo !== undefined) cambio.rol = rolCrudo as Rol;
  if (activoCrudo !== undefined) cambio.activo = activoCrudo;
  const pideRolOActivo = cambio.rol !== undefined || cambio.activo !== undefined;

  const datos: DatosUsuario = {};
  if (nombreCrudo !== undefined) datos.nombre = nombreCrudo as string | null;
  if (apellidoCrudo !== undefined) datos.apellido = apellidoCrudo as string | null;
  if (emailCrudo !== undefined) datos.email = emailCrudo as string;
  const pideDatos = Object.keys(datos).length > 0;

  if (!pideRolOActivo && !pideDatos) return json({ ok: false, error: 'sin-cambios' }, 400);

  // Las reglas de identidad son puras y no dependen de cómo esté el objetivo,
  // así que se resuelven antes de consultar nada: un nombre larguísimo o un
  // correo mal escrito se rechazan sin gastar una consulta.
  let datosLimpios: DatosUsuario = {};
  if (pideDatos) {
    const validacionDatos = validarDatosUsuario(actor, id, datos);
    if (!validacionDatos.ok) return json({ ok: false, error: validacionDatos.error }, 400);
    datosLimpios = validacionDatos.datos;
  }

  // Rol y activo sí necesitan saber cómo está el objetivo y cuántos admins
  // quedan; los datos de identidad no. Por eso un cuerpo que solo trae nombre,
  // apellido o correo no pasa por aquí: no hay último admin que proteger.
  if (pideRolOActivo) {
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
  }

  // Todo en una sola escritura, traigan los dos grupos de campos o uno solo.
  let filas;
  try {
    filas = await db
      .update(users)
      .set({ ...cambio, ...datosLimpios })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, nombre: users.nombre, apellido: users.apellido, rol: users.rol, activo: users.activo, clientId: users.clientId });
  } catch (e) {
    if (!esCorreoOcupado(e)) throw e;
    return json({ ok: false, error: 'correo-ocupado' }, 409);
  }

  const [actualizado] = filas;
  if (!actualizado) return json({ ok: false, error: 'no-existe' }, 404);

  // Al desactivar, se cierran sus sesiones: no basta con que deje de poder
  // iniciar sesión, la que ya tenía abierta también se corta.
  if (cambio.activo === false) {
    await db.delete(sessions).where(eq(sessions.userId, id));
  }

  return json({ ok: true, usuario: actualizado });
};
