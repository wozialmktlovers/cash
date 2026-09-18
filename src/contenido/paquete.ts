// El paquete mensual de un cliente (diseño §3): cuántos posts, carruseles,
// reels e historias lleva cada mes. Vive en `clients.paquete` y cada lote lo
// hereda; «El mes en números» lo compara con lo que hay (`cuadraConPaquete`) y
// la generación del mes con IA produce exactamente eso.
//
// Puro y sin Zod: lo usan la ruta que lo guarda, la que lanza la generación y
// el worker, y ninguno necesita más que contar.

import { FORMATOS, type Formato, type Paquete } from './reglas';

/**
 * Tope por formato. Un cliente con 40 historias al mes ya es un caso raro; más
 * que eso casi seguro es un error de dedo (400 en vez de 40), y la generación
 * con IA pagaría cada una de esas piezas.
 */
export const MAX_POR_FORMATO = 60;

/** Total de piezas del paquete. */
export function totalPaquete(paquete: Paquete | null | undefined): number {
  if (!paquete) return 0;
  return FORMATOS.reduce((s, f) => s + (paquete[f] ?? 0), 0);
}

/**
 * ¿El cliente tiene paquete? Un paquete en ceros es lo mismo que no tenerlo:
 * no hay nada que generar ni con qué comparar el mes.
 */
export function paqueteDefinido(paquete: unknown): paquete is Paquete {
  return leerPaquete(paquete) !== null;
}

/**
 * El paquete guardado en `clients.paquete` (jsonb), ya limpio: solo las cuatro
 * claves conocidas y enteros no negativos. `null` si no hay paquete o suma cero.
 * Tolera lo que haya quedado en la columna de antes de la validación.
 */
export function leerPaquete(crudo: unknown): Paquete | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const salida: Paquete = {};
  for (const f of FORMATOS) {
    const n = Number((crudo as Record<string, unknown>)[f]);
    if (Number.isInteger(n) && n > 0) salida[f] = n;
  }
  return totalPaquete(salida) > 0 ? salida : null;
}

/**
 * Valida el cuerpo con que se guarda el paquete desde la ficha del cliente.
 * Acepta `{ post, carrusel, reel, historia }` con enteros de 0 a
 * `MAX_POR_FORMATO` (una clave ausente o vacía es cero). Todo en cero guarda
 * `null`: «este cliente no tiene paquete».
 */
export function validarPaquete(cuerpo: unknown):
  | { ok: true; paquete: Paquete | null }
  | { ok: false; errores: string[] } {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
    return { ok: false, errores: ['El paquete debe ser un objeto con posts, carruseles, reels e historias.'] };
  }
  const c = cuerpo as Record<string, unknown>;
  const desconocidas = Object.keys(c).filter((k) => !(FORMATOS as readonly string[]).includes(k));
  if (desconocidas.length) return { ok: false, errores: [`Formato desconocido en el paquete: ${desconocidas.join(', ')}.`] };

  const errores: string[] = [];
  const paquete: Paquete = {};
  for (const f of FORMATOS) {
    const v = c[f];
    if (v === undefined || v === null || v === '') continue;
    const n = typeof v === 'string' ? Number(v.trim()) : v;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_POR_FORMATO) {
      errores.push(`${NOMBRE_PLURAL[f]}: debe ser un número entero de 0 a ${MAX_POR_FORMATO}.`);
      continue;
    }
    if (n > 0) paquete[f] = n;
  }
  if (errores.length) return { ok: false, errores };
  return { ok: true, paquete: totalPaquete(paquete) > 0 ? paquete : null };
}

export const NOMBRE_PLURAL: Record<Formato, string> = {
  post: 'Posts',
  carrusel: 'Carruseles',
  reel: 'Reels',
  historia: 'Historias',
};
