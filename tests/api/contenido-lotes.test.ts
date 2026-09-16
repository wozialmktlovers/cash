import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * `POST /api/contenido/lotes` (B1): abrir el lote del mes.
 *
 * Mismo patrón que `tests/api/usuarios-datos.test.ts`: sin `DATABASE_URL`, así
 * que cualquier consulta que no esté simulada revienta en vez de pasar de
 * largo. Lo que se prueba son las decisiones de la ruta —a quién deja entrar,
 * qué valida antes de escribir y cómo traduce el error de la base a un 409—,
 * no Drizzle.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
}));

const espia = vi.hoisted(() => ({
  cliente: null as Record<string, unknown> | null,
  etapas: [] as Record<string, unknown>[],
  investigaciones: [] as Record<string, unknown>[],
  fallo: null as unknown,
  insertado: undefined as Record<string, unknown> | undefined,
  sincronizados: [] as string[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const lectura = { from: () => lectura, where: async () => espia.investigaciones };
  const alta = {
    values(fila: Record<string, unknown>) {
      espia.insertado = fila;
      return alta;
    },
    async returning() {
      if (espia.fallo) throw espia.fallo;
      const pedido = (espia.insertado ?? {}) as { periodo?: string };
      return [{ id: ids.LOTE, clientId: ids.CLIENTE, periodo: pedido.periodo, estado: 'en_proceso', compartidoEn: null, limiteRevision: null, creadoEn: new Date(0) }];
    },
  };
  return { ...real, db: { select: () => lectura, transaction: async (fn: (tx: unknown) => unknown) => fn({ insert: () => alta }) } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return { ...real, clienteOperable: async () => espia.cliente };
});

vi.mock('@/flujo/servicio', async (importarReal) => {
  const real = await importarReal<typeof import('@/flujo/servicio')>();
  return { ...real, etapasDelCliente: async () => espia.etapas };
});

vi.mock('@/contenido/servicio', async (importarReal) => {
  const real = await importarReal<typeof import('@/contenido/servicio')>();
  return {
    ...real,
    sincronizarEtapa: async (clientId: string) => {
      espia.sincronizados.push(clientId);
      return 'en_proceso';
    },
  };
});

import { POST } from '@/pages/api/contenido/lotes/index';

const { CLIENTE, OPERADOR } = ids;

const usuario = (rol: 'admin' | 'operador' | 'cliente' = 'admin', id = OPERADOR) =>
  ({ id, email: 'a@x.mx', nombre: null, apellido: null, rol, clientId: null, activo: true });

const etapa = (extra: Record<string, unknown> = {}) => ({
  etapa: 'desarrollo_mensual', contratada: true, interna: false, estado: 'no_iniciada', ...extra,
});

const llamar = (cuerpo: unknown, quien = usuario()) => POST({
  request: new Request('http://x/api/contenido/lotes', { method: 'POST', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'OLAM', paquete: { post: 8, historia: 6 }, diasRevision: null };
  espia.etapas = [etapa()];
  // Una investigación con datos: `contarEtapasConDatos` cuenta las etapas del
  // JSON que salieron `ok`, así que basta con una.
  espia.investigaciones = [{ datos: { mercado: { estado: 'ok' } }, version: 1 }];
  espia.fallo = null;
  espia.insertado = undefined;
  espia.sincronizados = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

/** Lo que lanza postgres.js, envuelto por Drizzle, al romperse una restricción única. */
const choqueDeUnicidad = (restriccion: string) =>
  Object.assign(new Error('Failed query: insert into "contenido_lotes" ...'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint_name: restriccion }),
  });

describe('POST /api/contenido/lotes', () => {
  it('abre el mes y devuelve el paquete heredado del cliente', async () => {
    const res = await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(res.status).toBe(201);
    const cuerpo = await res.json();
    expect(cuerpo.lote.periodo).toBe('2026-09');
    expect(cuerpo.lote.estado).toBe('en_proceso');
    // El paquete NO se copia al lote: A1 lo dejó en el cliente y el lote lo
    // lee de ahí. La respuesta lo devuelve ya resuelto, con los 2 días por
    // omisión en lugar del nulo de la columna.
    expect(cuerpo.paquete).toEqual({ post: 8, historia: 6 });
    expect(cuerpo.diasRevision).toBe(2);
    expect(espia.insertado).toMatchObject({ clientId: CLIENTE, periodo: '2026-09', creadoPor: OPERADOR });
  });

  it('deja la etapa al día en la misma transacción', async () => {
    await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(espia.sincronizados).toEqual([CLIENTE]);
  });

  it('un cliente con días propios los conserva', async () => {
    espia.cliente = { ...espia.cliente, diasRevision: 5 };
    const cuerpo = await (await llamar({ clientId: CLIENTE, periodo: '2026-09' })).json();
    expect(cuerpo.diasRevision).toBe(5);
  });

  it('el cuerpo que no es JSON se rechaza', async () => {
    const res = await POST({
      request: new Request('http://x/api/contenido/lotes', { method: 'POST', body: 'no soy json' }),
      locals: { usuario: usuario() },
    } as any);
    expect(res.status).toBe(400);
    expect(espia.insertado).toBeUndefined();
  });

  it('sin cliente o sin periodo, 400', async () => {
    expect((await llamar({ periodo: '2026-09' })).status).toBe(400);
    expect((await llamar({ clientId: CLIENTE })).status).toBe(400);
    expect(espia.insertado).toBeUndefined();
  });

  it('un periodo que no es AAAA-MM se rechaza con 400', async () => {
    for (const periodo of ['2026-9', '2026-13', 'septiembre', '2026-09-01', '2026-00']) {
      const res = await llamar({ clientId: CLIENTE, periodo });
      expect(res.status, periodo).toBe(400);
    }
    expect(espia.insertado).toBeUndefined();
  });

  it('un cliente que no se opera responde 404, no 403', async () => {
    espia.cliente = null;
    const res = await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(res.status).toBe(404);
    expect(espia.insertado).toBeUndefined();
  });

  it('la etapa sin contratar es 409', async () => {
    espia.etapas = [etapa({ contratada: false, interna: false })];
    const res = await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('no está contratada');
  });

  it('una etapa interna sí deja abrir el mes', async () => {
    espia.etapas = [etapa({ contratada: false, interna: true })];
    expect((await llamar({ clientId: CLIENTE, periodo: '2026-09' })).status).toBe(201);
  });

  it('sin investigación con datos, 409', async () => {
    espia.investigaciones = [];
    const res = await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('investigación');
  });

  // Lo contrario de `puedeGenerar`, y a propósito (diseño §2): la etapa
  // refleja el lote ACTIVO, así que un cliente con septiembre aprobado tiene
  // la etapa `aprobada` y abrir octubre es exactamente lo que toca.
  it('la etapa aprobada o en revisión no impide abrir el mes siguiente', async () => {
    for (const estado of ['aprobada', 'en_revision'] as const) {
      espia.etapas = [etapa({ estado })];
      expect((await llamar({ clientId: CLIENTE, periodo: '2026-10' })).status, estado).toBe(201);
    }
  });

  it('el mes repetido se reconoce por la restricción única, con 409', async () => {
    espia.fallo = choqueDeUnicidad('contenido_lotes_client_id_periodo');
    const res = await llamar({ clientId: CLIENTE, periodo: '2026-09' });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('2026-09');
  });

  it('otra violación de unicidad no se disfraza de mes repetido', async () => {
    espia.fallo = choqueDeUnicidad('otra_restriccion');
    await expect(llamar({ clientId: CLIENTE, periodo: '2026-09' })).rejects.toThrow();
  });

  it('cualquier otro error se relanza', async () => {
    espia.fallo = new Error('se cayó la conexión');
    await expect(llamar({ clientId: CLIENTE, periodo: '2026-09' })).rejects.toThrow('se cayó la conexión');
  });
});
