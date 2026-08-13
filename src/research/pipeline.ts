import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from './contexto';
import { correrCompetencia } from './agents/competencia';
import { correrAudiencia } from './agents/audiencia';
import { correrCanales } from './agents/canales';
import { correrMercado } from './agents/mercado';
import { correrSintesis } from './agents/sintesis';
import { calcularCosto } from '@/lib/cost';

export const ETAPAS = ['competencia','audiencia','canales','mercado','sintesis'] as const;
export type Etapa = typeof ETAPAS[number];

export function decidirEtapasPendientes(estado: Record<string, string>): Etapa[] {
  return ETAPAS.filter((e) => estado[e] !== 'ok');
}

export function superaTope(costoAcumulado: number, tope: number): boolean {
  return costoAcumulado >= tope;
}

export async function ejecutarJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const tope = Number(process.env.COST_LIMIT_USD || 15);
  const modeloInv = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const modeloSin = process.env.MODEL_SYNTHESIS || 'claude-opus-5';

  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;

  const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, job.clientId));
  const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, job.clientId));
  const ctx = armarContexto(cliente, links, archivos);

  const estado = { ...(job.etapas as Record<string, string>) };
  const resultados: Record<string, any> = {};
  let costo = Number(job.costoUsd), tIn = job.tokensEntrada, tOut = job.tokensSalida;

  await db.update(researchJobs)
    .set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() })
    .where(eq(researchJobs.id, jobId));

  const corredores: Record<Etapa, () => Promise<any>> = {
    competencia: () => correrCompetencia(ctx),
    audiencia:   () => correrAudiencia(ctx),
    canales:     () => correrCanales(ctx),
    mercado:     () => correrMercado(ctx),
    sintesis:    () => correrSintesis(ctx, resultados as any),
  };

  const pendientes = decidirEtapasPendientes(estado);
  const paralelas = pendientes.filter((e) => e !== 'sintesis');

  const guardarProgreso = async () => {
    await db.update(researchJobs).set({
      etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(costo),
    }).where(eq(researchJobs.id, jobId));
  };

  // Las cuatro de investigación corren en paralelo
  await Promise.all(paralelas.map(async (etapa) => {
    if (superaTope(costo, tope)) { estado[etapa] = 'omitido_por_costo'; return; }
    estado[etapa] = 'corriendo';
    try {
      const r = await corredores[etapa]();
      resultados[etapa] = r.datos;
      tIn += r.tokensEntrada; tOut += r.tokensSalida;
      costo += calcularCosto(modeloInv, r.tokensEntrada, r.tokensSalida);
      estado[etapa] = 'ok';
    } catch (e) {
      estado[etapa] = 'fallo';
      console.error(`[${jobId}] etapa ${etapa}:`, e);
    }
  }));
  await guardarProgreso();

  // La síntesis espera a las demás
  if (pendientes.includes('sintesis')) {
    if (superaTope(costo, tope)) {
      estado.sintesis = 'omitido_por_costo';
    } else {
      estado.sintesis = 'corriendo';
      await db.update(researchJobs).set({ etapaActual: 'sintesis', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.sintesis();
        resultados.sintesis = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        costo += calcularCosto(modeloSin, r.tokensEntrada, r.tokensSalida);
        estado.sintesis = 'ok';
      } catch (e) {
        estado.sintesis = 'fallo';
        console.error(`[${jobId}] síntesis:`, e);
      }
    }
  }

  // Se arma el resultado marcando como vacías las etapas sin datos
  const datos = Object.fromEntries(ETAPAS.map((e) => [
    e,
    resultados[e]
      ? { estado: 'ok', datos: resultados[e] }
      : { estado: 'vacio', razon: razonDeVacio(estado[e]) },
  ]));

  const previas = await db.select().from(researchResults).where(eq(researchResults.clientId, job.clientId));
  await db.insert(researchResults).values({
    jobId, clientId: job.clientId, datos, version: previas.length + 1,
  });

  const todasFallaron = ETAPAS.every((e) => estado[e] !== 'ok');
  await db.update(researchJobs).set({
    estado: todasFallaron ? 'fallido' : 'completado',
    etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(costo),
    error: todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}

function razonDeVacio(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  return 'Esta etapa no se ejecutó.';
}
