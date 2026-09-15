import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ETAPAS, cambiosContratacionRiesgosos } from '@/flujo/reglas';
import { aplicarPlan, etapasDelCliente, planContratacion, registrarEventosContratacion } from '@/flujo/servicio';
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

  // Un operador no puede descontratar una etapa que ya arrancó, ni volver
  // interna una investigación que el cliente ya vio aprobada (regla del
  // dueño, fix I1 punto 3): `cambiosContratacionRiesgosos` es pura y solo
  // señala QUÉ cambios son riesgosos, sin conocer el rol — el 403/409 lo
  // decide esta ruta. El admin sí puede aplicarlos, pero cada uno queda
  // registrado como evento (`registrarEventosContratacion`).
  const actuales = await etapasDelCliente(id);
  const plan = planContratacion(r.data.etapas);
  const riesgos = cambiosContratacionRiesgosos(actuales, plan);

  if (riesgos.length > 0 && locals.usuario.rol !== 'admin') {
    return json({ ok: false, errores: riesgos.map((rg) => rg.razon) }, 409);
  }

  // `plan` ya se calculó arriba para decidir los riesgos: se aplica
  // directamente (aplicarPlan) en vez de volver a llamar planContratacion
  // dentro de aplicarPlanContratacion (limpieza M3, punto 1).
  await aplicarPlan(id, plan);

  if (riesgos.length > 0) {
    await registrarEventosContratacion(id, riesgos, locals.usuario.id);
  }

  return json({ ok: true, etapas: await etapasDelCliente(id) });
};
