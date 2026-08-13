import type { Fuente } from '@/research/schemas';

/** Toda cadena que venga del modelo pasa por aquí antes de tocar el HTML. */
export function escapar(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Una etapa que no produjo datos se declara vacía con su razón. Nunca se rellena. */
export function panelVacio(numero: string, titulo: string, razon: string): string {
  return `<section class="panel"><div class="wrap">
    <div class="pnum">${escapar(numero)}</div>
    <h2>${escapar(titulo)}</h2>
    <div class="alert alert-yellow" style="margin-top:22px;">
      <strong>Sin datos.</strong> ${escapar(razon)}
    </div>
  </div></section>`;
}

export function cabecera(numero: string, titulo: string, lead?: string): string {
  return `<div class="pnum">${escapar(numero)}</div>
    <h2>${escapar(titulo)}</h2>
    ${lead ? `<p class="lead">${escapar(lead)}</p>` : ''}`;
}

/** Un enlace de fuente. El href también se escapa: viene del modelo. */
export function enlaceFuente(f: Fuente): string {
  const seguro = /^https?:\/\//i.test(f.url) ? f.url : '#';
  return `<a href="${escapar(seguro)}" target="_blank" rel="noopener noreferrer">${escapar(f.url)}</a> <span class="tiny">(consultado ${escapar(f.consultado)})</span>`;
}

export function listaFuentes(fuentes: Fuente[]): string {
  const unicas = [...new Map(fuentes.map((f) => [f.url, f])).values()];
  if (!unicas.length) return '';
  return `<p class="src"><strong>Fuentes:</strong> ${unicas.map(enlaceFuente).join(' · ')}</p>`;
}

export function lista(items: string[], clase = 'lst'): string {
  if (!items.length) return '';
  return `<ul class="${clase}">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

export function tarjeta(titulo: string, cuerpo: string, color = ''): string {
  return `<div class="card ${color}">
    ${titulo ? `<h3>${escapar(titulo)}</h3>` : ''}
    ${cuerpo}
  </div>`;
}

export function tabla(encabezados: string[], filas: string[][]): string {
  return `<div class="tbl-wrap" style="margin-bottom:16px;">
    <table class="tbl">
      <thead><tr>${encabezados.map((h) => `<th>${escapar(h)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

/** Si una sección no tiene nada que mostrar, se dice, en vez de dejar un hueco. */
export function siVacio(items: unknown[], mensaje: string): string {
  return items.length ? '' : `<p class="hint">${escapar(mensaje)}</p>`;
}
