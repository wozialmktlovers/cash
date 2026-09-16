// El entregable del mes (diseño §7, tarea C1).
//
// Autocontenido como los otros dos documentos editoriales: el CSS va en línea y
// el logo incrustado, de modo que el archivo sobrevive suelto —guardado,
// reenviado o impreso— sin la hoja de estilos del sitio. Lo único que NO viaja
// dentro son los artes, que pesan demasiado para incrustarlos: se piden por
// `baseArchivos`, y en el enlace público esa base es relativa al propio
// documento, así que el token que abrió la página es también el que autoriza
// sus imágenes (ver `resolverArchivoPublico`, src/lib/documento-publico.ts).
//
// Misma línea editorial que la investigación y el mapa de pilares: 85% del
// ancho, cabecera flotante, índice lateral, día y noche. Lo aporta
// `envolverDocumento`; aquí solo se arman las cuatro secciones y la portada.

import type { FlujoDatos } from '@/render/editorial/flujo-cliente';
import { envolverDocumento } from '@/render/editorial/comunes';
import { nombrePeriodo } from '@/lib/ui/periodo';
import { ESTILOS_CONTENIDO } from './estilos';
import { REVISION_SOLO_LECTURA, nombreMes, type MetaContenido, type PiezaEntregable, type Revision } from './datos';
import { seccionPortada, seccionFeedVista, seccionCalendario } from './secciones';
import { seccionFeed, seccionHistorias } from './tarjetas';
import { SCRIPT_CONTENIDO, SCRIPT_REVISION } from './script';

export { SCRIPT_CONTENIDO, SCRIPT_REVISION };
export type { MetaContenido, PiezaEntregable, Revision };

export type OpcionesContenido = {
  /**
   * Prefijo con el que el documento pide cada arte subido al Studio: la ruta
   * final es `baseArchivos + fileId`.
   *
   * En el enlace público vale `{token}/archivo/` —sin barra al principio—,
   * que resuelto contra `/p/{negocio}/{token}` da
   * `/p/{negocio}/{token}/archivo/{fileId}`: el documento pide sus imágenes por
   * la misma puerta que lo abrió a él. Es obligatorio y no tiene valor por
   * omisión a propósito: un prefijo equivocado no se nota al leer el código, se
   * nota en la página como un mes entero de imágenes rotas.
   */
  baseArchivos: string;
  /** Solo en la vista interna: edición y comentarios anclados. */
  flujo?: FlujoDatos;
  /** Enlace «← Mi portal» — solo en el portal del cliente. */
  volver?: { href: string; texto: string; vistaPrevia?: boolean };
  /**
   * Si el documento trae los controles de revisión del cliente (diseño §6).
   *
   * **Sin esto se rinde de solo lectura**, que es lo que corresponde al enlace
   * público `/p/…`: ahí no hay sesión, así que una aprobación no podría quedar
   * atribuida a nadie. Solo el portal del cliente identificado los pasa. El
   * argumento completo está en el tipo `Revision` (./datos.ts).
   */
  revision?: Revision;
};

const INDICE: [string, string, string][] = [
  ['01', 'vista-feed', 'Vista del feed'],
  ['02', 'calendario', 'Calendario'],
  ['03', 'feed', 'Contenido de feed'],
  ['04', 'historias', 'Historias'],
];

/**
 * Rinde el entregable de un lote: portada con el plazo y el avance de la
 * revisión, la cuadrícula del perfil, el calendario del mes, las tarjetas de
 * feed y la tira de historias.
 *
 * `piezas` llega tal como se quiera pintar; el orden de cada sección lo pone
 * ella misma (por fecha en el calendario y en las tarjetas, al revés en la
 * cuadrícula del perfil), así que quien llama no tiene que ordenarlas.
 */
export function renderizarContenido(
  piezas: PiezaEntregable[],
  meta: MetaContenido,
  opciones: OpcionesContenido,
): string {
  const base = opciones.baseArchivos;
  const revision = opciones.revision ?? REVISION_SOLO_LECTURA;

  const cuerpo = [
    seccionPortada(piezas, meta, revision),
    seccionFeedVista(piezas, base),
    seccionCalendario(piezas, meta.periodo),
    seccionFeed(piezas, base, revision),
    seccionHistorias(piezas, base, revision),
  ].join('\n');

  return envolverDocumento({
    titulo: `Contenido de ${nombreMes(meta.periodo)} · ${meta.cliente}`,
    etiqueta: `Contenido · ${nombrePeriodo(meta.periodo)}`,
    cliente: meta.cliente,
    fecha: meta.fecha,
    estilos: ESTILOS_CONTENIDO,
    indice: INDICE,
    cuerpo,
    // El script de la revisión solo viaja con los controles: al enlace público
    // no le llega ni una línea que hable de la API de revisión.
    scriptsExtra: revision.controles ? `${SCRIPT_CONTENIDO}\n${SCRIPT_REVISION}` : SCRIPT_CONTENIDO,
    flujo: opciones.flujo,
    volver: opciones.volver,
  });
}
