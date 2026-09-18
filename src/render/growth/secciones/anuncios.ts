import { escapar, cabeceraSeccion, hueco } from './comunes';
import { rutaEditable, rutaAncla } from '@/render/editorial/flujo-cliente';
import { GRUPOS, type Growth, type Creativo, type CampanaMeta } from '@/growth/schemas';
import { enlaceWeb } from '@/contenido/reglas';
import {
  ARCHIVOS, MEDIDAS, TARJETAS_CARRUSEL, acomodarArtes, claseDe,
  type ArteGrowth, type ArtesManual, type Hueco, type HuecoOcupado,
} from '@/growth/artes-reglas';

// La vista que el cliente entiende sin traducción: campaña → anuncios, cada
// anuncio con su arte a un lado y sus dos copys al otro. Es la anatomía del
// entregable que el Studio hacía a mano (el de Natú): encabezado por campaña
// con sus datos, tarjeta por anuncio con distintivo de formato, propósito,
// arte y pestañas Copy A / Copy B.
//
// No es un dato nuevo: sale de `campanasMeta`, `creativos` y
// `promptsImagen`. Desde que el manual dejó de traer las secciones de
// creativos y de prompts, es AQUÍ donde se editan el ángulo, los copys A y B
// y el brief visual de cada anuncio (y el prompt base), con las mismas rutas
// del JSON que usaban aquellas (`creativos.N.copyA`,
// `promptsImagen.porCreativo.N`...): el guardado de la API no cambia. N es el
// índice ORIGINAL en `datos.creativos`, no la posición dentro de la campaña.
// Cada ruta sale una sola vez en el documento: dos `data-editable` con la
// misma ruta se pisarían al guardar.
//
// Lo que el machote de Natú trae y aquí no está, porque el sistema no lo
// genera y un hueco relleno de plausibilidad es una mentira: el CTA de cada
// anuncio, el enlace al video, las fechas y el presupuesto por campaña.

const FORMATO_TEXTO: Record<string, string> = {
  imagen: 'Imagen', video: 'Video', carrusel: 'Carrusel',
};

// `ARCHIVOS` y `MEDIDAS` viven en src/growth/artes-reglas.ts: la misma tabla
// que dice cuántos archivos se producen dice cuántos se pueden subir.

/** «3 archivos · Video 9:16 … · Portada 4:5 …»: lo que se entrega por este anuncio. */
function bloqueArchivos(c: Creativo): string {
  const archivos = ARCHIVOS[c.formato as keyof typeof ARCHIVOS] ?? [{ cantidad: 1, etiqueta: 'Pieza', ratio: c.ratio }];
  const total = archivos.reduce((n, a) => n + a.cantidad, 0);
  return `<div class="arte-archivos">
      <span class="kv-k">${total} ${total === 1 ? 'archivo' : 'archivos'} por producir</span>
      <ul>${archivos.map((a) => `<li><strong>${a.cantidad > 1 ? `${a.cantidad} ` : ''}${escapar(a.etiqueta)}</strong> <span>${escapar(a.ratio.replace('x', ':'))} · ${escapar(MEDIDAS[a.ratio as keyof typeof MEDIDAS] ?? c.medidas)}</span></li>`).join('')}</ul>
    </div>`;
}

const ICONO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

/**
 * Botón «Copiar» que apunta por id al texto que copia. Sin JS no hace nada,
 * así que la hoja lo esconde hasta que la base marca `<html class="js">`: el
 * texto sigue siendo seleccionable a mano.
 */
function botonCopiar(destino: string, etiqueta: string): string {
  return `<button class="anuncio-copiar" type="button" data-copiar="${escapar(destino)}" aria-label="${escapar(etiqueta)}">${ICONO_COPIAR}<span data-copiar-texto>Copiar</span></button>`;
}

/** El arte de un anuncio en este render: sus huecos ya ocupados, y cómo pedir y tocar los archivos. */
type ArteAnuncio = { creativo: number; ocupados: HuecoOcupado[]; src: (id: string) => string; api?: string };

const ACEPTA_IMAGEN = 'image/png,image/jpeg';
const ACEPTA_VIDEO = 'video/mp4';

/** «9:16 · 1080 × 1920 px» */
const proporcion = (h: Hueco) => `${h.ratio.replace('x', ':')} · ${MEDIDAS[h.ratio]}`;

/**
 * Un botón de los controles del arte. Todo lo que hace lo lee `SCRIPT_ARTES`
 * de sus `data-*`; sin JS los controles ni se ven (`html.js`).
 */
function boton(texto: string, datos: Record<string, string | number>, peligro = false, etiqueta?: string): string {
  const attrs = Object.entries(datos).map(([k, v]) => ` data-${k}="${escapar(v)}"`).join('');
  return `<button type="button" class="panel-boton${peligro ? ' panel-peligro' : ''}"${attrs}${etiqueta ? ` aria-label="${escapar(etiqueta)}"` : ''}>${escapar(texto)}</button>`;
}

/** Los controles de un hueco de posición fija (pieza, video, portada), según esté vacío u ocupado. */
function controlesHueco(h: Hueco, arte: ArteGrowth | undefined, nombre: string): string {
  const quien = `${h.etiqueta.toLowerCase()} del ${nombre}`;
  const orden = h.orden ?? 0;
  const botones: string[] = [];
  if (h.acepta.includes('video')) {
    botones.push(boton(arte && claseDe(arte) === 'video' ? 'Reemplazar video' : 'Subir video', { 'arte-subir': orden, acepta: ACEPTA_VIDEO }, false, `Subir el video del ${nombre}`));
  }
  if (h.acepta.includes('imagen')) {
    const texto = arte ? 'Reemplazar' : h.clave === 'portada' ? 'Subir portada' : 'Subir arte';
    botones.push(boton(texto, { 'arte-subir': orden, acepta: ACEPTA_IMAGEN }, false, `${arte ? 'Reemplazar' : 'Subir'} ${quien}`));
  }
  if (h.acepta.includes('enlace')) {
    botones.push(boton(arte && claseDe(arte) === 'enlace' ? 'Cambiar enlace' : 'Agregar enlace', { 'arte-enlace': orden, actual: enlaceWeb(arte?.url) ?? '' }, false, `Enlace del video del ${nombre}`));
  }
  if (arte) botones.push(boton('Quitar', { 'arte-quitar': arte.id }, true, `Quitar ${quien}`));
  return botones.join('');
}

/** La imagen de un hueco, en su proporción. */
function figuraImagen(a: ArteGrowth, ratio: string, src: (id: string) => string, alt: string, pie: string, controles: string): string {
  return `<figure class="arte-figura">
      <div class="arte-marco ar-${escapar(ratio)}"><img src="${escapar(src(a.id))}" alt="${escapar(alt)}" loading="lazy" decoding="async"></div>
      <figcaption><span class="arte-pie">${escapar(pie)}</span>${controles ? `<span class="arte-botones">${controles}</span>` : ''}</figcaption>
    </figure>`;
}

/**
 * El video del anuncio: el archivo, con su portada de póster si ya la hay, o
 * el enlace. El enlace se vuelve a pasar por `enlaceWeb` al pintarlo —la
 * API ya lo filtró al guardarlo, pero esta es la última puerta antes del
 * `href` que abre el cliente—; si no pasa, se enseña como hueco.
 */
function figuraVideo(a: ArteGrowth, h: Hueco, portada: ArteGrowth | undefined, x: ArteAnuncio, nombre: string, controles: string): string {
  const pie = `${h.etiqueta} · ${proporcion(h)}`;
  const botones = controles ? `<span class="arte-botones">${controles}</span>` : '';
  if (claseDe(a) === 'video') {
    const poster = portada ? ` poster="${escapar(x.src(portada.id))}"` : '';
    return `<figure class="arte-figura">
      <div class="arte-marco ar-${escapar(h.ratio)}"><video src="${escapar(x.src(a.id))}"${poster} controls playsinline preload="metadata" aria-label="${escapar(`Video del ${nombre}`)}"></video></div>
      <figcaption><span class="arte-pie">${escapar(pie)}</span>${botones}</figcaption>
    </figure>`;
  }
  const href = enlaceWeb(a.url);
  if (!href) return huecoChico(h, controles);
  let sitio = '';
  try { sitio = new URL(href).hostname.replace(/^www\./, ''); } catch { /* ya validado */ }
  const fondo = portada ? `<img src="${escapar(x.src(portada.id))}" alt="" loading="lazy" decoding="async">` : '';
  return `<figure class="arte-figura">
      <a class="arte-marco arte-enlace ar-${escapar(h.ratio)}" href="${escapar(href)}" target="_blank" rel="noopener noreferrer">${fondo}<span class="arte-enlace-t">Ver el video ↗<small>${escapar(sitio)}</small></span></a>
      <figcaption><span class="arte-pie">${escapar(pie)} · enlace</span>${botones}</figcaption>
    </figure>`;
}

/** Un hueco todavía vacío, cuando el anuncio ya tiene otro arte puesto. */
function huecoChico(h: Hueco, controles: string): string {
  return `<figure class="arte-figura">
      <div class="arte-marco arte-vacio ar-${escapar(h.ratio)}"><span class="arte-hueco-k">${escapar(h.etiqueta)} por producir</span><span class="arte-hueco-m">${escapar(proporcion(h))}</span></div>
      ${controles ? `<figcaption><span class="arte-botones">${controles}</span></figcaption>` : ''}
    </figure>`;
}

/** El recuadro grande «Arte por producir», el de siempre: el anuncio todavía no tiene ningún arte. */
function huecoGrande(c: Creativo): string {
  return `<div class="arte-hueco ar-${escapar(c.ratio)}">
      <span class="arte-hueco-k">Arte por producir</span>
      <strong class="arte-hueco-r">${escapar(c.ratio.replace('x', ':'))}</strong>
      <span class="arte-hueco-m">${escapar(c.medidas)}</span>
    </div>`;
}

/** Las tarjetas del carrusel, en orden, y el botón para agregar mientras falten. */
function carrusel(o: HuecoOcupado, x: ArteAnuncio, nombre: string): string {
  const total = TARJETAS_CARRUSEL;
  const tarjetas = o.artes.map((a, k) => {
    const quien = `la tarjeta ${k + 1} del ${nombre}`;
    const controles = x.api
      ? boton('Reemplazar', { 'arte-subir': a.orden, acepta: ACEPTA_IMAGEN }, false, `Reemplazar ${quien}`)
        + boton('Quitar', { 'arte-quitar': a.id }, true, `Quitar ${quien}`)
      : '';
    return `<li>${figuraImagen(a, o.hueco.ratio, x.src, `Tarjeta ${k + 1} de ${total} del ${nombre}`, `Tarjeta ${k + 1} de ${total}`, controles)}</li>`;
  }).join('');
  const faltan = total - o.artes.length;
  const nota = faltan > 0
    ? `<p class="arte-nota">${o.artes.length} de ${total} tarjetas · ${escapar(proporcion(o.hueco))}</p>`
    : '';
  return `<ol class="arte-carrusel" aria-label="${escapar(`Tarjetas del carrusel del ${nombre}`)}">${tarjetas}</ol>${nota}`;
}

/**
 * El arte del anuncio: lo que ya se subió en su proporción, o el recuadro
 * «Arte por producir» si todavía no hay nada, y debajo el desglose de
 * archivos y el brief visual con el que se produce.
 *
 * Los controles (subir, reemplazar, enlazar, quitar) salen solo cuando llega
 * `x.api`, que es solo en la vista interna de quien puede operar al cliente.
 * El portal y el enlace público ven el arte y nada más.
 */
function bloqueArte(c: Creativo, prompt: string | undefined, i: number, id: string, nombre: string, razonPrompt: string, editable: boolean, x?: ArteAnuncio): string {
  const brief = prompt
    ? `<div class="arte-brief">
        <div class="arte-brief-hd"><span class="kv-k">Brief visual</span>${botonCopiar(`${id}-brief`, `Copiar el brief visual del ${nombre}`)}</div>
        <p class="pre" id="${escapar(`${id}-brief`)}" data-copia${rutaEditable(editable, `promptsImagen.porCreativo.${i}`)}>${escapar(prompt)}</p>
      </div>`
    : `<p class="tiny">Sin brief visual: ${escapar(razonPrompt)}</p>`;

  return `<div class="anuncio-arte">
    ${arteVisible(c, nombre, x)}
    ${bloqueArchivos(c)}
    ${brief}
  </div>`;
}

function arteVisible(c: Creativo, nombre: string, x?: ArteAnuncio): string {
  const ocupados = x?.ocupados ?? [];
  const hayArte = ocupados.some((o) => o.artes.length > 0);
  const api = x?.api;

  if (!x || !hayArte) {
    if (!api || !ocupados.length) return huecoGrande(c);
    // Sin arte todavía: el recuadro de siempre y, debajo, cómo empezar.
    const controles = ocupados.map((o) => o.hueco.orden === null
      ? boton(`Subir arte`, { 'arte-subir': '', acepta: ACEPTA_IMAGEN, multiple: TARJETAS_CARRUSEL }, false, `Subir las tarjetas del carrusel del ${nombre}`)
      : controlesHueco(o.hueco, undefined, nombre)).join('');
    return gestion(x, `${huecoGrande(c)}<div class="arte-botones arte-botones-inicio">${controles}</div>`);
  }

  const portada = ocupados.find((o) => o.hueco.clave === 'portada')?.artes[0];
  const partes = ocupados.map((o) => {
    if (o.hueco.orden === null) {
      const agregar = api && o.artes.length < TARJETAS_CARRUSEL
        ? `<div class="arte-botones">${boton('Agregar tarjeta', { 'arte-subir': '', acepta: ACEPTA_IMAGEN, multiple: TARJETAS_CARRUSEL - o.artes.length }, false, `Agregar tarjetas al carrusel del ${nombre}`)}</div>`
        : '';
      return carrusel(o, x, nombre) + agregar;
    }
    const arte = o.artes[0];
    const controles = api ? controlesHueco(o.hueco, arte, nombre) : '';
    if (!arte) return api ? huecoChico(o.hueco, controles) : '';
    if (o.hueco.clave === 'video') return figuraVideo(arte, o.hueco, portada, x, nombre, controles);
    const pie = `${o.hueco.etiqueta} · ${proporcion(o.hueco)}`;
    const alt = o.hueco.clave === 'portada' ? `Portada del video del ${nombre}` : `Arte del ${nombre}`;
    return figuraImagen(arte, o.hueco.ratio, x.src, alt, pie, controles);
  }).join('');

  return gestion(x, `<div class="arte-subido">${partes}</div>`);
}

/**
 * El contenedor de los controles: de él lee `SCRIPT_ARTES` a dónde hablar y de
 * qué anuncio, y en él escribe «Subiendo…» y los errores. Sin `api` (portal,
 * enlace público) no hay contenedor: el arte va tal cual.
 */
function gestion(x: ArteAnuncio | undefined, html: string): string {
  if (!x?.api) return html;
  return `<div class="arte-gestion" data-arte-api="${escapar(x.api)}" data-creativo="${escapar(String(x.creativo))}">${html}<p class="arte-estado" role="status" aria-live="polite"></p></div>`;
}

/**
 * Copy A y Copy B en pestañas. El comportamiento (clic, flechas, Home/End,
 * `hidden` en el panel que no toca) lo pone `SCRIPT_EDITORIAL` sobre cualquier
 * `[role="tablist"]`, y `.pestanas` ya se esconde sin JS: entonces los dos
 * paneles se leen uno tras otro, cada uno con su título.
 *
 * En modo edición el copy del panel oculto también es editable: `SCRIPT_FLUJO`
 * enciende `contenteditable` en todos los `[data-editable]` al entrar, estén
 * a la vista o no, así que al cambiar de pestaña el Copy B ya está listo para
 * escribir, y un cambio hecho en un panel sigue contando (y guardándose)
 * aunque se vuelva al otro.
 */
function bloqueCopys(c: Creativo, i: number, id: string, nombre: string, editable: boolean): string {
  const opciones: ['A' | 'B', string][] = [['A', c.copyA], ['B', c.copyB]];
  const tabs = opciones.map(([o], i) =>
    `<button type="button" role="tab" id="${escapar(`${id}-tab-${o}`)}" aria-controls="${escapar(`${id}-copy-${o}`)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">Copy ${o}</button>`,
  ).join('');
  const paneles = opciones.map(([o, texto]) =>
    `<div class="anuncio-panel" role="tabpanel" id="${escapar(`${id}-copy-${o}`)}" aria-labelledby="${escapar(`${id}-tab-${o}`)}">
      <div class="anuncio-panel-hd">
        <span class="anuncio-panel-titulo">Copy ${o}</span>
        ${botonCopiar(`${id}-texto-${o}`, `Copiar el copy ${o} del ${nombre}`)}
      </div>
      <p class="copy" id="${escapar(`${id}-texto-${o}`)}" data-copia${rutaEditable(editable, `creativos.${i}.copy${o}`)}>${escapar(texto)}</p>
    </div>`,
  ).join('');

  return `<div class="pestanas anuncio-pestanas" role="tablist" aria-label="${escapar(`Opciones de copy del ${nombre}`)}">${tabs}</div>
    ${paneles}`;
}

function tarjetaAnuncio(
  c: Creativo, i: number, n: number, prompt: string | undefined, razonPrompt: string, editable: boolean, anclas: boolean,
  arte?: ArteAnuncio,
): string {
  const letra = c.grupo.toUpperCase();
  const id = `anuncio-${c.grupo}-${n}`;
  const nombre = `anuncio ${n} de la campaña ${letra}`;
  const formato = FORMATO_TEXTO[c.formato] ?? c.formato;

  // El ancla `creativos.N` es la que llevaba cada pieza en la antigua sección
  // de creativos: así un comentario ya dejado sobre un anuncio sigue
  // encontrando su sitio.
  return `<article class="anuncio" id="${escapar(id)}"${rutaAncla(anclas, `creativos.${i}`)}>
    ${bloqueArte(c, prompt, i, id, nombre, razonPrompt, editable, arte)}
    <div class="anuncio-info">
      <div class="anuncio-hd">
        <div>
          <span class="eyebrow">Campaña ${escapar(letra)} · Anuncio ${n}</span>
          <h3>${escapar(formato)}</h3>
        </div>
        <span class="badge b-pink anuncio-formato">${escapar(formato)} · ${escapar(c.ratio.replace('x', ':'))}</span>
      </div>
      <p class="anuncio-proposito"><span class="kv-k">Ángulo</span><span${rutaEditable(editable, `creativos.${i}.angulo`)}>${escapar(c.angulo)}</span></p>
      ${bloqueCopys(c, i, id, nombre, editable)}
    </div>
  </article>`;
}

function cabeceraCampana(grupo: string, campana: CampanaMeta | undefined, total: number, razon: string): string {
  const letra = grupo.toUpperCase();
  const datos = campana
    ? [`Objetivo: ${campana.objetivo}`, `Audiencia: ${campana.audiencia}`, `${total} ${total === 1 ? 'anuncio' : 'anuncios'}`]
    : [`${total} ${total === 1 ? 'anuncio' : 'anuncios'}`];
  return `<header class="campana-hd">
    <span class="skicker">Campaña ${escapar(letra)}</span>
    <h3>${escapar(campana?.nombre ?? `Grupo ${letra}`)}</h3>
    ${campana ? '' : `<p class="tiny">Sin objetivo ni audiencia: ${escapar(razon)}</p>`}
    <ul class="campana-datos">${datos.map((d) => `<li>${escapar(d)}</li>`).join('')}</ul>
  </header>`;
}

/**
 * Sección destacada del manual: los anuncios agrupados por campaña de Meta.
 *
 * Agrupa por `grupo`, que es la llave que comparten `campanasMeta` y
 * `creativos`. El prompt de cada anuncio sale de `promptsImagen.porCreativo`
 * por el índice ORIGINAL del creativo, que es como se generan (mismo orden).
 * Si falta un trozo, se declara en su sitio en vez de rellenarlo.
 */
export function seccionAnuncios(
  g: Partial<Growth>,
  huecos: Record<string, string>,
  editable = false,
  anclas = false,
  artes?: ArtesManual,
): string {
  const cabecera = cabeceraSeccion({
    numero: 'A', kicker: 'Lo que se publica', titulo: 'Los anuncios, campaña por campaña',
    lead: 'Cada campaña de Meta con sus anuncios: formato y medidas, el ángulo que defiende, el brief de su arte y dos copys para probar uno contra otro.',
  });

  const creativos = g.creativos ?? [];
  const razonCreativos = huecos.creativos ?? 'Los textos de anuncio no se generaron.';
  if (!creativos.length) {
    return `${cabecera}<div style="margin-top:var(--e2);">${hueco(razonCreativos)}</div>`;
  }

  const razonCampanas = huecos.estructura ?? 'La estructura de campañas no se generó.';
  const razonPrompts = huecos.prompts ?? 'Los prompts no se generaron.';
  const prompts = g.promptsImagen?.porCreativo ?? [];
  const campanaPorGrupo = new Map((g.campanasMeta ?? []).map((c) => [c.grupo as string, c]));
  // El arte subido, repartido en los huecos de los anuncios de ESTA versión
  // del manual: lo que ya no tiene hueco (un anuncio que se fue al restaurar
  // una versión) no sale.
  const acomodo = artes ? acomodarArtes(creativos, artes.lista) : null;
  const arteDe = (i: number): ArteAnuncio | undefined => artes && acomodo
    ? { creativo: i, ocupados: acomodo.get(i) ?? [], src: artes.src, api: artes.api }
    : undefined;

  const campanas = GRUPOS.map((grupo) => {
    const suyos = creativos
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.grupo === grupo);
    const campana = campanaPorGrupo.get(grupo);
    if (!suyos.length && !campana) return '';
    const tarjetas = suyos.length
      ? suyos.map(({ c, i }, n) => tarjetaAnuncio(c, i, n + 1, prompts[i], razonPrompts, editable, anclas, arteDe(i))).join('')
      : `<p class="tiny">Sin anuncios para esta campaña: ${escapar(razonCreativos)}</p>`;
    return `<section class="campana campana-${escapar(grupo)}" aria-label="${escapar(`Campaña ${grupo.toUpperCase()}`)}">
      ${cabeceraCampana(grupo, campana, suyos.length, razonCampanas)}
      <div class="anuncios-lista">${tarjetas}</div>
    </section>`;
  }).join('');

  return `${cabecera}
  ${g.campanasMeta?.length ? '' : `<div style="margin-top:var(--e2);">${hueco(razonCampanas)}</div>`}
  ${bloquePromptBase(g, editable)}
  <div class="campanas">${campanas}</div>`;
}

/**
 * El prompt base y la regla de la cara, que vivían en la antigua sección de
 * prompts. El brief de cada anuncio está escrito para ir DETRÁS de este
 * prompt: sin él, lo que se copia de cada tarjeta es un brief a medias. Por
 * eso se quedan aquí, antes de las campañas, y no se perdieron con la sección.
 */
function bloquePromptBase(g: Partial<Growth>, editable: boolean): string {
  const base = g.promptsImagen?.base;
  if (base === undefined) return '';
  return `<div class="alert alert-red" style="margin-top:var(--e2);">
      <strong>Regla que no se rompe: la cara del cliente no se genera con IA.</strong>
      Es una persona real y su credibilidad es el activo central de la campaña. Los briefs visuales producen fondos, texturas y escenas sin rostros identificables. La foto real se fotografía aparte y se compone encima.
    </div>
    <div class="arte-brief prompt-base">
      <div class="arte-brief-hd"><span class="kv-k">Prompt base · anteponer a todos los briefs</span>${botonCopiar('prompt-base', 'Copiar el prompt base')}</div>
      <p class="pre" id="prompt-base" data-copia${rutaEditable(editable, 'promptsImagen.base')}>${escapar(base)}</p>
    </div>`;
}
