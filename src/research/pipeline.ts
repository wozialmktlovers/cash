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

/**
 * Corre etapas en paralelo comprobando el tope antes de arrancar cada una.
 *
 * El gasto viaja en una caja mutable a propósito. La versión anterior leía una
 * variable capturada en el momento de lanzar las cuatro etapas a la vez, así
 * que las cuatro veían cero y ninguna se frenaba nunca: el tope solo podía
 * impedir la última etapa, la que espera a las demás. Con la caja, cada etapa
 * que arranca ve lo que llevan gastado las que ya terminaron.
 *
 * Sigue sin poder cortar una etapa a mitad —eso lo hace `onUso` dentro de
 * `pedirJson`—, pero ya no lanza trabajo nuevo con el presupuesto agotado.
 */
export async function repartirPorTope(
  etapas: string[],
  tope: number,
  gasto: { valor: number },
  estado: Record<string, string>,
  correr: (etapa: string) => Promise<void>,
  publicar: () => void = () => {},
): Promise<void> {
  await Promise.all(etapas.map(async (etapa) => {
    if (superaTope(gasto.valor, tope)) {
      estado[etapa] = 'omitido_por_costo';
      publicar();
      return;
    }
    estado[etapa] = 'corriendo';
    publicar();
    try {
      await correr(etapa);
      estado[etapa] = 'ok';
    } catch (e) {
      estado[etapa] = 'fallo';
      console.error(`[etapa ${etapa}]`, e);
    }
    publicar();
  }));
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
  // El costo va en caja mutable para que las etapas paralelas que aún no han
  // arrancado vean lo que llevan gastado las que ya terminaron.
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;

  await db.update(researchJobs)
    .set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() })
    .where(eq(researchJobs.id, jobId));

  /**
   * Freno dentro de la etapa. La búsqueda web encadena llamadas sin volver al
   * pipeline, así que sin esto una sola etapa puede pasarse del tope entera.
   * Se cobra al vuelo cada respuesta y se corta la reanudación al llegar.
   */
  const vigilar = (modelo: string) => (e: number, s: number) => {
    gasto.valor += calcularCosto(modelo, e, s);
    return !superaTope(gasto.valor, tope);
  };

  const corredores: Record<Etapa, () => Promise<any>> = {
    competencia: () => correrCompetencia(ctx, vigilar(modeloInv)),
    audiencia:   () => correrAudiencia(ctx, vigilar(modeloInv)),
    canales:     () => correrCanales(ctx, vigilar(modeloInv)),
    mercado:     () => correrMercado(ctx, vigilar(modeloInv)),
    sintesis:    () => correrSintesis(ctx, resultados as any, vigilar(modeloSin)),
  };

  const pendientes = decidirEtapasPendientes(estado);
  const paralelas = pendientes.filter((e) => e !== 'sintesis');

  const guardarProgreso = async () => {
    await db.update(researchJobs).set({
      etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    }).where(eq(researchJobs.id, jobId));
  };

  /**
   * Publica el avance en cuanto cambia, sin bloquear al agente.
   * Las cuatro etapas paralelas escriben la misma columna, así que una
   * escritura puede pisar a otra; da igual, cada una guarda el objeto completo
   * y el guardado final es el autoritativo. Sin esto, la página de progreso se
   * queda en blanco hasta que terminan las cuatro.
   */
  const publicar = () => {
    void guardarProgreso().catch((e) => console.error(`[${jobId}] guardar progreso:`, e));
  };

  // Las cuatro de investigación corren en paralelo
  // El costo ya lo cobró `vigilar` respuesta a respuesta: aquí solo se
  // acumulan los tokens para el reporte. Volver a sumarlo lo contaría doble.
  await repartirPorTope(paralelas, tope, gasto, estado, async (etapa) => {
    const r = await corredores[etapa as Etapa]();
    resultados[etapa] = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
  }, publicar);
  await guardarProgreso();

  // La síntesis espera a las demás
  if (pendientes.includes('sintesis')) {
    if (superaTope(gasto.valor, tope)) {
      estado.sintesis = 'omitido_por_costo';
    } else {
      estado.sintesis = 'corriendo';
      await db.update(researchJobs).set({ etapaActual: 'sintesis', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.sintesis();
        resultados.sintesis = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
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
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    error: todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}

function razonDeVacio(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  return 'Esta etapa no se ejecutó.';
}
