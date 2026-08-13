import { eq, desc } from 'drizzle-orm';
import { db, researchJobs, researchResults, growthResults, clients } from '@/db';
import { calcularCosto } from '@/lib/cost';
import { repartirPorTope, superaTope } from '@/research/pipeline';
import { armarContextoGrowth } from './contexto';
import { correrEstructura } from './agents/estructura';
import { correrCreativos } from './agents/creativos';
import { correrGoogle } from './agents/google';
import { correrPrompts } from './agents/prompts';

export const ETAPAS_GROWTH = ['estructura', 'creativos', 'google', 'prompts'] as const;
export type EtapaGrowth = typeof ETAPAS_GROWTH[number];

/** `prompts` necesita los creativos, así que espera. Las otras tres no dependen entre sí. */
export function decidirParalelas(etapas: readonly string[]): string[] {
  return etapas.filter((e) => e !== 'prompts');
}

export function decidirPendientesGrowth(estado: Record<string, string>): EtapaGrowth[] {
  return ETAPAS_GROWTH.filter((e) => estado[e] !== 'ok');
}

export function razonDeVacioGrowth(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  return 'Esta etapa no se ejecutó.';
}

export async function ejecutarGrowth(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;

  // El manual solo existe encadenado a una investigación. Sin ella no hay nada
  // sobre lo que razonar, y generarlo igualmente sería inventar la campaña.
  const [investigacion] = await db.select().from(researchResults)
    .where(eq(researchResults.clientId, job.clientId))
    .orderBy(desc(researchResults.version)).limit(1);

  if (!investigacion) {
    await db.update(researchJobs).set({
      estado: 'fallido', finishedAt: new Date(),
      error: 'Este cliente no tiene una investigación completada. El manual de campaña parte de ella.',
    }).where(eq(researchJobs.id, jobId));
    return;
  }

  const tope = Number(process.env.COST_LIMIT_USD || 15);
  const modelo = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const ctx = armarContextoGrowth(investigacion.datos as any, cliente);

  const estado = { ...(job.etapas as Record<string, string>) };
  const resultados: Record<string, any> = {};
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;

  await db.update(researchJobs)
    .set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() })
    .where(eq(researchJobs.id, jobId));

  const vigilar = (e: number, s: number) => {
    gasto.valor += calcularCosto(modelo, e, s);
    return !superaTope(gasto.valor, tope);
  };

  const guardarProgreso = async () => {
    await db.update(researchJobs).set({
      etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    }).where(eq(researchJobs.id, jobId));
  };
  const publicar = () => {
    void guardarProgreso().catch((e) => console.error(`[${jobId}] guardar progreso:`, e));
  };

  const corredores: Record<string, () => Promise<any>> = {
    estructura: () => correrEstructura(ctx, vigilar),
    creativos:  () => correrCreativos(ctx, resultados.estructura ?? null, vigilar),
    google:     () => correrGoogle(ctx, resultados.estructura ?? null, vigilar),
    prompts:    () => correrPrompts(ctx, resultados.creativos ?? null, vigilar),
  };

  const pendientes = decidirPendientesGrowth(estado);
  const paralelas = decidirParalelas(pendientes);

  await repartirPorTope(paralelas, tope, gasto, estado, async (etapa) => {
    const r = await corredores[etapa]();
    resultados[etapa] = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
  }, publicar);
  await guardarProgreso();

  // Los prompts esperan a los creativos: sin la lista de piezas no hay nada que ilustrar.
  if (pendientes.includes('prompts')) {
    if (superaTope(gasto.valor, tope)) {
      estado.prompts = 'omitido_por_costo';
    } else {
      estado.prompts = 'corriendo';
      await db.update(researchJobs)
        .set({ etapaActual: 'prompts', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.prompts();
        resultados.prompts = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        estado.prompts = 'ok';
      } catch (e) {
        estado.prompts = 'fallo';
        console.error(`[${jobId}] prompts:`, e);
      }
    }
  }

  // Se aplana en un solo objeto: cada agente devuelve su trozo del esquema y
  // el manual se rinde con lo que haya, declarando los huecos que queden.
  const datos: Record<string, any> = {
    _huecos: Object.fromEntries(
      ETAPAS_GROWTH.filter((e) => estado[e] !== 'ok')
        .map((e) => [e, razonDeVacioGrowth(estado[e])]),
    ),
  };
  for (const etapa of ETAPAS_GROWTH) Object.assign(datos, resultados[etapa] ?? {});

  const previas = await db.select().from(growthResults).where(eq(growthResults.clientId, job.clientId));
  await db.insert(growthResults).values({
    jobId, clientId: job.clientId, datos, version: previas.length + 1,
  });

  const todasFallaron = ETAPAS_GROWTH.every((e) => estado[e] !== 'ok');
  await db.update(researchJobs).set({
    estado: todasFallaron ? 'fallido' : 'completado',
    etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    error: todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}
