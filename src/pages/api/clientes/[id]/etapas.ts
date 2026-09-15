import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ETAPAS } from '@/flujo/reglas';
import { aplicarPlanContratacion, etapasDelCliente } from '@/flujo/servicio';
import { clienteOperable } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cuerpoSchema = z.object({
  etapas: z.array(z.enum(ETAPAS)).min(1, 'Selecciona al menos una etapa'),
});

export const GET: APIRoute = async ({ params, locals }) => {
  const id = params.id!;
  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, etapas: await etapasDelCliente(id) });
};

// Solo quien opera al cliente (admin u operador asignado) contrata etapas.
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;
  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  await aplicarPlanContratacion(id, r.data.etapas);
  return json({ ok: true, etapas: await etapasDelCliente(id) });
};
