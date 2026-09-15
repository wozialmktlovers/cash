import { describe, it, expect } from 'vitest';
import { temaExiste, validarCambioTema } from '@/pilares/avance';
import { mapaFalso } from '../fixtures/pilares';

describe('avance por tema', () => {
  it('temaExiste busca en los pilares con datos', () => {
    const m = mapaFalso();
    expect(temaExiste(m, 'P5-S3-20')).toBe(true);
    expect(temaExiste(m, 'P6-S1-01')).toBe(false);
    m.pilares[4] = { numero: 5, estado: 'vacio', razon: 'x' };
    expect(temaExiste(m, 'P5-S3-20')).toBe(false);
    expect(temaExiste(null, 'P1-S1-01')).toBe(false);
  });

  it('valida estado y nota', () => {
    expect(validarCambioTema({ estado: 'publicado' })).toEqual({ ok: true, estado: 'publicado' });
    expect(validarCambioTema({ nota: 'Pedir foto' })).toEqual({ ok: true, nota: 'Pedir foto' });
    expect(validarCambioTema({ nota: '   ' })).toEqual({ ok: true, nota: null });
    expect(validarCambioTema({ estado: 'listo' }).ok).toBe(false);
    expect(validarCambioTema({ nota: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validarCambioTema({}).ok).toBe(false);
    expect(validarCambioTema('x').ok).toBe(false);
  });
});
