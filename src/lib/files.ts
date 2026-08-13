import { mkdir, writeFile, rm } from 'node:fs/promises';
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

export async function borrarArchivo(relativa: string): Promise<void> {
  const dataDir = process.env.DATA_DIR || './data';
  await rm(rutaSegura(dataDir, relativa), { force: true });
}
