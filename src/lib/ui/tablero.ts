import { ETAPAS, ESTADOS, PESOS, etapasParaAvance, type Etapa, type Estado } from '@/flujo/reglas';
import {
  periodo, costo, filtrarPeriodo, agruparEtapasPorResponsable,
  type JobM, type EtapaM, type Evento, type Periodo,
} from '@/lib/desempeno';

type JobIndicador = { estado: string; costoUsd: string | number; createdAt: Date };

/**
 * El servidor corre en UTC. Sin fijar la zona, lo gastado la noche del último
 * día del mes en México se contaría en el mes siguiente.
 */
export function claveMes(d: Date, zona = 'America/Mexico_City'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const valor = (t: string) => partes.find((p) => p.type === t)?.value;
  return `${valor('year')}-${valor('month')}`;
}

/**
 * Lo gastado en jobs del mes en curso, en dólares y a dos decimales.
 *
 * Sale de `indicadores` porque el Inicio cambió sus cuatro cifras (diseño §2)
 * y de las de aquí solo conserva esta: pedirle el paquete completo lo obligaba
 * a seguir contando entregables con tres `count` que ya nadie enseña.
 */
export function gastoDelMes(jobs: JobIndicador[], ahora: Date): number {
  const mes = claveMes(ahora);
  const gasto = jobs
    .filter((j) => claveMes(j.createdAt) === mes)
    .reduce((s, j) => s + Number(j.costoUsd), 0);
  return Math.round(gasto * 100) / 100;
}

export function indicadores(d: { clientes: number; jobs: JobIndicador[]; entregables: number; ahora: Date }) {
  return {
    clientes: d.clientes,
    enCurso: d.jobs.filter((j) => j.estado === 'encolado' || j.estado === 'corriendo').length,
    entregables: d.entregables,
    gastoMes: gastoDelMes(d.jobs, d.ahora),
  };
}

// ---------------------------------------------------------------------------
// Tablero de seguimiento del Inicio: cálculos puros de los seis bloques.
//
// Todo lo de aquí abajo trabaja sobre datos que la página ya trajo, en una
// consulta por lote (nunca una por cliente). Donde `src/lib/desempeno.ts` ya
// sabe contar algo —el mes y el mes anterior (`periodo`), el costo por tipo y
// por cliente (`costo`), la carga y las aprobadas de un grupo (`carga`), el
// reparto de clientes por operador (`agruparClientesPorOperador`)— se le pide
// a él, para que el Inicio y /desempeno no digan dos cifras distintas del
// mismo mes.

/**
 * Días naturales sin movimiento a partir de los cuales un cliente con trabajo
 * por delante se marca «atascado» en el Inicio.
 *
 * Siete, una semana completa, porque es lo primero que ya no se explica por
 * ninguna espera legítima del flujo:
 * - el plazo de revisión del cliente es de 2 días hábiles
 *   (`DIAS_REVISION_POR_OMISION`), que con un fin de semana de por medio son
 *   hasta 4 naturales, y al vencer el mes se aprueba solo —eso ya es
 *   movimiento—;
 * - una investigación o un manual corren en minutos, y la autorización del
 *   admin se resuelve en su bandeja del día.
 * Si en siete días no hubo un evento de etapa, un comentario, un trabajo del
 * agente ni un cambio en el contenido del mes, nadie —ni el equipo ni el
 * cliente— tocó a ese cliente en todo un ciclo de trabajo. Un umbral más corto
 * (3–4 días) marcaría en rojo a quien solo está esperando su plazo normal, y el
 * rojo dejaría de significar algo; uno más largo (15) avisaría con medio mes
 * ya perdido.
 */
export const UMBRAL_ATASCADO_DIAS = 7;

const DIA_MS = 86_400_000;

/** La fecha más reciente de la lista, ignorando huecos; `null` si no hay ninguna. */
export function ultimaActividad(fechas: Array<Date | string | null | undefined>): Date | null {
  let max: number | null = null;
  for (const f of fechas) {
    if (!f) continue;
    const t = new Date(f).getTime();
    if (Number.isNaN(t)) continue;
    if (max === null || t > max) max = t;
  }
  return max === null ? null : new Date(max);
}

/**
 * Días naturales completos desde `ultima` hasta `ahora` (redondeado hacia
 * abajo: 6 días y 23 horas son 6). Nunca negativo; `null` si no hay fecha.
 */
export function diasSinMovimiento(ultima: Date | null, ahora: Date): number | null {
  if (!ultima) return null;
  return Math.max(0, Math.floor((ahora.getTime() - ultima.getTime()) / DIA_MS));
}

/**
 * Atascado = tiene trabajo por delante (un paso contratado sin aprobar) y
 * lleva `UMBRAL_ATASCADO_DIAS` o más sin movimiento. Un cliente con todo
 * aprobado, o sin nada contratado, no está atascado por mucho que no se mueva:
 * no hay nada que mover.
 */
export function estaAtascado(dias: number | null, tieneTrabajo: boolean, umbral = UMBRAL_ATASCADO_DIAS): boolean {
  return tieneTrabajo && dias !== null && dias >= umbral;
}

/** «hoy», «1 día», «12 días». */
export function textoDias(dias: number | null): string {
  if (dias === null) return '—';
  if (dias === 0) return 'hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}

// ── Por etapa ──────────────────────────────────────────────────────────────

export type FilaReparto = { etapa: Etapa; total: number; porEstado: Record<Estado, number> };

/**
 * Cuántos clientes hay en cada uno de los cuatro pasos y en qué estado. Solo
 * cuentan las etapas contratadas y no internas —el mismo filtro que el % de
 * avance (`etapasParaAvance`)—: una etapa descontratada puede conservar el
 * estado que tenía y no es trabajo de nadie. Como hay una fila por cliente y
 * etapa, contar filas es contar clientes.
 */
export function repartoPorEtapa(etapas: Array<{ etapa: Etapa; estado: Estado; contratada: boolean; interna: boolean }>): FilaReparto[] {
  const filas = new Map<Etapa, FilaReparto>(ETAPAS.map((etapa) => [
    etapa,
    { etapa, total: 0, porEstado: Object.fromEntries(ESTADOS.map((s) => [s, 0])) as Record<Estado, number> },
  ]));
  for (const e of etapasParaAvance(etapas)) {
    const fila = filas.get(e.etapa);
    if (!fila) continue;
    fila.total += 1;
    fila.porEstado[e.estado] += 1;
  }
  return [...filas.values()];
}

// ── Gastos ─────────────────────────────────────────────────────────────────

export type TipoGasto = JobM['tipo'];
export const TIPOS_GASTO: TipoGasto[] = ['research', 'pilares', 'growth', 'contenido'];
export const NOMBRE_TIPO_GASTO: Record<TipoGasto, string> = {
  research: 'Investigación', pilares: 'Mapa de pilares', growth: 'Manual de campaña', contenido: 'Contenido del mes con IA',
};

export type ComparativoGastos = {
  actual: number;
  anterior: number;
  /** actual − anterior, a dos decimales. */
  diferencia: number;
  porTipo: Array<{ tipo: TipoGasto; actual: number; anterior: number }>;
  /** Los que más consumen este mes, de mayor a menor; solo con gasto > 0. */
  clientes: Array<{ clientId: string; actual: number }>;
};

/**
 * El mes en curso contra el anterior, desglosado por tipo de trabajo, y los
 * clientes que más consumen este mes.
 *
 * El costo solo se guarda en `research_jobs.costo_usd` (investigación, mapa de
 * pilares y manual). Las propuestas de copy del mes calculan lo que cuestan
 * (`generarPropuestas`, src/contenido/agentes.ts) y se lo devuelven a quien las
 * pidió, pero no lo guardan en ninguna tabla: aquí no se pueden sumar.
 *
 * Los rangos son los de `periodo('mes')` y `periodo('mes_anterior')` y la suma
 * es la de `costo()`, en la zona de Ciudad de México: exactamente lo que
 * enseña /desempeno con esos dos filtros.
 */
export function comparativoGastos(jobs: JobM[], ahora: Date, maxClientes = 5): ComparativoGastos {
  // `costo` también reparte por operador; aquí no se usa, así que no hace
  // falta decirle de quién es cada cliente.
  const sinOperador = new Map<string, string | null>();
  const mes = costo(jobs, sinOperador, periodo('mes', ahora));
  const previo = costo(jobs, sinOperador, periodo('mes_anterior', ahora));
  const clientes = [...mes.porCliente.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxClientes)
    .map(([clientId, actual]) => ({ clientId, actual }));
  return {
    actual: mes.total,
    anterior: previo.total,
    diferencia: Math.round((mes.total - previo.total) * 100) / 100,
    porTipo: TIPOS_GASTO.map((tipo) => ({ tipo, actual: mes.porEtapa[tipo], anterior: previo.porEtapa[tipo] })),
    clientes,
  };
}

// ── Por responsable (puesto y persona) ─────────────────────────────────────

export type FilaResponsable = {
  /** id del usuario, o 'sin_asignar'. */
  clave: string;
  nombre: string;
  /** Puesto visible («Strategist»…); `null` para «sin asignar» o quien ya no tiene puesto. */
  puesto: string | null;
  /** Clientes distintos en cuyas etapas es responsable. */
  clientes: number;
  /** Etapas que tiene asignadas (contratadas, no internas). */
  etapas: number;
  /** Promedio del peso de esas etapas (0-100). */
  avancePromedio: number;
  /** Etapas contratadas en proceso o con cambios: lo que le toca mover. */
  pendientes: number;
  aprobadasMes: number;
};

/**
 * Una fila por persona con lo que lleva a su cargo, agrupable por puesto en
 * la pantalla. Rediseño de puestos: la unidad ya no es «los clientes de un
 * operador» sino las ETAPAS donde esa persona está en `etapa_responsables`
 * (`EtapaM.responsableIds`); una etapa con dos responsables cuenta para ambos.
 *
 * - «Avance» es el promedio del peso (`PESOS`) de SUS etapas contratadas y no
 *   internas —no el avance de cada cliente completo, que depende de etapas
 *   que esa persona no lleva—.
 * - «Por mover» es el mismo criterio de `contarPendientes`: etapas
 *   contratadas en proceso o con cambios, sin los comentarios.
 * - «Aprobadas» son los `aprobar` del periodo sobre sus etapas.
 *
 * `extras` son personas sin ninguna etapa que igual conviene enseñar (quién
 * está libre). `puestos` mapea usuario → nombre del puesto.
 */
export function filasPorResponsable(o: {
  etapas: EtapaM[];
  aprobaciones: Evento[];
  nombres: Map<string, string>;
  puestos: Map<string, string | null>;
  extras?: string[];
  p: Periodo;
}): FilaResponsable[] {
  const grupos = agruparEtapasPorResponsable(o.etapas);
  for (const id of o.extras ?? []) if (!grupos.has(id)) grupos.set(id, []);
  const aprobadas = filtrarPeriodo(o.aprobaciones, o.p).filter((e) => e.accion === 'aprobar');

  const filas = [...grupos.entries()].map(([clave, etapasG]) => {
    const visibles = etapasParaAvance(etapasG);
    const ids = new Set(etapasG.map((e) => e.id));
    const suma = visibles.reduce((s, e) => s + PESOS[e.estado], 0);
    return {
      clave,
      nombre: clave === 'sin_asignar' ? 'Sin asignar' : (o.nombres.get(clave) ?? 'Responsable'),
      puesto: clave === 'sin_asignar' ? null : (o.puestos.get(clave) ?? null),
      clientes: new Set(visibles.map((e) => e.clientId)).size,
      etapas: visibles.length,
      avancePromedio: visibles.length === 0 ? 0 : Math.round(suma / visibles.length),
      pendientes: etapasG.filter((e) => e.contratada && (e.estado === 'en_proceso' || e.estado === 'con_cambios')).length,
      aprobadasMes: aprobadas.filter((e) => ids.has(e.etapaId)).length,
    };
  });

  return filas.sort((a, b) =>
    a.clave === 'sin_asignar' ? 1 : b.clave === 'sin_asignar' ? -1 : a.nombre.localeCompare(b.nombre, 'es'));
}

// ── Meses por vencer ───────────────────────────────────────────────────────

export type LotePorVencer = { estado: Estado; limiteRevision: Date | null };

/**
 * Los meses que esperan al cliente con el plazo todavía corriendo, del que
 * vence antes al que vence después. La página ya los pide así a la base; esto
 * es el mismo criterio, puro, para poder probarlo (y para que un lote que
 * venció entre la consulta y el pintado no salga como «por vencer»).
 */
export function mesesPorVencer<T extends LotePorVencer>(lotes: T[], ahora: Date): Array<T & { limiteRevision: Date }> {
  return lotes
    .filter((l): l is T & { limiteRevision: Date } =>
      l.estado === 'en_revision' && l.limiteRevision !== null && l.limiteRevision.getTime() > ahora.getTime())
    .sort((a, b) => a.limiteRevision.getTime() - b.limiteRevision.getTime());
}

/**
 * La cuenta regresiva de un plazo: «vence en 3 días», «vence en 5 h», «vence en
 * 20 min». `urgente` cuando queda menos de un día: es cuando conviene
 * escribirle al cliente hoy.
 */
export function cuentaRegresiva(limite: Date, ahora: Date): { texto: string; urgente: boolean } {
  const ms = limite.getTime() - ahora.getTime();
  if (ms <= 0) return { texto: 'vence ya', urgente: true };
  const minutos = Math.floor(ms / 60_000);
  if (minutos < 60) return { texto: `vence en ${Math.max(1, minutos)} min`, urgente: true };
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return { texto: `vence en ${horas} h`, urgente: true };
  const dias = Math.floor(horas / 24);
  const resto = horas - dias * 24;
  const base = dias === 1 ? 'vence en 1 día' : `vence en ${dias} días`;
  return { texto: resto > 0 && dias < 3 ? `${base} y ${resto} h` : base, urgente: false };
}
