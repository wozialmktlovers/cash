// 03 · Contenido de feed y 04 · Historias: las tarjetas de pieza del entregable
// (diseño §7). Arte a la izquierda —visor de carrusel, reproductor o enlace para
// el reel— y a la derecha los datos, el copy con «Copiar», el llamado a la
// acción y los hashtags.
//
// Las dos secciones comparten el mismo bloque de arte y el mismo bloque de
// texto: una historia es una pieza como las demás, solo que vertical y en una
// tira que se pasa de lado en vez de en una lista.

import { escapar, encabezadoSeccion } from '@/render/editorial/comunes';
import {
  ESTADO, FORMATO, PLATAFORMA, ICONO_COPIAR, ICONO_ENLACE, ICONO_SIN_ARTE, REVISION_SOLO_LECTURA,
  chipEstado, diaLargo, esDeFeed, imagenesDe, portadaDe, porFecha, rutaArte, videoDe,
  type EstadoRevision, type Formato, type PiezaEntregable, type Revision,
} from './datos';

const ICONO_APROBAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12.5 5 5L20 6.5"/></svg>';
const ICONO_CAMBIOS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h8"/><path d="M15.5 4.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/></svg>';

/**
 * Los controles de revisión de UNA pieza (diseño §6): «Aprobar» y «Solicitar
 * cambios» con su nota.
 *
 * Solo se pintan con `revision.controles`, es decir, solo en el portal del
 * cliente identificado; el enlace público rinde la misma tarjeta sin ellos (ver
 * el tipo `Revision`, ./datos.ts). Quien decide de verdad es el servidor:
 * `POST /api/contenido/piezas/[id]/revision` vuelve a comprobar el rol, el
 * dueño de la pieza y el plazo, así que esconder el bloque es cortesía de la
 * pantalla, nunca el candado.
 *
 * El bloque entero depende de JS —se manda la decisión por `fetch`—, así que
 * sin JS se esconde y en su lugar queda una línea que lo dice, con la misma
 * regla de `html.js` que ya usan los filtros de la sección 03. Un botón que no
 * hace nada sería peor que no tenerlo: el plazo corre igual.
 *
 * `data-nota` empieza con la nota anterior dentro: si el cliente vuelve a pedir
 * cambios sobre algo que ya devolvió, ve lo que escribió la vez pasada en vez
 * de una caja en blanco.
 */
function controlesRevision(p: PiezaEntregable, revision: Revision): string {
  if (!revision.controles) return '';

  const idNota = `nota-pieza-${p.numero}`;
  const nombre = `${FORMATO[p.formato].texto.toLowerCase()} ${p.numero}`;

  return `<div class="revision" data-revision data-pieza="${escapar(p.id)}">
    <p class="revision-sin-js">Para aprobar esta pieza o pedirnos cambios hace falta tener JavaScript activado. Si no puedes, escríbele a tu equipo y lo registramos nosotros.</p>
    <div class="revision-botones">
      <button class="btn-revision aprobar" type="button" data-decision="aprobar" aria-label="${escapar(`Aprobar el ${nombre}`)}">${ICONO_APROBAR}Aprobar</button>
      <button class="btn-revision cambios" type="button" data-abrir-nota aria-expanded="false" aria-controls="${escapar(idNota)}" aria-label="${escapar(`Solicitar cambios en el ${nombre}`)}">${ICONO_CAMBIOS}Solicitar cambios</button>
    </div>
    <div class="revision-nota" id="${escapar(idNota)}" hidden>
      <label for="${escapar(`${idNota}-texto`)}">¿Qué cambiamos?</label>
      <textarea id="${escapar(`${idNota}-texto`)}" data-nota rows="3" maxlength="2000" placeholder="Por ejemplo: cambien la foto por una del consultorio nuevo.">${escapar(p.notaCliente ?? '')}</textarea>
      <div class="revision-botones">
        <button class="btn-revision cambios" type="button" data-decision="cambios">Enviar</button>
        <button class="btn-revision suave" type="button" data-cancelar-nota>Cancelar</button>
      </div>
    </div>
    <p class="revision-aviso" role="status" data-revision-aviso></p>
  </div>`;
}

/** Hueco con forma de arte para la pieza que todavía no lo tiene. */
function artePendiente(): string {
  return `<div class="arte-pendiente">${ICONO_SIN_ARTE}<span>El arte de esta pieza todavía no está subido.</span></div>`;
}

/**
 * El arte de una pieza.
 *
 * - **Carrusel:** visor con la imagen grande y una miniatura por slide. Sin JS
 *   el visor muestra la portada y las miniaturas siguen siendo enlaces visibles
 *   al mismo archivo, así que no se pierde ninguna imagen.
 * - **Reel:** reproductor si el video está subido al Studio; enlace si vive
 *   fuera (diseño §4: «portada más enlace o archivo de video»).
 * - **Post e historia:** una sola imagen, o el video si la historia lo es.
 *
 * `vertical` cambia la proporción del visor: 9:16 para reel e historia, 1:1
 * para post y carrusel.
 */
function bloqueArte(p: PiezaEntregable, base: string): string {
  const vertical = p.formato === 'reel' || p.formato === 'historia';
  const forma = vertical ? 'vertical' : 'cuadrado';
  const video = videoDe(p);
  const imagenes = imagenesDe(p);
  const portada = rutaArte(portadaDe(p), base);
  const partes: string[] = [];

  const videoSrc = video && video.fileId ? rutaArte(video, base) : null;
  if (videoSrc) {
    // `preload="metadata"`: un mes con doce videos no debe descargarse entero
    // por abrir la página. El poster es la portada, si la hay.
    partes.push(`<div class="pieza-visor ${forma}"><video controls preload="metadata"${portada ? ` poster="${escapar(portada)}"` : ''} src="${escapar(videoSrc)}"></video></div>`);
  } else if (portada) {
    partes.push(`<div class="pieza-visor ${forma}"><img data-visor-principal src="${escapar(portada)}" alt="${escapar(`Arte de la pieza ${p.numero}`)}" loading="lazy" decoding="async"></div>`);
  } else {
    partes.push(artePendiente());
  }

  if (!videoSrc && imagenes.length > 1) {
    const miniaturas = imagenes.map((a, i) => {
      const src = rutaArte(a, base);
      if (!src) return '';
      return `<button class="pieza-miniatura" type="button" data-slide="${escapar(src)}" aria-current="${i === 0 ? 'true' : 'false'}" aria-label="${escapar(`Ver la imagen ${i + 1} de ${imagenes.length}`)}">
        <img src="${escapar(src)}" alt="" loading="lazy" decoding="async">
      </button>`;
    }).join('');
    partes.push(`<div class="pieza-miniaturas" data-visor>${miniaturas}</div>`);
  }

  if (video && video.url) {
    partes.push(`<a class="pieza-enlace" href="${escapar(video.url)}" target="_blank" rel="noopener noreferrer">${ICONO_ENLACE}Ver el ${escapar(FORMATO[p.formato].texto.toLowerCase())}</a>`);
  }

  return `<div class="pieza-arte">${partes.join('')}</div>`;
}

/** Bloque de texto copiable: cabecera con «Copiar» y el texto tal cual se publica. */
function bloqueTexto(titulo: string, texto: string, clase: string, etiquetaBoton: string): string {
  return `<div class="bloque-texto">
    <div class="bloque-cabeza">
      <h4>${escapar(titulo)}</h4>
      <button class="btn-copiar" type="button" data-copiar aria-label="${escapar(etiquetaBoton)}">${ICONO_COPIAR}<span data-copiar-texto>Copiar</span></button>
    </div>
    <p class="${clase}" data-copia>${escapar(texto)}</p>
  </div>`;
}

/** Los datos de la pieza: cabecera, meta, copy, CTA, hashtags y la nota del cliente. */
function bloqueDatos(p: PiezaEntregable, revision: Revision): string {
  const fecha = p.fechaPublicacion ? diaLargo(p.fechaPublicacion) : 'Sin fecha todavía';
  const copy = p.copy.trim()
    ? bloqueTexto('Copy', p.copy, 'copy-texto', `Copiar el copy de la pieza ${p.numero}`)
    : '<div class="bloque-texto"><h4>Copy</h4><p class="suave">El copy de esta pieza todavía se está escribiendo.</p></div>';
  const hashtags = p.hashtags.trim()
    ? bloqueTexto('Hashtags', p.hashtags, 'hashtags-texto', `Copiar los hashtags de la pieza ${p.numero}`)
    : '';
  const cta = p.cta.trim()
    ? `<div class="pieza-dato"><span>Llamado a la acción</span><strong>${escapar(p.cta)}</strong></div>`
    : '';
  const nota = p.notaCliente && p.notaCliente.trim()
    ? `<div class="nota-cliente"><span>Cambios que pediste</span><p>${escapar(p.notaCliente)}</p></div>`
    : '';

  return `<div class="pieza-datos">
    <div class="pieza-cabeza">
      <div class="pila">
        <p class="eyebrow">Contenido ${String(p.numero).padStart(2, '0')}</p>
        <h3>${escapar(FORMATO[p.formato].texto)}</h3>
      </div>
      ${chipEstado(p.estadoCliente)}
    </div>
    <div class="pieza-meta">
      <div class="pieza-dato"><span>Publicación</span><strong>${escapar(fecha)}</strong></div>
      <div class="pieza-dato"><span>Formato</span><strong>${escapar(FORMATO[p.formato].texto)}</strong></div>
      <div class="pieza-dato"><span>Plataforma</span><strong>${escapar(PLATAFORMA[p.plataforma])}</strong></div>
      ${cta}
    </div>
    ${copy}
    ${hashtags}
    ${nota}
    ${controlesRevision(p, revision)}
  </div>`;
}

/**
 * Una tarjeta grande de feed. `data-formato` y `data-estado` son lo que leen
 * los filtros de la sección; el `id` es a donde llevan el calendario y la
 * cuadrícula del feed.
 */
function tarjetaFeed(p: PiezaEntregable, base: string, revision: Revision): string {
  return `<article class="pieza-tarjeta aparece" id="pieza-${p.numero}" data-pieza data-formato="${escapar(p.formato)}" data-estado="${escapar(p.estadoCliente)}">
    ${bloqueArte(p, base)}
    ${bloqueDatos(p, revision)}
  </article>`;
}

const FILTROS_ESTADO: EstadoRevision[] = ['pendiente', 'aprobada', 'cambios'];

/** Botonera de filtros por formato y por estado. Sin JS no se muestra. */
function filtros(formatos: Formato[], total: number): string {
  const boton = (grupo: string, valor: string, texto: string, icono = '', activo = false) =>
    `<button class="filtro-btn" type="button" data-filtro="${escapar(grupo)}" data-valor="${escapar(valor)}" aria-pressed="${activo ? 'true' : 'false'}">${icono}${escapar(texto)}</button>`;

  return `<div class="filtros-contenido">
    <div class="filtros-grupo">
      <span>Formato</span>
      ${boton('formato', '', 'Todos', '', true)}
      ${formatos.map((f) => boton('formato', f, FORMATO[f].plural, FORMATO[f].icono)).join('')}
    </div>
    <div class="filtros-grupo">
      <span>Estado</span>
      ${boton('estado', '', 'Todos', '', true)}
      ${FILTROS_ESTADO.map((e) => boton('estado', e, ESTADO[e])).join('')}
    </div>
    <output data-contador aria-live="polite">Mostrando ${total} de ${total}</output>
  </div>`;
}

/**
 * 03 · Contenido de feed: posts, carruseles y reels del mes, en orden de
 * publicación (diseño §7). Las historias tienen su propia sección.
 */
export function seccionFeed(piezas: PiezaEntregable[], base: string, revision: Revision = REVISION_SOLO_LECTURA): string {
  const feed = piezas.filter(esDeFeed).sort(porFecha);
  if (!feed.length) {
    return `<section class="seccion" id="feed" data-seccion>
      ${encabezadoSeccion('03', 'Contenido de feed', 'Posts, carruseles y reels del mes.')}
      <p class="vacio-seccion">Este mes todavía no tiene piezas de feed.</p>
    </section>`;
  }

  // Solo los formatos que este mes trae: un filtro que no puede devolver nada
  // es un botón que engaña.
  const formatos = (['post', 'carrusel', 'reel'] as Formato[]).filter((f) => feed.some((p) => p.formato === f));

  return `<section class="seccion" id="feed" data-seccion data-lista-piezas>
    ${encabezadoSeccion('03', 'Contenido de feed', 'El arte, el copy y los datos de cada publicación del mes.')}
    ${filtros(formatos, feed.length)}
    <div class="piezas-lista">${feed.map((p) => tarjetaFeed(p, base, revision)).join('')}</div>
  </section>`;
}

/** Una historia: tarjeta vertical 9:16 dentro de la tira. */
function tarjetaHistoria(p: PiezaEntregable, base: string, revision: Revision): string {
  const fecha = p.fechaPublicacion ? diaLargo(p.fechaPublicacion) : 'Sin fecha';
  const copy = p.copy.trim()
    ? `<p class="historia-copy">${escapar(p.copy)}</p>
       <button class="btn-copiar" type="button" data-copiar aria-label="${escapar(`Copiar el copy de la historia ${p.numero}`)}">${ICONO_COPIAR}<span data-copiar-texto>Copiar</span></button>
       <p class="copy-texto" data-copia hidden>${escapar(p.copy)}</p>`
    : '<p class="suave">Sin copy.</p>';
  const nota = p.notaCliente && p.notaCliente.trim()
    ? `<div class="nota-cliente"><span>Cambios que pediste</span><p>${escapar(p.notaCliente)}</p></div>`
    : '';

  return `<li class="historia-tarjeta" id="pieza-${p.numero}" data-pieza data-formato="historia" data-estado="${escapar(p.estadoCliente)}">
    ${bloqueArte(p, base)}
    <div class="historia-cabeza">
      <strong>Contenido ${String(p.numero).padStart(2, '0')}</strong>
      <span class="historia-fecha">${escapar(fecha)}</span>
    </div>
    ${chipEstado(p.estadoCliente)}
    ${copy}
    ${nota}
    ${controlesRevision(p, revision)}
  </li>`;
}

/**
 * 04 · Historias: tira horizontal de tarjetas verticales (diseño §7).
 *
 * El copy va recortado por alto (`.historia-copy`) y el texto completo viaja en
 * un párrafo oculto solo para el botón «Copiar»: una historia se revisa por el
 * arte, y un copy largo estiraría todas las tarjetas de la tira.
 */
export function seccionHistorias(piezas: PiezaEntregable[], base: string, revision: Revision = REVISION_SOLO_LECTURA): string {
  const historias = piezas.filter((p) => p.formato === 'historia').sort(porFecha);
  if (!historias.length) {
    return `<section class="seccion alterna" id="historias" data-seccion>
      ${encabezadoSeccion('04', 'Historias', 'Las adaptaciones verticales del mes.')}
      <p class="vacio-seccion">Este mes no lleva historias.</p>
    </section>`;
  }

  return `<section class="seccion alterna" id="historias" data-seccion>
    ${encabezadoSeccion('04', 'Historias', 'Las adaptaciones verticales del mes. Deslízalas de lado.')}
    <ul class="historias-tira">${historias.map((p) => tarjetaHistoria(p, base, revision)).join('')}</ul>
  </section>`;
}
