import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults } from '@/db';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ params }) => {
  const id = params.id!;

  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, id)).limit(1);
  if (!job) return json({ ok: false, errores: ['La investigación no existe'] }, 404);

  const [resultado] = await db
    .select({ id: researchResults.id })
    .from(researchResults)
    .where(eq(researchResults.jobId, job.id))
    .limit(1);

  return json({
    ok: true,
    id: job.id,
    clientId: job.clientId,
    estado: job.estado,
    etapaActual: job.etapaActual,
    etapas: job.etapas,
    costoUsd: Number(job.costoUsd),
    tokensEntrada: job.tokensEntrada,
    tokensSalida: job.tokensSalida,
    error: job.error,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    resultId: resultado?.id ?? null,
  });
};
