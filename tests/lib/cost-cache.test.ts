import { describe, it, expect } from 'vitest';
import { calcularCosto, entradaEquivalente } from '@/lib/cost';

describe('tarifas', () => {
  it('Sonnet 5 cuesta 2 y 10 USD por millón (cuadrado contra la consola de Anthropic)', () => {
    expect(calcularCosto('claude-sonnet-5', 1_000_000, 0)).toBe(2);
    expect(calcularCosto('claude-sonnet-5', 0, 1_000_000)).toBe(10);
  });
  it('un id de Haiku con fecha usa la tarifa de Haiku, no la de Opus', () => {
    expect(calcularCosto('claude-haiku-4-5-20251001', 1_000_000, 0)).toBe(1);
    expect(calcularCosto('claude-haiku-4-5-20251001', 0, 1_000_000)).toBe(5);
  });
});

describe('entradaEquivalente · caché de prompts', () => {
  it('escribir en caché cuesta 1.25× y leerlo 0.1×', () => {
    expect(entradaEquivalente({ input_tokens: 1000, cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000 })).toBe(1000 + 1250 + 1000);
  });
  it('sin uso devuelve 0', () => {
    expect(entradaEquivalente(undefined)).toBe(0);
  });
});
