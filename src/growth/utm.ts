import type { Growth } from './schemas';

export type UrlEtiquetada = {
  plataforma: 'meta' | 'google';
  /** El mismo valor que utm_content. Es la llave para emparejar cada URL con
   *  su pieza sin depender del orden ni del texto de la etiqueta. */
  clave: string;
  etiqueta: string;
  url: string;
};

/**
 * Minúsculas, guion bajo, sin acentos ni eñes.
 *
 * La regla del machote no es estética. En el reporte de plataforma «Meta» y
 * «meta» son dos fuentes distintas, así que un descuido de mayúsculas parte
 * los datos en dos filas que nadie vuelve a juntar. Los acentos rompen el
 * agrupado por el mismo motivo.
 */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** El periodo es YYYYMM: agrupa el reporte por mes sin depender del día. */
function periodo(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Orden fijo de las cinco campañas de Google, el del machote. */
const ORDEN_GOOGLE: Record<string, number> = {
  marca: 1, categoria: 2, precio: 3, geo: 4, contenido: 5,
};

/**
 * Las 14 URLs etiquetadas: 9 de Meta (un creativo cada una) y 5 de Google
 * (una campaña cada una). No es una cifra elegida: es la estructura fija de
 * la casa contada en URLs.
 */
export function construirUrls(opts: {
  growth: Growth;
  destino: string;
  cliente: string;
  ciudad?: string;
  /**
   * Fecha de creación del resultado, no la de hoy. Si el periodo se tomara de
   * un reloj en tiempo de render, volver a abrir un manual viejo cambiaría sus
   * URLs y dejarían de casar con lo ya cargado en las plataformas.
   */
  creadoEn: Date;
}): UrlEtiquetada[] {
  const { growth, destino, cliente, ciudad, creadoEn } = opts;
  const campana = `${normalizar(cliente)}_${periodo(creadoEn)}`;

  const armar = (params: Record<string, string>) => {
    const u = new URL(destino);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    // La inserción dinámica de Google va literal: codificada como %7Bkeyword%7D
    // la plataforma no la sustituye y el reporte se llena de esa cadena.
    return u.toString().replace(/%7Bkeyword%7D/gi, '{keyword}');
  };

  const meta: UrlEtiquetada[] = growth.creativos.map((c) => ({
    plataforma: 'meta',
    clave: `g${c.grupo}_${c.formato}`,
    etiqueta: `Grupo ${c.grupo.toUpperCase()} · ${c.formato}`,
    url: armar({
      utm_source: 'meta',
      utm_medium: 'paid_social',
      utm_campaign: campana,
      utm_content: `g${c.grupo}_${c.formato}`,
      utm_term: normalizar(c.angulo),
    }),
  }));

  const google: UrlEtiquetada[] = growth.campanasGoogle.map((c) => {
    const base = `g${ORDEN_GOOGLE[c.clave]}_${c.clave}`;
    const ciudadNorm = ciudad ? normalizar(ciudad) : '';
    const content = c.clave === 'geo' && ciudadNorm ? `${base}_${ciudadNorm}` : base;
    return {
      plataforma: 'google',
      clave: content,
      etiqueta: c.nombre,
      url: armar({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: campana,
        utm_content: content,
        utm_term: '{keyword}',
      }),
    };
  });

  return [...meta, ...google];
}
