import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, pilaresTemas, users } from '@/db';
import { temaExiste, validarCambioTema } from '@/pilares/avance';
import { puedeOperarCliente } from '@/lib/permisos';
import { nombreVisible } from '@/lib/usuarios';
import { documentoVisible } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const doc = await documentoVisible(locals.usuario, 'pilares', params.id!);
  if (!doc || !puedeOperarCliente(locals.usuario, doc.cliente)) return json({ ok: false, errores: ['El tema no existe.'] }, 404);
  const r = doc.resultado;
  if (!temaExiste(r.datos, params.temaId!)) return json({ ok: false, errores: ['El tema no existe.'] }, 404);

  let crudo: unknown;
  try { crudo = await request.json(); } catch { return json({ ok: false, errores: ['El cuerpo no es JSON válido.'] }, 400); }
  const v = validarCambioTema(crudo);
  if (!v.ok) return json(v, 400);

  const cambios = {
    ...(v.estado !== undefined ? { estado: v.estado } : {}),
    ...(v.nota !== undefined ? { nota: v.nota } : {}),
    actualizadoPor: locals.userId ?? null,
    actualizadoEn: new Date(),
  };
  const [fila] = await db.insert(pilaresTemas)
    .values({ resultId: r.id, temaId: params.temaId!, ...cambios })
    .onConflictDoUpdate({ target: [pilaresTemas.resultId, pilaresTemas.temaId], set: cambios })
    .returning();

  const [autor] = fila.actualizadoPor
    ? await db.select({ nombre: users.nombre, apellido: users.apellido, email: users.email }).from(users).where(eq(users.id, fila.actualizadoPor)).limit(1)
    : [];

  // Se manda el nombre ya resuelto, como en el historial de versiones y los
  // comentarios: la regla de «nombre y apellido, o el correo» vive en el
  // servidor y no se repite en el navegador.
  return json({ ok: true, estado: fila.estado, nota: fila.nota, actualizadoPor: autor ? nombreVisible(autor) : null, actualizadoEn: fila.actualizadoEn });
};
