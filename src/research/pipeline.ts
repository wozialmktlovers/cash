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
import {
  CorteDeTrabajo, motivoDeCorte, cortar, nuevaCaja, type Corte,
} from '@/lib/errores-agentes';

export const ETAPAS = ['competencia','audiencia','canales','mercado','sintesis','lectura'] as const;
export type Etapa = typeof ETAPAS[number];

export function decidirEtapasPendientes(estado: Record<string, string>): Etapa[] {
  return ETAPAS.filter((e) => estado[e] !== 'ok');
}

export function superaTope(costoAcumulado: number, tope: number): boolean {
  return costoAcumulado >= tope;
}

/**
 * Parte del tope que las cuatro etapas con búsqueda web no pueden tocar: queda
 * para la síntesis y la lectura, que corren al final y son las que el cliente
 * lee. Sin reserva, las cuatro paralelas se comían el tope entero (en «Mar de
 * miel» llegaron a 15.70 de 15) y las dos últimas salían `omitido_por_costo`:
 * el dinero se iba en datos crudos que nadie llegaba a resumir.
 *
 * 20 % del tope: 3 USD con el tope de 15. Una síntesis con Opus cuesta del
 * orden de 0.3–1 USD (entrada ~30k tokens, salida hasta 32k) y la lectura
 * 0.3–0.8; con su reintento en el peor caso, 3 USD alcanzan para las dos.
 */
export const FRACCION_RESERVA_FINAL = 0.2;

export function repartirPresupuesto(tope: number): { investigacion: number; reserva: number } {
  const reserva = Math.round(tope * FRACCION_RESERVA_FINAL * 100) / 100;
  return { investigacion: tope - reserva, reserva };
}

/**
 * Freno de gasto que se le pasa a `pedirJson` como `onUso`: cobra cada
 * respuesta en la caja compartida y dice si se puede seguir reanudando.
 * Las etapas de búsqueda reciben el límite de investigación (tope menos la
 * reserva); la síntesis y la lectura, el tope completo.
 */
export function frenoDeGasto(
  gasto: { valor: number },
  limite: number,
  corte: Corte,
  cobrar: (e: number, s: number) => number,
) {
  return (e: number, s: number): boolean => {
    gasto.valor += cobrar(e, s);
    return !corte.valor && !superaTope(gasto.valor, limite);
  };
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
 * `corte` es la segunda caja compartida y cubre el otro modo de quemar dinero:
 * un error irrecuperable de la cuenta (sin saldo, llave inválida). En cuanto
 * una etapa choca con uno, se anota ahí y esta función lanza al terminar, para
 * que el pipeline no siga con las etapas que vienen después. Lo que NO puede
 * hacer es matar una etapa que ya está en vuelo —no hay cómo cancelar una
 * promesa—, así que se espera a las cinco:
 *
 * - la que ya tenía sus datos se queda en `ok` y el pipeline los guarda; el
 *   corte no tira trabajo bueno ya pagado;
 * - las que siguen hablando con la API reciben el mismo error en su siguiente
 *   llamada y, además, el `vigilar` de cada pipeline devuelve `false` en cuanto
 *   la caja tiene algo, así que `pedirJson` deja de reanudar búsquedas web.
 *
 * Una etapa que cae por el corte se marca `abortado`, no `fallo`: no es que el
 * agente devolviera basura, es que no llegó a hablar con nadie, y esa
 * diferencia decide si se reintenta más adelante (ver `entradaLectura`).
 */
export async function repartirPorTope(
  etapas: string[],
  tope: number,
  gasto: { valor: number },
  estado: Record<string, string>,
  correr: (etapa: string) => Promise<void>,
  publicar: () => void = () => {},
  corte: Corte = nuevaCaja(),
): Promise<void> {
  await Promise.all(etapas.map(async (etapa) => {
    if (corte.valor) {
      estado[etapa] = 'abortado';
      publicar();
      return;
    }
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
      const motivo = motivoDeCorte(e);
      estado[etapa] = motivo ? 'abortado' : 'fallo';
      console.error(`[etapa ${etapa}]`, e);
      if (motivo) corte.valor ??= new CorteDeTrabajo(motivo, e);
    }
    publicar();
  }));

  if (corte.valor) throw corte.valor;
}

/**
 * Deja constancia de las etapas que el corte dejó sin ejecutar (o a medias, si
 * se quedaron en `corriendo`). No toca las que ya tienen un desenlace propio:
 * una etapa `ok` guarda sus datos y una `fallo` guarda su razón.
 */
export function marcarDetenidas(etapas: readonly string[], estado: Record<string, string>): void {
  const cerradas = new Set(['ok', 'fallo', 'omitido_por_costo', 'abortado']);
  for (const e of etapas) {
    if (!cerradas.has(estado[e])) estado[e] = 'abortado';
  }
}

export async function ejecutarJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const tope = leerTopeUsd(process.env.COST_LIMIT_USD, 15, 'COST_LIMIT_USD');
  // Solo las cuatro etapas con búsqueda web usan MODEL_BUSQUEDA (p. ej. Haiku, la
  // más barata); el resto sigue con MODEL_RESEARCH.
  const modeloInv = process.env.MODEL_BUSQUEDA || process.env.MODEL_RESEARCH || 'claude-sonnet-5';
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

  // La caja del corte se declara antes que `vigilar` porque `vigilar` la lee.
  const corte = nuevaCaja();

  /**
   * Freno dentro de la etapa. La búsqueda web encadena llamadas sin volver al
   * pipeline, así que sin esto una sola etapa puede pasarse del tope entera.
   * Se cobra al vuelo cada respuesta y se corta la reanudación al llegar.
   *
   * Frena por dos motivos, no por uno: el tope de costo de siempre y, desde el
   * incidente del saldo agotado, el corte. Así una etapa que sigue en vuelo
   * cuando una hermana ya chocó con el 400 deja de reanudar su búsqueda web en
   * vez de encadenar llamadas que van a fallar todas igual.
   */
  const presupuesto = repartirPresupuesto(tope);
  const vigilar = (modelo: string, limite: number) =>
    frenoDeGasto(gasto, limite, corte, (e, s) => calcularCosto(modelo, e, s));

  // Las de búsqueda frenan en `presupuesto.investigacion`; la síntesis y la
  // lectura pueden usar hasta el tope, que es donde está su reserva.
  const corredores: Record<Etapa, () => Promise<any>> = {
    competencia: () => correrCompetencia(ctx, vigilar(modeloInv, presupuesto.investigacion)),
    audiencia:   () => correrAudiencia(ctx, vigilar(modeloInv, presupuesto.investigacion)),
    canales:     () => correrCanales(ctx, vigilar(modeloInv, presupuesto.investigacion)),
    mercado:     () => correrMercado(ctx, vigilar(modeloInv, presupuesto.investigacion)),
    sintesis:    () => correrSintesis(ctx, resultados as any, vigilar(modeloSin, tope)),
    lectura:     () => correrLectura(ctx, resultados as any, vigilar(modeloSin, tope)),
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

  // Todo lo que habla con el modelo va dentro de este `try`. Un error de cuenta
  // (sin saldo, llave inválida) sale por aquí como `CorteDeTrabajo` y se salta
  // las etapas que faltaban; el resto del pipeline —guardar lo conseguido,
  // insertar el resultado, cerrar el job— sigue corriendo igual. Es la parte
  // que importa del arreglo: se aborta lo que falta, no lo que ya se pagó.
  let errorLectura: unknown;
  try {
    // Las cuatro de investigación corren en paralelo
    // El costo ya lo cobró `vigilar` respuesta a respuesta: aquí solo se
    // acumulan los tokens para el reporte. Volver a sumarlo lo contaría doble.
    // Con `presupuesto.investigacion`, no con `tope`: una etapa que arranca
    // cuando las otras ya gastaron la parte de investigación se omite, y la
    // reserva sigue intacta para la síntesis y la lectura.
    await repartirPorTope(paralelas, presupuesto.investigacion, gasto, estado, async (etapa) => {
      const r = await corredores[etapa as Etapa]();
      resultados[etapa] = r.datos;
      tIn += r.tokensEntrada; tOut += r.tokensSalida;
      if (r.parcial) console.warn(`[${jobId}] ${etapa}: guardada a medias; se descartó: ${(r.descartes ?? []).join(' | ')}`);
    }, publicar, corte);
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
          estado.sintesis = motivoDeCorte(e) ? 'abortado' : 'fallo';
          console.error(`[${jobId}] síntesis:`, e);
          cortar(corte, e);
        }
      }
    }

    // La lectura para el cliente espera a la síntesis y reescribe todo lo anterior.
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
          estado.lectura = motivoDeCorte(e) ? 'abortado' : 'fallo';
          errorLectura = e;
          console.error(`[${jobId}] lectura:`, e);
          cortar(corte, e);
        }
      }
    }
  } catch (e) {
    if (!(e instanceof CorteDeTrabajo)) throw e;
    // Las etapas que nunca llegaron a arrancar quedan como `abortado`, no como
    // «no se ejecutó»: la diferencia es lo que hace que `entradaLectura` las
    // deje pendientes de reintento en vez de darlas por perdidas.
    marcarDetenidas(pendientes, estado);
    console.error(`[${jobId}] trabajo cortado (${e.motivo}):`, e.causa);
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

  // Un trabajo cortado cuenta como fallido aunque alguna etapa haya salido
  // bien: no terminó, y quien lo lanzó tiene que recargar y volver a lanzarlo
  // (el aviso de `job_fallido` sale de este estado). Los datos que sí se
  // consiguieron ya quedaron guardados arriba, así que relanzarlo no los repite
  // desde cero. El `error` que se guarda es el mensaje legible del corte, no el
  // volcado del SDK: es lo que `ProgresoJob` pinta tal cual en pantalla.
  const todasFallaron = ETAPAS.every((e) => estado[e] !== 'ok');
  await db.update(researchJobs).set({
    estado: corte.valor || todasFallaron ? 'fallido' : 'completado',
    etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
    error: corte.valor ? corte.valor.message : todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}

export function razonDeVacio(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  if (estado === 'abortado') return 'El trabajo se detuvo antes de terminar esta etapa. Vuelve a lanzarlo.';
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
 * `abortado` (el trabajo se cortó por un error de cuenta) va con los
 * transitorios por la misma razón: recargando saldo se resuelve.
 */
export function entradaLectura(estadoLectura: string | undefined, datosLectura: unknown, error: unknown): EntradaLectura {
  if (datosLectura) return { estado: 'ok', datos: datosLectura };
  if (estadoLectura === 'omitido_por_costo') return undefined;
  // Cortada por un error de cuenta: nunca llegó a intentarse de verdad, así que
  // se omite la clave y `necesitaLectura` la vuelve a tomar cuando haya saldo.
  if (estadoLectura === 'abortado') return undefined;
  if (estadoLectura === 'fallo') {
    return esRespuestaInvalida(error) ? { estado: 'vacio', razon: razonDeVacio(estadoLectura) } : undefined;
  }
  // No se intentó (sin datos previos que leer, o ni siquiera era la etapa pendiente): igual que antes.
  return { estado: 'vacio', razon: razonDeVacio(estadoLectura) };
}
