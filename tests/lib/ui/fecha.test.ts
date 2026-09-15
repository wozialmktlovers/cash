import { describe, it, expect } from 'vitest';
import { fechaCorta, fechaHora } from '@/lib/ui/fecha';

describe('fechaCorta', () => {
  it('usa la hora de Ciudad de México, no la del servidor (UTC)', () => {
    // 1 de octubre 03:00 UTC sigue siendo 30 de septiembre en CDMX (UTC-6).
    expect(fechaCorta(new Date('2026-10-01T03:00:00Z'))).toBe('30 sep 2026');
  });

  it('formatea con día, mes corto y año', () => {
    expect(fechaCorta(new Date('2026-09-15T18:00:00Z'))).toBe('15 sep 2026');
  });
});

describe('fechaHora', () => {
  it('usa la hora de Ciudad de México y agrega hora:minuto', () => {
    // 15:30 UTC son las 09:30 en CDMX (UTC-6).
    expect(fechaHora(new Date('2026-09-15T15:30:00Z'))).toBe('15 sep 2026, 09:30 a.m.');
  });

  it('un instante cerca de medianoche UTC no salta al día siguiente en CDMX', () => {
    expect(fechaHora(new Date('2026-10-01T03:00:00Z'))).toBe('30 sep 2026, 09:00 p.m.');
  });
});
