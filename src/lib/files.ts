import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

export const MAX_BYTES = 25 * 1024 * 1024;

export function mimePermitido(mime: string): boolean {
  return PERMITIDOS.has(mime);
}

/**
 * Video: solo lo acepta el arte de los anuncios del manual de campaña
 * (`growth_artes`), nunca la ficha del cliente —esa sigue con `PERMITIDOS`,
 * que es lo que mira `POST /api/clientes/[id]/files`—. Se guarda y se sirve
 * con las mismas funciones, así que la lista de lo que el disco puede tener es
 * la unión de las dos (`mimeGuardable`).
 */
const VIDEO = new Set(['video/mp4']);

/** Lo que se puede escribir en el disco de datos y volver a servir con su tipo. */
export function mimeGuardable(mime: string): boolean {
  return PERMITIDOS.has(mime) || VIDEO.has(mime);
}

/**
 * Las marcas de un contenedor ISO (`ftyp`) que son video MP4 de verdad. La
 * misma caja la usan HEIC y AVIF —que son IMÁGENES— y el `.mov` de QuickTime,
 * que los navegadores no reproducen igual: por eso es lista blanca y no «trae
 * `ftyp`».
 */
const MARCAS_MP4 = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'M4VP', 'dash', 'mmp4', 'MSNV']);

/**
 * El tipo REAL de un archivo, mirando sus primeros bytes y no lo que declaró
 * el navegador ni la extensión del nombre (los dos los escribe quien sube).
 * `null` si no es ninguno de los que se reconocen aquí.
 *
 * Solo reconoce lo que el Studio incrusta en una página —PNG, JPEG y MP4—,
 * que es donde un tipo falso haría daño: un HTML con extensión `.png` que se
 * sirviera como imagen. WebP no está porque todavía no se acepta en ningún
 * lado (`PERMITIDOS`).
 */
export function tipoReal(buf: Uint8Array): 'image/png' | 'image/jpeg' | 'video/mp4' | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12) {
    const caja = String.fromCharCode(b[4], b[5], b[6], b[7]);
    const marca = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (caja === 'ftyp' && MARCAS_MP4.has(marca)) return 'video/mp4';
  }
  return null;
}

/** La extensión con que se guarda un archivo de un tipo ya verificado. */
export function extensionDe(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'video/mp4' ? 'mp4' : 'bin';
}

export function rutaSegura(dataDir: string, relativa: string): string {
  const base = resolve(dataDir);
  const destino = resolve(base, relativa);
  if (destino !== base && !destino.startsWith(base + '/')) {
    throw new Error('Ruta fuera del directorio permitido');
  }
  return destino;
}

export async function guardarArchivo(
  clientId: string, nombreOriginal: string, buf: Buffer, mime: string
): Promise<{ ruta: string }> {
  if (!mimeGuardable(mime)) throw new Error(`Tipo no permitido: ${mime}`);
  if (buf.byteLength > MAX_BYTES) throw new Error('El archivo supera 25 MB');

  const ext = nombreOriginal.includes('.')
    ? nombreOriginal.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : 'bin';
  const relativa = join(clientId, `${randomUUID()}.${ext || 'bin'}`);
  const dataDir = process.env.DATA_DIR || './data';
  const absoluta = rutaSegura(dataDir, relativa);

  await mkdir(dirname(absoluta), { recursive: true });
  await writeFile(absoluta, buf);
  return { ruta: relativa };
}

/**
 * Lee un archivo guardado, para servirlo.
 *
 * No inventa protección nueva: reusa las dos que ya tenía el módulo. Primero
 * `rutaSegura`, que no deja salir de `DATA_DIR`. Después el candado de un solo
 * segmento que puso `borrarCarpetaCliente`, aquí para lo contrario —no para no
 * borrar de más, sino para no LEER de más—: el archivo tiene que caer dentro
 * de la carpeta de SU cliente, que es como lo guarda `guardarArchivo`
 * (`join(clientId, ...)`). Así, una fila cuya `ruta` apuntara a
 * `../otro-cliente/arte.png` no entrega nada, aunque el destino siga estando
 * dentro de `DATA_DIR` y `rutaSegura` lo dejaría pasar.
 */
export async function leerArchivo(clientId: string, relativa: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9-]+$/.test(clientId)) throw new Error('Id de cliente inválido para leer sus archivos');
  const dataDir = process.env.DATA_DIR || './data';
  const carpeta = rutaSegura(dataDir, clientId);
  const absoluta = rutaSegura(dataDir, relativa);
  if (!absoluta.startsWith(carpeta + '/')) throw new Error('El archivo no está en la carpeta de su cliente');
  return readFile(absoluta);
}

export async function borrarArchivo(relativa: string): Promise<void> {
  const dataDir = process.env.DATA_DIR || './data';
  await rm(rutaSegura(dataDir, relativa), { force: true });
}

/**
 * Borra la carpeta entera de un cliente en el disco de datos, con lo que haya
 * dentro. Se usa al eliminar un cliente, después de borrar archivo por archivo
 * los que sí están registrados: barre lo que quedó de una subida a medias (un
 * archivo escrito cuya fila nunca se insertó) y deja de paso la carpeta vacía.
 *
 * El candado del id no es decorativo: con una cadena vacía o con separadores,
 * `rutaSegura` devolvería el propio DATA_DIR y este `rm` recursivo se llevaría
 * los archivos de TODOS los clientes. La carpeta de un cliente es siempre un
 * solo segmento (`join(clientId, ...)` en `guardarArchivo`).
 */
export async function borrarCarpetaCliente(clientId: string): Promise<void> {
  if (!/^[A-Za-z0-9-]+$/.test(clientId)) throw new Error('Id de cliente inválido para borrar su carpeta');
  const dataDir = process.env.DATA_DIR || './data';
  await rm(rutaSegura(dataDir, clientId), { recursive: true, force: true });
}
