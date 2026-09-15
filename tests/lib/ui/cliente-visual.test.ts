import { describe, it, expect } from 'vitest';
import { iniciales, tinte, TINTES } from '@/lib/ui/cliente-visual';

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Yessica Villa')).toBe('YV');
    expect(iniciales('Ana Yessica Villa')).toBe('AY');
  });
  it('una sola palabra da una letra', () => {
    expect(iniciales('Kvalita')).toBe('K');
  });
  it('ignora signos y espacios de más, respeta acentos', () => {
    expect(iniciales('  (clínica)   Ñandú ')).toBe('CÑ');
  });
  it('sin nombre usable devuelve ?', () => {
    expect(iniciales('   ')).toBe('?');
    expect(iniciales('— —')).toBe('?');
  });
});

describe('tinte', () => {
  it('es estable para el mismo id', () => {
    const id = '3f1c2b8e-1111-4a2b-9c3d-000000000001';
    expect(tinte(id)).toBe(tinte(id));
  });
  it('siempre es uno de los tintes', () => {
    for (const id of ['a', 'b', 'c', 'uuid-largo-123', '']) expect(TINTES).toContain(tinte(id));
  });
  it('reparte entre los tres tintes', () => {
    const vistos = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(tinte));
    expect(vistos.size).toBe(3);
  });
});
