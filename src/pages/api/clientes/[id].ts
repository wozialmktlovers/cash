import type { APIRoute } from 'astro';
import { eq, inArray } from 'drizzle-orm';
import { db, clients, documentoVersiones, researchResults, growthResults, pilaresResults } from '@/db';
import { validarCliente } from '@/lib/clientes';
import { clienteOperable } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;

  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

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

export const DELETE: APIRoute = async ({ params, locals }) => {
  const id = params.id!;

  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // `documento_versiones` no tiene FK hacia research/growth/pilares_results
  // (ver comentario en el schema): borrar el cliente en cascada deja esas
  // versiones huérfanas si no se limpian primero, a mano, en la misma
  // transacción que el borrado.
  const borrado = await db.transaction(async (tx) => {
    const [investigaciones, manuales, pilares] = await Promise.all([
      tx.select({ id: researchResults.id }).from(researchResults).where(eq(researchResults.clientId, id)),
      tx.select({ id: growthResults.id }).from(growthResults).where(eq(growthResults.clientId, id)),
      tx.select({ id: pilaresResults.id }).from(pilaresResults).where(eq(pilaresResults.clientId, id)),
    ]);
    const documentoIds = [...investigaciones, ...manuales, ...pilares].map((r) => r.id);
    if (documentoIds.length > 0) {
      await tx.delete(documentoVersiones).where(inArray(documentoVersiones.documentoId, documentoIds));
    }
    return tx.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
  });

  if (borrado.length === 0) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, id: borrado[0].id });
};
