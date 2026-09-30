// El paso «Elegir los temas del mes» (rediseño 2026-09-30): antes de que la IA
// escriba nada, el sistema PROPONE qué tema del mapa de pilares va en cada
// pieza del mes y el equipo lo acepta o lo cambia. Todo puro —sin base, sin
// modelo—: proponer no cuesta nada y las reglas se prueban sin gastar un
// centavo.
//
// Qué decide cada quien:
// - el sistema, con las mismas reglas de siempre (paquete exacto, reparto por
//   función del mix y por pilar, pendientes primero, sin repetir meses
//   anteriores), la propuesta inicial;
// - el equipo (responsables de contenido y diseño, o un admin), el tema, la
//   fecha y el formato de cada fila, y autorizar;
// - el modelo, solo el texto: recibe los temas ya autorizados y no elige.

import { FORMATOS, type Formato } from '../reglas';
import type { Paquete } from '../reglas';
import type { Funcion } from '@/pilares/schemas';
import {
  armarRanuras, diasDelPeriodo, faltantes, separarPiezas, totalDe,
  type Mix, type Modo, type PiezaExistente, type Ranura, MODOS,
} from './plan';
import { asignarTemas, pilaresPorUso, temasUsados, type TemaCatalogo } from './temas';

/** Una fila de la selección: la pieza que se va a escribir y el tema con que se escribe. */
export type FilaTema = {
  ref: number;
  formato: Formato;
  fecha: string;
  /** `null` solo en una propuesta a la que ya no le quedaban temas sin usar: hay que elegir uno. */
  temaId: string | null;
};

/** Quién autorizó, y cuándo. El nombre viaja guardado: la pantalla lo muestra sin otra consulta. */
export type Autorizacion = { usuarioId: string; nombre: string; en: string };

/**
 * Lo que se guarda en `contenido_lotes.temas_mes`: la selección del mes. Sin
 * `autorizada` es un borrador (sobrevive a recargar); con ella, lo que se mandó
 * a generar.
 */
export type SeleccionTemas = {
  modo: Modo;
  incluirConArte: boolean;
  filas: FilaTema[];
  propuestaEn: string;
  propuestaPor: string | null;
  autorizada: Autorizacion | null;
};

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Lee `temas_mes` sin confiar en su forma: lo que no cuadra se descarta entero (la pantalla propone de nuevo). */
export function leerSeleccion(v: unknown): SeleccionTemas | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (!(MODOS as readonly unknown[]).includes(s.modo) || !Array.isArray(s.filas)) return null;
  const filas: FilaTema[] = [];
  for (const f of s.filas) {
    const r = f as Record<string, unknown> | null;
    if (!r || typeof r.ref !== 'number' || typeof r.fecha !== 'string' || !FECHA_RE.test(r.fecha)
      || !(FORMATOS as readonly unknown[]).includes(r.formato)) return null;
    filas.push({ ref: r.ref, formato: r.formato as Formato, fecha: r.fecha, temaId: typeof r.temaId === 'string' ? r.temaId : null });
  }
  const a = s.autorizada as Record<string, unknown> | null | undefined;
  const autorizada: Autorizacion | null = a && typeof a.usuarioId === 'string' && typeof a.en === 'string'
    ? { usuarioId: a.usuarioId, nombre: typeof a.nombre === 'string' ? a.nombre : '', en: a.en }
    : null;
  return {
    modo: s.modo as Modo,
    incluirConArte: s.incluirConArte === true,
    filas,
    propuestaEn: typeof s.propuestaEn === 'string' ? s.propuestaEn : '',
    propuestaPor: typeof s.propuestaPor === 'string' ? s.propuestaPor : null,
    autorizada,
  };
}

// ── La propuesta ────────────────────────────────────────────────────────

/**
 * La propuesta del sistema: una fila por pieza a escribir, con su formato, su
 * fecha y su tema. Es la MISMA lógica que antes corría dentro del trabajo de
 * IA —`armarRanuras` para formatos, fechas y funciones; `asignarTemas` para los
 * temas—, solo que ahora se ve y se corrige antes de gastar.
 *
 * - `piezasLote`: las piezas que el mes ya tiene; `modo`/`incluirConArte`
 *   dicen cuáles se quedan y cuáles se reemplazan (`separarPiezas`), y de ahí
 *   sale cuántas faltan del paquete.
 * - `temasDelCliente`: los temas de las piezas del cliente en cualquier mes.
 *   Los de las piezas que se van a reemplazar vuelven a estar libres.
 * - `desde`: si el mes ya empezó, el día desde el que se publica (hoy).
 */
export function proponerTemas(o: {
  periodo: string;
  paquete: Paquete;
  modo: Modo;
  incluirConArte: boolean;
  piezasLote: PiezaExistente[];
  temasDelCliente: { id: string; temaId: string | null }[];
  catalogo: TemaCatalogo[];
  mix: Mix | null | undefined;
  desde?: string;
}): FilaTema[] {
  const { quedan, reemplazar } = separarPiezas(o.piezasLote, o.modo, o.incluirConArte);
  const porGenerar = faltantes(o.paquete, quedan);
  if (totalDe(porGenerar) === 0) return [];

  const seVan = new Set(reemplazar.map((p) => p.id));
  const usados = temasUsados(o.temasDelCliente.filter((p) => !seVan.has(p.id)));

  const funcionDe = new Map(o.catalogo.map((t) => [t.id, t.funcion]));
  const funcionesQueQuedan: Partial<Record<Funcion, number>> = {};
  for (const p of quedan) {
    const f = p.temaId ? funcionDe.get(p.temaId) : undefined;
    if (f) funcionesQueQuedan[f] = (funcionesQueQuedan[f] ?? 0) + 1;
  }

  const ranuras = armarRanuras({
    periodo: o.periodo,
    aGenerar: porGenerar,
    quedan,
    mix: o.mix,
    funcionesQueQuedan,
    pilares: pilaresPorUso(o.catalogo, usados),
    desde: o.desde,
  });
  const temas = asignarTemas(ranuras, o.catalogo, usados);
  return ranuras.map((r) => ({ ref: r.ref, formato: r.formato, fecha: r.fecha, temaId: temas.get(r.ref)?.id ?? null }));
}

// ── Validar lo que el equipo editó ──────────────────────────────────────

export type Validacion = {
  /** Lo que impide guardar o autorizar. */
  errores: string[];
  /** Lo que se avisa pero no impide: el paquete no cuadra. Autorizar exige confirmarlo. */
  avisos: string[];
  /** El paquete (lo que faltaba) contra lo que lleva la selección, por formato; null si cuadra. */
  desajuste: { formato: Formato; pide: number; lleva: number }[] | null;
};

const NOMBRE_FORMATO: Record<Formato, [string, string]> = {
  post: ['post', 'posts'], carrusel: ['carrusel', 'carruseles'], reel: ['reel', 'reels'], historia: ['historia', 'historias'],
};
const plural = (n: number, f: Formato) => `${n} ${NOMBRE_FORMATO[f][n === 1 ? 0 : 1]}`;

/**
 * Las reglas de una selección, las mismas en el guardado del borrador y al
 * autorizar (`exigirTemas`: al autorizar, todas las filas llevan tema):
 * - una fila por pieza a escribir, ni más ni menos (`esperadas`): el equipo
 *   cambia QUÉ se escribe, no cuántas piezas hay;
 * - formato válido y fecha dentro del mes;
 * - el tema debe existir en el banco del mapa y NO repetirse dentro del mes
 *   —ni entre filas ni con una pieza que se queda (`bloqueados`)—. Un tema de
 *   otro mes sí se puede elegir a mano: la pantalla avisa que ya se usó;
 * - el mix de formatos puede moverse, pero si ya no cuadra con el paquete se
 *   avisa y autorizar exige confirmarlo: nunca se rompe el conteo en silencio.
 */
export function validarSeleccion(o: {
  filas: FilaTema[];
  periodo: string;
  catalogo: TemaCatalogo[];
  /** Temas de las piezas que se quedan en este mes: no se pueden repetir. `numero` es el de la pieza, para decirlo. */
  bloqueados: Map<string, number>;
  esperadas: Record<Formato, number>;
  exigirTemas: boolean;
}): Validacion {
  const errores: string[] = [];
  const dias = new Set(diasDelPeriodo(o.periodo));
  const existentes = new Set(o.catalogo.map((t) => t.id));
  const total = totalDe(o.esperadas);

  if (o.filas.length !== total) {
    errores.push(`El mes pide ${total} ${total === 1 ? 'pieza' : 'piezas'} y la selección lleva ${o.filas.length}. Vuelve a proponer los temas.`);
  }

  const refs = new Set<number>();
  const vistos = new Map<string, number>();
  for (const f of o.filas) {
    if (refs.has(f.ref)) errores.push(`La pieza ${f.ref} aparece dos veces.`);
    refs.add(f.ref);
    if (!(FORMATOS as readonly unknown[]).includes(f.formato)) errores.push(`La pieza ${f.ref} tiene un formato que no existe.`);
    if (!FECHA_RE.test(f.fecha) || !dias.has(f.fecha)) errores.push(`La pieza ${f.ref} tiene una fecha fuera del mes.`);
    if (!f.temaId) {
      if (o.exigirTemas) errores.push(`Elige un tema para la pieza ${f.ref}.`);
      continue;
    }
    if (!existentes.has(f.temaId)) { errores.push(`El tema ${f.temaId} de la pieza ${f.ref} no está en el mapa de pilares.`); continue; }
    const otra = vistos.get(f.temaId);
    if (otra !== undefined) errores.push(`El tema ${f.temaId} está en las piezas ${otra} y ${f.ref}: no se puede repetir en el mes.`);
    else vistos.set(f.temaId, f.ref);
    const pieza = o.bloqueados.get(f.temaId);
    if (pieza !== undefined) errores.push(`El tema ${f.temaId} ya lo tiene la pieza ${pieza} de este mes: no se puede repetir.`);
  }

  const lleva = Object.fromEntries(FORMATOS.map((f) => [f, o.filas.filter((x) => x.formato === f).length])) as Record<Formato, number>;
  const diferencias = FORMATOS.filter((f) => lleva[f] !== o.esperadas[f]).map((f) => ({ formato: f, pide: o.esperadas[f], lleva: lleva[f] }));
  const avisos: string[] = [];
  if (diferencias.length && o.filas.length === total) {
    avisos.push(`El paquete no cuadra: ${diferencias.map((d) => `pide ${plural(d.pide, d.formato)} y llevas ${d.lleva}`).join('; ')}.`);
  }
  return { errores, avisos, desajuste: diferencias.length && o.filas.length === total ? diferencias : null };
}

// ── De la selección autorizada a las ranuras del agente ─────────────────

/**
 * Las ranuras que recibe el agente: una por fila, con su tema y su fecha ya
 * cerrados. La función y el pilar salen del tema (no de un reparto): así el
 * redactor sabe qué función del mix tiene que cumplir esa pieza. Falla si un
 * tema ya no está en el mapa (se regeneró entre autorizar y escribir).
 */
export function ranurasAutorizadas(
  filas: { ref: number; formato: Formato; fecha: string; temaId: string }[],
  catalogo: TemaCatalogo[],
): { ranuras: Ranura[] } | { error: string } {
  const porId = new Map(catalogo.map((t) => [t.id, t]));
  const ranuras: Ranura[] = [];
  for (const f of [...filas].sort((a, b) => a.ref - b.ref)) {
    const tema = porId.get(f.temaId);
    if (!tema) return { error: `El tema ${f.temaId} ya no está en el mapa de pilares (se regeneró después de autorizarlo). Vuelve a elegir los temas del mes.` };
    ranuras.push({ ref: f.ref, formato: f.formato, fecha: f.fecha, funcion: tema.funcion, pilar: tema.pilar, temaId: tema.id, fija: true });
  }
  return { ranuras };
}

/**
 * Qué pasa con las piezas del mes según el modo: cuáles se quedan, cuáles se
 * reemplazan, cuántas faltan del paquete por formato y qué temas quedan
 * bloqueados (los de las piezas que se quedan: no se pueden repetir en el mes).
 */
export function situacionDelMes(o: {
  paquete: Paquete;
  modo: Modo;
  incluirConArte: boolean;
  piezasLote: PiezaExistente[];
}): { quedan: PiezaExistente[]; reemplazar: PiezaExistente[]; esperadas: Record<Formato, number>; bloqueados: Map<string, number> } {
  const { quedan, reemplazar } = separarPiezas(o.piezasLote, o.modo, o.incluirConArte);
  const bloqueados = new Map<string, number>();
  for (const p of quedan) if (p.temaId) bloqueados.set(p.temaId, p.numero);
  return { quedan, reemplazar, esperadas: faltantes(o.paquete, quedan), bloqueados };
}
