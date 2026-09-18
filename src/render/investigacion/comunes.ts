import type { Fuente } from '@/research/schemas';
import { escapar, lista, encabezadoSeccion } from '@/render/editorial/comunes';

export { escapar, lista, encabezadoSeccion };

/** Enlace a la fuente con el dominio visible. El href también viene del modelo. */
export function fuente(f: Fuente | undefined): string {
  // Opcional desde que la normalización conserva un dato cuya fuente no llegó
  // (el miedo principal de la audiencia): sin fuente no se pinta enlace.
  if (!f || typeof f.url !== 'string') return '';
  const seguro = /^https?:\/\//i.test(f.url) ? f.url : '#';
  let dominio = 'fuente';
  try {
    if (seguro !== '#') dominio = new URL(seguro).hostname.replace(/^www\./, '');
  } catch { /* URL mal formada: se queda «fuente» */ }
  return `<a class="fuente" href="${escapar(seguro)}" target="_blank" rel="noopener noreferrer">${escapar(dominio)}</a>`;
}

export function sinDatos(): string {
  return '<p class="sin-datos">No se obtuvo información sobre este tema.</p>';
}
