import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * «Objetivos y líneas de investigación» en el alta (POST /api/clientes) y en
 * la edición (PATCH /api/clientes/[id]). Base simulada: se anota lo que se
 * inserta y lo que se actualiza; cualquier otra consulta revienta.
 */
const espia = vi.hoisted(() => ({
  clientes: [] as unknown[],
  inserts: [] as unknown[],
  sets: [] as unknown[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const insertar = (t: unknown) => {
    if (t !== real.clients) throw new Error('Inserción no prevista');
    return { values: (v: unknown) => { espia.inserts.push(v); return { returning: async () => [{ id: '00000000-0000-4000-8000-0000000000c2' }] }; } };
  };
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
        return { set: (v: unknown) => { espia.sets.push(v); return { where: () => ({ returning: async () => [{ id: CLIENTE }] }) }; } };
      },
      transaction: async (fn: (tx: unknown) => unknown) => fn({ insert: insertar }),
    },
  };
});

// La contratación de etapas no es asunto de esta prueba.
vi.mock('@/flujo/servicio', () => ({ aplicarPlanContratacion: async () => {} }));

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const OPERADOR = '00000000-0000-4000-8000-0000000000e1';
const operador = { id: OPERADOR, email: 'o@x.mx', nombre: null, apellido: null, rol: 'operador' as const, clientId: null, activo: true };

import { POST } from '@/pages/api/clientes/index';
import { PATCH } from '@/pages/api/clientes/[id]';

const pedir = (metodo: 'POST' | 'PATCH', cuerpo: unknown, usuario: unknown = operador) => {
  const request = new Request('http://x/api/clientes', { method: metodo, body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } });
  const ctx = { params: { id: CLIENTE }, request, locals: { usuario } } as any;
  return metodo === 'POST' ? POST(ctx) : PATCH(ctx);
};

const DATOS = { nombre: 'Panadería de Ejemplo', giro: 'Panadería', producto: 'Pan de masa madre' };
const OBJETIVOS = 'Quiere abrir sucursal en Monterrey.\nNo considerar a Pan Ejemplo como competidor.';

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.clientes = [{ id: CLIENTE, operadorId: OPERADOR }];
  espia.inserts = [];
  espia.sets = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('alta con objetivos', () => {
  it('los guarda recortados', async () => {
    const r = await pedir('POST', { ...DATOS, objetivos: `  ${OBJETIVOS}\n ` });
    expect(r.status).toBe(201);
    expect(espia.inserts[0]).toMatchObject({ objetivos: OBJETIVOS, operadorId: OPERADOR });
  });

  it('vacío se guarda como null', async () => {
    await pedir('POST', { ...DATOS, objetivos: '' });
    expect(espia.inserts[0]).toMatchObject({ objetivos: null });
  });

  it('más de 2000 caracteres: 400 y no se inserta nada', async () => {
    const r = await pedir('POST', { ...DATOS, objetivos: 'a'.repeat(2001) });
    expect(r.status).toBe(400);
    expect((await r.json()).errores.join(' ')).toContain('objetivos');
    expect(espia.inserts).toHaveLength(0);
  });
});

describe('edición con objetivos', () => {
  it('el operador asignado los guarda', async () => {
    const r = await pedir('PATCH', { ...DATOS, objetivos: OBJETIVOS });
    expect(r.status).toBe(200);
    expect(espia.sets[0]).toMatchObject({ objetivos: OBJETIVOS });
  });

  it('vaciar el campo los borra', async () => {
    await pedir('PATCH', { ...DATOS, objetivos: '   ' });
    expect(espia.sets[0]).toMatchObject({ objetivos: null });
  });

  it('si el cuerpo no los trae, no se tocan', async () => {
    await pedir('PATCH', DATOS);
    expect(espia.sets[0]).not.toHaveProperty('objetivos');
  });

  it('más de 2000 caracteres: 400 y no se escribe', async () => {
    const r = await pedir('PATCH', { ...DATOS, objetivos: 'a'.repeat(2001) });
    expect(r.status).toBe(400);
    expect(espia.sets).toHaveLength(0);
  });

  it('mismo permiso que el resto de Datos: un operador ajeno recibe 404 y no escribe', async () => {
    const ajeno = { ...operador, id: '00000000-0000-4000-8000-0000000000e9' };
    const r = await pedir('PATCH', { ...DATOS, objetivos: OBJETIVOS }, ajeno);
    expect(r.status).toBe(404);
    expect(espia.sets).toHaveLength(0);
  });
});
