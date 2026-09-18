import { escapar, cabeceraSeccion, hueco } from './comunes';
import { GRUPOS, type Growth, type Creativo, type CampanaMeta } from '@/growth/schemas';

// La vista que el cliente entiende sin traducción: campaña → anuncios, cada
// anuncio con su arte a un lado y sus dos copys al otro. Es la anatomía del
// entregable que el Studio hacía a mano (el de Natú): encabezado por campaña
// con sus datos, tarjeta por anuncio con distintivo de formato, propósito,
// arte y pestañas Copy A / Copy B.
//
// No es un dato nuevo: sale de `campanasMeta`, `creativos` y
// `promptsImagen.porCreativo`, lo mismo que ya rinden las secciones 01, 02 y
// 03. Por eso es de solo lectura: el modo edición sigue en la sección 02, y
// dos `data-editable` apuntando a la misma ruta del JSON se pisarían.
//
// Lo que el machote de Natú trae y aquí no está, porque el sistema no lo
// genera y un hueco relleno de plausibilidad es una mentira: el CTA de cada
// anuncio, el enlace al video, las fechas y el presupuesto por campaña.

const FORMATO_TEXTO: Record<string, string> = {
  imagen: 'Imagen', video: 'Video', carrusel: 'Carrusel',
};

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
function bloqueArte(c: Creativo, prompt: string | undefined, id: string, nombre: string, razonPrompt: string): string {
  const ratio = c.ratio.replace('x', ':');
  const brief = prompt
    ? `<div class="arte-brief">
        <div class="arte-brief-hd"><span class="kv-k">Brief visual</span>${botonCopiar(`${id}-brief`, `Copiar el brief visual del ${nombre}`)}</div>
        <p class="pre" id="${escapar(`${id}-brief`)}" data-copia>${escapar(prompt)}</p>
      </div>`
    : `<p class="tiny">Sin brief visual: ${escapar(razonPrompt)}</p>`;

  return `<div class="anuncio-arte">
    <div class="arte-hueco ar-${escapar(c.ratio)}">
      <span class="arte-hueco-k">Arte por producir</span>
      <strong class="arte-hueco-r">${escapar(ratio)}</strong>
      <span class="arte-hueco-m">${escapar(c.medidas)}</span>
    </div>
    ${brief}
  </div>`;
}

/**
 * Copy A y Copy B en pestañas. El comportamiento (clic, flechas, Home/End,
 * `hidden` en el panel que no toca) lo pone `SCRIPT_EDITORIAL` sobre cualquier
 * `[role="tablist"]`, y `.pestanas` ya se esconde sin JS: entonces los dos
 * paneles se leen uno tras otro, cada uno con su título.
 */
function bloqueCopys(c: Creativo, id: string, nombre: string): string {
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
      <p class="copy" id="${escapar(`${id}-texto-${o}`)}" data-copia>${escapar(texto)}</p>
    </div>`,
  ).join('');

  return `<div class="pestanas anuncio-pestanas" role="tablist" aria-label="${escapar(`Opciones de copy del ${nombre}`)}">${tabs}</div>
    ${paneles}`;
}

function tarjetaAnuncio(c: Creativo, n: number, prompt: string | undefined, razonPrompt: string): string {
  const letra = c.grupo.toUpperCase();
  const id = `anuncio-${c.grupo}-${n}`;
  const nombre = `anuncio ${n} de la campaña ${letra}`;
  const formato = FORMATO_TEXTO[c.formato] ?? c.formato;

  return `<article class="anuncio" id="${escapar(id)}">
    ${bloqueArte(c, prompt, id, nombre, razonPrompt)}
    <div class="anuncio-info">
      <div class="anuncio-hd">
        <div>
          <span class="eyebrow">Campaña ${escapar(letra)} · Anuncio ${n}</span>
          <h3>${escapar(formato)}</h3>
        </div>
        <span class="badge b-pink anuncio-formato">${escapar(formato)} · ${escapar(c.ratio.replace('x', ':'))}</span>
      </div>
      <p class="anuncio-proposito"><span class="kv-k">Ángulo</span><span>${escapar(c.angulo)}</span></p>
      ${bloqueCopys(c, id, nombre)}
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
export function seccionAnuncios(g: Partial<Growth>, huecos: Record<string, string>): string {
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
      ? suyos.map(({ c, i }, n) => tarjetaAnuncio(c, n + 1, prompts[i], razonPrompts)).join('')
      : `<p class="tiny">Sin anuncios para esta campaña: ${escapar(razonCreativos)}</p>`;
    return `<section class="campana campana-${escapar(grupo)}" aria-label="${escapar(`Campaña ${grupo.toUpperCase()}`)}">
      ${cabeceraCampana(grupo, campana, suyos.length, razonCampanas)}
      <div class="anuncios-lista">${tarjetas}</div>
    </section>`;
  }).join('');

  return `${cabecera}
  ${g.campanasMeta?.length ? '' : `<div style="margin-top:var(--e2);">${hueco(razonCampanas)}</div>`}
  <div class="campanas">${campanas}</div>`;
}
