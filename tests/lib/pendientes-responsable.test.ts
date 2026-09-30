import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

/**
 * «Te toca a ti» por ASIGNACIÓN DE ETAPA, no por cliente (rediseño de puestos):
 * lo que cuenta de un operador son las etapas donde él está en
 * `etapa_responsables`, de cualquier cliente. Sin base de datos: un doble de
 * Drizzle anota las consultas y aquí se compila su SQL.
 */
const llamadas = vi.hoisted(() => ({ lista: [] as { metodo: string; args: unknown[] }[], execute: [] as unknown[] }));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const cadena = (filas: unknown[] = []): unknown => new Proxy({}, {
    get(_t, prop) {
      if (prop === 'then') return (ok: (v: unknown) => unknown) => Promise.resolve(filas).then(ok);
      return (...args: unknown[]) => { llamadas.lista.push({ metodo: String(prop), args }); return cadena(filas); };
    },
  });
  return {
    ...real,
    db: {
      // Los `count(*)` se reconocen por su columna `n`.
      select: (cols?: Record<string, unknown>) => cadena(cols && 'n' in cols ? [{ n: 0 }] : []),
      execute: async (q: unknown) => { llamadas.execute.push(q); return [{ n: 0 }]; },
    },
  };
});

const { contarPendientes, listarPendientes } = await import('@/lib/pendientes');

const compilar = (x: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(x);
const operador = (id: string) => ({ id, email: `${id}@x.mx`, nombre: id, apellido: null, rol: 'operador' as const, clientId: null, activo: true });

beforeEach(() => { llamadas.lista.length = 0; llamadas.execute.length = 0; });

describe('contarPendientes (operador)', () => {
  it('cuenta por etapa_responsables del usuario, no por clients.operador_id', async () => {
    await contarPendientes(operador('ana'));
    const { sql, params } = compilar(llamadas.execute[0] as never);
    expect(sql).toContain('"etapa_responsables"');
    expect(sql).not.toContain('operador_id');
    // El id del usuario viaja como parámetro en las dos subconsultas.
    expect(params.filter((p) => p === 'ana')).toHaveLength(2);
  });
});

describe('listarPendientes (operador)', () => {
  it('une contra etapa_responsables y filtra por el usuario: el mismo criterio que el contador', async () => {
    await listarPendientes(operador('beto'), { incluirEsperandoCliente: true });
    const uniones = llamadas.lista.filter((l) => l.metodo === 'innerJoin').map((l) => compilar(l.args[1] as never).sql + ' ' + (l.args[0] as { _: { name?: string } })?._?.name);
    expect(uniones.some((u) => u.includes('etapa_responsables'))).toBe(true);
    const condiciones = llamadas.lista.filter((l) => l.metodo === 'where').map((l) => compilar(l.args[0] as never));
    expect(condiciones.length).toBeGreaterThan(0);
    for (const c of condiciones) {
      expect(c.sql).toContain('"usuario_id"');
      expect(c.params).toContain('beto');
    }
  });

  it('dos operadores distintos quedan con filtros distintos: no hay «sus clientes»', async () => {
    await listarPendientes(operador('ana'));
    const deAna = llamadas.lista.filter((l) => l.metodo === 'where').map((l) => compilar(l.args[0] as never).params);
    llamadas.lista.length = 0;
    await listarPendientes(operador('beto'));
    const deBeto = llamadas.lista.filter((l) => l.metodo === 'where').map((l) => compilar(l.args[0] as never).params);
    expect(deAna.flat()).toContain('ana');
    expect(deAna.flat()).not.toContain('beto');
    expect(deBeto.flat()).toContain('beto');
  });
});

describe('listarPendientes (admin)', () => {
  it('sigue viendo todo lo que está en revisión: sin filtro por usuario, con el responsable de la etapa', async () => {
    await listarPendientes({ ...operador('root'), rol: 'admin' });
    const joins = llamadas.lista.filter((l) => l.metodo === 'leftJoin').map((l) => compilar(l.args[1] as never).sql);
    expect(joins.some((j) => j.includes('"etapa_responsables"'))).toBe(true);
    const condiciones = llamadas.lista.filter((l) => l.metodo === 'where').map((l) => compilar(l.args[0] as never).params);
    expect(condiciones.flat()).not.toContain('root');
  });
});
