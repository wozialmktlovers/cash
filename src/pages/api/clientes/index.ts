import type { APIRoute } from 'astro';
import { asc } from 'drizzle-orm';
import { db, clients } from '@/db';
import { validarCliente, resumenCliente } from '@/lib/clientes';
import { condicionClientes } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ locals }) => {
  const filas = await db
    .select({ id: clients.id, nombre: clients.nombre, giro: clients.giro, ciudad: clients.ciudad })
    .from(clients)
    .where(condicionClientes(locals.usuario))
    .orderBy(asc(clients.nombre));
  return json({ ok: true, clientes: filas.map(resumenCliente) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = validarCliente(crudo);
  if (!r.ok) return json({ ok: false, errores: r.errores }, 400);

  // Al alta, el responsable es quien lo da de alta (admin u operador); se
  // reasigna después desde la ficha del cliente.
  const [creado] = await db
    .insert(clients)
    .values({ ...r.datos, operadorId: locals.usuario.id })
    .returning({ id: clients.id });
  return json({ ok: true, id: creado.id }, 201);
};
