import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const crear = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: crear }; },
}));

const esquema = z.object({ valor: z.string() });

function respuesta(texto: string, entrada = 100, salida = 50, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text', text: texto }],
    usage: { input_tokens: entrada, output_tokens: salida },
    stop_reason: 'end_turn',
    ...extra,
  };
}

beforeEach(() => { crear.mockReset(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('pedirJson', () => {
  it('devuelve datos validados y el consumo', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"valor":"hola"}'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('hola');
    expect(r.tokensEntrada).toBe(100);
  });

  it('reintenta una vez si el JSON no valida', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"otra":"cosa"}'))
         .mockResolvedValueOnce(respuesta('{"valor":"ok"}'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('ok');
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('lanza error si falla dos veces', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('{"malo":true}'));
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow();
  });

  it('extrae JSON aunque venga envuelto en texto', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('Claro:\n```json\n{"valor":"x"}\n```\nListo.'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('x');
  });

  it('reanuda cuando la búsqueda web pausa el turno y suma el consumo', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear
      .mockResolvedValueOnce(respuesta('', 100, 50, { stop_reason: 'pause_turn' }))
      .mockResolvedValueOnce(respuesta('{"valor":"tras la pausa"}', 200, 30));
    const r = await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true,
    });
    expect(r.datos.valor).toBe('tras la pausa');
    expect(crear).toHaveBeenCalledTimes(2);
    expect(r.tokensEntrada).toBe(300);
    expect(r.tokensSalida).toBe(80);
  });

  it('avisa cuando la respuesta se cortó por límite de tokens', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('{"valor":"a medio', 100, 50, { stop_reason: 'max_tokens' }));
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow(/max_tokens|se agotó/i);
  });
});
