import type { APIRoute } from 'astro';
import { db, clients } from '@/db';
import { validarCliente } from '@/lib/clientes';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = validarCliente(crudo);
  if (!r.ok) return json({ ok: false, errores: r.errores }, 400);

  const [creado] = await db.insert(clients).values(r.datos).returning({ id: clients.id });
  return json({ ok: true, id: creado.id }, 201);
};
