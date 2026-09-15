import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, shareLinks } from '@/db';
import { slugificar } from '@/lib/slug';
import { crearShareLink, revocarShareLink } from '@/lib/share';
import { puedeOperarCliente } from '@/lib/permisos';
import { documentoVisible, type DocumentoTipo } from '@/lib/visibilidad';

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

export const POST: APIRoute = async ({ request, locals }) => {
  let crudo: { resultId?: string; tipo?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const resultId = String(crudo.resultId ?? '').trim();
  if (!resultId) return json({ ok: false, errores: ['Falta resultId'] }, 400);

  const tipo: DocumentoTipo = crudo.tipo === 'growth' ? 'growth' : crudo.tipo === 'pilares' ? 'pilares' : 'research';

  const doc = await documentoVisible(locals.usuario, tipo, resultId);
  if (!doc || !puedeOperarCliente(locals.usuario, doc.cliente)) {
    return json({ ok: false, errores: ['El resultado no existe'] }, 404);
  }

  // El link lleva el nombre del negocio delante del token. Es lo que ve el
  // cliente al recibirlo, así que decir de quién es vale más que ser corto.
  const slug = slugificar(doc.cliente.nombre);

  const token = await crearShareLink(resultId, tipo);
  return json({ ok: true, token, url: `${baseUrl(request)}/p/${slug}/${token}` }, 201);
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  let crudo: { token?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const token = String(crudo.token ?? '').trim();
  if (!token) return json({ ok: false, errores: ['Falta token'] }, 400);

  // El link solo dice el token; hay que resolver a qué documento y a qué
  // cliente pertenece para comprobar el permiso antes de revocarlo.
  const [link] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!link) return json({ ok: false, errores: ['El link no existe'] }, 404);

  const doc = await documentoVisible(locals.usuario, link.documentoTipo as DocumentoTipo, link.documentoId);
  if (!doc || !puedeOperarCliente(locals.usuario, doc.cliente)) {
    return json({ ok: false, errores: ['El link no existe'] }, 404);
  }

  await revocarShareLink(token);
  return json({ ok: true });
};
