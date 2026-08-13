import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// `crear` es la fuente de las respuestas simuladas. `sinStream` es el
// `messages.create` de verdad: si alguna vez se usa, la petición vuelve a
// quedar sujeta al tope de 10 minutos del SDK.
const crear = vi.fn();
const sinStream = vi.fn((cuerpo: any) => crear(cuerpo));
const transmitir = vi.fn((cuerpo: any) => ({ finalMessage: () => crear(cuerpo) }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: sinStream, stream: transmitir }; },
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

beforeEach(() => {
  crear.mockReset();
  sinStream.mockClear();
  transmitir.mockClear();
  process.env.ANTHROPIC_API_KEY = 'test';
});

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

  it('pide en streaming, porque sin él el SDK rechaza la síntesis por el tope de 10 minutos', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"valor":"sintetizado"}'));
    const r = await pedirJson({
      modelo: 'claude-opus-5', sistema: 's', usuario: 'u', schema: esquema, maxTokens: 32_000,
    });
    expect(r.datos.valor).toBe('sintetizado');
    expect(transmitir).toHaveBeenCalledTimes(1);
    expect(transmitir.mock.calls[0][0].max_tokens).toBe(32_000);
    expect(sinStream).not.toHaveBeenCalled();
  });

  it('deja de reanudar el turno si el que llama dice que se acabó el presupuesto', async () => {
    // La búsqueda web pausa el turno cada diez iteraciones. Reanudar sin mirar
    // el gasto es la vía más rápida de pasarse del tope dentro de una sola etapa.
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('', 100, 50, { stop_reason: 'pause_turn' }));
    await expect(pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
      buscarWeb: true, onUso: () => false,
    })).rejects.toThrow(/presupuesto|tope/i);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('sigue reanudando mientras haya presupuesto', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear
      .mockResolvedValueOnce(respuesta('', 100, 50, { stop_reason: 'pause_turn' }))
      .mockResolvedValueOnce(respuesta('{"valor":"listo"}', 80, 20));
    const r = await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
      buscarWeb: true, onUso: () => true,
    });
    expect(r.datos.valor).toBe('listo');
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('reporta el consumo de cada respuesta al que llama', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"valor":"x"}', 120, 40));
    const vistos: Array<[number, number]> = [];
    await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
      onUso: (e, s) => { vistos.push([e, s]); return true; },
    });
    expect(vistos).toEqual([[120, 40]]);
  });

  it('avisa cuando la respuesta se cortó por límite de tokens', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('{"valor":"a medio', 100, 50, { stop_reason: 'max_tokens' }));
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow(/max_tokens|se agotó/i);
  });
});
