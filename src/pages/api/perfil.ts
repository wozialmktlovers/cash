import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';
import { validarDatosUsuario, type DatosUsuario } from '@/lib/usuarios';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Cada quien edita su propio nombre y apellido, sea admin, operador o cliente.
 *
 * El objetivo siempre es el usuario de la sesión: no se lee ningún `id` del
 * cuerpo, porque esta ruta no es para editar a terceros —para eso está
 * `PATCH /api/admin/usuarios/[id]`, que sí comprueba que quien llama sea admin—.
 * El `email` tampoco se lee: con el correo se inicia sesión, así que cambiarlo
 * es cosa de un admin y no de uno mismo. Ojo con el matiz: aquí el correo ni
 * siquiera se considera, de modo que un cuerpo que solo trae `email` cuenta
 * como «sin cambios», no como un intento de cambiar el correo.
 *
 * La verificación de origen (CSRF) la hace el middleware para todo método que
 * cambia estado, así que esta ruta no repite nada.
 */
export const PATCH: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, error: 'json-invalido' }, 400);
  }

  // Solo estos dos campos salen del cuerpo; cualquier `id` o `email` se descarta.
  const { nombre: nombreCrudo, apellido: apellidoCrudo } = (crudo ?? {}) as {
    nombre?: unknown;
    apellido?: unknown;
  };

  // El tipo se comprueba antes de validar, como en la ruta del admin: `null`
  // es válido y significa «bórralo».
  const esTextoONulo = (v: unknown) => typeof v === 'string' || v === null;
  if (nombreCrudo !== undefined && !esTextoONulo(nombreCrudo)) {
    return json({ ok: false, error: 'nombre-invalido' }, 400);
  }
  if (apellidoCrudo !== undefined && !esTextoONulo(apellidoCrudo)) {
    return json({ ok: false, error: 'apellido-invalido' }, 400);
  }

  const datos: DatosUsuario = {};
  if (nombreCrudo !== undefined) datos.nombre = nombreCrudo as string | null;
  if (apellidoCrudo !== undefined) datos.apellido = apellidoCrudo as string | null;

  const validacion = validarDatosUsuario(usuario, usuario.id, datos);
  if (!validacion.ok) return json({ ok: false, error: validacion.error }, 400);

  const [actualizado] = await db
    .update(users)
    .set(validacion.datos)
    .where(eq(users.id, usuario.id))
    .returning({ nombre: users.nombre, apellido: users.apellido, email: users.email });

  if (!actualizado) return json({ ok: false, error: 'no-existe' }, 404);

  return json({ ok: true, usuario: actualizado });
};
