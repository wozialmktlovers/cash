import { normalizarTema } from './texto';
import { FUNCIONES, type Estrategia, type Funcion, type PilarGenerado, type PilarMapa, type Tema } from './schemas';

// Re-exportado desde el módulo hoja `texto.ts` para no romper los imports
// existentes de `normalizarTema` desde `@/pilares/revision`.
export { normalizarTema };

/** Palabras de 4 letras o más: las cortas («de», «tu», «no») hacen parecer iguales temas distintos. */
export function palabras(t: string): Set<string> {
  return new Set(normalizarTema(t).split(' ').filter((w) => w.length >= 4));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  return comunes / (a.size + b.size - comunes);
}

export function sonParecidos(a: string, b: string): boolean {
  return normalizarTema(a) === normalizarTema(b) || jaccard(palabras(a), palabras(b)) >= 0.6;
}

// El id lo pone el código, no el modelo: la etapa de desarrollo de piezas se ligará a él.
export function asignarIds(numero: number, p: PilarGenerado): Extract<PilarMapa, { estado: 'ok' }> {
  return {
    numero,
    estado: 'ok',
    subcategorias: p.subcategorias.map((s, i) => ({
      nombre: s.nombre,
      temas: s.temas.map((t, j) => ({ id: `P${numero}-S${i + 1}-${String(j + 1).padStart(2, '0')}`, ...t })),
    })),
  };
}

export function todosLosTemas(pilares: PilarMapa[]): Tema[] {
  return pilares.flatMap((p) => (p.estado === 'ok' ? p.subcategorias.flatMap((s) => s.temas) : []));
}

/**
 * Pares [primero, repetido] en orden de aparición. El segundo es el que se
 * reescribe.
 *
 * `sonParecidos` normaliza y saca el set de palabras de cada texto que
 * recibe; llamarla directamente aquí repetiría ese trabajo por cada PAR
 * (O(n²) normalizaciones sobre solo n temas distintos). Con el banco
 * completo de pilares (hasta 15 subcategorías × varios temas cada una) ya
 * es un número de pares nada despreciable, así que se precalcula la
 * normalización y el set de palabras de cada tema una sola vez (limpieza
 * M3, punto 1) y el criterio de "parecidos" se repite aquí sobre esos
 * valores ya calculados, en vez de sobre `sonParecidos(texto, texto)`.
 */
export function buscarDuplicados(temas: Tema[]): [string, string][] {
  const normalizados = temas.map((t) => normalizarTema(t.texto));
  const setsPalabras = temas.map((t) => palabras(t.texto));

  const pares: [string, string][] = [];
  for (let i = 0; i < temas.length; i++) {
    for (let j = i + 1; j < temas.length; j++) {
      const parecidos = normalizados[i] === normalizados[j] || jaccard(setsPalabras[i], setsPalabras[j]) >= 0.6;
      if (parecidos) pares.push([temas[i].id, temas[j].id]);
    }
  }
  return pares;
}

export function mixReal(temas: Tema[]): Record<Funcion, number> {
  const conteo = Object.fromEntries(FUNCIONES.map((f) => [f, 0])) as Record<Funcion, number>;
  for (const t of temas) conteo[t.funcion]++;
  if (!temas.length) return conteo;
  return Object.fromEntries(FUNCIONES.map((f) => [f, Math.round((conteo[f] / temas.length) * 100)])) as Record<Funcion, number>;
}

export function fueraDeMargen(mix: Estrategia['mix'], real: Record<Funcion, number>, margen = 5): Funcion[] {
  return mix.filter((m) => Math.abs((real[m.funcion] ?? 0) - m.porcentaje) > margen).map((m) => m.funcion);
}

export function aplicarReemplazos(pilares: PilarMapa[], reemplazos: Tema[]): PilarMapa[] {
  const porId = new Map(reemplazos.map((r) => [r.id, r]));
  return pilares.map((p) => p.estado !== 'ok' ? p : {
    ...p,
    subcategorias: p.subcategorias.map((s) => ({ ...s, temas: s.temas.map((t) => porId.get(t.id) ?? t) })),
  });
}
