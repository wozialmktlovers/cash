import type { Growth } from '@/growth/schemas';
import { construirUrls, type UrlEtiquetada } from '@/growth/utm';
import { ESTILOS_GROWTH } from './estilos';
import { NAVEGACION_GROWTH } from './navegacion';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
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
export function renderizarManual(
  datos: Partial<Growth> & { _huecos?: Record<string, string> },
  meta: MetaManual & { destino?: string; ciudad?: string; creadoEn?: Date },
  barraOperador = '',
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

  const secciones = [
    seccion('setup', seccionPortada(datos, meta, urls.length, huecos)),
    seccion('meta', seccionMeta(datos, huecos)),
    seccion('creativos', seccionCreativos(datos, huecos, urls)),
    seccion('prompts', seccionPrompts(datos, huecos)),
    seccion('google', seccionGoogle(datos, huecos, urls)),
    seccion('rsa', seccionRsa(datos, huecos)),
    seccion('traza', seccionTraza(urls)),
    seccion('tecnico', seccionTecnico(meta, datos)),
    seccion('seguimiento', seccionSeguimiento(datos)),
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
</head><body>
${barraOperador}
<nav class="nav">
  <img src="${LOGO_WOZIAL_SRC}" alt="Wozial" class="nav-logo">
  <div class="nav-links">${enlaces}</div>
  <div class="nav-ctr">
    <button class="gbtn gbtn-txt" id="escala" aria-label="Tamaño del texto">1x</button>
    <button class="gbtn" id="pantalla" aria-label="Pantalla completa" title="Pantalla completa (F)">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</nav>
<div class="prog"><div class="prog-fill" id="pf"></div></div>
<main>${secciones}</main>
<script>${NAVEGACION_GROWTH}</script>
</body></html>`;
}
