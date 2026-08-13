import { describe, it, expect } from 'vitest';
import { validarUrl, normalizarUrl } from '@/lib/links';

describe('links', () => {
  it('acepta una URL con protocolo', () => {
    expect(validarUrl('https://ejemplo.com')).toBe(true);
  });

  it('rechaza texto que no es URL', () => {
    expect(validarUrl('no soy una url')).toBe(false);
  });

  it('rechaza protocolos que no son http o https', () => {
    expect(validarUrl('javascript:alert(1)')).toBe(false);
  });

  it('agrega https a una URL sin protocolo', () => {
    expect(normalizarUrl('ejemplo.com')).toBe('https://ejemplo.com');
  });
});
