// Métricas puras del tablero de desempeño (spec §5). Solo cálculo sobre datos
// en memoria: eventos, comentarios, jobs y etapas. Sin acceso a base de datos.
//
// Solo se importan tipos de src/flujo/reglas.ts (Etapa, Estado): el peso de
// avance por estado se repite aquí a propósito, en vez de importar PESOS o
// avanceCliente, para mantener este módulo desacoplado de esa lógica de
// transición (ver clarificación de la tarea D1).
import type { Etapa, Estado } from '@/flujo/reglas';

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

/** Réplica local de PESOS (src/flujo/reglas.ts) para no importar esa lógica de negocio; ver nota arriba. */
const PESO_ESTADO: Record<Estado, number> = {
  no_iniciada: 0,
  en_proceso: 25,
  en_revision: 50,
  con_cambios: 60,
  aprobada: 100,
};

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
      if (e.accion === 'pedir_cambios' || e.accion === 'reabrir' || e.accion === 'comentario_cliente') {
        const solicitud = siguienteConAccion(evs, i, ['solicitar']);
        if (solicitud) respuestaCambios.push(diasEntre(e.creadoEn, solicitud.creadoEn));
      }
    });
  }

  return { duracion, esperaRevision, respuestaCambios };
}

export function calidad(
  eventos: Evento[],
  comentarios: ComentarioM[],
): {
  rondasPorEtapaAprobada: number[];
  comentariosAdminPorEntregable: number;
  comentariosClientePorEntregable: number;
} {
  const porEtapaId = agruparPorEtapaId(ordenarPorFecha(eventos));
  const rondasPorEtapaAprobada: number[] = [];
  for (const evs of porEtapaId.values()) {
    const tieneAprobacion = evs.some((e) => e.accion === 'aprobar');
    if (!tieneAprobacion) continue;
    const rondas = evs.filter((e) => e.accion === 'pedir_cambios' || e.accion === 'reabrir').length;
    rondasPorEtapaAprobada.push(rondas);
  }

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

  // Avance por cliente: mismo cálculo que avanceCliente (promedio del peso de
  // las etapas contratadas y no internas; 0 sin ninguna), sin redondear cada
  // cliente por separado para no acumular el sesgo de un doble redondeo antes
  // de promediar entre clientes.
  const porCliente = new Map<string, EtapaM[]>();
  for (const e of etapas) {
    const lista = porCliente.get(e.clientId);
    if (lista) lista.push(e);
    else porCliente.set(e.clientId, [e]);
  }
  const avancesPorCliente: number[] = [];
  for (const es of porCliente.values()) {
    const visibles = es.filter((e) => e.contratada && !e.interna);
    if (visibles.length === 0) {
      avancesPorCliente.push(0);
      continue;
    }
    const suma = visibles.reduce((s, e) => s + PESO_ESTADO[e.estado], 0);
    avancesPorCliente.push(suma / visibles.length);
  }
  const avancePromedio =
    avancesPorCliente.length === 0 ? 0 : round1(avancesPorCliente.reduce((s, v) => s + v, 0) / avancesPorCliente.length);

  const aprobadasEnPeriodo = filtrarPeriodo(eventos, p).filter((e) => e.accion === 'aprobar').length;

  return { clientes, etapasActivas, avancePromedio, aprobadasEnPeriodo };
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

    const operadorId = j.creadoPor ?? operadorDeCliente.get(j.clientId) ?? null;
    const clave = operadorId ?? 'sin_asignar';
    porOperador.set(clave, (porOperador.get(clave) ?? 0) + j.costoUsd);
  }

  total = round2(total);
  for (const [k, v] of porCliente) porCliente.set(k, round2(v));
  for (const k of Object.keys(porEtapa) as Array<'research' | 'growth' | 'pilares'>) porEtapa[k] = round2(porEtapa[k]);
  for (const [k, v] of porOperador) porOperador.set(k, round2(v));

  return { total, porCliente, porEtapa, porOperador };
}
