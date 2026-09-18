import { escapar, cabeceraSeccion, hueco } from './comunes';
import { rutaEditable, rutaAncla } from '@/render/editorial/flujo-cliente';
import { GRUPOS, type Growth, type Creativo, type CampanaMeta } from '@/growth/schemas';

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

const MEDIDAS: Record<string, string> = {
  '1x1': '1080 × 1080 px', '4x5': '1080 × 1350 px', '9x16': '1080 × 1920 px',
};

/**
 * Archivos que hay que producir por cada anuncio, según su formato. Es la
 * tabla `ARCHIVOS` de la antigua sección de creativos (quitada en 2d4cc85),
 * con los mismos datos: se perdió con aquella sección y es justo lo que
 * necesita quien produce el arte.
 *
 * Un carrusel no es una imagen: son cinco tarjetas. Un video necesita además
 * su fotograma de portada, que es lo que se ve en el feed antes de
 * reproducir. Sin este desglose, «un anuncio» deja al diseñador calculando
 * cuántos archivos son en realidad.
 */
const ARCHIVOS: Record<string, { cantidad: number; etiqueta: string; ratio: string }[]> = {
  imagen: [{ cantidad: 1, etiqueta: 'Pieza', ratio: '1x1' }],
  // 4:5, igual que dicta el agente de creativos: la tabla vieja decía 1:1 y
  // el anuncio mostraba las dos medidas a la vez.
  carrusel: [{ cantidad: 5, etiqueta: 'Tarjetas', ratio: '4x5' }],
  video: [
    { cantidad: 1, etiqueta: 'Video', ratio: '9x16' },
    { cantidad: 1, etiqueta: 'Portada', ratio: '4x5' },
  ],
};

/** «3 archivos · Video 9:16 … · Portada 4:5 …»: lo que se entrega por este anuncio. */
function bloqueArchivos(c: Creativo): string {
  const archivos = ARCHIVOS[c.formato] ?? [{ cantidad: 1, etiqueta: 'Pieza', ratio: c.ratio }];
  const total = archivos.reduce((n, a) => n + a.cantidad, 0);
  return `<div class="arte-archivos">
      <span class="kv-k">${total} ${total === 1 ? 'archivo' : 'archivos'} por producir</span>
      <ul>${archivos.map((a) => `<li><strong>${a.cantidad > 1 ? `${a.cantidad} ` : ''}${escapar(a.etiqueta)}</strong> <span>${escapar(a.ratio.replace('x', ':'))} · ${escapar(MEDIDAS[a.ratio] ?? c.medidas)}</span></li>`).join('')}</ul>
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

/**
 * El arte todavía no existe en este entregable. En vez de un recuadro vacío,
 * el hueco dice qué falta (la pieza, con su proporción y sus medidas) y trae
 * debajo el brief visual con el que se produce.
 */
function bloqueArte(c: Creativo, prompt: string | undefined, i: number, id: string, nombre: string, razonPrompt: string, editable: boolean): string {
  const ratio = c.ratio.replace('x', ':');
  const brief = prompt
    ? `<div class="arte-brief">
        <div class="arte-brief-hd"><span class="kv-k">Brief visual</span>${botonCopiar(`${id}-brief`, `Copiar el brief visual del ${nombre}`)}</div>
        <p class="pre" id="${escapar(`${id}-brief`)}" data-copia${rutaEditable(editable, `promptsImagen.porCreativo.${i}`)}>${escapar(prompt)}</p>
      </div>`
    : `<p class="tiny">Sin brief visual: ${escapar(razonPrompt)}</p>`;

  return `<div class="anuncio-arte">
    <div class="arte-hueco ar-${escapar(c.ratio)}">
      <span class="arte-hueco-k">Arte por producir</span>
      <strong class="arte-hueco-r">${escapar(ratio)}</strong>
      <span class="arte-hueco-m">${escapar(c.medidas)}</span>
    </div>
    ${bloqueArchivos(c)}
    ${brief}
  </div>`;
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
): string {
  const letra = c.grupo.toUpperCase();
  const id = `anuncio-${c.grupo}-${n}`;
  const nombre = `anuncio ${n} de la campaña ${letra}`;
  const formato = FORMATO_TEXTO[c.formato] ?? c.formato;

  // El ancla `creativos.N` es la que llevaba cada pieza en la antigua sección
  // de creativos: así un comentario ya dejado sobre un anuncio sigue
  // encontrando su sitio.
  return `<article class="anuncio" id="${escapar(id)}"${rutaAncla(anclas, `creativos.${i}`)}>
    ${bloqueArte(c, prompt, i, id, nombre, razonPrompt, editable)}
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

  const campanas = GRUPOS.map((grupo) => {
    const suyos = creativos
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.grupo === grupo);
    const campana = campanaPorGrupo.get(grupo);
    if (!suyos.length && !campana) return '';
    const tarjetas = suyos.length
      ? suyos.map(({ c, i }, n) => tarjetaAnuncio(c, i, n + 1, prompts[i], razonPrompts, editable, anclas)).join('')
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
