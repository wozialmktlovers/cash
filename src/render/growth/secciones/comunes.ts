import { escapar } from '@/render/panels/comunes';

export { escapar };

/**
 * Cabecera de sección del machote: número, kicker, título y entradilla.
 * El icono se pasa como SVG en crudo porque viene del machote y no lleva datos.
 */
export function cabeceraSeccion(opts: {
  numero: string; kicker: string; titulo: string; lead?: string; icono?: string;
}): string {
  return `<div class="shead">
    ${opts.icono ? `<div class="ilu ilu-sec">${opts.icono}</div>` : ''}
    <div class="shead-n"><span class="grad">${escapar(opts.numero)}</span></div>
    <div class="shead-x">
      <span class="skicker">${escapar(opts.kicker)}</span>
      <h2>${escapar(opts.titulo)}</h2>
      ${opts.lead ? `<p class="lead" style="margin-top:8px;">${escapar(opts.lead)}</p>` : ''}
    </div>
  </div>`;
}

/** Envoltura de sección: el ancla del nav vive aquí. */
export function seccion(id: string, cuerpo: string): string {
  return `<section class="sec" id="${escapar(id)}"><div class="wrap">${cuerpo}</div></section>`;
}

/**
 * Un dato que el agente no entregó. Se declara, nunca se rellena.
 * Es la misma regla que ya rige el Social Research: un hueco con su razón es
 * información; un hueco relleno de plausibilidad es una mentira.
 */
export function hueco(razon: string): string {
  return `<div class="alert alert-yellow"><strong>Sin datos.</strong> ${escapar(razon)}</div>`;
}

export function filas(pares: [string, string][]): string {
  return pares.map(([k, v]) =>
    `<div class="kv"><div class="kv-k">${escapar(k)}</div><div>${escapar(v)}</div></div>`,
  ).join('');
}

export function chips(items: string[], clase = 'chip'): string {
  if (!items.length) return '';
  return `<div class="chips">${items.map((i) => `<span class="${clase}">${escapar(i)}</span>`).join('')}</div>`;
}

export function tablaGrowth(encabezados: string[], cuerpo: string[][]): string {
  return `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>${encabezados.map((h) => `<th>${escapar(h)}</th>`).join('')}</tr></thead>
    <tbody>${cuerpo.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

export function listaGrowth(items: string[], clase = 'lst'): string {
  if (!items.length) return '';
  return `<ul class="${clase}">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}
