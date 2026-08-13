import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, clientLinks, clients } from '@/db';
import { validarUrl, normalizarUrl } from '@/lib/links';

const TIPOS = ['sitio', 'instagram', 'facebook', 'tiktok', 'youtube', 'ventas', 'otro'] as const;
type Tipo = (typeof TIPOS)[number];

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  const clientId = params.id!;

  let crudo: { tipo?: string; url?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const tipo = String(crudo.tipo ?? '').trim() as Tipo;
  const url = String(crudo.url ?? '');

  const errores: string[] = [];
  if (!TIPOS.includes(tipo)) errores.push(`El tipo debe ser uno de: ${TIPOS.join(', ')}`);
  if (!validarUrl(url)) errores.push('La URL no es válida. Debe ser http o https y tener dominio.');
  if (errores.length) return json({ ok: false, errores }, 400);

  const [cliente] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cliente) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  const [creado] = await db
    .insert(clientLinks)
    .values({ clientId, tipo, url: normalizarUrl(url) })
    .returning();

  return json({ ok: true, enlace: creado }, 201);
};

export const DELETE: APIRoute = async ({ params, url }) => {
  const clientId = params.id!;
  const linkId = url.searchParams.get('linkId');
  if (!linkId) return json({ ok: false, errores: ['Falta linkId'] }, 400);

  const [borrado] = await db
    .delete(clientLinks)
    .where(and(eq(clientLinks.id, linkId), eq(clientLinks.clientId, clientId)))
    .returning({ id: clientLinks.id });

  if (!borrado) return json({ ok: false, errores: ['El enlace no existe'] }, 404);
  return json({ ok: true, id: borrado.id });
};
