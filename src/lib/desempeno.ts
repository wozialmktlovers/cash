// Métricas puras del tablero de desempeño (spec §5). Solo cálculo sobre datos
// en memoria: eventos, comentarios, jobs y etapas. Sin acceso a base de datos.
//
// Solo se importan tipos de src/flujo/reglas.ts (Etapa, Estado) — el resto de
// la lógica de transición (PESOS, avanceCliente) se mantenía deliberadamente
// fuera de este módulo (ver clarificación de la tarea D1), EXCEPTO el % de
// avance de `carga()`: ese cálculo sí importa PESOS y etapasParaAvance de
// src/flujo/reglas.ts (M3, punto 6 del controlador). Tenerlo repetido aquí
// hacía que este módulo NO excluyera `desarrollo_mensual` mientras esa etapa
// no tenga generador, a diferencia de avanceCliente (portal) que sí lo
// excluye — el tablero de desempeño y el portal terminaban mostrando un %
// distinto para el mismo cliente. Compartir la regla (en vez de duplicarla
// de nuevo, esta vez ya correcta) evita que se vuelvan a desalinear.
import { PESOS, etapasParaAvance, type Etapa, type Estado } from '@/flujo/reglas';

export type Evento = {
  etapaId: string;
  clientId: string;
  etapa: Etapa;
  accion: string;
  de: Estado | null;
  a: Estado;
  creadoEn: Date;
};

export type ComentarioM = { etapaId: string; autorRol: 'admin' | 'operador' | 'cliente'; creadoEn: Date };

export type JobM = {
  clientId: string;
  tipo: 'research' | 'growth' | 'pilares';
  costoUsd: number;
  creadoPor: string | null;
  creadoEn: Date;
};

export type EtapaM = {
  id: string;
  clientId: string;
  etapa: Etapa;
  estado: Estado;
  contratada: boolean;
  interna: boolean;
  operadorId: string | null;
};

export type Periodo = { desde: Date | null; hasta: Date };

const ZONA = 'America/Mexico_City';

const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Offset (en minutos) tal que local = UTC + offset, evaluado para el instante
 * `fecha` en la zona `zona`. Se deriva con Intl en vez de fijar un número: así
 * sigue siendo correcto si algún día la zona cambia de reglas (aunque
 * América/Ciudad de México no observa horario de verano desde 2022).
 */
function offsetMinutos(fecha: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(fecha);
  const obj: Record<string, string> = {};
  for (const p of partes) obj[p.type] = p.value;
  const comoUTC = Date.UTC(
    Number(obj.year),
    Number(obj.month) - 1,
    Number(obj.day),
    Number(obj.hour),
    Number(obj.minute),
    Number(obj.second),
  );
  return (comoUTC - fecha.getTime()) / 60_000;
}

/** Año y mes (1-12) locales de `fecha` en `zona`. */
function partesLocales(fecha: Date, zona: string): { anio: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(fecha);
  const valor = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  return { anio: valor('year'), mes: valor('month') };
}

/**
 * Instante UTC que corresponde a las 00:00 locales (en `zona`) del día 1 del
 * mes de `ahora` desplazado `offsetMeses` meses (0 = mes actual, -1 = mes
 * anterior).
 */
function primerDiaMesUTC(ahora: Date, offsetMeses: number, zona: string): Date {
  const { anio, mes } = partesLocales(ahora, zona);
  const total = anio * 12 + (mes - 1) + offsetMeses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = total - nuevoAnio * 12; // 0-11
  const suposicion = Date.UTC(nuevoAnio, nuevoMes, 1, 0, 0, 0);
  const offset = offsetMinutos(new Date(suposicion), zona);
  return new Date(suposicion - offset * 60_000);
}

/** Rango de fechas para cada clave de filtro del tablero, en zona America/Mexico_City. */
export function periodo(clave: 'mes' | 'mes_anterior' | '90' | 'todo', ahora: Date): Periodo {
  switch (clave) {
    case 'mes':
      return { desde: primerDiaMesUTC(ahora, 0, ZONA), hasta: ahora };
    case 'mes_anterior':
      return { desde: primerDiaMesUTC(ahora, -1, ZONA), hasta: primerDiaMesUTC(ahora, 0, ZONA) };
    case '90':
      return { desde: new Date(ahora.getTime() - 90 * 86_400_000), hasta: ahora };
    case 'todo':
      return { desde: null, hasta: ahora };
  }
}

/** Días entre dos fechas, con un decimal, nunca negativo. */
export function diasEntre(a: Date, b: Date): number {
  const dias = (b.getTime() - a.getTime()) / 86_400_000;
  return Math.max(0, round1(dias));
}

/** Promedio, mediana (promedia los dos valores centrales si n es par) y n. Lista vacía → nulls. */
export function resumenEstadistico(valores: number[]): { promedio: number | null; mediana: number | null; n: number } {
  const n = valores.length;
  if (n === 0) return { promedio: null, mediana: null, n: 0 };
  const promedio = round1(valores.reduce((s, v) => s + v, 0) / n);
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(n / 2);
  const medianaCruda = n % 2 === 0 ? (ordenados[mitad - 1] + ordenados[mitad]) / 2 : ordenados[mitad];
  return { promedio, mediana: round1(medianaCruda), n };
}

/**
 * Filtra por periodo: `creadoEn >= desde && creadoEn < hasta` (desde nulo no
 * filtra por abajo). hasta siempre exclusivo: para "mes_anterior" es lo que
 * pide la definición del rango; para los demás periodos hasta = ahora, así
 * que en la práctica solo excluye un evento creado en el instante exacto de
 * la consulta, un borde sin relevancia real.
 */
export function filtrarPeriodo<T extends { creadoEn: Date }>(xs: T[], p: Periodo): T[] {
  const desdeMs = p.desde?.getTime() ?? null;
  const hastaMs = p.hasta.getTime();
  return xs.filter((x) => {
    const t = x.creadoEn.getTime();
    if (desdeMs !== null && t < desdeMs) return false;
    return t < hastaMs;
  });
}

function ordenarPorFecha<T extends { creadoEn: Date }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => a.creadoEn.getTime() - b.creadoEn.getTime());
}

function agruparPorEtapaId<T extends { etapaId: string }>(xs: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const x of xs) {
    const lista = mapa.get(x.etapaId);
    if (lista) lista.push(x);
    else mapa.set(x.etapaId, [x]);
  }
  return mapa;
}

/** Primer evento en `evs` (a partir de `desdeIndex + 1`) cuya acción esté en `acciones`. */
function siguienteConAccion(evs: Evento[], desdeIndex: number, acciones: string[]): Evento | undefined {
  for (let i = desdeIndex + 1; i < evs.length; i++) {
    if (acciones.includes(evs[i].accion)) return evs[i];
  }
  return undefined;
}

const ETAPAS_VACIAS: Etapa[] = ['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana'];

/**
 * Un evento cuenta como "ronda de cambios" (dispara una nueva espera de
 * respuesta en `respuestaCambios` y suma en `rondasPorEtapaAprobada`) cuando
 * de verdad representa trabajo pedido de nuevo, no cualquier comentario:
 * - `pedir_cambios` y `reabrir`: acciones del admin, siempre cambian el
 *   estado (`aplicarAccion` solo las permite desde `en_revision`/`aprobada`),
 *   así que son transiciones reales por definición.
 * - `comentario_cliente`: el cliente puede dejar varias observaciones
 *   seguidas sobre la misma etapa sin que eso reabra nada (`de === a` la
 *   mayoría de las veces — `estadoTrasComentarioCliente`, src/flujo/reglas.ts,
 *   solo cambia el estado si la etapa estaba `aprobada`). Antes de este fix,
 *   cada `comentario_cliente` contaba como una ronda propia, así que tres
 *   observaciones seguidas sobre la misma reapertura inflaban "respuesta a
 *   cambios" a tres muestras en vez de una. Ahora solo cuenta cuando de
 *   verdad reabrió la etapa (`de !== a`): la decisión explícita que pide la
 *   tarea I4 es que SÍ cuenta como ronda (spec §5: es una reapertura causada
 *   por el cliente, equivalente en esfuerzo a un `reabrir` del admin), pero
 *   solo una vez por reapertura real, no una por cada observación.
 */
function esRondaDeCambios(e: Evento): boolean {
  if (e.accion === 'pedir_cambios' || e.accion === 'reabrir') return true;
  return e.accion === 'comentario_cliente' && e.de !== e.a;
}

// Nota (fix wave, #11): a propósito, `tiemposPorEtapa` y `calidad` no filtran
// por `interna` — reciben el `eventos`/`comentarios` que les pase la página,
// que hoy incluye las etapas internas. Los tiempos y las rondas de cambio
// miden el esfuerzo real del equipo, y una etapa interna (la que un cliente
// no contrató pero se hizo como dependencia de otra) es trabajo del equipo
// igual que cualquier otra. En cambio `carga` (abajo) sí excluye lo interno
// de `etapasActivas` y `avancePromedio`: esas dos son de cara al cliente —
// "cuánto está avanzando/activo lo que contrató" — y una etapa interna no es
// algo que el cliente vea ni haya pedido.
export function tiemposPorEtapa(eventos: Evento[]): {
  duracion: Record<Etapa, number[]>;
  esperaRevision: number[];
  respuestaCambios: number[];
} {
  const duracion = Object.fromEntries(ETAPAS_VACIAS.map((e) => [e, [] as number[]])) as Record<Etapa, number[]>;
  const esperaRevision: number[] = [];
  const respuestaCambios: number[] = [];

  const porEtapaId = agruparPorEtapaId(ordenarPorFecha(eventos));

  for (const evs of porEtapaId.values()) {
    // duracion: del primer 'en_proceso' a la primera 'aprobada' posterior. Si la
    // etapa se reabre y se reaprueba, solo cuenta la primera aprobación (la que
    // encuentra este mismo find, por ser la más temprana tras el inicio).
    const inicio = evs.find((e) => e.a === 'en_proceso');
    if (inicio) {
      const fin = evs.find((e) => e.a === 'aprobada' && e.creadoEn.getTime() >= inicio.creadoEn.getTime());
      if (fin) duracion[evs[0].etapa].push(diasEntre(inicio.creadoEn, fin.creadoEn));
    }

    evs.forEach((e, i) => {
      if (e.accion === 'solicitar') {
        const decision = siguienteConAccion(evs, i, ['aprobar', 'pedir_cambios']);
        if (decision) esperaRevision.push(diasEntre(e.creadoEn, decision.creadoEn));
      }
      if (esRondaDeCambios(e)) {
        const solicitud = siguienteConAccion(evs, i, ['solicitar']);
        if (solicitud) respuestaCambios.push(diasEntre(e.creadoEn, solicitud.creadoEn));
      }
    });
  }

  return { duracion, esperaRevision, respuestaCambios };
}

/**
 * Rondas de cambios (`esRondaDeCambios`) por etapaId con al menos un
 * `aprobar`, agrupadas por `Etapa` (spec §5, desglose por etapa — tarea I4
 * punto 2). Extraída de `calidad` para que tanto el resumen global como el
 * desglose cliente×etapa/operador×etapa usen la misma definición de "ronda",
 * en vez de reimplementar el filtro en dos lugares.
 */
export function rondasPorEtapa(eventos: Evento[]): Record<Etapa, number[]> {
  const resultado = Object.fromEntries(ETAPAS_VACIAS.map((e) => [e, [] as number[]])) as Record<Etapa, number[]>;
  const porEtapaId = agruparPorEtapaId(ordenarPorFecha(eventos));
  for (const evs of porEtapaId.values()) {
    const tieneAprobacion = evs.some((e) => e.accion === 'aprobar');
    if (!tieneAprobacion) continue;
    const rondas = evs.filter(esRondaDeCambios).length;
    resultado[evs[0].etapa].push(rondas);
  }
  return resultado;
}

export function calidad(
  eventos: Evento[],
  comentarios: ComentarioM[],
): {
  rondasPorEtapaAprobada: number[];
  comentariosAdminPorEntregable: number;
  comentariosClientePorEntregable: number;
} {
  const rondasPorEtapaAprobada = Object.values(rondasPorEtapa(eventos)).flat();

  // Entregables con actividad: etapaIds que tienen al menos un comentario (de
  // cualquier rol). Sobre ese mismo conjunto se promedian los conteos de
  // comentarios internos (admin + operador) y de cliente, entregable por
  // entregable.
  const porEtapaIdComentarios = agruparPorEtapaId(comentarios);
  const entregables = [...porEtapaIdComentarios.values()];
  let comentariosAdminPorEntregable = 0;
  let comentariosClientePorEntregable = 0;
  if (entregables.length > 0) {
    const sumaAdmin = entregables.reduce(
      (s, cs) => s + cs.filter((c) => c.autorRol === 'admin' || c.autorRol === 'operador').length,
      0,
    );
    const sumaCliente = entregables.reduce((s, cs) => s + cs.filter((c) => c.autorRol === 'cliente').length, 0);
    comentariosAdminPorEntregable = round1(sumaAdmin / entregables.length);
    comentariosClientePorEntregable = round1(sumaCliente / entregables.length);
  }

  return { rondasPorEtapaAprobada, comentariosAdminPorEntregable, comentariosClientePorEntregable };
}

export function carga(
  etapas: EtapaM[],
  eventos: Evento[],
  p: Periodo,
): { clientes: number; etapasActivas: number; avancePromedio: number; aprobadasEnPeriodo: number } {
  const clientes = new Set(etapas.map((e) => e.clientId)).size;

  const ACTIVOS: Estado[] = ['en_proceso', 'en_revision', 'con_cambios'];
  const etapasActivas = etapas.filter((e) => e.contratada && !e.interna && ACTIVOS.includes(e.estado)).length;

  // Avance por cliente: mismo cálculo que avanceCliente (etapasParaAvance:
  // contratadas, no internas y sin desarrollo_mensual mientras no tenga
  // generador; 0 sin ninguna), sin redondear cada cliente por separado para
  // no acumular el sesgo de un doble redondeo antes de promediar entre
  // clientes.
  const porCliente = new Map<string, EtapaM[]>();
  for (const e of etapas) {
    const lista = porCliente.get(e.clientId);
    if (lista) lista.push(e);
    else porCliente.set(e.clientId, [e]);
  }
  const avancesPorCliente: number[] = [];
  for (const es of porCliente.values()) {
    const visibles = etapasParaAvance(es);
    if (visibles.length === 0) {
      avancesPorCliente.push(0);
      continue;
    }
    const suma = visibles.reduce((s, e) => s + PESOS[e.estado], 0);
    avancesPorCliente.push(suma / visibles.length);
  }
  const avancePromedio =
    avancesPorCliente.length === 0 ? 0 : round1(avancesPorCliente.reduce((s, v) => s + v, 0) / avancesPorCliente.length);

  const aprobadasEnPeriodo = filtrarPeriodo(eventos, p).filter((e) => e.accion === 'aprobar').length;

  return { clientes, etapasActivas, avancePromedio, aprobadasEnPeriodo };
}

/**
 * Operador al que se atribuye el costo de un job: quien lo corrió si se sabe
 * (`creadoPor`), o si no el operador asignado hoy al cliente. Extraída
 * (limpieza M3, punto 1) porque la página repetía este mismo criterio a mano
 * en el desglose operador × etapa (`desempeno.astro`), y las dos copias
 * podían desalinearse con un cambio futuro en una sola.
 */
export function operadorDeJob(job: { creadoPor: string | null; clientId: string }, operadorDeCliente: Map<string, string | null>): string | null {
  return job.creadoPor ?? operadorDeCliente.get(job.clientId) ?? null;
}

export function costo(
  jobs: JobM[],
  operadorDeCliente: Map<string, string | null>,
  p: Periodo,
): {
  total: number;
  porCliente: Map<string, number>;
  porEtapa: Record<'research' | 'growth' | 'pilares', number>;
  porOperador: Map<string, number>;
} {
  const enPeriodo = filtrarPeriodo(jobs, p);

  let total = 0;
  const porCliente = new Map<string, number>();
  const porEtapa: Record<'research' | 'growth' | 'pilares', number> = { research: 0, growth: 0, pilares: 0 };
  const porOperador = new Map<string, number>();

  for (const j of enPeriodo) {
    total += j.costoUsd;
    porCliente.set(j.clientId, (porCliente.get(j.clientId) ?? 0) + j.costoUsd);
    porEtapa[j.tipo] += j.costoUsd;

    const clave = operadorDeJob(j, operadorDeCliente) ?? 'sin_asignar';
    porOperador.set(clave, (porOperador.get(clave) ?? 0) + j.costoUsd);
  }

  total = round2(total);
  for (const [k, v] of porCliente) porCliente.set(k, round2(v));
  for (const k of Object.keys(porEtapa) as Array<'research' | 'growth' | 'pilares'>) porEtapa[k] = round2(porEtapa[k]);
  for (const [k, v] of porOperador) porOperador.set(k, round2(v));

  return { total, porCliente, porEtapa, porOperador };
}

/**
 * Recorta eventos y comentarios a las etapas "cerradas" en el periodo: las
 * que tienen un evento `aprobar` dentro del rango (`filtrarPeriodo`). Con
 * `esTodo` (periodo "todo") no hay nada que recortar — ya es todo el
 * historial, y no hace falta acotar a lo aprobado dentro de un rango que no
 * existe.
 *
 * Extraída de `src/pages/desempeno.astro` (tarea I4, punto 2): la página
 * decidía "qué cuenta como cerrado en este periodo" mezclado con el armado
 * del HTML; ahora es una función pura que se puede probar sola.
 *
 * `tiemposPorEtapa` y `calidad` no reciben un `Periodo` (no está en su
 * firma): necesitan el historial completo de cada etapaId para emparejar
 * eventos (duracion, esperaRevision, respuestaCambios), así que el recorte
 * por periodo se hace ANTES, a nivel de qué etapaIds entran — cortar por la
 * fecha de cada evento suelto rompería esos pares.
 */
export function enPeriodoCerrado(
  eventos: Evento[],
  comentarios: ComentarioM[],
  p: Periodo,
  esTodo: boolean,
): { eventos: Evento[]; comentarios: ComentarioM[] } {
  if (esTodo) return { eventos, comentarios };
  const etapaIdsCerradas = new Set(filtrarPeriodo(eventos.filter((e) => e.accion === 'aprobar'), p).map((e) => e.etapaId));
  return {
    eventos: eventos.filter((e) => etapaIdsCerradas.has(e.etapaId)),
    comentarios: comentarios.filter((c) => etapaIdsCerradas.has(c.etapaId)),
  };
}

/**
 * Agrupa ids de cliente por operador ('sin_asignar' si no tiene uno).
 * Extraída de `src/pages/desempeno.astro` (tarea I4, punto 2): la tabla «Por
 * operador» arma sus grupos con esto en vez de reconstruir el Map a mano en
 * el frontmatter de la página.
 */
export function agruparClientesPorOperador(clientes: { id: string; operadorId: string | null }[]): Map<string, string[]> {
  const grupos = new Map<string, string[]>();
  for (const c of clientes) {
    const clave = c.operadorId ?? 'sin_asignar';
    const lista = grupos.get(clave);
    if (lista) lista.push(c.id);
    else grupos.set(clave, [c.id]);
  }
  return grupos;
}

type TipoJob = JobM['tipo'];

/** Tipo de documento (job) de cada etapa; `desarrollo_mensual` no genera jobs todavía (mismo mapa que `tipoDocumentoDe`, src/flujo/reglas.ts, repetido aquí para no importar esa lógica de negocio — a diferencia de PESOS/etapasParaAvance arriba, que sí se comparten para el % de avance, ver nota de imports). */
const TIPO_POR_ETAPA: Partial<Record<Etapa, TipoJob>> = {
  investigacion: 'research',
  pilares: 'pilares',
  manual_campana: 'growth',
};

export type FilaDesgloseEtapa = { etapa: Etapa; dias: number | null; rondas: number | null; costo: number };

/**
 * Desglose por etapa de un grupo de eventos y jobs — el de un solo cliente
 * (matriz cliente × etapa) o el de todos los clientes de un operador (matriz
 * operador × etapa), spec §5 y tarea I4 punto 2. Para cada etapa: mediana de
 * días hasta aprobar, promedio de rondas de cambios (misma definición que
 * `calidad`/`rondasPorEtapa`) y costo total de jobs de ese tipo de
 * documento.
 *
 * No filtra por periodo: quien llama ya le pasa `eventosGrupo` recortado con
 * `enPeriodoCerrado` y `jobsGrupo` ya acotado al periodo (mismo patrón que
 * usa la página con `costo()`). `desarrollo_mensual` no tiene tipo de
 * documento todavía, así que su costo siempre es 0.
 */
export function desglosePorEtapa(eventosGrupo: Evento[], jobsGrupo: JobM[]): Record<Etapa, FilaDesgloseEtapa> {
  const { duracion } = tiemposPorEtapa(eventosGrupo);
  const rondas = rondasPorEtapa(eventosGrupo);

  const costoPorTipo: Record<TipoJob, number> = { research: 0, pilares: 0, growth: 0 };
  for (const j of jobsGrupo) costoPorTipo[j.tipo] += j.costoUsd;

  const resultado = {} as Record<Etapa, FilaDesgloseEtapa>;
  for (const etapa of ETAPAS_VACIAS) {
    const tipo = TIPO_POR_ETAPA[etapa];
    resultado[etapa] = {
      etapa,
      dias: resumenEstadistico(duracion[etapa]).mediana,
      rondas: resumenEstadistico(rondas[etapa]).promedio,
      costo: tipo ? round2(costoPorTipo[tipo]) : 0,
    };
  }
  return resultado;
}
