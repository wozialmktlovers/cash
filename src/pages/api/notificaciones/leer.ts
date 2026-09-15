import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db, notificaciones } from '@/db';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cuerpoSchema = z.object({ ids: z.array(z.string().uuid()).optional() });

// Sin `ids` (o con un cuerpo vacío, como manda el botón «Marcar todas») marca
// todas las propias como leídas; con `ids`, solo esas. La condición siempre
// exige `usuario_id = quien pide`, así que nadie puede marcar avisos ajenos.
export const POST: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;

  let crudo: unknown = {};
  const texto = await request.text();
  if (texto) {
    try {
      crudo = JSON.parse(texto);
    } catch {
      return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
    }
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  const propias = eq(notificaciones.usuarioId, usuario.id);
  const condicion = r.data.ids && r.data.ids.length > 0 ? and(propias, inArray(notificaciones.id, r.data.ids)) : propias;

  await db.update(notificaciones).set({ leidaEn: new Date() }).where(condicion);
  return json({ ok: true });
};
