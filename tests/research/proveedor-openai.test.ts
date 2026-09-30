import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

/**
 * `pedirJson` con PROVEEDOR_IA=openai debe llamar a la Responses API de
 * OpenAI (por `fetch`) y NO al SDK de Anthropic; con PROVEEDOR_IA=anthropic
 * (o sin definir, o con un valor que no reconoce), debe seguir llamando al
 * SDK de Anthropic como hasta ahora.
 */

const crearAnthropic = vi.fn();
const transmitirAnthropic = vi.fn((cuerpo: any) => ({ finalMessage: () => crearAnthropic(cuerpo) }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { stream: transmitirAnthropic }; },
}));

const esquema = z.object({ valor: z.string() });

function respuestaAnthropic(texto: string, entrada = 100, salida = 50, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text', text: texto }],
    usage: { input_tokens: entrada, output_tokens: salida },
    stop_reason: 'end_turn',
    ...extra,
  };
}

/** Respuesta simulada de la Responses API de OpenAI. */
function respuestaOpenAI(texto: string, entrada = 100, salida = 50, extra: Record<string, unknown> = {}) {
  return {
    status: 'completed',
    output: [{ type: 'message', content: [{ type: 'output_text', text: texto }] }],
    output_text: texto,
    usage: { input_tokens: entrada, output_tokens: salida },
    ...extra,
  };
}

function mockFetchJson(...respuestas: unknown[]) {
  const f = vi.fn();
  for (const r of respuestas) {
    f.mockResolvedValueOnce({ ok: true, status: 200, json: async () => r });
  }
  return f;
}

const ENV_ORIGINAL = { ...process.env };

beforeEach(() => {
  crearAnthropic.mockReset();
  transmitirAnthropic.mockClear();
  vi.resetModules();
  process.env.ANTHROPIC_API_KEY = 'test-anthropic';
  process.env.OPENAI_API_KEY = 'test-openai';
  delete process.env.PROVEEDOR_IA;
  delete process.env.PROVEEDOR_IA_BUSQUEDA;
  delete process.env.MODEL_BUSQUEDA_OPENAI;
  delete process.env.MODEL_SYNTHESIS_OPENAI;
});

afterEach(() => {
  process.env = { ...ENV_ORIGINAL };
  vi.unstubAllGlobals();
});

describe('selección de proveedor', () => {
  it('sin PROVEEDOR_IA, usa Anthropic (comportamiento de siempre)', async () => {
    const { pedirJson } = await import('@/research/claude');
    crearAnthropic.mockResolvedValueOnce(respuestaAnthropic('{"valor":"x"}'));
    const fetchEspia = vi.fn();
    vi.stubGlobal('fetch', fetchEspia);
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('x');
    expect(fetchEspia).not.toHaveBeenCalled();
  });

  it('con un valor inválido de PROVEEDOR_IA, cae en Anthropic sin tronar', async () => {
    process.env.PROVEEDOR_IA = 'lo-que-sea';
    const { pedirJson } = await import('@/research/claude');
    crearAnthropic.mockResolvedValueOnce(respuestaAnthropic('{"valor":"x"}'));
    const fetchEspia = vi.fn();
    vi.stubGlobal('fetch', fetchEspia);
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('x');
    expect(fetchEspia).not.toHaveBeenCalled();
  });

  it('con PROVEEDOR_IA=openai, llama a OpenAI y no toca el SDK de Anthropic', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"x"}'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('x');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(crearAnthropic).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/responses');
  });

  it('PROVEEDOR_IA_BUSQUEDA manda solo cuando buscarWeb es true', async () => {
    process.env.PROVEEDOR_IA = 'anthropic';
    process.env.PROVEEDOR_IA_BUSQUEDA = 'openai';
    const { pedirJson } = await import('@/research/claude');

    // buscarWeb: true → OpenAI, por el override de grupo.
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"con busqueda"}'));
    vi.stubGlobal('fetch', fetchMock);
    const r1 = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(r1.datos.valor).toBe('con busqueda');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // buscarWeb: false → sigue PROVEEDOR_IA global (anthropic).
    crearAnthropic.mockResolvedValueOnce(respuestaAnthropic('{"valor":"sin busqueda"}'));
    const r2 = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: false });
    expect(r2.datos.valor).toBe('sin busqueda');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no llamó a OpenAI otra vez
  });
});

describe('pedirJsonOpenAI', () => {
  it('usa el modelo económico para buscarWeb y el de mejor calidad para el resto', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');

    const fetchBusqueda = mockFetchJson(respuestaOpenAI('{"valor":"a"}'));
    vi.stubGlobal('fetch', fetchBusqueda);
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(JSON.parse(fetchBusqueda.mock.calls[0][1].body).model).toBe('gpt-5-mini');

    const fetchSintesis = mockFetchJson(respuestaOpenAI('{"valor":"b"}'));
    vi.stubGlobal('fetch', fetchSintesis);
    await pedirJson({ modelo: 'claude-opus-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: false });
    expect(JSON.parse(fetchSintesis.mock.calls[0][1].body).model).toBe('gpt-5');
  });

  it('respeta MODEL_BUSQUEDA_OPENAI/MODEL_SYNTHESIS_OPENAI si están definidas', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    process.env.MODEL_BUSQUEDA_OPENAI = 'gpt-5-nano';
    process.env.MODEL_SYNTHESIS_OPENAI = 'gpt-5.5';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"x"}'));
    vi.stubGlobal('fetch', fetchMock);
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('gpt-5-nano');
  });

  it('pide JSON con text.format json_object', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"x"}'));
    vi.stubGlobal('fetch', fetchMock);
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo.text.format.type).toBe('json_object');
  });

  it('aplica `preparar` antes de validar, igual que con Anthropic', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    // El modelo devuelve el valor envuelto en un objeto con acento; `preparar`
    // lo aplana antes de que zod valide.
    const fetchMock = mockFetchJson(respuestaOpenAI('{"envoltura":{"valor":"aplanado"}}'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
      preparar: (crudo: any) => crudo.envoltura,
    });
    expect(r.datos.valor).toBe('aplanado');
  });

  it('reintenta con una corrección barata si el JSON no valida (con búsqueda)', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(
      respuestaOpenAI('{"otra":"cosa"}'),
      respuestaOpenAI('{"valor":"corregido"}'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true,
    });
    expect(r.datos.valor).toBe('corregido');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reintenta repitiendo el pedido completo si no hay búsqueda web ni `forma`', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(
      respuestaOpenAI('{"otra":"cosa"}'),
      respuestaOpenAI('{"valor":"ok"}'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('lanza error si falla dos veces', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"malo":true}'), respuestaOpenAI('{"malo":true}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow();
  });

  it('rescata lo que sí valida cuando nada cumple el esquema del todo (con búsqueda)', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const arreglo = z.object({ items: z.array(z.object({ nombre: z.string(), url: z.string().url() })) });
    const fetchMock = mockFetchJson(
      respuestaOpenAI('{"items":[{"nombre":"a","url":"https://x.com"},{"nombre":"b","url":"no-es-url"}]}'),
      respuestaOpenAI('{"items":[{"nombre":"a","url":"https://x.com"},{"nombre":"b","url":"no-es-url"}]}'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: arreglo, buscarWeb: true,
    });
    expect(r.parcial).toBe(true);
    expect(r.datos.items).toHaveLength(1);
  });

  it('reporta el consumo de tokens (entrada/salida) al que llama', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"x"}', 120, 40));
    vi.stubGlobal('fetch', fetchMock);
    const vistos: Array<[number, number]> = [];
    await pedirJson({
      modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
      onUso: (e, s) => { vistos.push([e, s]); return true; },
    });
    expect(vistos).toEqual([[120, 40]]);
  });

  it('cuenta lo leído del caché a precio equivalente (mitad de precio)', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const fetchMock = mockFetchJson(respuestaOpenAI('{"valor":"x"}', 1000, 50, {
      usage: { input_tokens: 1000, output_tokens: 50, input_tokens_details: { cached_tokens: 800 } },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    // 1000 - 0.5*800 = 600
    expect(r.tokensEntrada).toBe(600);
  });

  it('avisa cuando la respuesta se cortó por max_output_tokens', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    const { pedirJson } = await import('@/research/claude');
    const cortada = respuestaOpenAI('{"valor":"a medio', 100, 50, { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } });
    const fetchMock = mockFetchJson(cortada, cortada);
    vi.stubGlobal('fetch', fetchMock);
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow(/max_output_tokens|se agotó/i);
  });

  it('sin OPENAI_API_KEY, lanza un error claro', async () => {
    process.env.PROVEEDOR_IA = 'openai';
    delete process.env.OPENAI_API_KEY;
    const { pedirJson } = await import('@/research/claude');
    vi.stubGlobal('fetch', vi.fn());
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow(/OPENAI_API_KEY/);
  });
});
