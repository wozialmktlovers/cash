import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mimePermitido, rutaSegura, borrarCarpetaCliente, leerArchivo } from '@/lib/files';

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

describe('leerArchivo', () => {
  const CLIENTE = '00000000-0000-4000-8000-0000000000aa';
  const OTRO = '00000000-0000-4000-8000-0000000000bb';
  let previa: string | undefined;

  beforeEach(async () => {
    previa = process.env.DATA_DIR;
    process.env.DATA_DIR = await mkdtemp(join(tmpdir(), 'wozial-leer-'));
    await mkdir(join(process.env.DATA_DIR, CLIENTE), { recursive: true });
    await mkdir(join(process.env.DATA_DIR, OTRO), { recursive: true });
    await writeFile(join(process.env.DATA_DIR, CLIENTE, 'arte.png'), 'mio');
    await writeFile(join(process.env.DATA_DIR, OTRO, 'arte.png'), 'ajeno');
    // Un archivo fuera del directorio de datos, el destino clásico del `..`.
    await writeFile(join(process.env.DATA_DIR, '..', 'secreto.txt'), 'secreto');
  });

  afterEach(async () => {
    await rm(join(process.env.DATA_DIR!, '..', 'secreto.txt'), { force: true });
    await rm(process.env.DATA_DIR!, { recursive: true, force: true });
    if (previa === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = previa;
  });

  it('lee un archivo de la carpeta de su cliente', async () => {
    expect((await leerArchivo(CLIENTE, `${CLIENTE}/arte.png`)).toString()).toBe('mio');
  });

  // El id del archivo viene de la URL; la ruta sale de la base. Aunque una
  // fila viniera retocada, no puede salir de DATA_DIR ni cambiar de carpeta.
  it('no sale del directorio de datos', async () => {
    for (const ruta of ['../secreto.txt', `${CLIENTE}/../../secreto.txt`, '/etc/passwd', '..']) {
      await expect(leerArchivo(CLIENTE, ruta)).rejects.toThrow();
    }
  });

  it('no lee la carpeta de otro cliente, aunque siga dentro del directorio de datos', async () => {
    for (const ruta of [`${OTRO}/arte.png`, `${CLIENTE}/../${OTRO}/arte.png`]) {
      await expect(leerArchivo(CLIENTE, ruta)).rejects.toThrow('carpeta de su cliente');
    }
  });

  // El mismo candado de `borrarCarpetaCliente`: un id vacío o con separadores
  // resolvería a DATA_DIR entero y volvería legible cualquier cosa de dentro.
  it('se niega con un id de cliente que no es de un solo segmento', async () => {
    for (const id of ['', '.', '..', '/', 'abc/def', '../otro', 'a b']) {
      await expect(leerArchivo(id, 'arte.png')).rejects.toThrow('Id de cliente inválido');
    }
  });
});
