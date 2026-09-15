import type { APIRoute } from 'astro';
import { documentoVisible } from '@/lib/visibilidad';

/** El JSON crudo que produjo el pipeline, para revisarlo sin pasar por la presentación. */
export const GET: APIRoute = async ({ params, locals }) => {
  const doc = await documentoVisible(locals.usuario, 'research', params.id!);

  if (!doc) {
    return new Response(JSON.stringify({ ok: false, errores: ['No existe'] }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(doc.resultado.datos, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
