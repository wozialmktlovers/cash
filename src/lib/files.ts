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
  if (!mimePermitido(mime)) throw new Error(`Tipo no permitido: ${mime}`);
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
