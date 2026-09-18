import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * PUT /api/clientes/[id]/paquete: el paquete mensual se guarda y se valida en
 * la ficha. Base simulada; ninguna consulta no prevista pasa.
 */
const espia = vi.hoisted(() => ({ clientes: [] as unknown[], sets: [] as unknown[] }));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  return {
    ...real,
    db: {
      select: () => {
        const b: Record<string, unknown> = {
          from(t: unknown) { if (t !== real.clients) throw new Error('Consulta no prevista'); return b; },
          where() { return b; },
          limit: async () => espia.clientes,
        };
        return b;
      },
      update: (t: unknown) => {
        if (t !== real.clients) throw new Error('Escritura no prevista');
        return { set: (v: unknown) => ({ where: async () => { espia.sets.push(v); } }) };
      },
    },
  };
});

import { PUT } from '@/pages/api/clientes/[id]/paquete';
import { validarPaquete, leerPaquete } from '@/contenido/paquete';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const OPERADOR = '00000000-0000-4000-8000-0000000000e1';
const operador = { id: OPERADOR, email: 'o@x.mx', nombre: null, apellido: null, rol: 'operador' as const, clientId: null, activo: true };
const admin = { ...operador, id: '00000000-0000-4000-8000-0000000000a9', rol: 'admin' as const };
const usuarioCliente = { ...operador, id: '00000000-0000-4000-8000-0000000000f1', rol: 'cliente' as const, clientId: CLIENTE };

const llamar = (cuerpo: unknown, usuario: unknown = operador) => PUT({
  params: { id: CLIENTE },
  request: new Request(`http://x/api/clientes/${CLIENTE}/paquete`, { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  locals: { usuario },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.clientes = [{ id: CLIENTE, operadorId: OPERADOR }];
  espia.sets = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('PUT /api/clientes/[id]/paquete', () => {
  it('el operador asignado lo guarda, sin las claves en cero', async () => {
    const r = await llamar({ post: 8, carrusel: '4', reel: 4, historia: 0 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, paquete: { post: 8, carrusel: 4, reel: 4 } });
    expect(espia.sets[0]).toMatchObject({ paquete: { post: 8, carrusel: 4, reel: 4 } });
  });

  it('el admin también', async () => {
    expect((await llamar({ post: 1 }, admin)).status).toBe(200);
  });

  it('todo en cero guarda «sin paquete»', async () => {
    const r = await llamar({ post: 0, carrusel: 0, reel: 0, historia: 0 });
    expect(await r.json()).toEqual({ ok: true, paquete: null });
    expect(espia.sets[0]).toMatchObject({ paquete: null });
  });

  it('rechaza negativos, decimales, textos, topes y formatos desconocidos', async () => {
    for (const malo of [{ post: -1 }, { post: 2.5 }, { post: 'ocho' }, { post: 61 }, { video: 3 }, [1, 2]]) {
      const r = await llamar(malo);
      expect(r.status).toBe(400);
    }
    expect(espia.sets).toHaveLength(0);
  });

  it('un operador ajeno recibe 404 y no escribe', async () => {
    const r = await llamar({ post: 3 }, { ...operador, id: '00000000-0000-4000-8000-0000000000e9' });
    expect(r.status).toBe(404);
    expect(espia.sets).toHaveLength(0);
  });

  it('el usuario cliente recibe 404 y no escribe', async () => {
    const r = await llamar({ post: 3 }, usuarioCliente);
    expect(r.status).toBe(404);
    expect(espia.sets).toHaveLength(0);
  });
});

describe('leer y validar el paquete', () => {
  it('leerPaquete limpia lo que haya en la columna', () => {
    expect(leerPaquete({ post: 8, carrusel: '2', reel: -1, basura: 3 })).toEqual({ post: 8, carrusel: 2 });
    expect(leerPaquete({ post: 0 })).toBeNull();
    expect(leerPaquete(null)).toBeNull();
    expect(leerPaquete('8 posts')).toBeNull();
  });

  it('validarPaquete explica cada error', () => {
    const r = validarPaquete({ post: -1, reel: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores).toHaveLength(2);
  });
});
