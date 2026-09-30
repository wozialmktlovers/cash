import { describe, it, expect } from 'vitest';
import {
  UMBRAL_ATASCADO_DIAS, ultimaActividad, diasSinMovimiento, estaAtascado, textoDias,
  repartoPorEtapa, comparativoGastos, filasPorResponsable, mesesPorVencer, cuentaRegresiva,
} from '@/lib/ui/tablero';
import { periodo, type EtapaM, type Evento, type JobM } from '@/lib/desempeno';

const ahora = new Date('2026-09-17T18:00:00Z');

describe('días sin movimiento', () => {
  it('toma la actividad más reciente e ignora los huecos', () => {
    const r = ultimaActividad([null, new Date('2026-09-01T00:00:00Z'), undefined, '2026-09-10T12:00:00Z', new Date('2026-08-01T00:00:00Z')]);
    expect(r?.toISOString()).toBe('2026-09-10T12:00:00.000Z');
    expect(ultimaActividad([])).toBeNull();
    expect(ultimaActividad([null, 'no es fecha'])).toBeNull();
  });

  it('cuenta días completos, hacia abajo, y nunca negativos', () => {
    expect(diasSinMovimiento(new Date('2026-09-10T18:00:01Z'), ahora)).toBe(6); // 6 d 23 h 59 min
    expect(diasSinMovimiento(new Date('2026-09-10T18:00:00Z'), ahora)).toBe(7);
    expect(diasSinMovimiento(new Date('2026-09-17T10:00:00Z'), ahora)).toBe(0);
    expect(diasSinMovimiento(new Date('2026-09-18T10:00:00Z'), ahora)).toBe(0); // reloj adelantado
    expect(diasSinMovimiento(null, ahora)).toBeNull();
  });

  it('solo se atasca quien tiene trabajo por delante y llega al umbral', () => {
    expect(UMBRAL_ATASCADO_DIAS).toBe(7);
    expect(estaAtascado(7, true)).toBe(true);
    expect(estaAtascado(6, true)).toBe(false);
    expect(estaAtascado(40, false)).toBe(false); // todo aprobado o nada contratado
    expect(estaAtascado(null, true)).toBe(false);
  });

  it('dice los días como se leen', () => {
    expect(textoDias(0)).toBe('hoy');
    expect(textoDias(1)).toBe('1 día');
    expect(textoDias(12)).toBe('12 días');
    expect(textoDias(null)).toBe('—');
  });
});

describe('repartoPorEtapa', () => {
  const fila = (etapa: EtapaM['etapa'], estado: EtapaM['estado'], contratada = true, interna = false) => ({ etapa, estado, contratada, interna });

  it('cuenta clientes por etapa y estado, en el orden de las cuatro etapas', () => {
    const r = repartoPorEtapa([
      fila('pilares', 'en_proceso'), fila('investigacion', 'aprobada'), fila('investigacion', 'en_revision'),
      fila('investigacion', 'aprobada'), fila('manual_campana', 'con_cambios'),
    ]);
    expect(r.map((f) => f.etapa)).toEqual(['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana']);
    expect(r[0].total).toBe(3);
    expect(r[0].porEstado).toEqual({ no_iniciada: 0, en_proceso: 0, en_revision: 1, con_cambios: 0, aprobada: 2 });
    expect(r[1].porEstado.en_proceso).toBe(1);
    expect(r[2].total).toBe(0);
    expect(r[3].porEstado.con_cambios).toBe(1);
  });

  it('deja fuera lo no contratado y lo interno aunque conserve estado', () => {
    const r = repartoPorEtapa([fila('pilares', 'en_revision', false), fila('pilares', 'en_proceso', false, true), fila('pilares', 'no_iniciada')]);
    expect(r[1].total).toBe(1);
    expect(r[1].porEstado.no_iniciada).toBe(1);
    expect(r[1].porEstado.en_revision).toBe(0);
  });

  it('sin etapas, todo en cero', () => {
    expect(repartoPorEtapa([]).every((f) => f.total === 0)).toBe(true);
  });
});

describe('comparativoGastos', () => {
  const job = (clientId: string, tipo: JobM['tipo'], costoUsd: number, creadoEn: string): JobM =>
    ({ clientId, tipo, costoUsd, creadoPor: null, creadoEn: new Date(creadoEn) });
  const jobs: JobM[] = [
    job('a', 'research', 2.5, '2026-09-02T12:00:00Z'),
    job('a', 'pilares', 1.25, '2026-09-15T12:00:00Z'),
    job('b', 'growth', 4, '2026-09-16T12:00:00Z'),
    job('c', 'research', 0, '2026-09-16T12:00:00Z'),
    job('a', 'research', 3, '2026-08-20T12:00:00Z'),
    // 31 ago 23:00 en CDMX = 1 sep 05:00 UTC: cuenta en AGOSTO.
    job('b', 'growth', 1, '2026-09-01T05:00:00Z'),
    job('b', 'growth', 9, '2026-07-10T12:00:00Z'), // fuera de los dos meses
  ];

  it('compara el mes con el anterior en hora de México y desglosa por tipo', () => {
    const r = comparativoGastos(jobs, ahora);
    expect(r.actual).toBe(7.75);
    expect(r.anterior).toBe(4);
    expect(r.diferencia).toBe(3.75);
    expect(r.porTipo).toEqual([
      { tipo: 'research', actual: 2.5, anterior: 3 },
      { tipo: 'pilares', actual: 1.25, anterior: 0 },
      { tipo: 'growth', actual: 4, anterior: 1 },
      { tipo: 'contenido', actual: 0, anterior: 0 },
    ]);
  });

  it('ordena a los clientes que más consumen y deja fuera a los de gasto cero', () => {
    const r = comparativoGastos(jobs, ahora);
    expect(r.clientes).toEqual([{ clientId: 'b', actual: 4 }, { clientId: 'a', actual: 3.75 }]);
    expect(comparativoGastos(jobs, ahora, 1).clientes).toHaveLength(1);
  });

  it('sin gasto, ceros y ningún cliente', () => {
    expect(comparativoGastos([], ahora)).toEqual({
      actual: 0, anterior: 0, diferencia: 0, clientes: [],
      porTipo: [
        { tipo: 'research', actual: 0, anterior: 0 },
        { tipo: 'pilares', actual: 0, anterior: 0 },
        { tipo: 'growth', actual: 0, anterior: 0 },
        { tipo: 'contenido', actual: 0, anterior: 0 },
      ],
    });
  });
});

describe('filasPorResponsable', () => {
  const et = (clientId: string, etapa: EtapaM['etapa'], estado: EtapaM['estado'], responsableIds: string[], contratada = true): EtapaM =>
    ({ id: `${clientId}-${etapa}`, clientId, etapa, estado, contratada, interna: false, responsableIds });
  const aprobar = (clientId: string, etapa: EtapaM['etapa'], creadoEn: string): Evento =>
    ({ etapaId: `${clientId}-${etapa}`, clientId, etapa, accion: 'aprobar', de: 'en_revision', a: 'aprobada', creadoEn: new Date(creadoEn) });

  // Ana (strategist) lleva la investigación de c1 y c2; Beto (content creator)
  // los pilares de c1; Dani (contenido) y Eli (diseño) comparten el mes de c1.
  const etapas = [
    et('c1', 'investigacion', 'aprobada', ['ana']), et('c1', 'pilares', 'en_proceso', ['beto']),
    et('c2', 'investigacion', 'con_cambios', ['ana']),
    et('c1', 'desarrollo_mensual', 'en_proceso', ['dani', 'eli']),
    et('c3', 'manual_campana', 'en_revision', []),
    // Sin contratar: no cuenta en el promedio ni como pendiente.
    et('c4', 'investigacion', 'en_proceso', ['ana'], false),
  ];
  const nombres = new Map([['ana', 'Ana'], ['beto', 'Beto'], ['caro', 'Caro'], ['dani', 'Dani'], ['eli', 'Eli']]);
  const puestos = new Map<string, string | null>([['ana', 'Strategist'], ['beto', 'Content Creator'], ['caro', 'Trafficker'], ['dani', 'Contenido'], ['eli', 'Diseño']]);
  const p = periodo('mes', ahora);

  it('reparte etapas, avance, pendientes y aprobadas del mes por persona, con su puesto', () => {
    const filas = filasPorResponsable({
      etapas, nombres, puestos, p, extras: ['caro'],
      aprobaciones: [aprobar('c1', 'investigacion', '2026-09-05T12:00:00Z'), aprobar('c1', 'investigacion', '2026-08-20T12:00:00Z'), aprobar('c2', 'investigacion', '2026-09-10T12:00:00Z')],
    });
    expect(filas.map((f) => f.nombre)).toEqual(['Ana', 'Beto', 'Caro', 'Dani', 'Eli', 'Sin asignar']);
    // Ana: c1 investigación (100) y c2 investigación (60) → promedio 80; la de c4 no está contratada.
    expect(filas[0]).toEqual({ clave: 'ana', nombre: 'Ana', puesto: 'Strategist', clientes: 2, etapas: 2, avancePromedio: 80, pendientes: 1, aprobadasMes: 2 });
    expect(filas[1]).toMatchObject({ clave: 'beto', clientes: 1, etapas: 1, avancePromedio: 25, pendientes: 1, aprobadasMes: 0 });
    expect(filas[2]).toMatchObject({ clave: 'caro', clientes: 0, etapas: 0, avancePromedio: 0, pendientes: 0 });
    expect(filas[5]).toMatchObject({ clave: 'sin_asignar', puesto: null, etapas: 1 });
  });

  it('una etapa de desarrollo mensual cuenta completa para sus dos responsables', () => {
    const filas = filasPorResponsable({ etapas, nombres, puestos, p, aprobaciones: [] });
    expect(filas.find((f) => f.clave === 'dani')).toMatchObject({ etapas: 1, pendientes: 1 });
    expect(filas.find((f) => f.clave === 'eli')).toMatchObject({ etapas: 1, pendientes: 1 });
  });

  it('sin etapas ni extras no hay filas', () => {
    expect(filasPorResponsable({ etapas: [], nombres, puestos, p, aprobaciones: [] })).toEqual([]);
  });
});

describe('meses por vencer', () => {
  it('solo los que esperan al cliente con plazo futuro, el más próximo primero', () => {
    const lotes = [
      { id: 'tarde', estado: 'en_revision' as const, limiteRevision: new Date('2026-09-22T05:59:59Z') },
      { id: 'pronto', estado: 'en_revision' as const, limiteRevision: new Date('2026-09-18T05:59:59Z') },
      { id: 'vencido', estado: 'en_revision' as const, limiteRevision: new Date('2026-09-17T17:00:00Z') },
      { id: 'sin-plazo', estado: 'en_revision' as const, limiteRevision: null },
      { id: 'del-equipo', estado: 'con_cambios' as const, limiteRevision: new Date('2026-09-20T00:00:00Z') },
    ];
    expect(mesesPorVencer(lotes, ahora).map((l) => l.id)).toEqual(['pronto', 'tarde']);
    expect(mesesPorVencer([], ahora)).toEqual([]);
  });

  it('cuenta hacia atrás en días, horas o minutos y marca lo urgente', () => {
    const en = (ms: number) => cuentaRegresiva(new Date(ahora.getTime() + ms), ahora);
    const H = 3_600_000;
    expect(en(4 * 24 * H)).toEqual({ texto: 'vence en 4 días', urgente: false });
    expect(en(24 * H + 5 * H)).toEqual({ texto: 'vence en 1 día y 5 h', urgente: false });
    expect(en(24 * H)).toEqual({ texto: 'vence en 1 día', urgente: false });
    expect(en(5 * H + 59 * 60_000)).toEqual({ texto: 'vence en 5 h', urgente: true });
    expect(en(20 * 60_000)).toEqual({ texto: 'vence en 20 min', urgente: true });
    expect(en(10_000)).toEqual({ texto: 'vence en 1 min', urgente: true });
    expect(en(-1)).toEqual({ texto: 'vence ya', urgente: true });
  });
});
