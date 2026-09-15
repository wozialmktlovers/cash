import type { APIRoute } from 'astro';
import { z } from 'zod';
import { validarComentario } from '@/flujo/comentarios';
import { responderComentario } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cuerpoSchema = z.object({ texto: z.string().min(1).max(2000) });

/**
 * `POST /api/comentarios/[id]/respuestas` `{ texto }`: responde a un
 * comentario de primer nivel (spec §3, «Responder»). El cliente solo
 * responde en sus propios hilos; el personal, en cualquiera que pueda ver.
 * Una respuesta a una respuesta, o sin permiso, 404/409 (ver `servicio.ts`).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  // El ancla no importa aquí (la respuesta hereda la del padre), pero se
  // reutiliza `validarComentario` con un ancla comodín para no duplicar la
  // regla de largo/recorte del texto.
  const v = validarComentario({ texto: r.data.texto, ancla: 'respuesta' });
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  const resultado = await responderComentario({ comentarioId: id, usuario: locals.usuario, texto: v.texto });
  if (!resultado.ok) return json({ ok: false, errores: [resultado.razon] }, resultado.status);
  return json({ ok: true, comentario: resultado.comentario }, 201);
};
