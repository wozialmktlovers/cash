import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ACCIONES } from '@/flujo/reglas';
import { ejecutarTransicion } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cuerpoSchema = z.object({
  accion: z.enum(ACCIONES),
  comentario: z.string().trim().max(2000).optional(),
});

// Una transición no permitida responde 409 con la razón en español (spec §3,
// tabla de `aplicarAccion`); una etapa que ese usuario no puede ver u operar
// responde 404, sin distinguir «no existe» de «no es tuya».
export const POST: APIRoute = async ({ params, request, locals }) => {
  const etapaId = params.id!;

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  const resultado = await ejecutarTransicion({
    etapaId, accion: r.data.accion, usuario: locals.usuario, comentario: r.data.comentario,
  });

  if (!resultado.ok) return json({ ok: false, errores: [resultado.razon] }, resultado.status);
  return json({ ok: true, etapa: resultado.etapa });
};
