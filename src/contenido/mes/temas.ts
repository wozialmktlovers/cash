// De dónde salen los temas del mes: el mapa de pilares del cliente, con el
// avance que el equipo lleva en su banco (`pilares_temas`).
//
// Las reglas del dueño para la PROPUESTA de temas del mes (./propuesta.ts), y
// dónde vive cada una:
// - **Prefiere los pendientes**: `candidatosPara` los pone primero.
// - **Respeta el mix y el reparto por pilar**: cada ranura ya trae su función y
//   su pilar (`armarRanuras`, ./plan.ts), y los candidatos se ordenan por eso.
// - **No repite temas de meses anteriores**: `temasUsados` junta los temas de
//   todas las piezas del cliente, y ninguno de ellos se propone. El usuario sí
//   puede elegir uno a mano (el selector avisa que ya se usó), pero nunca el
//   mismo dos veces en el mismo mes (`validarSeleccion`).
//
// El modelo ya no elige temas: escribe sobre los que el equipo autorizó.

import type { EstadoTema, Formato as FormatoTema, Funcion, MapaPilares } from '@/pilares/schemas';
import type { Formato } from '../reglas';
import type { Ranura } from './plan';

export type TemaCatalogo = {
  id: string;
  texto: string;
  /** Nombre de la subcategoría del pilar a la que pertenece. */
  subcategoria: string;
  funcion: Funcion;
  formato: FormatoTema;
  pilar: number;
  estado: EstadoTema;
};

/** Todos los temas del mapa con su estado en el banco. Sin fila de avance, el tema está pendiente. */
export function catalogoDeTemas(mapa: MapaPilares | null | undefined, avance: Map<string, string> | Record<string, string> = {}): TemaCatalogo[] {
  const pilares = mapa?.pilares;
  if (!Array.isArray(pilares)) return [];
  const estadoDe = (id: string) => (avance instanceof Map ? avance.get(id) : avance[id]) as EstadoTema | undefined;
  return pilares.flatMap((p) => (p.estado === 'ok'
    ? p.subcategorias.flatMap((s) => s.temas.map((t) => ({
        id: t.id,
        texto: t.texto,
        subcategoria: s.nombre,
        funcion: t.funcion,
        formato: t.formato,
        pilar: Number(t.id[1]),
        estado: estadoDe(t.id) ?? 'pendiente',
      })))
    : []));
}

/** Los temas que ya tiene alguna pieza del cliente, de cualquier mes. */
export function temasUsados(piezas: { temaId: string | null }[]): Set<string> {
  return new Set(piezas.map((p) => p.temaId).filter((t): t is string => !!t));
}

/**
 * El orden en que se reparten los pilares: primero los que menos se han usado
 * (temas que dejaron de estar pendientes más temas ya puestos en piezas), para
 * que el mes empareje el mapa en vez de exprimir siempre el mismo pilar.
 */
export function pilaresPorUso(catalogo: TemaCatalogo[], usados: Set<string>): number[] {
  const numeros = [...new Set(catalogo.map((t) => t.pilar))].sort((a, b) => a - b);
  const uso = (n: number) => catalogo.filter((t) => t.pilar === n && (t.estado !== 'pendiente' || usados.has(t.id))).length;
  return numeros.sort((a, b) => uso(a) - uso(b) || a - b);
}

/** ¿El formato que sugirió la estrategia le queda a la pieza? El post admite cualquiera. */
function formatoCompatible(pieza: Formato, tema: FormatoTema): boolean {
  if (pieza === 'post') return true;
  if (pieza === 'historia') return tema === 'story';
  return pieza === tema;
}

/**
 * Los temas que se le ofrecen al modelo para una ranura, del mejor al peor.
 * Nunca uno de `excluidos` (usados en cualquier mes, o ya ofrecidos a otra
 * ranura de la misma tanda). El orden pesa, de más a menos: que siga pendiente,
 * que sea de la función que pide el mix, que sea del pilar que toca y que su
 * formato sugerido le quede a la pieza.
 */
export function candidatosPara(
  ranura: Pick<Ranura, 'formato' | 'funcion' | 'pilar'>,
  catalogo: TemaCatalogo[],
  excluidos: Set<string>,
  cuantos = 4,
): TemaCatalogo[] {
  const puntaje = (t: TemaCatalogo) =>
    (t.estado === 'pendiente' ? 0 : 100)
    + (t.funcion === ranura.funcion ? 0 : 50)
    + (t.pilar === ranura.pilar ? 0 : 10)
    + (formatoCompatible(ranura.formato, t.formato) ? 0 : 3);
  return catalogo
    .filter((t) => !excluidos.has(t.id))
    .map((t) => ({ t, p: puntaje(t) }))
    .sort((a, b) => a.p - b.p || a.t.id.localeCompare(b.t.id))
    .slice(0, cuantos)
    .map((x) => x.t);
}

/**
 * Un tema para cada ranura, sin repetir ninguno y sin tocar los `usados`: es
 * la propuesta del sistema para el paso «Elegir los temas del mes». Recorre
 * las ranuras en orden y a cada una le da su mejor candidato libre
 * (`candidatosPara`: pendiente, de la función del mix, del pilar que toca y de
 * formato compatible). `null` en las ranuras a las que ya no les queda tema sin
 * usar: el equipo tiene que elegir uno a mano.
 */
export function asignarTemas(ranuras: Pick<Ranura, 'ref' | 'formato' | 'funcion' | 'pilar'>[], catalogo: TemaCatalogo[], usados: Set<string>): Map<number, TemaCatalogo | null> {
  const ocupados = new Set(usados);
  const salida = new Map<number, TemaCatalogo | null>();
  for (const r of ranuras) {
    const tema = candidatosPara(r, catalogo, ocupados, 1)[0] ?? null;
    if (tema) ocupados.add(tema.id);
    salida.set(r.ref, tema);
  }
  return salida;
}
