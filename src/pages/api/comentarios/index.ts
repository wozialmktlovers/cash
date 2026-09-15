import type { APIRoute } from 'astro';
import { z } from 'zod';
import { validarComentario } from '@/flujo/comentarios';
import { listarComentarios, crearComentarioInterno, crearComentarioCliente } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * `GET /api/comentarios?etapa=<id>[&todos=1]`: visibilidad por rol (spec §3).
 * El personal ve todos los del documento vigente de la etapa (o de todas sus
 * versiones con `?todos=1`); el cliente solo los suyos, sobre la versión
 * aprobada. Una etapa que ese usuario no puede ver responde 404.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const etapaId = url.searchParams.get('etapa') ?? '';
  if (!etapaId) return json({ ok: false, errores: ['Falta la etapa'] }, 400);

  const resultado = await listarComentarios({
    etapaId, usuario: locals.usuario, todasVersiones: url.searchParams.get('todos') === '1',
  });

  if (!resultado.ok) return json({ ok: false, errores: [resultado.razon] }, resultado.status);
  return json({ ok: true, comentarios: resultado.comentarios });
};

const cuerpoSchema = z.object({
  etapaId: z.string().trim().min(1, 'Falta la etapa'),
  ancla: z.string().trim().min(1, 'El ancla no es válida').max(200, 'El ancla no es válida'),
  texto: z.string().trim().min(1, 'Escribe el comentario').max(2000, 'El comentario no puede pasar de 2000 caracteres'),
});

/**
 * `POST /api/comentarios` `{ etapaId, ancla, texto }`: crea un comentario
 * anclado (spec §3). El documento y la versión salen de la etapa: vigente
 * para el personal, aprobada para el cliente — nunca los elige quien llama.
 * Sin permiso, 404; una etapa sin documento (personal) o sin versión
 * aprobada (cliente), 409 con la razón en español.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  const v = validarComentario({ texto: r.data.texto, ancla: r.data.ancla });
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  const usuario = locals.usuario;
  const resultado = usuario.rol === 'cliente'
    ? await crearComentarioCliente({ etapaId: r.data.etapaId, usuario, ancla: v.ancla, texto: v.texto })
    : await crearComentarioInterno({ etapaId: r.data.etapaId, usuario, ancla: v.ancla, texto: v.texto });

  if (!resultado.ok) return json({ ok: false, errores: [resultado.razon] }, resultado.status);
  return json({ ok: true, comentario: resultado.comentario }, 201);
};
