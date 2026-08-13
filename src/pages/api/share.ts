import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, researchResults, growthResults } from '@/db';
import { crearShareLink, revocarShareLink } from '@/lib/share';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function baseUrl(request: Request): string {
  const configurada = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (configurada) return configurada;
  return new URL(request.url).origin;
}

export const POST: APIRoute = async ({ request }) => {
  let crudo: { resultId?: string; tipo?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const resultId = String(crudo.resultId ?? '').trim();
  if (!resultId) return json({ ok: false, errores: ['Falta resultId'] }, 400);

  const tipo = crudo.tipo === 'growth' ? 'growth' : 'research';

  const [resultado] = await db
    .select({ id: researchResults.id })
    .from(tipo === 'growth' ? growthResults : researchResults)
    .where(eq(tipo === 'growth' ? growthResults.id : researchResults.id, resultId))
    .limit(1);
  if (!resultado) return json({ ok: false, errores: ['El resultado no existe'] }, 404);

  const token = await crearShareLink(resultId, tipo);
  return json({ ok: true, token, url: `${baseUrl(request)}/p/${token}` }, 201);
};

export const DELETE: APIRoute = async ({ request }) => {
  let crudo: { token?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const token = String(crudo.token ?? '').trim();
  if (!token) return json({ ok: false, errores: ['Falta token'] }, 400);

  await revocarShareLink(token);
  return json({ ok: true });
};
