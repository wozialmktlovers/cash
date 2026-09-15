import type { Fuente } from '@/research/schemas';
import { escapar } from '@/render/escapar';

export { escapar };

/** Enlace a la fuente con el dominio visible. El href también viene del modelo. */
export function fuente(f: Fuente): string {
  const seguro = /^https?:\/\//i.test(f.url) ? f.url : '#';
  let dominio = 'fuente';
  try {
    if (seguro !== '#') dominio = new URL(seguro).hostname.replace(/^www\./, '');
  } catch { /* URL mal formada: se queda «fuente» */ }
  return `<a class="fuente" href="${escapar(seguro)}" target="_blank" rel="noopener noreferrer">${escapar(dominio)}</a>`;
}

export function lista(items: string[]): string {
  if (!items.length) return '';
  return `<ul class="lista">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

export function sinDatos(): string {
  return '<p class="sin-datos">No se obtuvo información sobre este tema.</p>';
}

/** Número grande, título y una línea de entrada: la jerarquía que faltaba entre secciones. */
export function encabezadoSeccion(num: string, titulo: string, entrada: string): string {
  return `<header class="seccion-cabeza aparece">
    <span class="seccion-num">${escapar(num)}</span>
    <div><h2>${escapar(titulo)}</h2><p class="entrada">${escapar(entrada)}</p></div>
  </header>`;
}
