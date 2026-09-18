import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults, growthResults, clients } from '@/db';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { investigacionUtil } from '@/lib/precheck';
import { repartirPorTope, superaTope, marcarDetenidas } from '@/research/pipeline';
import { CorteDeTrabajo, motivoDeCorte, cortar, nuevaCaja } from '@/lib/errores-agentes';
import { registrarEntregable } from '@/flujo/servicio';
import { armarContextoGrowth } from './contexto';
import { correrEstructura } from './agents/estructura';
import { correrCreativos } from './agents/creativos';
import { correrGoogle } from './agents/google';
import { correrPrompts } from './agents/prompts';

export const ETAPAS_GROWTH = ['estructura', 'creativos', 'google', 'prompts'] as const;
export type EtapaGrowth = typeof ETAPAS_GROWTH[number];

/**
 * Orden de ejecución, en fases. Creativos y Google leen los ángulos y las
 * campañas que decide `estructura`; antes corrían en paralelo con ella y
 * siempre recibían `null`, así que cada uno inventaba su propia estructura.
 * `prompts` necesita los creativos. Dentro de una fase, las etapas van en
 * paralelo. `prompts` se ejecuta aparte (ver `ejecutarGrowth`).
 */
export function decidirFases(etapas: readonly string[]): string[][] {
  return [
    etapas.filter((e) => e === 'estructura'),
    etapas.filter((e) => e === 'creativos' || e === 'google'),
  ].filter((f) => f.length);
}

/**
 * Corre una etapa y, si falla, deja el error en el registro con el id del
 * trabajo antes de propagarlo. Sin esto, el manual de «Mar de miel» terminó
 * con `estructura` y `google` en `fallo` y nada en los registros que lo
 * explicara ni lo ligara al trabajo.
 */
export async function conRegistro<T>(jobId: string, etapa: string, correr: () => Promise<T>): Promise<T> {
  try {
    return await correr();
  } catch (e) {
    console.error(`[${jobId}] ${etapa}:`, e);
    throw e;
  }
}

export function decidirPendientesGrowth(estado: Record<string, string>): EtapaGrowth[] {
  return ETAPAS_GROWTH.filter((e) => estado[e] !== 'ok');
}

export function razonDeVacioGrowth(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  if (estado === 'abortado') return 'El trabajo se detuvo antes de terminar esta etapa. Vuelve a lanzarlo.';
  return 'Esta etapa no se ejecutó.';
}

export async function ejecutarGrowth(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;

  // El manual solo existe encadenado a una investigación. Sin ella no hay nada
  // sobre lo que razonar, y generarlo igualmente sería inventar la campaña.
  // La misma regla que la API: la investigación más reciente que tenga datos.
  const investigaciones = await db.select().from(researchResults).where(eq(researchResults.clientId, job.clientId));
  const investigacion = investigacionUtil(investigaciones);

  if (!investigacion) {
    await db.update(researchJobs).set({
      estado: 'fallido', finishedAt: new Date(),
      error: 'Este cliente no tiene una investigación completada. El manual de campaña parte de ella.',
    }).where(eq(researchJobs.id, jobId));
    return;
  }

  const tope = leerTopeUsd(process.env.COST_LIMIT_USD, 15, 'COST_LIMIT_USD');
  const modelo = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const ctx = armarContextoGrowth(investigacion.datos as any, cliente);

  const estado = { ...(job.etapas as Record<string, string>) };
  const resultados: Record<string, any> = {};
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;

  await db.update(researchJobs)
    .set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() })
    .where(eq(researchJobs.id, jobId));

  // Misma caja que en investigación: un error de cuenta corta el manual entero
  // y, mientras tanto, frena las reanudaciones de las etapas que siguen vivas.
  const corte = nuevaCaja();

  const vigilar = (e: number, s: number) => {
    gasto.valor += calcularCosto(modelo, e, s);
    return !corte.valor && !superaTope(gasto.valor, tope);
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

  try {
    for (const fase of decidirFases(pendientes)) {
      await repartirPorTope(fase, tope, gasto, estado, async (etapa) => {
        const r = await conRegistro(jobId, etapa, corredores[etapa]);
        resultados[etapa] = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        if (r.parcial) console.warn(`[${jobId}] ${etapa}: guardada a medias; se descartó: ${r.descartes?.join(' | ')}`);
      }, publicar, corte);
    }
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
          estado.prompts = motivoDeCorte(e) ? 'abortado' : 'fallo';
          console.error(`[${jobId}] prompts:`, e);
          cortar(corte, e);
        }
      }
    }
  } catch (e) {
    if (!(e instanceof CorteDeTrabajo)) throw e;
    marcarDetenidas(pendientes, estado);
    console.error(`[${jobId}] trabajo cortado (${e.motivo}):`, e.causa);
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
  const [resultado] = await db.insert(growthResults).values({
    jobId, clientId: job.clientId, datos, version: previas.length + 1,
  }).returning({ id: growthResults.id });

  const todasFallaron = ETAPAS_GROWTH.every((e) => estado[e] !== 'ok');

  // Igual que research: el pipeline inserta el resultado aunque las cuatro
  // etapas hayan fallado, para dejar constancia del intento. Esa fila vacía
  // (puro `_huecos`) no debe mover la etapa a en_proceso. Lo que un corte
  // consiguió antes de saltar sí cuenta como entregable: está pagado y sirve.
  if (!todasFallaron) {
    try {
      await registrarEntregable(job.clientId, 'growth', resultado.id, job.creadoPor);
    } catch (e) {
      console.error('[flujo] registrarEntregable growth:', e);
    }
  }
  // El corte manda sobre el desenlace: aunque alguna etapa trajera datos, el
  // manual no está terminado y hay que volver a lanzarlo con saldo.
  await db.update(researchJobs).set({
    estado: corte.valor || todasFallaron ? 'fallido' : 'completado',
    etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    error: corte.valor ? corte.valor.message : todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}
