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

  // La tabla se elige una sola vez. Tenerla en tres ternarios separados dejó
  // la proyección apuntando a research_results mientras el FROM iba a
  // growth_results, y Drizzle revienta: «references a column ... but the table
  // is not part of the query». El botón de crear link del manual fallaba.
  const tabla = tipo === 'growth' ? growthResults : researchResults;
  const [resultado] = await db
    .select({ id: tabla.id })
    .from(tabla)
    .where(eq(tabla.id, resultId))
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
