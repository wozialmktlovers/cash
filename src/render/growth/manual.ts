import type { Growth } from '@/growth/schemas';
import { construirUrls, type UrlEtiquetada } from '@/growth/utm';
import { ESTILOS_GROWTH } from './estilos';
import { NAVEGACION_GROWTH } from './navegacion';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { atributoFlujo, panelVersiones, barraEdicion, panelComentarios, SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import { escapar, seccion } from './secciones/comunes';
import { seccionPortada, type MetaManual } from './secciones/portada';
import { seccionMeta } from './secciones/meta';
import { seccionCreativos } from './secciones/creativos';
import { seccionPrompts } from './secciones/prompts';
import { seccionGoogle } from './secciones/google';
import { seccionRsa } from './secciones/rsa';
import { seccionTraza } from './secciones/traza';
import { seccionTecnico } from './secciones/tecnico';
import { seccionSeguimiento } from './secciones/seguimiento';

export type { MetaManual };

// Iconos del portal del cliente (C2, spec §4): mismo trazo 14×14 que
// `pantalla` más abajo. Nunca texto en estos tres botones — «Comentar» sí
// lleva su propia etiqueta (SCRIPT_FLUJO se la cambia a «Salir de
// comentar», por eso usa la píldora de ancho automático, no estos iconos),
// pero «← Mi portal» y «Observaciones» son contenido fijo, y un botón
// circular de 31 px con la palabra completa adentro es justo lo que se veía
// roto en la verificación en vivo a 375 px: el texto se salía del círculo y
// atropellaba al botón vecino.
const ICONO_VOLVER = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2 3 7l6 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICONO_OBSERVACIONES = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 2.5h11v7h-6l-3 3v-3h-2v-7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// Mismo trazo que `ojo` en src/components/Icono.astro, adaptado al viewBox
// 14×14 de los demás iconos de este archivo (fix menores, punto 3).
const ICONO_OJO = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

const ANCLAS: [string, string][] = [
  ['setup', 'Setup'],
  ['meta', 'Meta'],
  ['creativos', 'Creativos'],
  ['prompts', 'Prompts'],
  ['google', 'Google'],
  ['rsa', 'Anuncios'],
  ['traza', 'Trazabilidad'],
  ['tecnico', 'Implementación'],
  ['seguimiento', 'Seguimiento'],
];

/**
 * Rinde el manual de campaña.
 *
 * `datos` puede venir incompleto: cada agente escribe su trozo y uno puede
 * haber fallado. Las secciones se rinden igual, declarando el hueco con su
 * razón, porque media campaña bien documentada sirve y una campaña inventada
 * sobre datos que no existen, no.
 */
/**
 * Datos exclusivos del portal del cliente (C2, spec §4): sin `barraOperador`
 * (nunca hay Compartir ahí), el manual no tiene otro sitio de dónde sacar el
 * enlace «← Mi portal» ni el botón para entrar al modo Comentar — en la
 * vista interna esos dos viven dentro de `barraOperador`.
 */
export type OpcionesPortalManual = {
  volverHref: string;
  volverTexto: string;
  ayudaComentarios?: string;
  /** Admin/operador previsualizando el manual del cliente (fix menores, punto 3): agrega la banda de aviso. */
  vistaPrevia?: boolean;
};

export function renderizarManual(
  datos: Partial<Growth> & { _huecos?: Record<string, string> },
  meta: MetaManual & { destino?: string; ciudad?: string; creadoEn?: Date },
  barraOperador = '',
  editable = false,
  flujo?: FlujoDatos,
  portal?: OpcionesPortalManual,
): string {
  const huecos = datos._huecos ?? {};

  // Las URLs solo se pueden construir con la estructura de campañas y un
  // destino. Sin cualquiera de los dos, la tabla se declara vacía en vez de
  // enseñar enlaces a ninguna parte.
  let urls: UrlEtiquetada[] = [];
  if (datos.campanasGoogle?.length && datos.creativos?.length && meta.destino) {
    urls = construirUrls({
      growth: datos as Growth,
      destino: meta.destino,
      cliente: meta.cliente,
      ciudad: meta.ciudad,
      creadoEn: meta.creadoEn ?? new Date(0),
    });
  }

  // `anclas`: solo en la vista interna (cuando llega `flujo`), nunca en la
  // vista pública ni en el link `/p/...` — mismo criterio que `editable`.
  const anclas = Boolean(flujo);
  const secciones = [
    seccion('setup', seccionPortada(datos, meta, urls.length, huecos, editable), anclas),
    seccion('meta', seccionMeta(datos, huecos, editable), anclas),
    seccion('creativos', seccionCreativos(datos, huecos, urls, editable, anclas), anclas),
    seccion('prompts', seccionPrompts(datos, huecos, editable), anclas),
    seccion('google', seccionGoogle(datos, huecos, urls), anclas),
    seccion('rsa', seccionRsa(datos, huecos), anclas),
    seccion('traza', seccionTraza(urls), anclas),
    seccion('tecnico', seccionTecnico(meta, datos), anclas),
    seccion('seguimiento', seccionSeguimiento(datos), anclas),
  ].join('\n');

  const enlaces = ANCLAS
    .map(([id, txt]) => `<a href="#${id}">${escapar(txt)}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Growth Wozial | ${escapar(meta.cliente)} · Manual de campaña</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#0a0a0a">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${ESTILOS_GROWTH}</style>
</head><body${flujo ? atributoFlujo(flujo) : ''}${portal?.vistaPrevia ? ' data-vista-previa' : ''}>
${barraOperador}
${portal?.vistaPrevia ? `<div class="banda-vista-previa">
  <span>${ICONO_OJO}Vista previa del portal</span>
  <a href="${escapar(portal.volverHref)}">${ICONO_VOLVER}Volver a la ficha</a>
</div>` : ''}
<nav class="nav">
  <img src="${LOGO_WOZIAL_SRC}" alt="Wozial" class="nav-logo">
  ${portal ? `<a class="gbtn gbtn-44" href="${escapar(portal.volverHref)}" aria-label="${escapar(portal.volverTexto)}" title="${escapar(portal.volverTexto)}">${ICONO_VOLVER}</a>` : ''}
  <div class="nav-links">${enlaces}</div>
  <div class="nav-ctr">
    ${portal && flujo?.puedeComentar ? `<button type="button" class="gbtn gbtn-pill" id="btn-flujo-comentar" aria-pressed="false">Comentar</button>
    <button type="button" class="gbtn gbtn-44" id="btn-flujo-comentarios" aria-haspopup="dialog" aria-controls="dialog-comentarios" aria-label="Observaciones" title="Observaciones">${ICONO_OBSERVACIONES}</button>` : ''}
    <button class="gbtn gbtn-txt" id="escala" aria-label="Tamaño del texto">1x</button>
    <button class="gbtn" id="pantalla" aria-label="Pantalla completa" title="Pantalla completa (F)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</nav>
<div class="prog"><div class="prog-fill" id="pf"></div></div>
<main>${secciones}</main>
${flujo?.puedeEditar ? panelVersiones() + barraEdicion() : ''}
${flujo?.puedeComentar ? panelComentarios(portal?.ayudaComentarios) : ''}
<script>${NAVEGACION_GROWTH}</script>
${flujo ? `<script>${SCRIPT_FLUJO}</script>` : ''}
</body></html>`;
}
