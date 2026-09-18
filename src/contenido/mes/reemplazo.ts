// Qué piezas del mes se quedan, cuáles se pueden reemplazar y cuántas faltan
// para el paquete. Puro y sin Zod: lo comparten la ruta que lanza la
// generación, el pipeline que guarda y la pantalla del mes, que lo usa para
// decir de antemano qué va a pasar.

import { FORMATOS, type EstadoRevision, type Formato, type Paquete } from '../reglas';

export const MODOS = ['completar', 'reemplazar'] as const;
export type Modo = (typeof MODOS)[number];

/** Lo que el plan necesita saber de una pieza que ya está en el lote. */
export type PiezaExistente = {
  id: string;
  numero: number;
  formato: Formato;
  estadoCliente: EstadoRevision;
  arte: unknown;
  fechaPublicacion: string | null;
  temaId: string | null;
};

export const tieneArte = (p: { arte: unknown }): boolean => Array.isArray(p.arte) && p.arte.length > 0;

/**
 * ¿Esta pieza se puede reemplazar? Solo las que el cliente no ha revisado
 * (`pendiente`). Una aprobada nunca; una con cambios pedidos tampoco —el
 * cliente está esperando que se corrija ESA pieza—. Las que ya tienen arte
 * subido solo si quien lanza lo confirmó de forma explícita
 * (`incluirConArte`): el arte cuesta horas de diseño y no se tira por un clic.
 */
export function esReemplazable(p: Pick<PiezaExistente, 'estadoCliente' | 'arte'>, incluirConArte: boolean): boolean {
  if (p.estadoCliente !== 'pendiente') return false;
  return !tieneArte(p) || incluirConArte;
}

/** Qué piezas se quedan y cuáles se van, según el modo. `completar` no toca ninguna. */
export function separarPiezas<T extends Pick<PiezaExistente, 'estadoCliente' | 'arte'>>(
  piezas: T[], modo: Modo, incluirConArte: boolean,
): { quedan: T[]; reemplazar: T[] } {
  if (modo === 'completar') return { quedan: [...piezas], reemplazar: [] };
  const quedan: T[] = [], reemplazar: T[] = [];
  for (const p of piezas) (esReemplazable(p, incluirConArte) ? reemplazar : quedan).push(p);
  return { quedan, reemplazar };
}

/**
 * Cuántas piezas de cada formato faltan para llegar al paquete. Nunca
 * negativo: si ya sobran carruseles no se «generan menos», simplemente no se
 * genera ninguno de ese formato (y «El mes en números» avisa que sobran).
 */
export function faltantes(paquete: Paquete, quedan: { formato: Formato }[]): Record<Formato, number> {
  const salida = {} as Record<Formato, number>;
  for (const f of FORMATOS) {
    const hay = quedan.filter((p) => p.formato === f).length;
    salida[f] = Math.max(0, (paquete[f] ?? 0) - hay);
  }
  return salida;
}

export const totalDe = (conteo: Record<Formato, number>): number => FORMATOS.reduce((s, f) => s + conteo[f], 0);

