import { describe, it, expect } from 'vitest';
import { calcularCosto } from '@/lib/cost';

describe('calcularCosto', () => {
  it('cobra más por los tokens de salida que de entrada', () => {
    const entrada = calcularCosto('claude-sonnet-5', 1_000_000, 0);
    const salida = calcularCosto('claude-sonnet-5', 0, 1_000_000);
    expect(salida).toBeGreaterThan(entrada);
  });

  it('Opus cuesta más que Sonnet con el mismo consumo', () => {
    expect(calcularCosto('claude-opus-5', 100_000, 10_000))
      .toBeGreaterThan(calcularCosto('claude-sonnet-5', 100_000, 10_000));
  });

  it('devuelve cero sin consumo', () => {
    expect(calcularCosto('claude-sonnet-5', 0, 0)).toBe(0);
  });

  it('usa la tarifa por defecto ante un modelo desconocido', () => {
    expect(calcularCosto('modelo-inexistente', 1_000_000, 0)).toBeGreaterThan(0);
  });
});
