import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, clients } from '@/db';
import { validarCliente } from '@/lib/clientes';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PATCH: APIRoute = async ({ params, request }) => {
  const id = params.id!;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = validarCliente(crudo);
  if (!r.ok) return json({ ok: false, errores: r.errores }, 400);

  const [actualizado] = await db
    .update(clients)
    .set({ ...r.datos, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!actualizado) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, id: actualizado.id });
};

export const DELETE: APIRoute = async ({ params }) => {
  const id = params.id!;

  const [borrado] = await db
    .delete(clients)
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!borrado) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, id: borrado.id });
};
