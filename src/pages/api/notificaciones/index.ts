import type { APIRoute } from 'astro';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, notificaciones } from '@/db';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Solo las notificaciones de quien pide (nunca las de otro usuario). */
export const GET: APIRoute = async ({ locals }) => {
  const usuario = locals.usuario;

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notificaciones)
    .where(and(eq(notificaciones.usuarioId, usuario.id), isNull(notificaciones.leidaEn)));

  const items = await db
    .select()
    .from(notificaciones)
    .where(eq(notificaciones.usuarioId, usuario.id))
    .orderBy(desc(notificaciones.creadoEn))
    .limit(20);

  return json({ noLeidas: n, items });
};
