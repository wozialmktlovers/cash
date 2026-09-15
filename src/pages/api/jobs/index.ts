import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';
import { db, researchJobs, researchResults } from '@/db';
import { investigacionUtil } from '@/lib/precheck';
import { clienteOperable } from '@/lib/visibilidad';
import { puedeGenerar, etapaDeTipo } from '@/flujo/reglas';
import { etapasDelCliente } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request, locals }) => {
  let crudo: { clientId?: string; tipo?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const clientId = String(crudo.clientId ?? '').trim();
  if (!clientId) return json({ ok: false, errores: ['Falta clientId'] }, 400);

  const tipo = crudo.tipo === 'growth' ? 'growth' : crudo.tipo === 'pilares' ? 'pilares' : 'research';

  if (!(await clienteOperable(locals.usuario, clientId))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // `puedeGenerar` (fix I1, punto 1) cubre los tres bloqueos que esta ruta
  // dejaba pasar antes: etapa ni contratada ni interna, `en_revision` (se
  // reemplazaría el documento que el admin está revisando), `aprobada` (hay
  // que reabrirla primero) y dependencias sin cumplir. El manual y el mapa de
  // pilares parten de la investigación: sin ella no hay nada que razonar.
  const etapa = etapaDeTipo(tipo);
  let hayInvestigacionConDatos = true;
  if (etapa !== 'investigacion') {
    const previos = await db.select({ datos: researchResults.datos, version: researchResults.version })
      .from(researchResults).where(eq(researchResults.clientId, clientId));
    hayInvestigacionConDatos = Boolean(investigacionUtil(previos));
  }

  const etapasCliente = await etapasDelCliente(clientId);
  const chequeo = puedeGenerar(etapa, etapasCliente, hayInvestigacionConDatos);
  if (!chequeo.ok) return json({ ok: false, errores: [chequeo.razon] }, 409);

  const [enCurso] = await db
    .select({ id: researchJobs.id })
    .from(researchJobs)
    .where(and(
      eq(researchJobs.clientId, clientId),
      or(eq(researchJobs.estado, 'encolado'), eq(researchJobs.estado, 'corriendo')),
    ))
    .limit(1);

  if (enCurso) {
    return json(
      { ok: false, errores: ['Este cliente ya tiene una investigación en curso'], jobId: enCurso.id },
      409,
    );
  }

  const [creado] = await db
    .insert(researchJobs)
    .values({ clientId, tipo, estado: 'encolado', etapas: {}, creadoPor: locals.usuario.id })
    .returning({ id: researchJobs.id });

  return json({ ok: true, id: creado.id }, 201);
};
