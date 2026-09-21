import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const crear = vi.fn();
const transmitir = vi.fn((cuerpo: any) => ({ finalMessage: () => crear(JSON.parse(JSON.stringify(cuerpo))) }));
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { stream: transmitir }; } }));

const esquema = z.object({ valor: z.string() });
const ok = (texto = '{"valor":"x"}', uso: Record<string, number> = {}) =>
  ({ content: [{ type: 'text', text: texto }], usage: { input_tokens: 100, output_tokens: 10, ...uso }, stop_reason: 'end_turn' });
const pausa = () => ({
  content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: {} }, { type: 'web_search_tool_result', tool_use_id: 's1', content: [] }],
  usage: { input_tokens: 100, output_tokens: 10 }, stop_reason: 'pause_turn',
});
const marcas = (cuerpo: any) => {
  const n = (b: any) => (b && b.cache_control ? 1 : 0);
  const sistema = Array.isArray(cuerpo.system) ? cuerpo.system.reduce((a: number, b: any) => a + n(b), 0) : 0;
  const msgs = cuerpo.messages.reduce((a: number, m: any) => a + (Array.isArray(m.content) ? m.content.reduce((x: number, b: any) => x + n(b), 0) : 0), 0);
  return sistema + msgs;
};

beforeEach(() => { crear.mockReset(); transmitir.mockClear(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('pedirJson · caché de prompts', () => {
  it('sin búsqueda web no marca nada: escribir en caché costaría 25 % más sin repetición', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(ok());
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(marcas(crear.mock.calls[0][0])).toBe(0);
  });

  it('con búsqueda marca el sistema y solo el último bloque, sin acumular cortes al reanudar', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(pausa()).mockResolvedValueOnce(pausa()).mockResolvedValueOnce(ok());
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    for (const [cuerpo] of crear.mock.calls) expect(marcas(cuerpo)).toBe(2);
    expect(crear.mock.calls).toHaveLength(3);
  });

  it('Haiku usa la búsqueda 20250305; los demás la 20260209; el tope es de 6 consultas', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(ok());
    await pedirJson({ modelo: 'claude-haiku-4-5-20251001', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(crear.mock.calls[0][0].tools[0]).toMatchObject({ type: 'web_search_20250305', max_uses: 6 });
    expect(crear.mock.calls[1][0].tools[0]).toMatchObject({ type: 'web_search_20260209', max_uses: 6 });
  });

  it('cuenta lo escrito y lo leído del caché a precio equivalente', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(ok('{"valor":"x"}', { cache_creation_input_tokens: 1000, cache_read_input_tokens: 10000 }));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(r.tokensEntrada).toBe(100 + 1250 + 1000);
  });

  it('si la API rechaza cache_control, sigue sin caché en vez de perder la etapa', async () => {
    const { pedirJson } = await import('@/research/claude');
    const rechazo = Object.assign(new Error('400 cache_control not supported on this block'), { status: 400 });
    crear.mockRejectedValueOnce(rechazo).mockResolvedValueOnce(ok());
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema, buscarWeb: true });
    expect(r.datos.valor).toBe('x');
    expect(marcas(crear.mock.calls[0][0])).toBe(2);
    expect(marcas(crear.mock.calls[1][0])).toBe(0);
  });
});
