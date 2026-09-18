// El arte de cada anuncio del manual de campaña: qué huecos tiene cada formato,
// qué cabe en cada uno y cuáles de los artes guardados se enseñan.
//
// Puro —sin base, sin Zod, sin Astro— para que lo compartan el render (que
// pinta los huecos), el servicio (que valida a dónde va una subida) y las
// pruebas, sin arrastrarse dependencias entre sí.
//
// **El arte no es contenido versionado del documento.** Vive en su propia
// tabla (`growth_artes`) y se ancla por el índice ORIGINAL del creativo en
// `datos.creativos` —el mismo `creativos.N` que usan los comentarios—, así que
// editar un copy, guardar una versión o restaurar otra no lo toca. La otra
// cara de eso es que el manual puede cambiar debajo del arte: una versión
// restaurada con menos anuncios, o un anuncio que pasó de carrusel a imagen.
// `acomodarArtes` es quien decide qué se sigue enseñando: lo que ya no tiene
// hueco se queda en la base, pero no sale en el documento.

export type FormatoAnuncio = 'imagen' | 'video' | 'carrusel';
export type Ratio = '1x1' | '4x5' | '9x16';

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
 *
 * Es también la tabla de huecos del arte subido (`huecosDe`): lo que dice
 * cuántos archivos van es lo que dice cuántos se pueden subir.
 */
export const ARCHIVOS: Record<FormatoAnuncio, { cantidad: number; etiqueta: string; ratio: Ratio }[]> = {
  imagen: [{ cantidad: 1, etiqueta: 'Pieza', ratio: '1x1' }],
  // 4:5, igual que dicta el agente de creativos: la tabla vieja decía 1:1 y
  // el anuncio mostraba las dos medidas a la vez.
  carrusel: [{ cantidad: 5, etiqueta: 'Tarjetas', ratio: '4x5' }],
  video: [
    { cantidad: 1, etiqueta: 'Video', ratio: '9x16' },
    { cantidad: 1, etiqueta: 'Portada', ratio: '4x5' },
  ],
};

export const MEDIDAS: Record<Ratio, string> = {
  '1x1': '1080 × 1080 px', '4x5': '1080 × 1350 px', '9x16': '1080 × 1920 px',
};

/** Lo que es un arte guardado, visto desde el hueco que lo recibe. */
export type ClaseArte = 'imagen' | 'video' | 'enlace';

/**
 * Un hueco de arte de un anuncio.
 *
 * - `orden` es la posición fija del hueco (la pieza de una imagen es la 0; el
 *   video es la 0 y su portada la 1). Las tarjetas de un carrusel no tienen
 *   posición fija —se agregan una tras otra y se enseñan por orden—, así que
 *   su hueco va con `orden: null` y `cantidad` dice cuántas caben.
 */
export type Hueco = {
  clave: 'pieza' | 'tarjeta' | 'video' | 'portada';
  etiqueta: string;
  ratio: Ratio;
  orden: number | null;
  cantidad: number;
  acepta: readonly ClaseArte[];
};

const SOLO_IMAGEN = ['imagen'] as const;

/** Los huecos de arte de un formato, sacados de `ARCHIVOS`. Formato desconocido: ninguno. */
export function huecosDe(formato: string): Hueco[] {
  if (formato === 'imagen') {
    return [{ clave: 'pieza', etiqueta: 'Pieza', ratio: ARCHIVOS.imagen[0].ratio, orden: 0, cantidad: 1, acepta: SOLO_IMAGEN }];
  }
  if (formato === 'carrusel') {
    const t = ARCHIVOS.carrusel[0];
    return [{ clave: 'tarjeta', etiqueta: 'Tarjeta', ratio: t.ratio, orden: null, cantidad: t.cantidad, acepta: SOLO_IMAGEN }];
  }
  if (formato === 'video') {
    const [video, portada] = ARCHIVOS.video;
    return [
      // El video puede subirse como archivo o quedarse en un enlace (Drive,
      // YouTube, el administrador de anuncios): suele pesar más de lo que
      // conviene guardar aquí.
      { clave: 'video', etiqueta: video.etiqueta, ratio: video.ratio, orden: 0, cantidad: 1, acepta: ['video', 'enlace'] },
      { clave: 'portada', etiqueta: portada.etiqueta, ratio: portada.ratio, orden: 1, cantidad: 1, acepta: SOLO_IMAGEN },
    ];
  }
  return [];
}

/** Cuántas tarjetas lleva un carrusel. */
export const TARJETAS_CARRUSEL = ARCHIVOS.carrusel[0].cantidad;

/** Un arte guardado, tal como lo necesitan el render y el servicio. */
export type ArteGrowth = {
  id: string;
  creativo: number;
  orden: number;
  tipo: 'archivo' | 'enlace';
  mime: string | null;
  url: string | null;
  nombreOriginal: string | null;
};

/** La clase de un arte guardado; `null` si su tipo no es de ninguna clase conocida. */
export function claseDe(a: Pick<ArteGrowth, 'tipo' | 'mime'>): ClaseArte | null {
  if (a.tipo === 'enlace') return 'enlace';
  if (a.mime === 'image/png' || a.mime === 'image/jpeg') return 'imagen';
  if (a.mime === 'video/mp4') return 'video';
  return null;
}

/** Un hueco con lo que se enseña en él. Las tarjetas traen su lista; los demás, a lo más un arte. */
export type HuecoOcupado = { hueco: Hueco; artes: ArteGrowth[] };

/**
 * Los artes guardados de un manual, repartidos en los huecos de sus anuncios
 * ACTUALES. La llave del mapa es el índice original del creativo.
 *
 * Un arte se enseña solo si su anuncio sigue existiendo, el formato de ese
 * anuncio todavía tiene su hueco, y lo que es el arte cabe en él. Lo que no
 * —un huérfano de una versión con más anuncios, una tarjeta de un anuncio que
 * ahora es imagen suelta con el hueco ya ocupado— no truena ni se inventa
 * sitio: simplemente no sale.
 */
export function acomodarArtes(
  creativos: readonly { formato: string }[],
  artes: readonly ArteGrowth[],
): Map<number, HuecoOcupado[]> {
  const porCreativo = new Map<number, HuecoOcupado[]>();
  creativos.forEach((c, i) => {
    const suyos = artes
      .filter((a) => a.creativo === i)
      .slice()
      .sort((x, y) => x.orden - y.orden);
    const ocupados = huecosDe(c.formato).map((hueco): HuecoOcupado => {
      const caben = suyos.filter((a) => {
        const clase = claseDe(a);
        return clase !== null && hueco.acepta.includes(clase) && (hueco.orden === null || a.orden === hueco.orden);
      });
      return { hueco, artes: caben.slice(0, hueco.cantidad) };
    });
    porCreativo.set(i, ocupados);
  });
  return porCreativo;
}

/**
 * A qué orden va una subida, o por qué no puede ir.
 *
 * - Hueco de posición fija: `orden` es obligatorio y tiene que ser la
 *   posición de un hueco del formato. Si ya hay algo ahí, se reemplaza.
 * - Tarjeta de carrusel: sin `orden` se agrega al final, siempre que quepa;
 *   con `orden` reemplaza esa tarjeta, que tiene que existir.
 *
 * `existentes` son los artes que ya se ENSEÑAN en ese anuncio (lo que devuelve
 * `acomodarArtes`), no todo lo guardado: un huérfano no ocupa lugar.
 */
export function destinoDeSubida(
  formato: string,
  orden: number | null,
  clase: ClaseArte,
  existentes: readonly HuecoOcupado[],
  /** El orden más alto guardado para este anuncio, se enseñe o no: una tarjeta nueva va detrás de todo. */
  maxGuardado = -1,
): { ok: true; orden: number } | { ok: false; error: string } {
  const huecos = huecosDe(formato);
  if (!huecos.length) return { ok: false, error: 'Este anuncio no tiene un formato con arte.' };

  if (formato === 'carrusel') {
    const tarjetas = existentes.find((h) => h.hueco.clave === 'tarjeta')?.artes ?? [];
    if (clase !== 'imagen') return { ok: false, error: 'Las tarjetas del carrusel son imágenes PNG o JPEG.' };
    if (orden === null) {
      if (tarjetas.length >= TARJETAS_CARRUSEL) {
        return { ok: false, error: `El carrusel ya tiene sus ${TARJETAS_CARRUSEL} tarjetas. Reemplaza o quita una.` };
      }
      const ultima = tarjetas.length ? tarjetas[tarjetas.length - 1].orden : -1;
      return { ok: true, orden: Math.max(ultima, maxGuardado) + 1 };
    }
    if (!tarjetas.some((t) => t.orden === orden)) return { ok: false, error: 'Esa tarjeta ya no existe.' };
    return { ok: true, orden };
  }

  if (orden === null) return { ok: false, error: 'Falta indicar qué arte del anuncio es.' };
  const hueco = huecos.find((h) => h.orden === orden);
  if (!hueco) return { ok: false, error: 'Ese arte no existe en este anuncio.' };
  if (!hueco.acepta.includes(clase)) {
    return {
      ok: false,
      error: hueco.clave === 'video'
        ? 'El video va como archivo MP4 o como enlace.'
        : `${hueco.etiqueta}: solo se aceptan imágenes PNG o JPEG.`,
    };
  }
  return { ok: true, orden };
}

/**
 * Lo que el render del manual necesita para pintar el arte: los artes
 * guardados, de dónde pedir cada archivo según la puerta por la que se está
 * viendo el manual (la API del equipo, el portal, el enlace público), y —solo
 * en la vista interna de quien puede operar— a dónde subir y quitar.
 */
export type ArtesManual = {
  lista: readonly ArteGrowth[];
  src: (arteId: string) => string;
  /** `POST {api}` sube; `DELETE {api}/{arteId}` quita. Ausente en portal y enlace público. */
  api?: string;
};
