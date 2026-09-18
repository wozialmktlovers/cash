import { escapar } from '@/render/escapar';

export { escapar };

/**
 * Cabecera de sección: número, kicker, título y entradilla. El icono se pasa
 * como SVG en crudo porque viene del machote y no lleva datos.
 *
 * `aparece` es la clase de la base editorial: el encabezado entra al hacer
 * scroll, igual que en la investigación y el mapa de pilares. Sin JS (o con
 * movimiento reducido) se ve desde el principio.
 */
export function cabeceraSeccion(opts: {
  numero: string; kicker: string; titulo: string; lead?: string; icono?: string;
}): string {
  return `<div class="shead aparece">
    ${opts.icono ? `<div class="ilu ilu-sec">${opts.icono}</div>` : ''}
    <div class="shead-n"><span class="grad">${escapar(opts.numero)}</span></div>
    <div class="shead-x">
      <span class="skicker">${escapar(opts.kicker)}</span>
      <h2>${escapar(opts.titulo)}</h2>
      ${opts.lead ? `<p class="lead" style="margin-top:var(--e1);">${escapar(opts.lead)}</p>` : ''}
    </div>
  </div>`;
}

/**
 * Envoltura de sección: el ancla del nav vive aquí, y también `data-ancla`
 * (B7, spec §3, «secciones: `seccion:<id>`») cuando `anclas` es verdadero
 * — solo en la vista interna, nunca en `/p/...` (ruling del controlador B7).
 *
 * `data-seccion` es lo que mira `SCRIPT_EDITORIAL` para encender la entrada
 * del índice lateral por la que vas pasando: el mismo atributo que ya marcan
 * las secciones de la investigación, del mapa de pilares y del contenido
 * mensual.
 */
export function seccion(id: string, cuerpo: string, anclas = false): string {
  const dataAncla = anclas ? ` data-ancla="seccion:${escapar(id)}"` : '';
  return `<section class="sec" id="${escapar(id)}" data-seccion${dataAncla}><div class="wrap">${cuerpo}</div></section>`;
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
