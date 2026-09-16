import { mimePermitido } from './files';

/** Lo mínimo que hace falta de una fila de `client_files` para poder servirla. */
export type ArchivoServible = { nombreOriginal: string; mime: string };

/**
 * Tipos que se sirven INCRUSTADOS en la página; el resto sale como descarga.
 *
 * Es una lista explícita y no un `mime.startsWith('image/')` a propósito:
 * `image/svg+xml` es una imagen y a la vez un documento que ejecuta scripts en
 * el origen de quien lo abre —el Studio para el equipo, el enlace público para
 * el cliente—. Hoy no hay SVG que servir, porque `PERMITIDOS` (src/lib/files.ts)
 * no lo acepta al subir; si algún día se acepta, esta lista hace que salga como
 * descarga sin que nadie tenga que acordarse de este archivo.
 */
const INCRUSTABLES = new Set(['image/png', 'image/jpeg']);

/**
 * Caché.
 *
 * `private` siempre: son archivos de un cliente y no pueden quedar en una caché
 * compartida (el proxy de Railway, un CDN, la caché de una oficina). Solo el
 * navegador de quien pidió el archivo puede guardarlos, y quien pide es quien
 * ya pasó el permiso o traía el token.
 *
 * Las imágenes se guardan cinco minutos porque una página del entregable pide
 * dos docenas de artes y se recarga a cada rato: es suficiente para que
 * navegar no vuelva a bajarlas, y poco para que un permiso retirado o un
 * enlace revocado sigan sirviendo mucho rato.
 */
export const CACHE_IMAGEN = 'private, max-age=300, must-revalidate';

/**
 * Lo que no es imagen —el brief en PDF, el DOCX, el TXT— va sin caché: se
 * descarga una vez y no hay razón para dejar el documento de un cliente en el
 * disco de nadie.
 */
export const CACHE_DOCUMENTO = 'private, no-store';

/**
 * El tipo con el que se sirve. Si la fila trae un tipo que hoy no se acepta al
 * subir —una fila vieja, o una lista de permitidos que se recortó después—, se
 * sirve como binario opaco en vez de con el tipo que diga la fila.
 */
export function tipoServible(mime: string): string {
  return mimePermitido(mime) ? mime : 'application/octet-stream';
}

/** El nombre original viaja en una cabecera, y lo escribió quien subió el archivo. */
function cabeceraDisposicion(nombre: string, incrustar: boolean): string {
  // Fuera saltos de línea y caracteres de control (partirían la cabecera en
  // dos), comillas (cerrarían el `filename=`) y barras (un nombre no es una
  // ruta). Y un tope, que un nombre de mil letras no le sirve a nadie.
  const limpio = nombre.replace(/[\u0000-\u001f\u007f"\\/]/g, '_').trim().slice(0, 120) || 'archivo';
  // `filename` solo ASCII para los navegadores viejos; `filename*` lleva el
  // nombre real, acentos incluidos, como manda el RFC 5987.
  const ascii = limpio.replace(/[^\u0020-\u007e]/g, '_');
  return `${incrustar ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(limpio)}`;
}

/**
 * La respuesta con el archivo, igual para el equipo y para el enlace público:
 * el tipo real de la fila, descarga forzada para lo que no sea imagen —para
 * que un archivo subido no se ejecute en el navegador de quien lo abre—,
 * `nosniff` para que el navegador no adivine otro tipo mirando el contenido, y
 * una caché que nunca es compartida.
 */
export function respuestaArchivo(
  contenido: Buffer,
  archivo: ArchivoServible,
  cabecerasExtra: Record<string, string> = {},
): Response {
  const tipo = tipoServible(archivo.mime);
  const incrustar = INCRUSTABLES.has(tipo);
  return new Response(new Uint8Array(contenido), {
    status: 200,
    headers: {
      'Content-Type': tipo,
      'Content-Length': String(contenido.byteLength),
      'Content-Disposition': cabeceraDisposicion(archivo.nombreOriginal, incrustar),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': incrustar ? CACHE_IMAGEN : CACHE_DOCUMENTO,
      ...cabecerasExtra,
    },
  });
}
