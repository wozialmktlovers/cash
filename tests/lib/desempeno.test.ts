import { describe, it, expect } from 'vitest';
import {
  periodo,
  diasEntre,
  resumenEstadistico,
  filtrarPeriodo,
  tiemposPorEtapa,
  calidad,
  carga,
  costo,
  type Evento,
  type ComentarioM,
  type JobM,
  type EtapaM,
} from '@/lib/desempeno';

// Fábricas con valores por omisión razonables, siguiendo el patrón de tests/flujo/reglas.test.ts.
const ev = (overrides: Partial<Evento> = {}): Evento => ({
  etapaId: 'e1',
  clientId: 'c1',
  etapa: 'investigacion',
  accion: 'iniciar',
  de: null,
  a: 'en_proceso',
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const com = (overrides: Partial<ComentarioM> = {}): ComentarioM => ({
  etapaId: 'e1',
  autorRol: 'admin',
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const job = (overrides: Partial<JobM> = {}): JobM => ({
  clientId: 'c1',
  tipo: 'research',
  costoUsd: 1,
  creadoPor: null,
  creadoEn: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const etm = (overrides: Partial<EtapaM> = {}): EtapaM => ({
  id: 'e1',
  clientId: 'c1',
  etapa: 'investigacion',
  estado: 'no_iniciada',
  contratada: true,
  interna: false,
  operadorId: null,
  ...overrides,
});

describe('periodo', () => {
  it('"mes": desde es el día 1 del mes actual a medianoche CDMX, hasta es ahora', () => {
    const ahora = new Date('2026-09-15T18:00:00Z');
    const p = periodo('mes', ahora);
    // 1 de septiembre 00:00 CDMX (UTC-6) = 06:00 UTC.
    expect(p.desde?.toISOString()).toBe('2026-09-01T06:00:00.000Z');
    expect(p.hasta).toEqual(ahora);
  });

  it('"mes": en el borde UTC/CDMX, usa el mes local (aún no cruzó a medianoche en CDMX)', () => {
    // 2026-10-01T03:00Z son las 21:00 del 30 de septiembre en CDMX: el mes local sigue siendo septiembre.
    const ahora = new Date('2026-10-01T03:00:00Z');
    const p = periodo('mes', ahora);
    expect(p.desde?.toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });

  it('"mes_anterior": desde el 1 del mes previo, hasta el 1 del mes actual (exclusivo)', () => {
    const ahora = new Date('2026-09-15T18:00:00Z');
    const p = periodo('mes_anterior', ahora);
    expect(p.desde?.toISOString()).toBe('2026-08-01T06:00:00.000Z');
    expect(p.hasta.toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });

  it('"mes_anterior" en enero retrocede al diciembre del año anterior', () => {
    const ahora = new Date('2026-01-10T18:00:00Z');
    const p = periodo('mes_anterior', ahora);
    expect(p.desde?.toISOString()).toBe('2025-12-01T06:00:00.000Z');
    expect(p.hasta.toISOString()).toBe('2026-01-01T06:00:00.000Z');
  });

  it('"90": desde es ahora menos 90 días, hasta es ahora', () => {
    const ahora = new Date('2026-09-15T18:00:00Z');
    const p = periodo('90', ahora);
    expect(p.desde?.toISOString()).toBe('2026-06-17T18:00:00.000Z');
    expect(p.hasta).toEqual(ahora);
  });

  it('"todo": desde es null, hasta es ahora', () => {
    const ahora = new Date('2026-09-15T18:00:00Z');
    const p = periodo('todo', ahora);
    expect(p.desde).toBeNull();
    expect(p.hasta).toEqual(ahora);
  });
});

describe('diasEntre', () => {
  it('calcula días con un decimal', () => {
    const a = new Date('2026-01-01T00:00:00Z');
    const b = new Date('2026-01-03T12:00:00Z');
    expect(diasEntre(a, b)).toBe(2.5);
  });

  it('nunca es negativo (se recorta a 0 si b es anterior a a)', () => {
    const a = new Date('2026-01-03T00:00:00Z');
    const b = new Date('2026-01-01T00:00:00Z');
    expect(diasEntre(a, b)).toBe(0);
  });
});

describe('resumenEstadistico', () => {
  it('lista vacía devuelve nulls con n 0', () => {
    expect(resumenEstadistico([])).toEqual({ promedio: null, mediana: null, n: 0 });
  });

  it('calcula promedio y mediana con n impar', () => {
    expect(resumenEstadistico([1, 2, 3])).toEqual({ promedio: 2, mediana: 2, n: 3 });
  });

  it('con n par, la mediana promedia los dos valores centrales', () => {
    expect(resumenEstadistico([1, 2, 3, 4])).toEqual({ promedio: 2.5, mediana: 2.5, n: 4 });
  });

  it('redondea a un decimal', () => {
    const r = resumenEstadistico([1, 2, 2]);
    expect(r.promedio).toBe(1.7);
  });
});

describe('filtrarPeriodo', () => {
  it('desde es inclusivo y hasta es exclusivo', () => {
    const xs = [
      ev({ creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ creadoEn: new Date('2026-01-05T00:00:00Z') }),
      ev({ creadoEn: new Date('2026-01-10T00:00:00Z') }),
    ];
    const p = { desde: new Date('2026-01-01T00:00:00Z'), hasta: new Date('2026-01-10T00:00:00Z') };
    const r = filtrarPeriodo(xs, p);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.creadoEn.toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z',
    ]);
  });

  it('con desde null (periodo "todo"), incluye todo lo anterior a hasta', () => {
    const xs = [ev({ creadoEn: new Date('2020-01-01T00:00:00Z') }), ev({ creadoEn: new Date('2026-01-01T00:00:00Z') })];
    const p = { desde: null, hasta: new Date('2026-06-01T00:00:00Z') };
    expect(filtrarPeriodo(xs, p)).toHaveLength(2);
  });
});

describe('tiemposPorEtapa', () => {
  it('duracion: del primer en_proceso al primer aprobada posterior', () => {
    const eventos = [
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'iniciar', a: 'en_proceso', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-04T00:00:00Z') }),
    ];
    const r = tiemposPorEtapa(eventos);
    expect(r.duracion.investigacion).toEqual([3]);
    expect(r.duracion.pilares).toEqual([]);
  });

  it('etapa sin aprobar no cuenta en duración', () => {
    const eventos = [
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'iniciar', a: 'en_proceso', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-02T00:00:00Z') }),
    ];
    expect(tiemposPorEtapa(eventos).duracion.investigacion).toEqual([]);
  });

  it('etapa reabierta y reaprobada cuenta solo la primera aprobación', () => {
    const eventos = [
      ev({ etapaId: 'e1', etapa: 'pilares', accion: 'iniciar', a: 'en_proceso', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'pilares', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-03T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'pilares', accion: 'reabrir', a: 'con_cambios', creadoEn: new Date('2026-01-05T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'pilares', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-09T00:00:00Z') }),
    ];
    // 2 días (1→3), no 8 (1→9) ni la segunda aprobación.
    expect(tiemposPorEtapa(eventos).duracion.pilares).toEqual([2]);
  });

  it('función ordena los eventos internamente sin importar el orden de entrada', () => {
    const eventos = [
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-04T00:00:00Z') }),
      ev({ etapaId: 'e1', etapa: 'investigacion', accion: 'iniciar', a: 'en_proceso', creadoEn: new Date('2026-01-01T00:00:00Z') }),
    ];
    expect(tiemposPorEtapa(eventos).duracion.investigacion).toEqual([3]);
  });

  it('esperaRevision: cada solicitar hasta la siguiente decisión (aprobar o pedir_cambios)', () => {
    const eventos = [
      ev({ etapaId: 'e1', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-02T00:00:00Z') }),
      ev({ etapaId: 'e2', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-10T00:00:00Z') }),
      ev({ etapaId: 'e2', accion: 'pedir_cambios', a: 'con_cambios', creadoEn: new Date('2026-01-13T00:00:00Z') }),
    ];
    expect(tiemposPorEtapa(eventos).esperaRevision.sort()).toEqual([1, 3].sort());
  });

  it('un solicitar sin decisión posterior no cuenta', () => {
    const eventos = [ev({ etapaId: 'e1', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-01T00:00:00Z') })];
    expect(tiemposPorEtapa(eventos).esperaRevision).toEqual([]);
  });

  it('respuestaCambios: pedir_cambios, reabrir y comentario_cliente hasta el siguiente solicitar', () => {
    const eventos = [
      ev({ etapaId: 'e1', accion: 'pedir_cambios', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-03T00:00:00Z') }),
      ev({ etapaId: 'e2', accion: 'reabrir', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e2', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-02T00:00:00Z') }),
      ev({ etapaId: 'e3', accion: 'comentario_cliente', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e3', accion: 'solicitar', a: 'en_revision', creadoEn: new Date('2026-01-05T00:00:00Z') }),
    ];
    expect(tiemposPorEtapa(eventos).respuestaCambios.sort((a, b) => a - b)).toEqual([1, 2, 4]);
  });

  it('un pedir_cambios sin solicitar posterior no cuenta', () => {
    const eventos = [ev({ etapaId: 'e1', accion: 'pedir_cambios', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') })];
    expect(tiemposPorEtapa(eventos).respuestaCambios).toEqual([]);
  });
});

describe('calidad', () => {
  it('rondasPorEtapaAprobada: cuenta pedir_cambios + reabrir por etapaId con al menos un aprobar', () => {
    const eventos = [
      ev({ etapaId: 'e1', accion: 'pedir_cambios', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      ev({ etapaId: 'e1', accion: 'reabrir', a: 'con_cambios', creadoEn: new Date('2026-01-02T00:00:00Z') }),
      ev({ etapaId: 'e1', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-01-03T00:00:00Z') }),
    ];
    expect(calidad(eventos, []).rondasPorEtapaAprobada).toEqual([2]);
  });

  it('etapa nunca aprobada no cuenta', () => {
    const eventos = [ev({ etapaId: 'e1', accion: 'pedir_cambios', a: 'con_cambios', creadoEn: new Date('2026-01-01T00:00:00Z') })];
    expect(calidad(eventos, []).rondasPorEtapaAprobada).toEqual([]);
  });

  it('comentarios por entregable: promedios de admin/operador y de cliente entre etapaIds con comentarios', () => {
    const comentarios = [
      com({ etapaId: 'e1', autorRol: 'admin', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      com({ etapaId: 'e1', autorRol: 'admin', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      com({ etapaId: 'e1', autorRol: 'cliente', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      com({ etapaId: 'e2', autorRol: 'operador', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      com({ etapaId: 'e2', autorRol: 'cliente', creadoEn: new Date('2026-01-01T00:00:00Z') }),
      com({ etapaId: 'e2', autorRol: 'cliente', creadoEn: new Date('2026-01-01T00:00:00Z') }),
    ];
    const r = calidad([], comentarios);
    // e1: 2 admin, 1 cliente. e2: 1 admin/operador, 2 cliente. Promedio admin = (2+1)/2=1.5; cliente=(1+2)/2=1.5.
    expect(r.comentariosAdminPorEntregable).toBe(1.5);
    expect(r.comentariosClientePorEntregable).toBe(1.5);
  });

  it('sin comentarios, ambos promedios son 0', () => {
    const r = calidad([], []);
    expect(r.comentariosAdminPorEntregable).toBe(0);
    expect(r.comentariosClientePorEntregable).toBe(0);
  });
});

describe('carga', () => {
  it('cuenta clientes distintos, etapas activas, avance promedio y aprobadas en el periodo', () => {
    const etapas = [
      etm({ id: 'e1', clientId: 'c1', etapa: 'investigacion', estado: 'en_proceso', contratada: true, interna: false }),
      etm({ id: 'e2', clientId: 'c1', etapa: 'pilares', estado: 'aprobada', contratada: true, interna: false }),
      etm({ id: 'e3', clientId: 'c2', etapa: 'investigacion', estado: 'en_revision', contratada: true, interna: false }),
      // interna: no cuenta como activa ni en el avance.
      etm({ id: 'e4', clientId: 'c2', etapa: 'desarrollo_mensual', estado: 'en_proceso', contratada: true, interna: true }),
    ];
    const eventos = [
      ev({ etapaId: 'e2', accion: 'aprobar', a: 'aprobada', creadoEn: new Date('2026-09-10T00:00:00Z') }),
      ev({ etapaId: 'e1', accion: 'iniciar', a: 'en_proceso', creadoEn: new Date('2020-01-01T00:00:00Z') }),
    ];
    const p = { desde: new Date('2026-09-01T00:00:00Z'), hasta: new Date('2026-09-30T00:00:00Z') };
    const r = carga(etapas, eventos, p);
    expect(r.clientes).toBe(2);
    expect(r.etapasActivas).toBe(2); // e1 (en_proceso) y e3 (en_revision); e4 es interna.
    expect(r.aprobadasEnPeriodo).toBe(1);
    // c1: (en_proceso=25 + aprobada=100)/2 = 62.5; c2: (en_revision=50)/1 = 50 (e4 interna excluida). Promedio de clientes = (62.5+50)/2=56.25≈56.3.
    expect(r.avancePromedio).toBe(56.3);
  });

  it('sin etapas, todo en cero', () => {
    const r = carga([], [], { desde: null, hasta: new Date('2026-01-01T00:00:00Z') });
    expect(r).toEqual({ clientes: 0, etapasActivas: 0, avancePromedio: 0, aprobadasEnPeriodo: 0 });
  });
});

describe('costo', () => {
  it('suma por cliente, por etapa (tipo de job) y por operador, filtrando por periodo', () => {
    const jobs = [
      job({ clientId: 'c1', tipo: 'research', costoUsd: 10, creadoPor: 'op1', creadoEn: new Date('2026-09-05T00:00:00Z') }),
      job({ clientId: 'c1', tipo: 'growth', costoUsd: 5, creadoPor: null, creadoEn: new Date('2026-09-06T00:00:00Z') }),
      job({ clientId: 'c2', tipo: 'pilares', costoUsd: 7, creadoPor: null, creadoEn: new Date('2026-09-07T00:00:00Z') }),
      // fuera del periodo: no debe contar.
      job({ clientId: 'c1', tipo: 'research', costoUsd: 100, creadoPor: 'op1', creadoEn: new Date('2020-01-01T00:00:00Z') }),
    ];
    const operadorDeCliente = new Map<string, string | null>([
      ['c1', 'op2'],
      ['c2', null],
    ]);
    const p = { desde: new Date('2026-09-01T00:00:00Z'), hasta: new Date('2026-09-30T00:00:00Z') };
    const r = costo(jobs, operadorDeCliente, p);
    expect(r.total).toBe(22);
    expect(r.porCliente.get('c1')).toBe(15);
    expect(r.porCliente.get('c2')).toBe(7);
    expect(r.porEtapa).toEqual({ research: 10, growth: 5, pilares: 7 });
    // job1: creadoPor='op1' → op1. job2: creadoPor null, cliente c1 → operadorDeCliente('c1')='op2'. job3: creadoPor null, cliente c2 → null → 'sin_asignar'.
    expect(r.porOperador.get('op1')).toBe(10);
    expect(r.porOperador.get('op2')).toBe(5);
    expect(r.porOperador.get('sin_asignar')).toBe(7);
  });

  it('sin jobs en el periodo, todo en cero/vacío', () => {
    const r = costo([], new Map(), { desde: null, hasta: new Date('2026-01-01T00:00:00Z') });
    expect(r.total).toBe(0);
    expect(r.porCliente.size).toBe(0);
    expect(r.porEtapa).toEqual({ research: 0, growth: 0, pilares: 0 });
    expect(r.porOperador.size).toBe(0);
  });
});
