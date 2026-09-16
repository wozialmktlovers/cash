import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mimePermitido, rutaSegura, borrarCarpetaCliente } from '@/lib/files';

describe('files', () => {
  it('permite PDF, DOCX, TXT, PNG y JPEG', () => {
    for (const m of ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg']) {
      expect(mimePermitido(m)).toBe(true);
    }
  });

  it('rechaza ejecutables y HTML', () => {
    expect(mimePermitido('application/x-msdownload')).toBe(false);
    expect(mimePermitido('text/html')).toBe(false);
  });

  it('bloquea escape de directorio', () => {
    expect(() => rutaSegura('/data', '../../etc/passwd')).toThrow();
  });

  it('resuelve una ruta legítima dentro del directorio', () => {
    expect(rutaSegura('/data', 'abc/archivo.pdf')).toBe('/data/abc/archivo.pdf');
  });
});

describe('borrarCarpetaCliente', () => {
  // Sin este candado, un id vacío resolvería al propio DATA_DIR y el `rm`
  // recursivo se llevaría los archivos de todos los clientes.
  it('se niega a borrar cualquier cosa que no sea un id de un solo segmento', async () => {
    for (const id of ['', '.', '..', '/', 'abc/def', '../otro', 'a b']) {
      await expect(borrarCarpetaCliente(id)).rejects.toThrow('Id de cliente inválido');
    }
  });

  it('un uuid legítimo sí pasa el candado', async () => {
    const previa = process.env.DATA_DIR;
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'wozial-borrado-'));
    const cliente = '00000000-0000-4000-8000-0000000000aa';
    await mkdir(join(process.env.DATA_DIR, cliente), { recursive: true });
    await writeFile(join(process.env.DATA_DIR, cliente, 'suelto.pdf'), 'x');

    await borrarCarpetaCliente(cliente);
    expect(existsSync(join(process.env.DATA_DIR, cliente))).toBe(false);
    // Y el directorio de datos sigue en pie.
    expect(existsSync(process.env.DATA_DIR)).toBe(true);

    await rm(process.env.DATA_DIR, { recursive: true, force: true });
    if (previa === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previa;
  });

  // Un cliente que nunca subió nada no tiene carpeta: borrarla no puede fallar.
  it('una carpeta que no existe no es un error', async () => {
    const previa = process.env.DATA_DIR;
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'wozial-borrado-'));
    await expect(borrarCarpetaCliente('00000000-0000-4000-8000-0000000000bb')).resolves.toBeUndefined();
    await rm(process.env.DATA_DIR, { recursive: true, force: true });
    if (previa === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previa;
  });
});
