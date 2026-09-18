// El trabajo en segundo plano que genera el mes completo (job `contenido`).
// Lo toma el mismo worker que la investigación, el mapa y el manual
// (src/research/worker.ts), con los mismos estados, la misma contabilidad de
// costo y el mismo candado de un trabajo por cliente.
//
// Etapas visibles en el progreso: `plan` (ranuras, fechas y temas, sin
// modelo), `semana1`…`semana5` (una tanda de piezas por semana del mes) y
// `guardado` (la única escritura sobre el lote, en una transacción).
//
// Nada se escribe en el lote hasta el final. Si el trabajo se corta a la
// mitad, las piezas que ya estaban siguen intactas; lo que sí se guarda es lo
// que se alcanzó a escribir (rescate parcial), y el operador puede volver a
// lanzar «completar lo que falta».

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
  db, researchJobs, researchResults, pilaresResults, clients, clientLinks, clientFiles, contenidoLotes, contenidoPiezas,
} from '@/db';
import { armarContexto } from '@/research/contexto';
import { superaTope, marcarDetenidas } from '@/research/pipeline';
import { recortar } from '@/research/normalizar';
import { CorteDeTrabajo, motivoDeCorte } from '@/lib/errores-agentes';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { investigacionUtil } from '@/lib/precheck';
import { nombrePeriodo, periodoActual } from '@/lib/ui/periodo';
import { avisarJob } from '@/flujo/avisos';
import { NOMBRE_ETAPA } from '@/flujo/reglas';
import type { MapaPilares, Funcion } from '@/pilares/schemas';
import { avanceDelMapa, marcarTemasEnDesarrollo } from '@/pilares/avance-servicio';
import { leerPaquete } from '../paquete';
import { marcarContenidoTocado, refrescarLote } from '../servicio';
import {
  armarRanuras, faltantes, leerParametros, separarPiezas, tandasPorSemana, totalDe,
  type ParametrosMes, type PiezaExistente, type Ranura,
} from './plan';
import { candidatosDeTanda, candidatosPara, catalogoDeTemas, pilaresPorUso, resolverTema, temasUsados, type TemaCatalogo } from './temas';
import { correrTanda, modeloMes, resumenEstrategia, type EntradaTanda } from './agente';
import { decidirGuardado, type PiezaGenerada } from './guardado';

export const ETAPAS_CONTENIDO = ['plan', 'semana1', 'semana2', 'semana3', 'semana4', 'semana5', 'guardado'] as const;

/**
 * Tope de gasto de un mes, en dólares.
 *
 * Un mes típico (22 piezas, cinco tandas con Sonnet) ronda 1 USD: unos 20k
 * tokens de entrada por tanda —cliente, documentos, estrategia e
 * investigación— y 1.2k de salida por pieza. Con el reintento barato de
 * `pedirJson` en alguna tanda, el peor caso razonable anda en 2–3 USD. El
 * `COST_LIMIT_USD` de 15 es el de una investigación con búsqueda web, que no
 * se parece: aquí 5 USD ya son el doble del peor caso, y un mes que llega ahí
 * algo está haciendo mal. Nunca por encima de `COST_LIMIT_USD`.
 */
export function topeMesUsd(): number {
  const general = leerTopeUsd(process.env.COST_LIMIT_USD, 15, 'COST_LIMIT_USD');
  return Math.min(general, leerTopeUsd(process.env.COST_LIMIT_CONTENIDO_USD, 5, 'COST_LIMIT_CONTENIDO_USD'));
}

/** La síntesis y la audiencia de la investigación, si existen, recortadas: es lo que el redactor usa de ella. */
export function resumenInvestigacion(datos: unknown): string {
  const d = (datos ?? {}) as Record<string, { estado?: string; datos?: unknown }>;
  const bloque = (clave: string, titulo: string) =>
    d[clave]?.estado === 'ok' ? `### ${titulo}\n${recortar(JSON.stringify(d[clave].datos), 8000)}` : null;
  const partes = [bloque('sintesis', 'Síntesis estratégica'), bloque('audiencia', 'Audiencia')].filter(Boolean);
  return partes.length ? partes.join('\n\n') : 'La investigación no tiene síntesis ni audiencia con datos.';
}

type Deps = {
  correr: typeof correrTanda;
  ahora: () => Date;
};

/**
 * Genera las piezas de todas las tandas, sin tocar la base. Separado del job
 * para poder probar el reparto, los temas y el rescate con un agente simulado.
 *
 * `usados` entra con los temas de todas las piezas del cliente y sale con los
 * de este mes agregados: ningún tema se repite, ni con meses anteriores ni
 * entre tandas.
 */
export async function generarTandas(o: {
  ranuras: Ranura[];
  catalogo: TemaCatalogo[];
  usados: Set<string>;
  contexto: string;
  periodo: string;
  nombresPilares: string[];
  estado: Record<string, string>;
  correr: typeof correrTanda;
  /** Freno de gasto: devuelve false si ya no se debe pedir más. */
  hayPresupuesto: () => boolean;
  onUso?: (e: number, s: number) => boolean;
  alAvanzar?: () => void;
}): Promise<{ generadas: PiezaGenerada[]; corte: CorteDeTrabajo | null; tokensEntrada: number; tokensSalida: number; descartes: string[] }> {
  const generadas: PiezaGenerada[] = [];
  const descartes: string[] = [];
  let corte: CorteDeTrabajo | null = null;
  let tIn = 0, tOut = 0;
  const tandas = tandasPorSemana(o.ranuras);

  for (let semana = 1; semana <= 5; semana++) {
    const etapa = `semana${semana}`;
    const deSemana = tandas.filter((t) => t.semana === semana);
    if (deSemana.length === 0) { o.estado[etapa] = 'ok'; continue; }
    if (corte) break;
    if (!o.hayPresupuesto()) { o.estado[etapa] = 'omitido_por_costo'; continue; }

    o.estado[etapa] = 'corriendo';
    o.alAvanzar?.();
    let algunaOk = false;
    for (const tanda of deSemana) {
      if (!o.hayPresupuesto()) break;
      const candidatos = candidatosDeTanda(tanda.ranuras, o.catalogo, o.usados);
      const entrada: EntradaTanda = {
        contexto: o.contexto,
        periodo: o.periodo,
        nombreMes: nombrePeriodo(o.periodo),
        ranuras: tanda.ranuras,
        candidatos,
        nombresPilares: o.nombresPilares,
        yaEscritas: generadas.map((g) => recortar(g.pieza.copy.split('\n')[0], 120)),
      };
      try {
        const r = await o.correr(entrada, o.onUso);
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        if (r.descartes?.length) descartes.push(...r.descartes);
        for (const pieza of r.datos.piezas) {
          const ranura = tanda.ranuras.find((x) => x.ref === pieza.ref);
          if (!ranura) continue;
          let temaId = resolverTema(pieza.temaId, candidatos.get(ranura.ref) ?? [], o.usados);
          // Todos los candidatos de la ranura ya se usaron en esta misma tanda:
          // se busca otro libre en el mapa entero.
          if (!temaId) temaId = candidatosPara(ranura, o.catalogo, o.usados, 1)[0]?.id ?? null;
          if (temaId) o.usados.add(temaId);
          generadas.push({ ranura, pieza, temaId });
          algunaOk = true;
        }
      } catch (e) {
        console.error(`[contenido-mes] ${etapa}:`, e);
        const motivo = motivoDeCorte(e);
        if (motivo) { corte = new CorteDeTrabajo(motivo, e); break; }
      }
    }
    o.estado[etapa] = corte ? 'abortado' : algunaOk ? 'ok' : o.hayPresupuesto() ? 'fallo' : 'omitido_por_costo';
    o.alAvanzar?.();
  }
  return { generadas, corte, tokensEntrada: tIn, tokensSalida: tOut, descartes };
}

export async function ejecutarContenidoMes(jobId: string, deps: Deps = { correr: correrTanda, ahora: () => new Date() }): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const estado: Record<string, string> = { ...(job.etapas as Record<string, string>) };
  const fallar = async (error: string) => {
    marcarDetenidas(ETAPAS_CONTENIDO, estado);
    await db.update(researchJobs)
      .set({ estado: 'fallido', error, etapas: estado, etapaActual: null, finishedAt: deps.ahora() })
      .where(eq(researchJobs.id, jobId));
  };

  const params = leerParametros(job.parametros);
  if (!params) return fallar('El trabajo no dice qué mes generar. Vuelve a lanzarlo desde la pantalla del mes.');

  const [lote] = await db.select().from(contenidoLotes)
    .where(and(eq(contenidoLotes.id, params.loteId), eq(contenidoLotes.clientId, job.clientId))).limit(1);
  if (!lote) return fallar('El lote de este mes ya no existe.');
  if (lote.estado !== 'en_proceso') return fallar('El mes ya no está en proceso (se compartió o se aprobó): no se generó nada.');

  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;
  const paquete = leerPaquete(cliente.paquete);
  if (!paquete) return fallar('Este cliente no tiene paquete mensual. Defínelo en su ficha y vuelve a lanzar.');

  const [mapaFila] = await db.select().from(pilaresResults)
    .where(eq(pilaresResults.clientId, job.clientId)).orderBy(desc(pilaresResults.version)).limit(1);
  const mapa = (mapaFila?.datos ?? null) as MapaPilares | null;
  if (!mapaFila || !mapa?.pilares?.some((p) => p.estado === 'ok')) {
    return fallar('Este cliente no tiene un mapa de pilares con temas. El mes sale de ahí.');
  }

  await db.update(researchJobs).set({ estado: 'corriendo', startedAt: job.startedAt ?? deps.ahora(), etapaActual: 'plan' })
    .where(eq(researchJobs.id, jobId));

  // ── 1 · Plan: qué hay, qué falta, cuándo y de qué temas ───────────────
  const piezasLote = await db.select().from(contenidoPiezas)
    .where(eq(contenidoPiezas.loteId, lote.id)).orderBy(asc(contenidoPiezas.numero));
  const { quedan, reemplazar } = separarPiezas(piezasLote, params.modo, params.incluirConArte);
  const porGenerar = faltantes(paquete, quedan);
  if (totalDe(porGenerar) === 0) return fallar('El mes ya cuadra con el paquete: no hay piezas que generar.');

  const lotesCliente = await db.select({ id: contenidoLotes.id }).from(contenidoLotes).where(eq(contenidoLotes.clientId, job.clientId));
  const piezasCliente = lotesCliente.length
    ? await db.select({ id: contenidoPiezas.id, temaId: contenidoPiezas.temaId }).from(contenidoPiezas)
        .where(inArray(contenidoPiezas.loteId, lotesCliente.map((l) => l.id)))
    : [];
  // Los temas de las piezas que se van a reemplazar vuelven a estar libres.
  const seVan = new Set(reemplazar.map((p) => p.id));
  const usados = temasUsados(piezasCliente.filter((p) => !seVan.has(p.id)));

  const avance = await avanceDelMapa(mapaFila.id);
  const catalogo = catalogoDeTemas(mapa, avance);
  const funcionDe = new Map(catalogo.map((t) => [t.id, t.funcion]));
  const funcionesQueQuedan: Partial<Record<Funcion, number>> = {};
  for (const p of quedan) {
    const f = p.temaId ? funcionDe.get(p.temaId) : undefined;
    if (f) funcionesQueQuedan[f] = (funcionesQueQuedan[f] ?? 0) + 1;
  }

  const hoy = deps.ahora().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const ranuras = armarRanuras({
    periodo: params.periodo,
    aGenerar: porGenerar,
    quedan,
    mix: mapa.estrategia?.mix,
    funcionesQueQuedan,
    pilares: pilaresPorUso(catalogo, usados),
    // Si el mes ya empezó, se publica de hoy en adelante (ver `diasParaPublicar`).
    desde: params.periodo === periodoActual(deps.ahora()) ? hoy : undefined,
  });

  const [links, archivos, investigaciones] = await Promise.all([
    db.select().from(clientLinks).where(eq(clientLinks.clientId, job.clientId)),
    db.select().from(clientFiles).where(eq(clientFiles.clientId, job.clientId)),
    db.select({ datos: researchResults.datos, version: researchResults.version }).from(researchResults).where(eq(researchResults.clientId, job.clientId)),
  ]);
  const investigacion = investigacionUtil(investigaciones);
  const contexto = `${armarContexto(cliente, links, archivos)}

## Estrategia editorial (mapa de pilares)
${resumenEstrategia(mapa)}

## Investigación
${investigacion ? resumenInvestigacion(investigacion.datos) : 'Este cliente no tiene investigación con datos.'}`;

  estado.plan = 'ok';
  const tope = topeMesUsd();
  const modelo = modeloMes();
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;
  const guardarProgreso = () => db.update(researchJobs)
    .set({ etapas: estado, etapaActual: Object.keys(estado).find((k) => estado[k] === 'corriendo') ?? null, costoUsd: String(gasto.valor) })
    .where(eq(researchJobs.id, jobId));
  await guardarProgreso();

  // ── 2 · Tandas por semana ─────────────────────────────────────────────
  const nombresPilares = (mapa.estrategia?.pilares ?? []).map((p) => p.nombre);
  const r = await generarTandas({
    ranuras, catalogo, usados, contexto, periodo: params.periodo, nombresPilares, estado,
    correr: deps.correr,
    hayPresupuesto: () => !superaTope(gasto.valor, tope),
    onUso: (e, s) => { gasto.valor += calcularCosto(modelo, e, s); return !superaTope(gasto.valor, tope); },
    alAvanzar: () => { void guardarProgreso().catch((e) => console.error(`[${jobId}] progreso:`, e)); },
  });
  tIn += r.tokensEntrada; tOut += r.tokensSalida;
  // Un corte de cuenta (sin saldo, llave inválida) deja las semanas que faltaban como detenidas.
  if (r.corte) marcarDetenidas(ETAPAS_CONTENIDO.filter((e) => e.startsWith('semana')), estado);

  // ── 3 · Guardado ─────────────────────────────────────────────────────
  estado.guardado = 'corriendo';
  await db.update(researchJobs).set({ etapas: estado, etapaActual: 'guardado', tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor) })
    .where(eq(researchJobs.id, jobId));

  let guardadas = 0;
  let errorGuardado: string | null = null;
  if (r.generadas.length > 0) {
    try {
      guardadas = await guardarMes(lote.id, job.clientId, params, r.generadas, mapaFila.id, job.creadoPor, deps.ahora());
    } catch (e) {
      console.error(`[${jobId}] guardado:`, e);
      errorGuardado = e instanceof Error ? e.message : String(e);
    }
  }
  estado.guardado = guardadas > 0 ? 'ok' : 'fallo';

  const pedidas = ranuras.length;
  const error = errorGuardado
    ? `No se pudo guardar el mes: ${errorGuardado}`
    : r.corte ? r.corte.message
    : guardadas === 0 ? 'No se pudo escribir ninguna pieza. Intenta de nuevo.'
    : guardadas < pedidas ? `Se generaron ${guardadas} de ${pedidas} piezas. Vuelve a lanzar «Completar lo que falta» para el resto.`
    : null;

  await db.update(researchJobs).set({
    estado: guardadas > 0 ? 'completado' : 'fallido',
    etapas: estado, etapaActual: null, finishedAt: deps.ahora(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor), error,
  }).where(eq(researchJobs.id, jobId));

  // El aviso de éxito sale de aquí; el de fallo lo manda el worker al ver el
  // estado final (`avisarSiJobFallido`), igual que con los otros documentos.
  if (guardadas > 0 && job.creadoPor) {
    void avisarJob({
      evento: 'mes_generado',
      creadoPor: job.creadoPor,
      cliente: cliente.nombre,
      etapa: NOMBRE_ETAPA.desarrollo_mensual,
      periodo: params.periodo,
      detalle: guardadas < pedidas ? `${guardadas} de ${pedidas} piezas` : `${guardadas} piezas`,
      enlace: `/clientes/${job.clientId}/contenido/${params.periodo}`,
    }).catch((e) => console.error('[avisos] mes_generado:', e));
  }
}

/**
 * La única escritura sobre el lote. En una transacción: vuelve a leer el lote
 * y sus piezas (pudieron moverse mientras la IA escribía), borra las
 * reemplazables que lo siguen siendo, da de alta las nuevas, marca los temas
 * en el banco y deja el lote y la etapa al día. Devuelve cuántas piezas dio de alta.
 */
export async function guardarMes(
  loteId: string,
  clientId: string,
  params: ParametrosMes,
  generadas: PiezaGenerada[],
  mapaId: string,
  usuarioId: string | null,
  ahora: Date,
): Promise<number> {
  return db.transaction(async (tx) => {
    const [lote] = await tx.select().from(contenidoLotes).where(eq(contenidoLotes.id, loteId)).for('update').limit(1);
    if (!lote) throw new Error('el lote ya no existe.');
    // Mientras se generaba, alguien compartió el mes: meterle piezas nuevas (y
    // borrarle otras) cambiaría lo que el cliente está revisando.
    if (lote.estado !== 'en_proceso') throw new Error('el mes dejó de estar en proceso mientras se generaba (se compartió o se aprobó).');

    const actuales: PiezaExistente[] = await tx.select().from(contenidoPiezas).where(eq(contenidoPiezas.loteId, loteId));
    const d = decidirGuardado({ modo: params.modo, incluirConArte: params.incluirConArte, actuales, planeadas: params.planeadas, generadas });

    if (d.borrar.length) await tx.delete(contenidoPiezas).where(inArray(contenidoPiezas.id, d.borrar));
    if (d.altas.length) await tx.insert(contenidoPiezas).values(d.altas.map((a) => ({ loteId, ...a })));
    await marcarTemasEnDesarrollo(mapaId, d.temas, usuarioId, ahora, tx);
    await marcarContenidoTocado(loteId, ahora, tx);
    await refrescarLote({ ...lote, clientId }, ahora, tx);
    return d.altas.length;
  });
}
