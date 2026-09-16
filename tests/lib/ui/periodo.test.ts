import { describe, it, expect } from 'vitest';
import { nombrePeriodo, periodoActual, periodoVecino } from '@/lib/ui/periodo';
import { periodoValido } from '@/contenido/reglas';

describe('periodoActual', () => {
  it('usa la hora de Ciudad de México, no la del servidor (UTC)', () => {
    // 1 de octubre 03:00 UTC sigue siendo 30 de septiembre en CDMX (UTC-6):
    // abrir «el mes en curso» debe dar septiembre, que es el mes que ve quien
    // está mirando la pantalla.
    expect(periodoActual(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09');
  });

  it('el primero de mes ya en hora de México devuelve el mes nuevo', () => {
    expect(periodoActual(new Date('2026-10-01T12:00:00Z'))).toBe('2026-10');
  });

  it('lo que devuelve siempre lo acepta la API', () => {
    expect(periodoValido(periodoActual(new Date('2026-09-16T20:00:00Z')))).toBe(true);
  });
});

describe('periodoVecino', () => {
  it('avanza y retrocede un mes', () => {
    expect(periodoVecino('2026-09', 1)).toBe('2026-10');
    expect(periodoVecino('2026-09', -1)).toBe('2026-08');
  });

  it('cruza el año en los dos sentidos', () => {
    expect(periodoVecino('2026-12', 1)).toBe('2027-01');
    expect(periodoVecino('2026-01', -1)).toBe('2025-12');
  });

  it('un texto que no es un mes se devuelve tal cual, sin NaN', () => {
    expect(periodoVecino('septiembre', 1)).toBe('septiembre');
    expect(periodoVecino('2026-13', 1)).toBe('2026-13');
  });
});

describe('nombrePeriodo', () => {
  it('escribe el mes con mayúscula y sin el «de»', () => {
    expect(nombrePeriodo('2026-09')).toBe('Septiembre 2026');
    expect(nombrePeriodo('2026-01')).toBe('Enero 2026');
  });

  it('el mes no se corre al anterior por la zona horaria', () => {
    // El periodo es un mes del calendario, no un instante: formatearlo en la
    // zona de México movería el día 1 a las 00:00 UTC al mes de antes.
    expect(nombrePeriodo('2026-12')).toBe('Diciembre 2026');
  });

  it('un texto que no es un mes se devuelve tal cual', () => {
    expect(nombrePeriodo('2026-99')).toBe('2026-99');
  });
});
