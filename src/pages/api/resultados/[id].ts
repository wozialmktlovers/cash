import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, researchResults } from '@/db';

/** El JSON crudo que produjo el pipeline, para revisarlo sin pasar por la presentación. */
export const GET: APIRoute = async ({ params }) => {
  const [r] = await db
    .select()
    .from(researchResults)
    .where(eq(researchResults.id, params.id!))
    .limit(1);

  if (!r) {
    return new Response(JSON.stringify({ ok: false, errores: ['No existe'] }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(r.datos, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
