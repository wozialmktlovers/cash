import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';
import { db, researchJobs, researchResults, clients } from '@/db';
import { puedeGenerarGrowth, contarEtapasConDatos } from '@/lib/precheck';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ request }) => {
  let crudo: { clientId?: string; tipo?: string };
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const clientId = String(crudo.clientId ?? '').trim();
  if (!clientId) return json({ ok: false, errores: ['Falta clientId'] }, 400);

  const tipo = crudo.tipo === 'growth' ? 'growth' : 'research';

  const [cliente] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!cliente) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // El manual parte de la investigación: sin ella no hay nada que razonar.
  if (tipo === 'growth') {
    const previos = await db.select({ datos: researchResults.datos })
      .from(researchResults).where(eq(researchResults.clientId, clientId));
    const mejor = Math.max(0, ...previos.map((p) => contarEtapasConDatos(p.datos)));
    const r = puedeGenerarGrowth({ etapasConDatos: mejor });
    if (!r.ok) return json({ ok: false, errores: [r.razon] }, 409);
  }

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
    .values({ clientId, tipo, estado: 'encolado', etapas: {} })
    .returning({ id: researchJobs.id });

  return json({ ok: true, id: creado.id }, 201);
};
