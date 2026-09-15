import { describe, it, expect, vi } from 'vitest';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';

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

describe('leerTopeUsd', () => {
  it('usa el valor de la variable de entorno cuando es un número positivo', () => {
    expect(leerTopeUsd('20', 10, 'X')).toBe(20);
    expect(leerTopeUsd('0.5', 10, 'X')).toBe(0.5);
  });

  it('sin variable, usa el valor por defecto sin avisar', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(leerTopeUsd(undefined, 10, 'X')).toBe(10);
    expect(leerTopeUsd('', 10, 'X')).toBe(10);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('un valor no numérico usa el valor por defecto y avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(leerTopeUsd('quince', 10, 'COST_LIMIT_USD')).toBe(10);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('COST_LIMIT_USD');
    warn.mockRestore();
  });

  it('un valor cero o negativo usa el valor por defecto y avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(leerTopeUsd('0', 10, 'X')).toBe(10);
    expect(leerTopeUsd('-5', 10, 'X')).toBe(10);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
