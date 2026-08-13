import { describe, it, expect } from 'vitest';
import { slugificar } from '@/lib/slug';

describe('slugificar', () => {
  it('convierte el nombre del negocio en segmento legible', () => {
    expect(slugificar('Ana Yessica Villa')).toBe('ana-yessica-villa');
  });

  it('quita acentos y eñes', () => {
    expect(slugificar('Cosmiatría Peña')).toBe('cosmiatria-pena');
  });

  it('colapsa signos y espacios en un solo guion', () => {
    expect(slugificar('Eugenia´s  Closet · GDL')).toBe('eugenia-s-closet-gdl');
  });

  it('no deja guiones colgando en los bordes', () => {
    expect(slugificar('  ¡Clínica! ')).toBe('clinica');
  });

  it('recorta los nombres largos sin cortar en guion', () => {
    const s = slugificar('A'.repeat(40) + ' ' + 'B'.repeat(40));
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s.endsWith('-')).toBe(false);
  });

  it('un nombre sin letras utilizables no rompe la ruta', () => {
    expect(slugificar('***')).toBe('cliente');
    expect(slugificar('')).toBe('cliente');
  });

  it('solo produce caracteres seguros para URL', () => {
    for (const n of ['Café & Té', 'Ñoño 100%', 'A/B Testing S.A. de C.V.']) {
      expect(slugificar(n)).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
