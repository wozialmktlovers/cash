import type { Growth } from '@/growth/schemas';
import { construirUrls, type UrlEtiquetada } from '@/growth/utm';
import type { OpcionesBarra } from '@/render/barra-operador';
import { ESTILOS_GROWTH } from './estilos';
import { NAVEGACION_GROWTH } from './navegacion';
import { envolverDocumento } from '@/render/editorial/comunes';
import type { FlujoDatos } from '@/render/editorial/flujo-cliente';
import { seccion } from './secciones/comunes';
import { seccionPortada, type MetaManual } from './secciones/portada';
import { seccionAnuncios } from './secciones/anuncios';
import { seccionMeta } from './secciones/meta';
import { seccionGoogle } from './secciones/google';
import { seccionRsa } from './secciones/rsa';
import { seccionTraza } from './secciones/traza';
import { seccionTecnico } from './secciones/tecnico';
import { seccionSeguimiento } from './secciones/seguimiento';

export type { MetaManual };

// Controles de videollamada. No son de la base editorial —la investigación y
// el mapa de pilares no los tienen— pero este documento se presenta
// compartiendo pantalla y sin subir el tipo las tablas técnicas llegan al
// otro lado ilegibles. Van en la cápsula por `accionesExtra`.
const ICONO_PANTALLA = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1 5V1h4M13 5V1H9M1 9v4h4M13 9v4H9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const ACCIONES_VIDEOLLAMADA = `<button type="button" class="cabecera-escala" id="escala" aria-label="Tamaño del texto">1x</button>
    <button type="button" class="cabecera-pantalla" id="pantalla" aria-label="Pantalla completa" title="Pantalla completa (F)">${ICONO_PANTALLA}</button>`;

/**
 * Índice lateral: mismo numeral que la placa de cada sección, para que la
 * columna y el documento digan lo mismo. El «00» es la portada, que no lleva
 * placa. Si se quita o se agrega una sección, se renumeran aquí Y en su
 * `cabeceraSeccion`: las dos listas tienen que decir lo mismo.
 *
 * Las secciones de creativos (02) y de prompts (03) salieron del manual: sus
 * copys, ángulos y briefs se leen y se editan en la de anuncios, y el prompt
 * base con la regla de la cara van en su cabecera. Al quitarlas se cerraron
 * también los saltos que traía la numeración (del 07 al 09, y el 08 que
 * `tecnico.ts` usaba sin arquitectura de medición): ahora corre seguida.
 *
 * La «A» es la sección de anuncios por campaña, la primera después de la
 * portada. Va con letra y no con número porque es la vista de conjunto, y las
 * numeradas son el detalle.
 */
const INDICE: [string, string, string][] = [
  ['00', 'setup', 'Setup'],
  ['A', 'anuncios', 'Campañas'],
  ['01', 'meta', 'Meta'],
  ['02', 'google', 'Google'],
  ['03', 'rsa', 'Anuncios'],
  ['04', 'traza', 'Trazabilidad'],
  ['05', 'tecnico', 'Implementación'],
  ['06', 'seguimiento', 'Seguimiento'],
];

/**
 * Datos exclusivos del portal del cliente (C2, spec §4): sin `operador`
 * (nunca hay Compartir ahí), el manual no tiene otro sitio de dónde sacar el
 * enlace «← Mi portal» ni el texto de ayuda del panel de observaciones.
 */
export type OpcionesPortalManual = {
  volverHref: string;
  volverTexto: string;
  ayudaComentarios?: string;
  /** Admin/operador previsualizando el manual del cliente (fix menores, punto 3): agrega la banda de aviso. */
  vistaPrevia?: boolean;
};

/**
 * Rinde el manual de campaña.
 *
 * `datos` puede venir incompleto: cada agente escribe su trozo y uno puede
 * haber fallado. Las secciones se rinden igual, declarando el hueco con su
 * razón, porque media campaña bien documentada sirve y una campaña inventada
 * sobre datos que no existen, no.
 *
 * El envase es el mismo que el de la investigación y el mapa de pilares
 * (`envolverDocumento`): cápsula flotante con progreso de lectura, índice
 * lateral, marco al 85% y día/noche. Antes este archivo armaba su propia
 * barra negra fija con las anclas adentro, y era el único entregable fuera
 * de la línea.
 */
export function renderizarManual(
  datos: Partial<Growth> & { _huecos?: Record<string, string> },
  meta: MetaManual & {
    destino?: string; ciudad?: string; creadoEn?: Date;
    /**
     * Destino del logo de la cabecera: `/` en la vista interna, el `/portal`
     * de quien mira en el portal. Ausente en el enlace público (`/p/...`), donde
     * el logo queda sin enlace — ver `cabeceraDocumento`.
     */
    inicio?: string;
  },
  operador?: OpcionesBarra,
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
  const cuerpo = [
    seccion('setup', seccionPortada(datos, meta, urls.length, huecos, editable), anclas),
    seccion('anuncios', seccionAnuncios(datos, huecos, editable, anclas), anclas),
    seccion('meta', seccionMeta(datos, huecos, editable), anclas),
    seccion('google', seccionGoogle(datos, huecos, urls), anclas),
    seccion('rsa', seccionRsa(datos, huecos), anclas),
    seccion('traza', seccionTraza(urls), anclas),
    seccion('tecnico', seccionTecnico(meta, datos), anclas),
    seccion('seguimiento', seccionSeguimiento(datos), anclas),
  ].join('\n');

  return envolverDocumento({
    titulo: `Manual de campaña · ${meta.cliente}`,
    etiqueta: 'Manual de campaña',
    cliente: meta.cliente,
    fecha: meta.fecha,
    estilos: ESTILOS_GROWTH,
    indice: INDICE,
    cuerpo,
    operador,
    scriptsExtra: NAVEGACION_GROWTH,
    flujo,
    volver: portal ? { href: portal.volverHref, texto: portal.volverTexto, vistaPrevia: portal.vistaPrevia } : undefined,
    ayudaComentarios: portal?.ayudaComentarios,
    accionesExtra: ACCIONES_VIDEOLLAMADA,
    inicio: meta.inicio,
  });
}
