// Lo que el entregable del mes necesita saber de un lote y de sus piezas, y las
// piezas de vocabulario que comparten sus cuatro secciones: iconos de formato,
// etiquetas, colores de estado, el orden del feed y de dónde sale cada arte.
//
// Los tipos son ligeros y propios, como los de `src/contenido/reglas.ts`:
// describen lo que hay que PINTAR, no las filas completas de la base. Quien
// llama (el enlace público, el portal) adapta la fila a esto, y así una columna
// nueva de `contenido_piezas` no se cuela sola al documento que ve el cliente.

import type { Arte } from '@/contenido/piezas';
import { enlaceWeb } from '@/contenido/reglas';
import type { EstadoRevision, Formato, Plataforma } from '@/contenido/reglas';
import { escapar } from '@/render/escapar';

export type { Arte, EstadoRevision, Formato, Plataforma };
export { enlaceWeb };

/** Una pieza tal como se pinta en el entregable. */
export type PiezaEntregable = {
  id: string;
  numero: number;
  formato: Formato;
  plataforma: Plataforma;
  /** `YYYY-MM-DD`, o `null` si todavía no tiene día. */
  fechaPublicacion: string | null;
  copy: string;
  cta: string;
  hashtags: string;
  arte: Arte[];
  estadoCliente: EstadoRevision;
  /** La nota que dejó el cliente al pedir cambios. */
  notaCliente: string | null;
};

/** Cabecera del documento: de quién es el mes y qué plazo corre. */
export type MetaContenido = {
  cliente: string;
  /**
   * Destino del logo de la cabecera: `/` en la vista interna, el `/portal`
   * de quien mira en el portal. Ausente en el enlace público (`/p/...`), donde
   * el logo queda sin enlace — ver `cabeceraDocumento`.
   */
  inicio?: string;
  /** El mes del lote, `YYYY-MM`. */
  periodo: string;
  /** Fecha del pie del documento, ya escrita para leerse. */
  fecha: string;
  /** Cuándo se le compartió al cliente; `null` si todavía no. */
  compartidoEn: Date | null;
  /** Fecha límite ya calculada; `null` mientras no se comparta. */
  limiteRevision: Date | null;
  /** Días hábiles de revisión de este cliente, para decirlo en el mensaje. */
  diasRevision: number;
  /**
   * Si el mes **ya no admite decisiones del cliente**: el lote está `aprobada` y
   * su plazo venció (`aceptaDecision`, src/contenido/revision.ts).
   *
   * Llega calculado y no se deduce aquí a propósito. La regla vive en un solo
   * sitio —el mismo que contesta el 409 de la API— y el documento se limita a
   * pintar lo que esa regla dijo: si lo dedujera por su cuenta de `estado` y
   * `limite_revision`, tendríamos dos versiones de «este mes está cerrado» que
   * pueden desincronizarse, y la que vería el cliente sería la equivocada.
   *
   * No es lo mismo que «el lote está aprobada». Un mes aprobado con el plazo
   * vivo —el cliente aprobó todo por su cuenta y todavía puede arrepentirse de
   * una pieza— **no** está cerrado y conserva sus controles; uno aprobado sin
   * fecha límite, tampoco. Lo que cierra es el plazo, no el estado.
   */
  cerrado: boolean;
};

/**
 * Si el documento trae los controles de revisión o es de solo lectura
 * (diseño §6, tarea C2).
 *
 * **La decisión, para que no se deshaga por descuido: los botones de aprobar y
 * de pedir cambios existen únicamente en el portal, con el cliente
 * identificado.** El enlace público `/p/…` rinde el mismo documento sin ellos y
 * lo dice en la portada, con el camino para entrar.
 *
 * El motivo es que una aprobación tiene que quedar atribuida a una persona
 * —`contenido_piezas.revisado_en` y el comentario anclado llevan autor—, y un
 * enlace compartido no identifica a nadie: lo reenvía quien sea a quien sea, y
 * quien lo abre no tiene sesión. Aprobar desde ahí sería registrar «alguien con
 * el enlace aprobó el mes», que no sirve de nada el día que alguien pregunte
 * quién aprobó qué.
 */
export type Revision = {
  /** `true` solo en el portal del cliente autenticado. */
  controles: boolean;
  /** A dónde mandar a quien abrió el enlace público y quiere aprobar. */
  accesoHref: string;
};

/** Lo que recibe el enlace público: se lee todo, no se decide nada. */
export const REVISION_SOLO_LECTURA: Revision = { controles: false, accesoHref: '/portal' };

const ICONO_POST = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17.5 9.5 12l4 4 2.5-2.5 4 4"/></svg>';
const ICONO_CARRUSEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="7" height="12" rx="1.5"/><rect x="8.5" y="4" width="7" height="16" rx="1.5"/><rect x="15" y="6" width="7" height="12" rx="1.5"/></svg>';
const ICONO_REEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 9h18M8.5 3 11 9M15 3l2.5 6"/><path d="m11 13 4 2.2-4 2.2z"/></svg>';
const ICONO_HISTORIA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 22v-2a3 3 0 0 1 6 0v2"/></svg>';

export const ICONO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
export const ICONO_ENLACE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';
export const ICONO_SIN_ARTE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m4 17 5-5 4 4 2-2 5 5"/><path d="m3 3 18 18"/></svg>';

/** Nombre e icono de cada formato. El plural es para las cifras de la portada. */
export const FORMATO: Record<Formato, { texto: string; plural: string; icono: string }> = {
  post: { texto: 'Post', plural: 'Posts', icono: ICONO_POST },
  carrusel: { texto: 'Carrusel', plural: 'Carruseles', icono: ICONO_CARRUSEL },
  reel: { texto: 'Reel', plural: 'Reels', icono: ICONO_REEL },
  historia: { texto: 'Historia', plural: 'Historias', icono: ICONO_HISTORIA },
};

export const PLATAFORMA: Record<Plataforma, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  ambas: 'Facebook e Instagram',
};

/**
 * Lo que el cliente ve de su propia revisión. `pendiente` se dice «Pendiente de
 * revisión» y no «Pendiente»: la pieza no está a medias, está esperándolo a él.
 */
export const ESTADO: Record<EstadoRevision, string> = {
  pendiente: 'Pendiente de revisión',
  aprobada: 'Aprobada',
  cambios: 'Con cambios',
};

/** Los formatos que van al feed del perfil; la historia no deja huella ahí. */
export const FORMATOS_FEED: Formato[] = ['post', 'carrusel', 'reel'];

export function esDeFeed(p: PiezaEntregable): boolean {
  return p.formato !== 'historia';
}

/**
 * Orden de publicación: por fecha y, a igualdad o sin fecha, por número.
 *
 * Las piezas sin día van al final en vez de al principio: son las que todavía
 * no se han colocado en el mes, y ponerlas delante haría ver el calendario y la
 * cuadrícula del feed como si el mes empezara por lo que falta.
 */
export function porFecha(a: PiezaEntregable, b: PiezaEntregable): number {
  if (a.fechaPublicacion !== b.fechaPublicacion) {
    if (a.fechaPublicacion === null) return 1;
    if (b.fechaPublicacion === null) return -1;
    return a.fechaPublicacion < b.fechaPublicacion ? -1 : 1;
  }
  return a.numero - b.numero;
}

/**
 * De dónde pide el documento un arte.
 *
 * - Con `url`, el arte vive fuera (el caso del reel alojado en otro sitio) y se
 *   usa tal cual **si apunta a la web**. `enlaceWeb` (src/contenido/reglas.ts)
 *   descarta cualquier otro esquema —`javascript:`, `data:`, `file:`—, que
 *   desde aquí acabaría en un `src`, un `poster` o un `href` servidos en el
 *   origen del Studio. El esquema de alta ya no los deja entrar; esto es para
 *   lo que pueda haber entrado antes, porque `arte` es `jsonb` y nadie lo
 *   vuelve a validar al leerlo (ver el comentario de `enlaceWeb`).
 * - Con `fileId`, lo sirve el Studio y la ruta se arma con `base`. En el enlace
 *   público esa base es RELATIVA al propio documento
 *   (`{token}/archivo/`, ver `resolverDocumentoPublico`), de modo que el
 *   entregable pide sus imágenes por la misma puerta que lo abrió a él y sigue
 *   funcionando aunque el sitio cuelgue de otro dominio o de otro prefijo.
 *
 * Devuelve `null` si el arte no apunta a nada, que el marcado traduce a un
 * hueco con el número de la pieza en vez de a una imagen rota.
 */
export function rutaArte(arte: Arte | undefined, base: string): string | null {
  if (!arte) return null;
  if (arte.url) return enlaceWeb(arte.url);
  if (arte.fileId) return `${base}${encodeURIComponent(arte.fileId)}`;
  return null;
}

/**
 * La imagen que representa a la pieza: su portada si la marcaron, y si no, la
 * primera imagen. Es lo que se ve en la cuadrícula del feed y lo primero que
 * abre el visor de un carrusel.
 */
export function portadaDe(p: PiezaEntregable): Arte | undefined {
  return p.arte.find((a) => a.tipo === 'portada') ?? p.arte.find((a) => a.tipo === 'imagen') ?? p.arte[0];
}

/** Las imágenes que recorre el visor del carrusel, en el orden en que se subieron. */
export function imagenesDe(p: PiezaEntregable): Arte[] {
  return p.arte.filter((a) => a.tipo === 'imagen' || a.tipo === 'portada');
}

/** El video de la pieza, si lo hay: un archivo subido o un enlace externo. */
export function videoDe(p: PiezaEntregable): Arte | undefined {
  return p.arte.find((a) => a.tipo === 'video');
}

/** Año y mes de un periodo `YYYY-MM`; `null` si el texto no tiene esa forma. */
export function partesPeriodo(periodo: string): { anio: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(periodo);
  if (!m) return null;
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { anio: Number(m[1]), mes } : null;
}

/**
 * «septiembre», en minúscula: va dentro de la frase «Contenido de septiembre»
 * (diseño §7). Se formatea en UTC porque el periodo es un mes del calendario,
 * no un instante: pasarlo por la zona de México movería el día 1 a las 00:00
 * UTC al mes anterior, igual que advierte `src/lib/ui/periodo.ts`.
 */
export function nombreMes(periodo: string): string {
  const p = partesPeriodo(periodo);
  if (!p) return periodo;
  return new Date(Date.UTC(p.anio, p.mes - 1, 1)).toLocaleDateString('es-MX', { month: 'long', timeZone: 'UTC' });
}

/** «12 de septiembre» a partir de un `YYYY-MM-DD`; el texto crudo si no lo es. */
export function diaLargo(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    .toLocaleDateString('es-MX', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/**
 * Etiqueta de estado, lista para pegar en cualquier sección.
 *
 * `data-estado-chip` es para el portal: cuando el cliente decide sobre una
 * pieza, el script repinta su chip sin recargar la página (C2). En el enlace
 * público el atributo sobra y no estorba.
 */
export function chipEstado(estado: EstadoRevision): string {
  return `<span class="estado-pieza ${estado}" data-estado-chip>${escapar(ESTADO[estado])}</span>`;
}
