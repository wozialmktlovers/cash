import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Retirar el enlace del mes: `DELETE /api/share` con un token de tipo
 * `contenido`.
 *
 * La ruta ya sabía revocar estos enlaces —el permiso se resuelve por el LOTE y
 * no por una fila de resultados—, pero se quedaba en revocar el token. Lo que
 * se comprueba aquí es lo que se le añadió: que un enlace de mes pase por
 * `retirarEnlaceDelLote`, que es quien decide si el plazo de revisión se
 * detiene (src/contenido/enlaces.ts), y que los otros tres tipos de documento
 * —que no tienen plazo— sigan yendo por la revocación de siempre.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  OTRO_OPERADOR: '00000000-0000-4000-8000-000000000002',
}));

const espia = vi.hoisted(() => ({
  link: null as Record<string, unknown> | null,
  lote: null as Record<string, unknown> | null,
  cliente: null as Record<string, unknown> | null,
  documento: null as Record<string, unknown> | null,
  retiros: [] as { loteId: string; token: string }[],
  revocados: [] as string[],
  resultadoRetiro: {
    retirado: true,
    activosRestantes: 0,
    detuvoElPlazo: true,
    estado: 'en_proceso',
  } as Record<string, unknown>,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const c = { from: () => c, where: () => c, limit: async () => (espia.link ? [espia.link] : []) };
  return { ...real, db: { select: () => c } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return {
    ...real,
    loteVisible: async () => (espia.lote ? { lote: espia.lote, cliente: espia.cliente } : null),
    documentoVisible: async () => (espia.documento ? { resultado: espia.documento, cliente: espia.cliente } : null),
  };
});

vi.mock('@/lib/share', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/share')>();
  return { ...real, revocarShareLink: async (token: string) => { espia.revocados.push(token); } };
});

vi.mock('@/contenido/enlaces', async (importarReal) => {
  const real = await importarReal<typeof import('@/contenido/enlaces')>();
  return {
    ...real,
    retirarEnlaceDelLote: async (lote: { id: string }, token: string) => {
      espia.retiros.push({ loteId: lote.id, token });
      return espia.resultadoRetiro;
    },
  };
});

import { DELETE } from '@/pages/api/share';

const { CLIENTE, LOTE, OPERADOR, OTRO_OPERADOR } = ids;

const usuario = (rol: 'admin' | 'operador' | 'cliente' = 'operador', id = OPERADOR) =>
  ({ id, email: 'a@x.mx', nombre: null, apellido: null, rol, clientId: rol === 'cliente' ? CLIENTE : null, activo: true });

const retirar = (cuerpo: unknown, quien = usuario()) => DELETE({
  request: new Request('http://studio.mx/api/share', { method: 'DELETE', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'Olam Dental', diasRevision: 3 };
  espia.lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_revision' };
  espia.link = { token: 'tok', documentoId: LOTE, documentoTipo: 'contenido', revocado: false };
  espia.documento = null;
  espia.retiros = [];
  espia.revocados = [];
  espia.resultadoRetiro = { retirado: true, activosRestantes: 0, detuvoElPlazo: true, estado: 'en_proceso' };
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('DELETE /api/share · enlace del mes', () => {
  it('retira el enlace por el lote y cuenta que el plazo se detuvo', async () => {
    const res = await retirar({ token: 'tok' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true, activosRestantes: 0, detuvoElPlazo: true, estadoLote: 'en_proceso',
    });
    expect(espia.retiros).toEqual([{ loteId: LOTE, token: 'tok' }]);
  });

  // Importa que la respuesta lo diga: la pantalla usa `detuvoElPlazo` para
  // decidir qué avisar al operador, y quedarse corto ahí sería justo el aviso
  // que hace falta.
  it('con otro enlace vivo, la respuesta dice que el plazo sigue', async () => {
    espia.resultadoRetiro = { retirado: true, activosRestantes: 2, detuvoElPlazo: false, estado: 'en_revision' };
    const res = await retirar({ token: 'tok' });
    expect(await res.json()).toMatchObject({ ok: true, detuvoElPlazo: false, estadoLote: 'en_revision' });
  });

  it('no pasa por la revocación genérica: el mes tiene su propio camino', async () => {
    await retirar({ token: 'tok' });
    expect(espia.revocados).toEqual([]);
  });

  it('un operador ajeno al cliente recibe 404 y no retira nada', async () => {
    espia.lote = null;
    const res = await retirar({ token: 'tok' }, usuario('operador', OTRO_OPERADOR));
    expect(res.status).toBe(404);
    expect(espia.retiros).toEqual([]);
  });

  it('un usuario cliente no retira enlaces, ni llegando a la ruta', async () => {
    const res = await retirar({ token: 'tok' }, usuario('cliente'));
    expect(res.status).toBe(404);
    expect(espia.retiros).toEqual([]);
  });

  it('un token que no existe es 404', async () => {
    espia.link = null;
    const res = await retirar({ token: 'tok' });
    expect(res.status).toBe(404);
    expect(espia.retiros).toEqual([]);
  });

  it('sin token no se toca nada', async () => {
    const res = await retirar({});
    expect(res.status).toBe(400);
    expect(espia.retiros).toEqual([]);
  });

  // Los otros tres entregables no tienen plazo que detener.
  it('un enlace de otro tipo sigue por la revocación de siempre', async () => {
    espia.link = { token: 'tok', documentoTipo: 'pilares', documentoId: LOTE, revocado: false };
    espia.documento = { id: LOTE };
    const res = await retirar({ token: 'tok' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(espia.revocados).toEqual(['tok']);
    expect(espia.retiros).toEqual([]);
  });
});
