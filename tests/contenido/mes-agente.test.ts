import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * El agente del mes contra un SDK de Anthropic simulado: **no se llama a la
 * API**. Comprueba que el pedido lleva todas las lecciones de hoy —forma exacta
 * en el pedido y en la corrección, `preparar`, salida holgada— y que una
 * respuesta cortada por `max_tokens` se corrige barato y se guarda lo que sí
 * se escribió.
 */

const crear = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: vi.fn(), stream: (cuerpo: any) => ({ finalMessage: () => crear(cuerpo) }) }; },
}));

import { correrTanda, armarEntradaTanda, FORMA_TANDA, MAX_TOKENS_MES, type EntradaTanda } from '@/contenido/mes/agente';
import type { Ranura } from '@/contenido/mes/plan';

const respuesta = (texto: string, stop = 'end_turn') => ({
  content: [{ type: 'text', text: texto }], usage: { input_tokens: 1000, output_tokens: 800 }, stop_reason: stop,
});

const ranuras: Ranura[] = [
  { ref: 1, formato: 'reel', fecha: '2026-10-05', funcion: 'conexion', pilar: 1 },
  { ref: 2, formato: 'post', fecha: '2026-10-06', funcion: 'venta', pilar: 2 },
  { ref: 3, formato: 'carrusel', fecha: '2026-10-07', funcion: 'autoridad', pilar: 3 },
];
const entrada: EntradaTanda = {
  contexto: '## Cliente\nNombre: Negocio de prueba', periodo: '2026-10', nombreMes: 'Octubre 2026', ranuras,
  candidatos: new Map([[1, [{ id: 'P1-S1-01', texto: 'Tema uno', funcion: 'conexion', formato: 'reel', pilar: 1, estado: 'pendiente' }]]]),
  nombresPilares: ['Uno', 'Dos', 'Tres'], yaEscritas: ['Una entrada anterior'],
};

beforeEach(() => { crear.mockReset(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('correrTanda', () => {
  it('el pedido describe la forma exacta y pide salida holgada, sin búsqueda web', async () => {
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({ piezas: [{ ref: 1, copy: 'Hola' }] })));
    await correrTanda(entrada);
    const cuerpo = crear.mock.calls[0][0];
    expect(cuerpo.max_tokens).toBe(MAX_TOKENS_MES);
    expect(cuerpo.max_tokens).toBeGreaterThanOrEqual(32_000);
    expect(cuerpo.tools).toBeUndefined();
    const usuario = cuerpo.messages[0].content as string;
    expect(usuario).toContain(FORMA_TANDA);
    expect(usuario).toContain('Ranura 1 · reel');
    expect(usuario).toContain('P1-S1-01');
    expect(usuario).toContain('Una entrada anterior');
    // Nada presupone un giro educativo.
    expect(cuerpo.system).not.toMatch(/alumn|curso|educativ|clase de/i);
  });

  it('una respuesta cortada por max_tokens se corrige barato y se guarda lo que sí vino', async () => {
    const cortada = '{"piezas":[{"ranura":1,"Copy":"Primera","guión":["Plano"]},{"numero":2,"copy":"Segunda","plataforma":"FB"},{"ref":3,"copy":"a med';
    crear
      .mockResolvedValueOnce(respuesta(cortada, 'max_tokens'))
      .mockResolvedValueOnce(respuesta('{"piezas":[{"ranura":1,"Copy":"Primera","guión":["Plano"]},{"numero":2,"copy":"Segunda","plataforma":"FB"},{"ref":3}]}'));
    const r = await correrTanda(entrada);
    expect(crear).toHaveBeenCalledTimes(2);
    // La corrección lleva la forma exacta y no el contexto del cliente.
    const correccion = crear.mock.calls[1][0].messages[0].content as string;
    expect(correccion).toContain(FORMA_TANDA);
    expect(correccion).not.toContain('Negocio de prueba');
    expect(r.datos.piezas.map((p) => p.ref)).toEqual([1, 2]);
    expect(r.datos.piezas[0].guion).toEqual([{ visual: 'Plano', texto: '' }]);
    expect(r.datos.piezas[1].plataforma).toBe('facebook');
  });

  it('sin ninguna pieza útil ni tras corregir, falla (y el pipeline marca esa semana)', async () => {
    crear.mockResolvedValue(respuesta('{"piezas":[{"ref":1}]}'));
    await expect(correrTanda(entrada)).rejects.toThrow();
  });

  it('el modo de prueba no está activo fuera del servidor de desarrollo con su variable', async () => {
    delete process.env.CONTENIDO_MES_SIMULADO;
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({ piezas: [{ ref: 1, copy: 'Real' }] })));
    const r = await correrTanda(entrada);
    expect(crear).toHaveBeenCalledTimes(1);
    expect(r.datos.piezas[0].copy).toBe('Real');
  });
});

describe('armarEntradaTanda', () => {
  it('una ranura sin candidatos lo dice en vez de callar', () => {
    const texto = armarEntradaTanda({ ...entrada, candidatos: new Map() });
    expect(texto).toContain('el mapa ya no tiene temas libres');
  });
});
