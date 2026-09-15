import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from './contexto';
import { correrCompetencia } from './agents/competencia';
import { correrAudiencia } from './agents/audiencia';
import { correrCanales } from './agents/canales';
import { correrMercado } from './agents/mercado';
import { correrSintesis } from './agents/sintesis';
import { correrLectura } from './agents/lectura';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { esRespuestaInvalida } from './convertir-lecturas';
import { contarEtapasConDatos } from '@/lib/precheck';
import { registrarEntregable } from '@/flujo/servicio';

export const ETAPAS = ['competencia','audiencia','canales','mercado','sintesis','lectura'] as const;
export type Etapa = typeof ETAPAS[number];

export function decidirEtapasPendientes(estado: Record<string, string>): Etapa[] {
  return ETAPAS.filter((e) => estado[e] !== 'ok');
}

export function superaTope(costoAcumulado: number, tope: number): boolean {
  return costoAcumulado >= tope;
}

const PREVIAS_A_LECTURA = ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis'];

/** La lectura reescribe lo investigado: sin nada investigado no hay qué explicar. */
export function hayDatosParaLectura(resultados: Record<string, unknown>): boolean {
  return PREVIAS_A_LECTURA.some((k) => Boolean(resultados[k]));
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

  const tope = leerTopeUsd(process.env.COST_LIMIT_USD, 15, 'COST_LIMIT_USD');
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
    lectura:     () => correrLectura(ctx, resultados as any, vigilar(modeloSin)),
  };

  const pendientes = decidirEtapasPendientes(estado);
  const paralelas = pendientes.filter((e) => e !== 'sintesis' && e !== 'lectura');

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

  // La lectura para el cliente espera a la síntesis y reescribe todo lo anterior.
  let errorLectura: unknown;
  if (pendientes.includes('lectura') && hayDatosParaLectura(resultados)) {
    if (superaTope(gasto.valor, tope)) {
      estado.lectura = 'omitido_por_costo';
    } else {
      estado.lectura = 'corriendo';
      await db.update(researchJobs).set({ etapaActual: 'lectura', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.lectura();
        resultados.lectura = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        estado.lectura = 'ok';
      } catch (e) {
        estado.lectura = 'fallo';
        errorLectura = e;
        console.error(`[${jobId}] lectura:`, e);
      }
    }
  }

  // Se arma el resultado marcando como vacías las etapas sin datos. La
  // lectura es aparte: `entradaLectura` decide si se omite del todo.
  const datos: Record<string, unknown> = Object.fromEntries(ETAPAS.filter((e) => e !== 'lectura').map((e) => [
    e,
    resultados[e]
      ? { estado: 'ok', datos: resultados[e] }
      : { estado: 'vacio', razon: razonDeVacio(estado[e]) },
  ]));
  const entrada = entradaLectura(estado.lectura, resultados.lectura, errorLectura);
  if (entrada) datos.lectura = entrada;

  const previas = await db.select().from(researchResults).where(eq(researchResults.clientId, job.clientId));
  const [resultado] = await db.insert(researchResults).values({
    jobId, clientId: job.clientId, datos, version: previas.length + 1,
  }).returning({ id: researchResults.id });

  // Solo se registra como entregable si de verdad trae datos: el pipeline
  // inserta una fila aunque las seis etapas fallen, para dejar constancia
  // del intento, y esa fila vacía no debe poner la etapa en_proceso.
  if (contarEtapasConDatos(datos) > 0) {
    try {
      await registrarEntregable(job.clientId, 'research', resultado.id, job.creadoPor);
    } catch (e) {
      console.error('[flujo] registrarEntregable research:', e);
    }
  }

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

export type EntradaLectura = { estado: 'ok'; datos: unknown } | { estado: 'vacio'; razon: string } | undefined;

/**
 * Qué guardar en `datos.lectura`, a diferencia de las demás etapas. Un
 * fallo transitorio (saldo, red, 5xx) no se guarda como «vacío»: se omite
 * la clave para que `necesitaLectura` la reintente en el siguiente arranque
 * en vez de darla por perdida. Un fallo por respuesta inválida (jerga,
 * cifra inventada, JSON roto) sí es definitivo y se guarda como vacío, igual
 * que `omitido_por_costo` en las demás etapas no lo es aquí: correr al
 * cliente le puede tocar el tope de un job ajeno, así que también se omite.
 */
export function entradaLectura(estadoLectura: string | undefined, datosLectura: unknown, error: unknown): EntradaLectura {
  if (datosLectura) return { estado: 'ok', datos: datosLectura };
  if (estadoLectura === 'omitido_por_costo') return undefined;
  if (estadoLectura === 'fallo') {
    return esRespuestaInvalida(error) ? { estado: 'vacio', razon: razonDeVacio(estadoLectura) } : undefined;
  }
  // No se intentó (sin datos previos que leer, o ni siquiera era la etapa pendiente): igual que antes.
  return { estado: 'vacio', razon: razonDeVacio(estadoLectura) };
}
