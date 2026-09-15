export const TINTES = ['rosa', 'azul', 'amarillo'] as const;
export type Tinte = (typeof TINTES)[number];

export function iniciales(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((l): l is string => Boolean(l))
    .slice(0, 2);
  return letras.length ? letras.join('').toLocaleUpperCase('es-MX') : '?';
}

/**
 * Depende solo del id: el mismo cliente conserva su color en el tablero, la
 * lista y la ficha, aunque cambie de nombre o de posición.
 */
export function tinte(id: string): Tinte {
  let suma = 0;
  for (const ch of id) suma += ch.codePointAt(0) ?? 0;
  return TINTES[suma % TINTES.length];
}
