import type { APIRoute } from 'astro';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import { db, clients } from '@/db';
import { validarCliente, resumenCliente } from '@/lib/clientes';
import { condicionClientes } from '@/lib/visibilidad';
import { ETAPAS, type Etapa } from '@/flujo/reglas';
import { aplicarPlanContratacion } from '@/flujo/servicio';

// Por omisión, un cliente nuevo se contrata con estas tres. El desarrollo
// mensual ya se puede vender, pero no se marca solo: es trabajo recurrente y
// se contrata a propósito, no por descuido al dar de alta.
const ETAPAS_ALTA_DEFECTO: Etapa[] = ['investigacion', 'pilares', 'manual_campana'];
const etapasSchema = z.array(z.enum(ETAPAS)).min(1, 'Selecciona al menos una etapa').optional();

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

  const etapasR = etapasSchema.safeParse((crudo as { etapas?: unknown })?.etapas);
  if (!etapasR.success) return json({ ok: false, errores: etapasR.error.issues.map((i) => i.message) }, 400);
  const etapasSeleccionadas = etapasR.data ?? ETAPAS_ALTA_DEFECTO;

  // Al alta, el responsable es quien lo da de alta (admin u operador); se
  // reasigna después desde la ficha del cliente. Todo en una transacción:
  // un cliente sin sus etapas contratadas (o viceversa) no es un estado
  // intermedio válido.
  const creado = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(clients)
      .values({ ...r.datos, operadorId: locals.usuario.id })
      .returning({ id: clients.id });
    await aplicarPlanContratacion(c.id, etapasSeleccionadas, tx);
    return c;
  });

  return json({ ok: true, id: creado.id }, 201);
};
