import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults, pilaresResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from '@/research/contexto';
import { repartirPorTope, superaTope } from '@/research/pipeline';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { investigacionUtil } from '@/lib/precheck';
import { correrEstrategia, correrPilar, correrCorreccion } from './agentes';
import {
  asignarIds, todosLosTemas, buscarDuplicados, mixReal, fueraDeMargen, aplicarReemplazos, sonParecidos,
} from './revision';
import type { Estrategia, PilarGenerado, PilarMapa, Tema } from './schemas';

export const ETAPAS_PILARES = ['estrategia', 'pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5', 'revision'] as const;

function razon(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar este pilar.';
  return 'Este pilar no se ejecutó.';
}

export function armarPilares(
  estrategia: Estrategia,
  generados: Record<number, PilarGenerado | undefined>,
  estado: Record<string, string>,
): PilarMapa[] {
  return estrategia.pilares.map((_, i) => {
    const n = i + 1;
    const g = generados[n];
    return g ? asignarIds(n, g) : { numero: n, estado: 'vacio', razon: razon(estado[`pilar${n}`]) };
  });
}

export async function ejecutarPilares(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;
  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;

  const fallar = (error: string) => db.update(researchJobs)
    .set({ estado: 'fallido', error, finishedAt: new Date() }).where(eq(researchJobs.id, jobId));

  // La más reciente CON DATOS, no la más reciente a secas: el pipeline
  // inserta una fila aunque las cinco etapas fallen, así que la versión más
  // alta puede estar vacía mientras una anterior sí tiene con qué trabajar.
  // Misma regla que el precheck de POST /api/jobs, para que un cliente que
  // la API deja «listo» nunca falle el job al arrancar.
  const resultados = await db.select().from(researchResults).where(eq(researchResults.clientId, job.clientId));
  const investigacion = investigacionUtil(resultados);
  if (!investigacion) {
    await fallar('Este cliente no tiene una investigación con datos. El mapa de pilares parte de ella.');
    return;
  }

  const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, job.clientId));
  const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, job.clientId));
  const ctx = armarContexto(cliente, links, archivos);

  const tope = leerTopeUsd(process.env.COST_LIMIT_USD, 15, 'COST_LIMIT_USD');
  const modeloSin = process.env.MODEL_SYNTHESIS || 'claude-opus-5';
  const modeloInv = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const estado: Record<string, string> = { ...(job.etapas as Record<string, string>) };
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;

  const vigilar = (modelo: string) => (e: number, s: number) => {
    gasto.valor += calcularCosto(modelo, e, s);
    return !superaTope(gasto.valor, tope);
  };
  const guardar = () => db.update(researchJobs).set({
    etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
  }).where(eq(researchJobs.id, jobId));
  const publicar = () => { void guardar().catch((e) => console.error(`[${jobId}] guardar progreso:`, e)); };

  await db.update(researchJobs).set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() }).where(eq(researchJobs.id, jobId));

  // 1 · Estrategia. Sin ella no hay pilares que escribir: el job termina aquí.
  let estrategia: Estrategia;
  estado.estrategia = 'corriendo';
  await db.update(researchJobs).set({ etapaActual: 'estrategia', etapas: estado }).where(eq(researchJobs.id, jobId));
  try {
    const r = await correrEstrategia(ctx, investigacion.datos as Record<string, unknown>, vigilar(modeloSin));
    estrategia = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
    estado.estrategia = 'ok';
  } catch (e) {
    console.error(`[${jobId}] estrategia:`, e);
    estado.estrategia = 'fallo';
    await guardar();
    await fallar('No se pudo definir la estrategia del mapa.');
    return;
  }
  await guardar();

  // 2 · Los cinco pilares en paralelo, con freno de costo.
  const generados: Record<number, PilarGenerado> = {};
  const pilaresEtapas = ['pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5'];
  await repartirPorTope(pilaresEtapas, tope, gasto, estado, async (etapa) => {
    const n = Number(etapa.slice(-1));
    const r = await correrPilar(ctx, estrategia, n, vigilar(modeloInv));
    generados[n] = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
  }, publicar);
  await guardar();

  // 3 · Revisión en código y una sola ronda de corrección de duplicados.
  estado.revision = 'corriendo';
  await db.update(researchJobs).set({ etapaActual: 'revision', etapas: estado }).where(eq(researchJobs.id, jobId));
  let pilares = armarPilares(estrategia, generados, estado);
  let reescritos = 0;
  const duplicados = buscarDuplicados(todosLosTemas(pilares));

  if (duplicados.length && !superaTope(gasto.valor, tope)) {
    const temas = todosLosTemas(pilares);
    const porId = new Map(temas.map((t) => [t.id, t]));
    const repetidos = [...new Set(duplicados.map(([, b]) => b))];
    const porPilar = new Map<number, Tema[]>();
    for (const id of repetidos) {
      const n = Number(id[1]);
      porPilar.set(n, [...(porPilar.get(n) ?? []), porId.get(id)!]);
    }
    for (const [n, aReescribir] of porPilar) {
      if (superaTope(gasto.valor, tope)) break;
      try {
        const ids = new Set(aReescribir.map((t) => t.id));
        const evitar = temas.filter((t) => !ids.has(t.id)).map((t) => t.texto);
        const r = await correrCorreccion(estrategia, n, aReescribir, evitar, vigilar(modeloInv));
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        // Solo se aceptan reemplazos de ids pedidos que ya no se parezcan a nada del mapa.
        const validos = r.datos.temas.filter((t) => ids.has(t.id) && !evitar.some((otro) => sonParecidos(t.texto, otro)));
        pilares = aplicarReemplazos(pilares, validos);
        reescritos += validos.length;
      } catch (e) {
        console.error(`[${jobId}] corrección pilar ${n}:`, e);
      }
    }
  }

  const finales = todosLosTemas(pilares);
  const real = mixReal(finales);
  const revision = {
    duplicadosRestantes: buscarDuplicados(finales),
    mixReal: real,
    fueraDeMargen: fueraDeMargen(estrategia.mix, real),
    reescritos,
  };
  estado.revision = 'ok';

  const previas = await db.select({ id: pilaresResults.id }).from(pilaresResults).where(eq(pilaresResults.clientId, job.clientId));
  await db.insert(pilaresResults).values({
    jobId, clientId: job.clientId, datos: { estrategia, pilares, revision }, version: previas.length + 1,
  });

  await db.update(researchJobs).set({
    estado: 'completado', etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor), error: null,
  }).where(eq(researchJobs.id, jobId));
}
