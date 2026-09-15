import { describe, it, expect } from 'vitest';
import { normalizar, coincide } from '@/lib/ui/buscar';

describe('normalizar', () => {
  it('quita acentos, mayúsculas y espacios de los bordes', () => {
    expect(normalizar('  Cosmetología ÁREA ')).toBe('cosmetologia area');
  });
});

describe('coincide', () => {
  const campos = ['Yessica Villa', 'Cosmetología', 'Guadalajara'];
  it('consulta vacía coincide con todo', () => {
    expect(coincide('  ', campos)).toBe(true);
  });
  it('encuentra sin acentos ni mayúsculas en cualquier campo', () => {
    expect(coincide('COSMETOLOGIA', campos)).toBe(true);
    expect(coincide('guada', campos)).toBe(true);
  });
  it('cada palabra de la consulta debe aparecer', () => {
    expect(coincide('villa gdl', campos)).toBe(false);
    expect(coincide('villa guadalajara', campos)).toBe(true);
  });
  it('tolera campos nulos', () => {
    expect(coincide('villa', ['Villa', null, undefined])).toBe(true);
  });
});
