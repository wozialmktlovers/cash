import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ESTADOS_COMENTARIO } from '@/flujo/comentarios';
import { cambiarEstadoComentario } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cuerpoSchema = z.object({ estado: z.enum(ESTADOS_COMENTARIO) });

/**
 * `PATCH /api/comentarios/[id]` `{ estado }`: cambia el estado de un
 * comentario de primer nivel (spec §3, `puedeCambiarEstadoComentario`). El
 * cliente nunca puede: sin permiso, 404; con permiso de ver el comentario
 * pero no de moverlo a ese estado (o si es una respuesta), 409 con la razón.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  const resultado = await cambiarEstadoComentario({ comentarioId: id, usuario: locals.usuario, estado: r.data.estado });
  if (!resultado.ok) return json({ ok: false, errores: [resultado.razon] }, resultado.status);
  return json({ ok: true, comentario: resultado.comentario });
};
