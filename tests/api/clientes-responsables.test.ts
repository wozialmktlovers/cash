import { describe, it, expect, vi, beforeEach } from 'vitest';

/** `PUT /api/clientes/[id]/responsables`: solo el admin asigna, por etapa y por puesto. */
const CLIENTE = '11111111-1111-4111-8111-111111111111';
const ETAPA = '22222222-2222-4222-8222-222222222222';
const USUARIO = '33333333-3333-4333-8333-333333333333';

const espia = vi.hoisted(() => ({
  etapa: null as Record<string, unknown> | null,
  actual: null as { usuarioId: string } | null,
  asignaciones: [] as Record<string, unknown>[],
  resultado: { ok: true } as { ok: boolean; razon?: string },
  avisos: [] as Record<string, unknown>[],
  llamadasSelect: 0,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  return {
    ...real,
    db: {
      select: () => {
        const n = espia.llamadasSelect++;
        // 1.ª consulta: la etapa del cliente; 2.ª: el responsable actual del puesto.
        const filas = n % 2 === 0 ? (espia.etapa ? [espia.etapa] : []) : (espia.actual ? [espia.actual] : []);
        return { from: () => ({ where: () => ({ limit: () => Promise.resolve(filas) }) }) };
      },
    },
  };
});
vi.mock('@/lib/visibilidad', async (importarReal) => ({
  ...(await importarReal<typeof import('@/lib/visibilidad')>()),
  clienteVisible: vi.fn(async () => ({ id: CLIENTE, nombre: 'Ana Villa' })),
}));
vi.mock('@/flujo/responsables', () => ({
  asignarResponsable: vi.fn(async (o: Record<string, unknown>) => { espia.asignaciones.push(o); return espia.resultado; }),
}));
vi.mock('@/flujo/avisos', () => ({
  avisarAsignacionResponsable: vi.fn(async (o: Record<string, unknown>) => { espia.avisos.push(o); }),
}));

const { PUT } = await import('@/pages/api/clientes/[id]/responsables');

const admin = { id: 'admin-1', rol: 'admin', activo: true, email: 'a@x.mx', nombre: 'A', apellido: null, clientId: null };
const operador = { ...admin, id: 'op-1', rol: 'operador' };

const llamar = (cuerpo: unknown, usuario: unknown = admin) => PUT({
  params: { id: CLIENTE },
  request: new Request('http://x/api', { method: 'PUT', body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  locals: { usuario },
} as never);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  espia.etapa = { id: ETAPA, clientId: CLIENTE, etapa: 'pilares' };
  espia.actual = null; espia.asignaciones = []; espia.avisos = []; espia.resultado = { ok: true }; espia.llamadasSelect = 0;
});

describe('PUT /api/clientes/[id]/responsables', () => {
  it('solo el admin asigna: un operador recibe 403 y no se asigna nada', async () => {
    const r = await llamar({ etapaId: ETAPA, puesto: 'content_creator', usuarioId: USUARIO }, operador);
    expect(r.status).toBe(403);
    expect(espia.asignaciones).toEqual([]);
  });

  it('asigna, dice quién asignó y avisa al nuevo responsable', async () => {
    const r = await llamar({ etapaId: ETAPA, puesto: 'content_creator', usuarioId: USUARIO });
    expect(r.status).toBe(200);
    expect(espia.asignaciones).toEqual([{ etapaId: ETAPA, etapa: 'pilares', puesto: 'content_creator', usuarioId: USUARIO, asignadoPor: 'admin-1' }]);
    await flush();
    expect(espia.avisos).toMatchObject([{ nuevoResponsableId: USUARIO, cliente: 'Ana Villa', etapa: 'Mapa de pilares' }]);
  });

  it('elegir al que ya estaba no asigna ni avisa de nuevo', async () => {
    espia.actual = { usuarioId: USUARIO };
    const r = await llamar({ etapaId: ETAPA, puesto: 'content_creator', usuarioId: USUARIO });
    expect(r.status).toBe(200);
    expect(espia.asignaciones).toEqual([]);
    await flush();
    expect(espia.avisos).toEqual([]);
  });

  it('quitar (usuarioId null) no avisa a nadie', async () => {
    espia.actual = { usuarioId: USUARIO };
    const r = await llamar({ etapaId: ETAPA, puesto: 'content_creator', usuarioId: null });
    expect(r.status).toBe(200);
    expect(espia.asignaciones).toHaveLength(1);
    await flush();
    expect(espia.avisos).toEqual([]);
  });

  it('un puesto o una persona que no corresponden a la etapa vuelven 400 con la razón', async () => {
    espia.resultado = { ok: false, razon: 'strategist no responde por esta etapa' };
    const r = await llamar({ etapaId: ETAPA, puesto: 'strategist', usuarioId: USUARIO });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('asignacion-invalida');
    await flush();
    expect(espia.avisos).toEqual([]);
  });

  it('cuerpo inválido: 400 antes de tocar nada; etapa de otro cliente: 404', async () => {
    expect((await llamar({ etapaId: 'no-uuid', puesto: 'contenido', usuarioId: null })).status).toBe(400);
    expect((await llamar({ etapaId: ETAPA, puesto: 'operador', usuarioId: null })).status).toBe(400);
    expect((await llamar({ etapaId: ETAPA, puesto: 'contenido', usuarioId: 'x' })).status).toBe(400);
    espia.etapa = null;
    expect((await llamar({ etapaId: ETAPA, puesto: 'contenido', usuarioId: null })).status).toBe(404);
    expect(espia.asignaciones).toEqual([]);
  });
});
