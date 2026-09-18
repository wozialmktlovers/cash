import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * POST /api/contenido/lotes/[id]/generar — lanzar la generación del mes con IA.
 *
 * Se simula `@/db` con el patrón de `contenido-propuestas.test.ts`: cualquier
 * consulta no prevista revienta. La ruta no llama al modelo (solo encola el
 * job), y aquí se comprueba quién puede, qué pide antes y qué deja en la cola.
 */
const espia = vi.hoisted(() => ({
  lotes: [] as unknown[],
  mapas: [] as unknown[],
  piezas: [] as unknown[],
  jobs: [] as unknown[],
  insertados: [] as any[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const datosDe = (tabla: unknown) => {
    if (tabla === real.contenidoLotes) return espia.lotes;
    if (tabla === real.pilaresResults) return espia.mapas;
    if (tabla === real.contenidoPiezas) return espia.piezas;
    if (tabla === real.researchJobs) return espia.jobs;
    throw new Error('Consulta no prevista en la prueba');
  };
  const lectura = () => {
    let tabla: unknown;
    const b: Record<string, unknown> = {
      from(t: unknown) { tabla = t; return b; },
      innerJoin() { return b; },
      where() { return b; },
      orderBy() { return b; },
      limit: async () => datosDe(tabla),
      then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve().then(() => datosDe(tabla)).then(ok, mal),
    };
    return b;
  };
  return {
    ...real,
    db: {
      select: () => lectura(),
      insert: (tabla: unknown) => ({
        values: (v: any) => ({
          returning: async () => {
            if (tabla !== real.researchJobs) throw new Error('Alta no prevista');
            espia.insertados.push(v);
            return [{ id: 'job-nuevo' }];
          },
        }),
      }),
    },
  };
});

import { POST } from '@/pages/api/contenido/lotes/[id]/generar';
import { mapaFalso } from '../fixtures/pilares';

const LOTE = '00000000-0000-4000-8000-0000000000b1';
const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const OPERADOR = '00000000-0000-4000-8000-0000000000e1';

const admin = { id: '00000000-0000-4000-8000-0000000000a9', email: 'a@x.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const operador = { id: OPERADOR, email: 'o@x.mx', nombre: 'Ope', apellido: null, rol: 'operador' as const, clientId: null, activo: true };
const operadorAjeno = { ...operador, id: '00000000-0000-4000-8000-0000000000e9' };
const usuarioCliente = { id: '00000000-0000-4000-8000-0000000000f1', email: 'c@x.mx', nombre: null, apellido: null, rol: 'cliente' as const, clientId: CLIENTE, activo: true };

const cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'Negocio de prueba', paquete: { post: 2, reel: 1 } };
const lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-10', estado: 'en_proceso' };
const pieza = (id: string, extra: Record<string, unknown> = {}) => ({ id, numero: 1, formato: 'post', estadoCliente: 'pendiente', arte: [], fechaPublicacion: null, temaId: null, ...extra });

const llamar = (cuerpo?: unknown, usuario: unknown = operador) => POST({
  params: { id: LOTE },
  request: new Request(`http://x/api/contenido/lotes/${LOTE}/generar`, {
    method: 'POST',
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  }),
  locals: { usuario },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.lotes = [{ lote: { ...lote }, cliente: { ...cliente } }];
  espia.mapas = [{ datos: mapaFalso() }];
  espia.piezas = [];
  espia.jobs = [];
  espia.insertados = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('permisos', () => {
  it('el admin lanza', async () => {
    const r = await llamar(undefined, admin);
    expect(r.status).toBe(201);
    expect(espia.insertados[0].creadoPor).toBe(admin.id);
  });

  it('el operador asignado lanza', async () => {
    const r = await llamar();
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ ok: true, id: 'job-nuevo', piezas: 3 });
  });

  it('un operador ajeno recibe 404 y no encola nada', async () => {
    const r = await llamar(undefined, operadorAjeno);
    expect(r.status).toBe(404);
    expect(espia.insertados).toHaveLength(0);
  });

  it('el usuario cliente recibe 404 y no encola nada', async () => {
    const r = await llamar(undefined, usuarioCliente);
    expect(r.status).toBe(404);
    expect(espia.insertados).toHaveLength(0);
  });
});

describe('lo que pide antes de lanzar', () => {
  it('sin paquete, pide definirlo y manda a la ficha', async () => {
    espia.lotes = [{ lote, cliente: { ...cliente, paquete: null } }];
    const r = await llamar();
    expect(r.status).toBe(409);
    const cuerpo = await r.json();
    expect(cuerpo.errores[0]).toMatch(/paquete/i);
    expect(cuerpo.enlace).toBe(`/clientes/${CLIENTE}#paquete`);
    expect(espia.insertados).toHaveLength(0);
  });

  it('un paquete en ceros cuenta como sin paquete', async () => {
    espia.lotes = [{ lote, cliente: { ...cliente, paquete: { post: 0 } } }];
    expect((await llamar()).status).toBe(409);
  });

  it('sin mapa de pilares no hay de dónde generar', async () => {
    espia.mapas = [];
    const r = await llamar();
    expect(r.status).toBe(409);
    expect((await r.json()).errores[0]).toMatch(/mapa de pilares/);
  });

  it('solo un mes en proceso', async () => {
    espia.lotes = [{ lote: { ...lote, estado: 'en_revision' }, cliente }];
    expect((await llamar()).status).toBe(409);
  });

  it('con piezas, hay que elegir completar o reemplazar', async () => {
    espia.piezas = [pieza('p1')];
    const r = await llamar({});
    expect(r.status).toBe(400);
    expect((await r.json()).errores[0]).toMatch(/completar|reemplazar/);
  });

  it('un cliente con otro trabajo en curso no lanza un segundo', async () => {
    espia.jobs = [{ id: 'job-viejo' }];
    const r = await llamar();
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, jobId: 'job-viejo' });
  });

  it('si el mes ya cuadra, no hay nada que generar', async () => {
    espia.piezas = [pieza('p1'), pieza('p2'), pieza('r1', { formato: 'reel' })];
    const r = await llamar({ modo: 'completar' });
    expect(r.status).toBe(409);
  });
});

describe('lo que deja en la cola', () => {
  it('completar: un job `contenido` con el lote y el mes, sin nada que borrar', async () => {
    espia.piezas = [pieza('p1', { estadoCliente: 'aprobada' })];
    const r = await llamar({ modo: 'completar' });
    expect(r.status).toBe(201);
    expect(espia.insertados[0]).toMatchObject({
      clientId: CLIENTE, tipo: 'contenido', estado: 'encolado',
      parametros: { loteId: LOTE, periodo: '2026-10', modo: 'completar', incluirConArte: false, planeadas: [] },
    });
    expect((await r.json()).piezas).toBe(2);
  });

  it('reemplazar: solo planea borrar las sin revisar, y las con arte solo si se confirma', async () => {
    espia.piezas = [
      pieza('aprobada', { estadoCliente: 'aprobada' }),
      pieza('cambios', { estadoCliente: 'cambios' }),
      pieza('conArte', { arte: [{ tipo: 'imagen', fileId: 'f' }] }),
      pieza('libre', { formato: 'reel' }),
    ];
    await llamar({ modo: 'reemplazar' });
    expect(espia.insertados[0].parametros).toMatchObject({ modo: 'reemplazar', incluirConArte: false, planeadas: ['libre'] });

    espia.insertados = [];
    await llamar({ modo: 'reemplazar', incluirConArte: true });
    expect(espia.insertados[0].parametros.planeadas.sort()).toEqual(['conArte', 'libre']);
  });

  it('`incluirConArte` no significa nada al completar', async () => {
    espia.piezas = [pieza('conArte', { arte: [{ tipo: 'imagen', fileId: 'f' }] })];
    await llamar({ modo: 'completar', incluirConArte: true });
    expect(espia.insertados[0].parametros).toMatchObject({ modo: 'completar', incluirConArte: false, planeadas: [] });
  });
});
