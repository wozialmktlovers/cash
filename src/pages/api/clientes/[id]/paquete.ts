// PUT /api/clientes/[id]/paquete — el paquete mensual del cliente (diseño §3):
// cuántos posts, carruseles, reels e historias lleva cada mes. Cada lote lo
// hereda, «El mes en números» lo compara y la generación con IA produce
// exactamente eso.
//
// Lo edita quien opera al cliente: el admin o el operador asignado. El usuario
// cliente no llega (el middleware le cierra `/api/clientes`) y un operador
// ajeno recibe el mismo 404 que un cliente que no existe.
//
// Todo en cero guarda `null`: «sin paquete».

import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, clients } from '@/db';
import { validarPaquete } from '@/contenido/paquete';
import { clienteOperable } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;
  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const v = validarPaquete(crudo);
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  await db.update(clients).set({ paquete: v.paquete, updatedAt: new Date() }).where(eq(clients.id, id));
  return json({ ok: true, paquete: v.paquete });
};
