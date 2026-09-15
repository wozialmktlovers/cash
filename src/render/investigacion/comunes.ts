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

/** Las celdas llegan ya como HTML seguro: quien llama escapa o usa fuente(). */
export function tabla(encabezados: string[], filas: string[][]): string {
  if (!filas.length) return '';
  return `<div class="tabla"><table><thead><tr>${encabezados.map((e) => `<th>${escapar(e)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function sinDatos(): string {
  return '<p class="sin-datos">No se obtuvo información sobre este tema.</p>';
}
