import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, researchResults, growthResults, pilaresResults } from '@/db';
import { jobVisible } from '@/lib/visibilidad';
import { destinoDeJob } from '@/lib/ui/destino-job';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ params, locals }) => {
  const id = params.id!;

  const visible = await jobVisible(locals.usuario, id);
  if (!visible) return json({ ok: false, errores: ['La investigación no existe'] }, 404);
  const { job } = visible;

  // El resultado vive en una tabla u otra según el tipo del job. El mes con
  // IA no tiene tabla propia: su resultado son piezas dentro del lote, y a
  // donde lleva es la pantalla del mes (`destinoDeJob`).
  const destino = destinoDeJob(job);
  let resultId: string | null = null;
  if (job.tipo === 'contenido') {
    resultId = job.estado === 'completado' ? destino?.loteId ?? null : null;
  } else {
    const tabla = job.tipo === 'growth' ? growthResults : job.tipo === 'pilares' ? pilaresResults : researchResults;
    const [resultado] = await db
      .select({ id: tabla.id })
      .from(tabla)
      .where(eq(tabla.jobId, job.id))
      .limit(1);
    resultId = resultado?.id ?? null;
  }

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
    tipo: job.tipo,
    resultId,
    enlace: destino?.enlace ?? null,
  });
};
