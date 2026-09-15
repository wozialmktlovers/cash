import { describe, it, expect } from 'vitest';
import { indicadores, claveMes } from '@/lib/ui/tablero';

describe('claveMes', () => {
  it('usa la hora de Ciudad de México, no la del servidor', () => {
    // 1 de octubre 03:00 UTC sigue siendo 30 de septiembre en CDMX.
    expect(claveMes(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09');
  });
});

describe('indicadores', () => {
  const ahora = new Date('2026-09-14T18:00:00Z');
  const jobs = [
    { estado: 'corriendo', costoUsd: '2.5', createdAt: new Date('2026-09-14T17:00:00Z') },
    { estado: 'encolado', costoUsd: '0', createdAt: new Date('2026-09-14T17:30:00Z') },
    { estado: 'completado', costoUsd: '6.8', createdAt: new Date('2026-09-02T12:00:00Z') },
    { estado: 'completado', costoUsd: '7', createdAt: new Date('2026-08-30T12:00:00Z') },
  ];

  it('cuenta clientes, en curso y entregables', () => {
    const r = indicadores({ clientes: 4, jobs, entregables: 3, ahora });
    expect(r.clientes).toBe(4);
    expect(r.enCurso).toBe(2);
    expect(r.entregables).toBe(3);
  });

  it('el gasto del mes solo suma jobs creados en el mes actual', () => {
    expect(indicadores({ clientes: 0, jobs, entregables: 0, ahora }).gastoMes).toBeCloseTo(9.3);
  });

  it('sin jobs todo en cero', () => {
    expect(indicadores({ clientes: 0, jobs: [], entregables: 0, ahora })).toEqual({ clientes: 0, enCurso: 0, entregables: 0, gastoMes: 0 });
  });
});
