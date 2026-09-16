import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Compartir el entregable del mes (C2): `POST /api/share` con
 * `tipo: 'contenido'`.
 *
 * Es lo que arranca el plazo de revisión, así que lo que se comprueba aquí es
 * eso: que además de crear el enlace se estampe el plazo en el lote, que el
 * permiso se resuelva por el LOTE y no por una fila de resultados, y que no se
 * le aplique la regla de «solo documentos aprobados», que en esta etapa haría
 * imposible compartir ningún mes.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  OTRO_OPERADOR: '00000000-0000-4000-8000-000000000002',
}));

const espia = vi.hoisted(() => ({
  lote: null as Record<string, unknown> | null,
  cliente: null as Record<string, unknown> | null,
  compartidos: [] as { loteId: string; dias: number | null }[],
  creados: [] as { documentoId: string; tipo: string }[],
  permisosPedidos: [] as unknown[],
  documentosPedidos: [] as unknown[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const c = { from: () => c, where: () => c, limit: async () => [] };
  return { ...real, db: { select: () => c, insert: () => ({ values: async () => {} }), update: () => ({ set: () => ({ where: async () => {} }) }) } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return {
    ...real,
    loteVisible: async () => (espia.lote ? { lote: espia.lote, cliente: espia.cliente } : null),
    documentoVisible: async (...args: unknown[]) => { espia.documentosPedidos.push(args); return null; },
  };
});

vi.mock('@/lib/share', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/share')>();
  return {
    ...real,
    crearShareLink: async (documentoId: string, tipo: string) => {
      espia.creados.push({ documentoId, tipo });
      return 'token-nuevo';
    },
  };
});

vi.mock('@/flujo/servicio', () => ({
  permisoCompartir: async (...args: unknown[]) => {
    espia.permisosPedidos.push(args);
    return { ok: false, razon: 'Solo se pueden compartir documentos aprobados' };
  },
}));

vi.mock('@/contenido/servicio', async (importarReal) => {
  const real = await importarReal<typeof import('@/contenido/servicio')>();
  return {
    ...real,
    compartirLote: async (lote: { id: string }, dias: number | null) => {
      espia.compartidos.push({ loteId: lote.id, dias });
      return {
        estado: 'en_revision',
        compartidoEn: new Date('2026-09-16T18:00:00.000Z'),
        limiteRevision: new Date('2026-09-19T05:59:59.999Z'),
        arrancoElPlazo: true,
      };
    },
  };
});

import { POST } from '@/pages/api/share';

const { CLIENTE, LOTE, OPERADOR, OTRO_OPERADOR } = ids;

const usuario = (rol: 'admin' | 'operador' | 'cliente' = 'operador', id = OPERADOR) =>
  ({ id, email: 'a@x.mx', nombre: null, apellido: null, rol, clientId: rol === 'cliente' ? CLIENTE : null, activo: true });

const compartir = (cuerpo: unknown, quien = usuario()) => POST({
  request: new Request('http://studio.mx/api/share', { method: 'POST', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'Olam Dental', diasRevision: 3 };
  espia.lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_proceso', compartidoEn: null, limiteRevision: null };
  espia.compartidos = [];
  espia.creados = [];
  espia.permisosPedidos = [];
  espia.documentosPedidos = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('POST /api/share · tipo contenido', () => {
  it('crea el enlace del lote y le estampa el plazo', async () => {
    const res = await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(res.status).toBe(201);

    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({
      ok: true,
      token: 'token-nuevo',
      url: 'http://studio.mx/p/olam-dental/token-nuevo',
      estadoLote: 'en_revision',
      arrancoElPlazo: true,
    });
    expect(cuerpo.limiteRevision).toBe('2026-09-19T05:59:59.999Z');
    expect(espia.creados).toEqual([{ documentoId: LOTE, tipo: 'contenido' }]);
  });

  it('el plazo se calcula con los días de revisión del cliente', async () => {
    await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(espia.compartidos).toEqual([{ loteId: LOTE, dias: 3 }]);
  });

  it('el cliente sin días propios los pasa nulos: los pone el servicio', async () => {
    espia.cliente = { ...espia.cliente, diasRevision: null };
    await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(espia.compartidos).toEqual([{ loteId: LOTE, dias: null }]);
  });

  // El punto que justifica la rama entera: `permisoCompartir` exige la etapa
  // aprobada, y compartir es justo lo que manda el mes a revisión.
  it('no le aplica la regla de «solo documentos aprobados»', async () => {
    const res = await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(res.status).toBe(201);
    expect(espia.permisosPedidos).toEqual([]);
  });

  it('resuelve el permiso por el lote, no por una fila de resultados', async () => {
    await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(espia.documentosPedidos).toEqual([]);
  });

  it('un lote que no existe es 404 y no crea ningún enlace', async () => {
    espia.lote = null;
    const res = await compartir({ resultId: LOTE, tipo: 'contenido' });
    expect(res.status).toBe(404);
    expect(espia.creados).toEqual([]);
    expect(espia.compartidos).toEqual([]);
  });

  it('un operador ajeno al cliente también recibe 404', async () => {
    const res = await compartir({ resultId: LOTE, tipo: 'contenido' }, usuario('operador', OTRO_OPERADOR));
    expect(res.status).toBe(404);
    expect(espia.creados).toEqual([]);
  });

  it('un usuario cliente no comparte nada, ni llegando a la ruta', async () => {
    const res = await compartir({ resultId: LOTE, tipo: 'contenido' }, usuario('cliente'));
    expect(res.status).toBe(404);
    expect(espia.compartidos).toEqual([]);
  });

  it('sin resultId no se toca el lote', async () => {
    const res = await compartir({ tipo: 'contenido' });
    expect(res.status).toBe(400);
    expect(espia.compartidos).toEqual([]);
  });

  // Los otros tres tipos siguen pasando por donde siempre.
  it('un tipo distinto sigue yendo por documentoVisible y permisoCompartir', async () => {
    const res = await compartir({ resultId: LOTE, tipo: 'pilares' });
    expect(res.status).toBe(404);
    expect(espia.documentosPedidos).toHaveLength(1);
    expect(espia.compartidos).toEqual([]);
  });
});
