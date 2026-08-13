import { describe, it, expect } from 'vitest';
import { competenciaSchema, fuenteSchema, investigacionSchema } from '@/research/schemas';

describe('esquemas', () => {
  it('exige fuente en cada competidor', () => {
    const r = competenciaSchema.safeParse({
      directos: [{ nombre: 'X', producto: 'Y', precio: '100', duracion: '', modalidad: '', aval: '' }],
      indirectos: [], referentes: [], hallazgos: [],
    });
    expect(r.success).toBe(false);
  });

  it('acepta un competidor con fuente', () => {
    const r = competenciaSchema.safeParse({
      directos: [{ nombre: 'X', producto: 'Y', precio: '100', duracion: '6 meses',
        modalidad: 'online', aval: 'SEP', fuente: { url: 'https://x.com', consultado: '2026-08-12' } }],
      indirectos: [], referentes: [], hallazgos: ['algo'],
    });
    expect(r.success).toBe(true);
  });

  it('una fuente exige URL válida', () => {
    expect(fuenteSchema.safeParse({ url: 'no-url', consultado: '2026-08-12' }).success).toBe(false);
  });

  it('la investigación completa admite etapas vacías con razón', () => {
    const r = investigacionSchema.safeParse({
      competencia: { estado: 'vacio', razon: 'No se encontraron datos públicos' },
      audiencia: { estado: 'vacio', razon: 'x' },
      canales: { estado: 'vacio', razon: 'x' },
      mercado: { estado: 'vacio', razon: 'x' },
      sintesis: { estado: 'vacio', razon: 'x' },
    });
    expect(r.success).toBe(true);
  });
});
