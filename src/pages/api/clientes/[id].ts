import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';
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

  // Solo el admin borra clientes (regla del dueño: el operador crea, modifica
  // y solicita autorizaciones, nunca borra). Mismo criterio que ya usa PATCH
  // .../operador para una acción exclusiva de admin: el rol se revisa ANTES
  // de tocar la base, con 403 — no 404, porque a diferencia de `clienteOperable`
  // esto no depende de qué cliente sea, sino de quién pregunta.
  if (locals.usuario.rol !== 'admin') return json({ ok: false, errores: ['Solo un administrador puede eliminar un cliente'] }, 403);

  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // `documento_versiones` no tiene FK hacia research/growth/pilares_results
  // (ver comentario en el schema), así que borrar el cliente en cascada deja
  // esas versiones huérfanas si no se limpian a mano. Pero el orden importa:
  // `cliente_etapas.version_aprobada_id` SÍ tiene FK (NO ACTION) hacia
  // `documento_versiones`, así que borrar las versiones ANTES que el cliente
  // revienta con una violación de esa FK en cualquier cliente con una etapa
  // aprobada. Por eso: se capturan los pares (tipo, id) primero, se borra el
  // cliente (la cascada se lleva `cliente_etapas` y con ella esa referencia),
  // y solo entonces se borran las versiones — filtrando por (documentoTipo,
  // documentoId) juntos, no por documentoId a secas, porque un mismo uuid
  // nunca debería cruzar tipos pero la tabla no tiene forma de impedirlo.
  const borrado = await db.transaction(async (tx) => {
    const [investigaciones, manuales, pilares] = await Promise.all([
      tx.select({ id: researchResults.id }).from(researchResults).where(eq(researchResults.clientId, id)),
      tx.select({ id: growthResults.id }).from(growthResults).where(eq(growthResults.clientId, id)),
      tx.select({ id: pilaresResults.id }).from(pilaresResults).where(eq(pilaresResults.clientId, id)),
    ]);
    const pares = [
      ...investigaciones.map((r) => ({ tipo: 'research' as const, id: r.id })),
      ...manuales.map((r) => ({ tipo: 'growth' as const, id: r.id })),
      ...pilares.map((r) => ({ tipo: 'pilares' as const, id: r.id })),
    ];

    const filasBorradas = await tx.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
    if (filasBorradas.length === 0) return filasBorradas;

    if (pares.length > 0) {
      await tx.delete(documentoVersiones).where(
        or(...pares.map((p) => and(eq(documentoVersiones.documentoTipo, p.tipo), eq(documentoVersiones.documentoId, p.id)))),
      );
    }

    return filasBorradas;
  });

  if (borrado.length === 0) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, id: borrado[0].id });
};
