// El plan del mes que genera la IA: cuántas piezas, de qué formato, qué día y
// para qué función del mix. Todo puro —sin base, sin modelo— para que las
// reglas que el dueño fijó se puedan probar sin gastar un centavo:
//
// - la cantidad es EXACTAMENTE el paquete del cliente (menos lo que ya hay y se
//   queda, si se completa);
// - las fechas caen dentro del mes, en días hábiles y repartidas, sin amontonar;
// - el reparto por función respeta el mix editorial del mapa de pilares, y el
//   reparto por pilar va parejo, empezando por los menos usados.
//
// Lo que decide el modelo es el texto y cuál de los temas candidatos usa en
// cada ranura. Lo que aquí se decide no lo decide él: dejarle contar piezas o
// repartir fechas es pedirle que se equivoque en lo único que se puede medir.

import { FORMATOS, type Formato } from '../reglas';
import { FUNCIONES, type Funcion } from '@/pilares/schemas';

// Qué se queda, qué se reemplaza y cuánto falta: sin Zod, porque también lo usa
// la pantalla del mes (`PiezasEditor`) para decir qué va a pasar antes de lanzar.
export {
  MODOS, esReemplazable, faltantes, separarPiezas, tieneArte, totalDe,
  type Modo, type PiezaExistente,
} from './reemplazo';
import { type Modo, MODOS } from './reemplazo';

// ── Calendario ──────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

function partesPeriodo(periodo: string): { anio: number; mes: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodo);
  if (!m) throw new RangeError(`Periodo inválido: ${periodo}`);
  return { anio: Number(m[1]), mes: Number(m[2]) };
}

/** Todos los días del mes, en `AAAA-MM-DD`. */
export function diasDelPeriodo(periodo: string): string[] {
  const { anio, mes } = partesPeriodo(periodo);
  const dias: string[] = [];
  for (let t = Date.UTC(anio, mes - 1, 1); new Date(t).getUTCMonth() === mes - 1; t += DIA_MS) {
    dias.push(new Date(t).toISOString().slice(0, 10));
  }
  return dias;
}

/** 0 = domingo … 6 = sábado. Un día civil, sin zona: se lee en UTC. */
export const diaDeLaSemana = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();

/** Lunes a viernes. Sin festivos, por lo mismo que `limiteRevision`: una tabla vieja se equivoca en silencio. */
export const esHabil = (iso: string): boolean => {
  const d = diaDeLaSemana(iso);
  return d !== 0 && d !== 6;
};

/**
 * Los días hábiles en que tiene sentido publicar. Si el mes ya empezó
 * (`desde` dentro del mes), solo los que faltan; pero si quedan demasiado
 * pocos para repartir sin amontonar (menos de uno por cada dos piezas), se usa
 * el mes completo y el operador moverá las fechas que ya pasaron: amontonar
 * diez piezas en los dos últimos días sería peor.
 */
export function diasParaPublicar(periodo: string, cantidad: number, desde?: string): string[] {
  const todos = diasDelPeriodo(periodo).filter(esHabil);
  if (!desde) return todos;
  const restantes = todos.filter((d) => d >= desde);
  return restantes.length >= Math.max(1, Math.ceil(cantidad / 2)) ? restantes : todos;
}

/**
 * Reparte `cantidad` publicaciones en `dias`, lo más parejo posible.
 *
 * Cada pieza apunta a su lugar ideal en el mes (la i-ésima de n cae en la
 * fracción (i + ½)/n) y de ahí se mueve al día más cercano que tenga menos
 * publicaciones —contando las que ya estaban (`ocupadas`)—. Así nunca hay un
 * día con dos piezas mientras otro hábil se queda vacío, y las que se agregan
 * al completar un mes esquivan los días que ya tienen algo.
 */
export function repartirFechas(dias: string[], cantidad: number, ocupadas: (string | null)[] = []): string[] {
  if (cantidad <= 0 || dias.length === 0) return [];
  const carga = new Map(dias.map((d) => [d, 0]));
  for (const d of ocupadas) if (d && carga.has(d)) carga.set(d, carga.get(d)! + 1);

  const fechas: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const ideal = ((i + 0.5) * dias.length) / cantidad - 0.5;
    let mejor = 0;
    for (let j = 1; j < dias.length; j++) {
      const cj = carga.get(dias[j])!, cm = carga.get(dias[mejor])!;
      if (cj < cm || (cj === cm && Math.abs(j - ideal) < Math.abs(mejor - ideal))) mejor = j;
    }
    fechas.push(dias[mejor]);
    carga.set(dias[mejor], carga.get(dias[mejor])! + 1);
  }
  return fechas.sort();
}

/**
 * Intercala elementos de varios grupos para que ninguno se amontone: cada
 * elemento del grupo con `n` miembros ocupa la posición (k + ½)/n. Sirve para
 * que los reels no caigan todos la primera semana y para que las funciones del
 * mix se alternen en vez de ir en bloque.
 */
export function intercalar<K extends string>(conteo: [K, number][]): K[] {
  const posiciones: { k: K; pos: number; orden: number }[] = [];
  conteo.forEach(([k, n], orden) => {
    for (let i = 0; i < n; i++) posiciones.push({ k, pos: (i + 0.5) / n, orden });
  });
  return posiciones.sort((a, b) => a.pos - b.pos || a.orden - b.orden).map((p) => p.k);
}

// ── Mix editorial ───────────────────────────────────────────────────────

export type Mix = { funcion: Funcion; porcentaje: number }[];

/**
 * Cuántas piezas nuevas van a cada función del mix.
 *
 * Se apunta al mix sobre el mes ENTERO (las que se quedan más las nuevas): si
 * al completar ya hay tres piezas de venta y el mix pide 20 %, las nuevas
 * cargan hacia lo que falta. Se reparte por el método del mayor residuo, así
 * que la suma es exactamente `n`. Sin mix válido, parejo entre las cinco.
 */
export function repartirFunciones(mix: Mix | null | undefined, n: number, yaHay: Partial<Record<Funcion, number>> = {}): Record<Funcion, number> {
  const salida = Object.fromEntries(FUNCIONES.map((f) => [f, 0])) as Record<Funcion, number>;
  if (n <= 0) return salida;
  const pesos = new Map<Funcion, number>();
  const valido = Array.isArray(mix) && mix.some((m) => (m?.porcentaje ?? 0) > 0);
  for (const f of FUNCIONES) {
    const p = valido ? (mix!.find((m) => m.funcion === f)?.porcentaje ?? 0) : 20;
    pesos.set(f, Math.max(0, p));
  }
  const sumaPesos = [...pesos.values()].reduce((a, b) => a + b, 0) || 1;
  const hay = FUNCIONES.reduce((s, f) => s + (yaHay[f] ?? 0), 0);
  const total = n + hay;

  // Lo que le falta a cada función para su parte del mes completo.
  let deseo = FUNCIONES.map((f) => ({ f, v: Math.max(0, (pesos.get(f)! / sumaPesos) * total - (yaHay[f] ?? 0)) }));
  if (deseo.every((d) => d.v === 0)) deseo = FUNCIONES.map((f) => ({ f, v: pesos.get(f)! }));
  const sumaDeseo = deseo.reduce((s, d) => s + d.v, 0) || 1;

  const exactos = deseo.map((d) => ({ f: d.f, x: (d.v / sumaDeseo) * n }));
  let asignadas = 0;
  for (const e of exactos) { salida[e.f] = Math.floor(e.x); asignadas += salida[e.f]; }
  exactos
    .sort((a, b) => (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)) || FUNCIONES.indexOf(a.f) - FUNCIONES.indexOf(b.f))
    .slice(0, n - asignadas)
    .forEach((e) => { salida[e.f] += 1; });
  return salida;
}

// ── Ranuras ─────────────────────────────────────────────────────────────

/** Un hueco del mes que el modelo tiene que llenar. `ref` es su nombre en el pedido. */
export type Ranura = {
  ref: number;
  formato: Formato;
  fecha: string;
  funcion: Funcion;
  /** El pilar al que se le da preferencia al buscar temas (1–5). */
  pilar: number;
};

/** Qué formatos van al feed. Las historias se reparten aparte: conviven con el feed el mismo día. */
const FEED: Formato[] = ['post', 'carrusel', 'reel'];

/**
 * Arma las ranuras del mes: formato, fecha, función y pilar de cada pieza
 * nueva. `pilares` es el orden en que se reparten (los menos usados primero).
 */
export function armarRanuras(o: {
  periodo: string;
  aGenerar: Record<Formato, number>;
  quedan: { formato: Formato; fechaPublicacion: string | null }[];
  mix: Mix | null | undefined;
  funcionesQueQuedan?: Partial<Record<Funcion, number>>;
  pilares: number[];
  desde?: string;
}): Ranura[] {
  const nFeed = FEED.reduce((s, f) => s + o.aGenerar[f], 0);
  const nHist = o.aGenerar.historia;
  const total = nFeed + nHist;
  if (total === 0) return [];

  const esFeed = (f: Formato) => FEED.includes(f);
  const feedFormatos = intercalar(FEED.map((f) => [f, o.aGenerar[f]] as [Formato, number]));
  const fechasFeed = repartirFechas(
    diasParaPublicar(o.periodo, nFeed, o.desde), nFeed,
    o.quedan.filter((p) => esFeed(p.formato)).map((p) => p.fechaPublicacion),
  );
  const fechasHist = repartirFechas(
    diasParaPublicar(o.periodo, nHist, o.desde), nHist,
    o.quedan.filter((p) => p.formato === 'historia').map((p) => p.fechaPublicacion),
  );

  const base = [
    ...feedFormatos.map((formato, i) => ({ formato, fecha: fechasFeed[i] })),
    ...fechasHist.map((fecha) => ({ formato: 'historia' as Formato, fecha })),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha) || FORMATOS.indexOf(a.formato) - FORMATOS.indexOf(b.formato));

  const conteo = repartirFunciones(o.mix, total, o.funcionesQueQuedan);
  const funciones = intercalar(FUNCIONES.map((f) => [f, conteo[f]] as [Funcion, number]));
  const pilares = o.pilares.length ? o.pilares : [1, 2, 3, 4, 5];

  return base.map((b, i) => ({ ref: i + 1, formato: b.formato, fecha: b.fecha, funcion: funciones[i], pilar: pilares[i % pilares.length] }));
}

/** Semana del mes de una fecha: días 1–7 son la 1, 8–14 la 2… y 29–31 la 5. */
export const semanaDe = (fecha: string): number => Math.min(5, Math.floor((Number(fecha.slice(8, 10)) - 1) / 7) + 1);

/** Tope de piezas por pedido al modelo: con ~1500 tokens por pieza, ocho caben holgadas en la salida. */
export const PIEZAS_POR_TANDA = 8;

/**
 * Las tandas en que se pide el mes: una por semana, partida en trozos de
 * `PIEZAS_POR_TANDA` si la semana trae muchas. Pedir el mes entero de un golpe
 * cortaba la salida en los paquetes grandes y perdía todo; por semana, un
 * corte pierde a lo mucho esa tanda y las demás se guardan.
 */
export function tandasPorSemana(ranuras: Ranura[], porTanda = PIEZAS_POR_TANDA): { semana: number; ranuras: Ranura[] }[] {
  const tandas: { semana: number; ranuras: Ranura[] }[] = [];
  for (let semana = 1; semana <= 5; semana++) {
    const deSemana = ranuras.filter((r) => semanaDe(r.fecha) === semana);
    for (let i = 0; i < deSemana.length; i += porTanda) tandas.push({ semana, ranuras: deSemana.slice(i, i + porTanda) });
  }
  return tandas;
}

/**
 * Los números libres para las piezas nuevas, del más bajo al más alto: los
 * huecos que dejaron las piezas reemplazadas primero y después los que siguen
 * al último. Las piezas que se quedan conservan su número, que es el que el
 * cliente ya conoce («pieza 7 de septiembre»).
 */
export function numerosLibres(ocupados: number[], cuantos: number): number[] {
  const usados = new Set(ocupados);
  const libres: number[] = [];
  for (let n = 1; libres.length < cuantos; n++) if (!usados.has(n)) libres.push(n);
  return libres;
}

// ── Parámetros del trabajo ──────────────────────────────────────────────

/**
 * Lo que viaja en `research_jobs.parametros` de un job `contenido`: el lote, su
 * mes, el modo y si se confirmó reemplazar piezas con arte. `planeadas` son
 * los ids que eran reemplazables al lanzar: al guardar solo se borran esos, y
 * solo si lo siguen siendo (`decidirGuardado`, ./guardado.ts).
 */
export type ParametrosMes = {
  loteId: string;
  periodo: string;
  modo: Modo;
  incluirConArte: boolean;
  planeadas: string[];
};

export function leerParametros(v: unknown): ParametrosMes | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Record<string, unknown>;
  if (typeof p.loteId !== 'string' || typeof p.periodo !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.periodo)) return null;
  if (!(MODOS as readonly unknown[]).includes(p.modo)) return null;
  return {
    loteId: p.loteId,
    periodo: p.periodo,
    modo: p.modo as Modo,
    incluirConArte: p.incluirConArte === true,
    planeadas: Array.isArray(p.planeadas) ? p.planeadas.filter((x): x is string => typeof x === 'string') : [],
  };
}
