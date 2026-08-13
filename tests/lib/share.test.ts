import { describe, it, expect } from 'vitest';
import { generarTokenShare } from '@/lib/share';

describe('token de compartir', () => {
  it('genera tokens distintos en cada llamada', () => {
    const vistos = new Set(Array.from({ length: 100 }, () => generarTokenShare()));
    expect(vistos.size).toBe(100);
  });

  it('usa al menos 32 bytes de entropía', () => {
    expect(generarTokenShare().length).toBeGreaterThanOrEqual(43);
  });

  it('solo usa caracteres seguros para URL', () => {
    expect(generarTokenShare()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
