import { describe, it, expect } from 'vitest';
import { resumirPorCliente, resumenDe, pasaFiltro } from '@/lib/ui/estado-cliente';

const j = (clientId: string, estado: string, dia: number, costoUsd = '1.5') =>
  ({ clientId, estado, costoUsd, createdAt: new Date(2026, 8, dia) });

describe('resumirPorCliente', () => {
  it('sin jobs el cliente está sin investigar', () => {
    expect(resumenDe(resumirPorCliente([]), 'x')).toEqual({ estado: 'sin_investigar', costo: 0, ultimo: null });
  });

  it('último job completado es listo y suma el costo de todos', () => {
    const r = resumenDe(resumirPorCliente([j('a', 'fallido', 1, '2'), j('a', 'completado', 5, '3.25')]), 'a');
    expect(r.estado).toBe('listo');
    expect(r.costo).toBeCloseTo(5.25);
    expect(r.ultimo?.createdAt.getDate()).toBe(5);
  });

  it('un job encolado o corriendo gana aunque haya uno completado más nuevo', () => {
    const m = resumirPorCliente([j('a', 'corriendo', 1), j('a', 'completado', 9)]);
    expect(resumenDe(m, 'a').estado).toBe('en_curso');
  });

  it('último job fallido o cancelado queda en otro', () => {
    const m = resumirPorCliente([j('a', 'completado', 1), j('a', 'cancelado', 3)]);
    expect(resumenDe(m, 'a').estado).toBe('otro');
  });

  it('no depende del orden de entrada', () => {
    const m = resumirPorCliente([j('a', 'completado', 9), j('a', 'fallido', 2)]);
    expect(resumenDe(m, 'a').estado).toBe('listo');
  });
});

describe('pasaFiltro', () => {
  it('todos deja pasar cualquier estado', () => {
    for (const e of ['listo', 'en_curso', 'sin_investigar', 'otro'] as const) expect(pasaFiltro(e, 'todos')).toBe(true);
  });
  it('otro solo aparece en todos', () => {
    expect(pasaFiltro('otro', 'listo')).toBe(false);
    expect(pasaFiltro('otro', 'en_curso')).toBe(false);
    expect(pasaFiltro('otro', 'sin_investigar')).toBe(false);
  });
  it('los demás filtros son exactos', () => {
    expect(pasaFiltro('listo', 'listo')).toBe(true);
    expect(pasaFiltro('listo', 'en_curso')).toBe(false);
  });
});
