import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * El agente que escribe el copy de una pieza (B2).
 *
 * `pedirJson` se simula, como en las pruebas de pilares y de growth: **ninguna
 * prueba llama al modelo de verdad**, ni gasta saldo. Lo que se comprueba es
 * lo que decide este módulo —qué se le cuenta al modelo, con qué modelo, y
 * hasta dónde se deja gastar—, no que Anthropic conteste.
 */
const pedir = vi.fn();
vi.mock('@/research/claude', () => ({ pedirJson: (o: any) => pedir(o) }));

import {
  SISTEMA_COPY, armarEntradaPropuestas, correrPropuestas, frenoDeGasto,
  generarPropuestas, modeloCopy, temaDelMapa, topePropuestasUsd,
} from '@/contenido/agentes';
import { propuestasCopySchema, OPCIONES } from '@/contenido/schemas';
import { calcularCosto } from '@/lib/cost';
import type { PiezaParaCopy, TemaParaCopy } from '@/contenido/schemas';

const tema: TemaParaCopy = {
  id: 'P2-S1-07', texto: 'La consulta que nadie agenda hasta que duele', funcion: 'conexion', formato: 'reel',
};
const pieza: PiezaParaCopy = { formato: 'carrusel', plataforma: 'ambas', fechaPublicacion: '2026-09-18' };

const opcion = (i: number) => ({
  gancho: `Gancho ${i}`,
  copy: `Copy ${i}`,
  cta: 'Escríbenos por WhatsApp.',
  hashtags: ['#uno', '#dos', '#tres', '#cuatro', '#cinco'],
  briefVisual: `Brief ${i}`,
});
const respuesta = { opciones: [opcion(1), opcion(2), opcion(3)] };

const entorno: Record<string, string | undefined> = {};
const recordar = (...nombres: string[]) => nombres.forEach((n) => { entorno[n] = process.env[n]; });

beforeEach(() => {
  pedir.mockReset();
  pedir.mockResolvedValue({ datos: respuesta, tokensEntrada: 1000, tokensSalida: 500 });
  recordar('MODEL_RESEARCH', 'COST_LIMIT_PROPUESTAS_USD');
});
afterEach(() => {
  for (const [n, v] of Object.entries(entorno)) {
    if (v === undefined) delete process.env[n]; else process.env[n] = v;
  }
});

describe('sistema', () => {
  it('mantiene la voz del estratega de pilares', () => {
    const s = SISTEMA_COPY.toLowerCase();
    for (const regla of ['frases de agencia', 'descubre', 'innovador', 'la mejor opción', 'escenas', 'no inventes', 'json válido']) {
      expect(s).toContain(regla.toLowerCase());
    }
  });

  it('dice para dónde y en qué español escribe', () => {
    expect(SISTEMA_COPY).toContain('Facebook e Instagram');
    expect(SISTEMA_COPY).toContain('español de México');
  });

  it('pide tres caminos distintos y un brief para quien hace el arte', () => {
    expect(SISTEMA_COPY).toContain('tres opciones');
    expect(SISTEMA_COPY.toLowerCase()).toContain('brief visual');
  });
});

describe('armarEntradaPropuestas', () => {
  it('lleva el contexto del cliente, el tema del mapa y la pieza', () => {
    const e = armarEntradaPropuestas('## Cliente\nAna', tema, pieza);
    expect(e).toContain('## Cliente');
    expect(e).toContain(tema.id);
    expect(e).toContain(tema.texto);
    expect(e).toContain('conexion');
    expect(e).toContain('carrusel');
    expect(e).toContain('Facebook e Instagram');
    expect(e).toContain('2026-09-18');
  });

  it('pide la forma del JSON con los límites del esquema escritos', () => {
    const e = armarEntradaPropuestas('ctx', tema, pieza);
    for (const campo of ['gancho', 'copy', 'cta', 'hashtags', 'briefVisual']) expect(e).toContain(campo);
    for (const limite of ['120', '2200', '400', '5', '10']) expect(e).toContain(limite);
    expect(e).toContain(String(OPCIONES));
  });

  it('cuando el formato de la pieza no es el que sugirió la estrategia, manda el de la pieza', () => {
    const e = armarEntradaPropuestas('ctx', tema, pieza);
    expect(e).toMatch(/manda sobre el que sugirió la estrategia/);
  });

  it('cuando coinciden no gasta líneas en aclararlo', () => {
    const e = armarEntradaPropuestas('ctx', { ...tema, formato: 'carrusel' }, pieza);
    expect(e).not.toMatch(/manda sobre el que sugirió la estrategia/);
  });

  it('sin fecha de publicación no inventa una línea vacía', () => {
    const e = armarEntradaPropuestas('ctx', tema, { formato: 'historia', plataforma: 'instagram' });
    expect(e).not.toContain('Fecha de publicación');
    expect(e).toContain('Instagram');
  });
});

describe('temaDelMapa', () => {
  const mapa = (n: number, texto: string) => ({
    datos: {
      pilares: [{
        numero: n, estado: 'ok',
        subcategorias: [{ nombre: 'Sub', temas: [{ id: `P${n}-S1-07`, texto, funcion: 'conexion', formato: 'reel' }] }],
      }],
    },
  });

  it('encuentra el tema y lo deja en la forma que necesita el prompt', () => {
    expect(temaDelMapa([mapa(2, 'El texto vigente')], 'P2-S1-07')).toEqual({
      id: 'P2-S1-07', texto: 'El texto vigente', funcion: 'conexion', formato: 'reel',
    });
  });

  it('gana la versión más reciente que tenga ese tema', () => {
    const mapas = [mapa(2, 'Versión nueva'), mapa(2, 'Versión vieja')];
    expect(temaDelMapa(mapas, 'P2-S1-07')?.texto).toBe('Versión nueva');
  });

  it('si el mapa nuevo no lo tiene, lo busca en el anterior: la pieza se planeó con aquel', () => {
    const mapas = [mapa(3, 'Otro pilar'), mapa(2, 'El de la pieza')];
    expect(temaDelMapa(mapas, 'P2-S1-07')?.texto).toBe('El de la pieza');
  });

  it('un id que no está en ningún mapa da null, y un mapa sin pilares no revienta', () => {
    expect(temaDelMapa([mapa(2, 'x')], 'P5-S3-20')).toBeNull();
    expect(temaDelMapa([{ datos: null }, { datos: { revision: {} } }, { datos: 'nada' }], 'P2-S1-07')).toBeNull();
    expect(temaDelMapa([], 'P2-S1-07')).toBeNull();
  });
});

describe('la llamada al modelo', () => {
  it('no sale a buscar a la web, valida con el esquema de propuestas y acota los tokens', async () => {
    await correrPropuestas('ctx', tema, pieza);
    expect(pedir).toHaveBeenCalledTimes(1);
    const [opts] = pedir.mock.calls[0];
    expect(opts.buscarWeb).toBe(false);
    expect(opts.schema).toBe(propuestasCopySchema);
    expect(opts.sistema).toBe(SISTEMA_COPY);
    expect(opts.maxTokens).toBe(8_000);
  });

  it('escribe con el modelo de redacción, configurable por entorno', () => {
    delete process.env.MODEL_RESEARCH;
    expect(modeloCopy()).toBe('claude-sonnet-5');
    process.env.MODEL_RESEARCH = 'claude-haiku-4-5';
    expect(modeloCopy()).toBe('claude-haiku-4-5');
  });

  it('una pieza por petición: una llamada, no una por opción ni una por lote', async () => {
    await generarPropuestas('ctx', tema, pieza);
    expect(pedir).toHaveBeenCalledTimes(1);
  });
});

describe('tope de gasto', () => {
  it('por omisión medio dólar por petición, y el entorno lo puede mover', () => {
    delete process.env.COST_LIMIT_PROPUESTAS_USD;
    expect(topePropuestasUsd()).toBe(0.5);
    process.env.COST_LIMIT_PROPUESTAS_USD = '2';
    expect(topePropuestasUsd()).toBe(2);
  });

  it('un tope inválido no deja el gasto suelto: se vuelve al de omisión', () => {
    for (const malo of ['cero', '-1', '0']) {
      process.env.COST_LIMIT_PROPUESTAS_USD = malo;
      expect(topePropuestasUsd()).toBe(0.5);
    }
  });

  it('el freno cuenta con las tarifas del modelo y corta al alcanzar el tope', () => {
    const { gasto, onUso } = frenoDeGasto('claude-sonnet-5', 0.05);
    // 1M de entrada con Sonnet son 2 USD; 15k son 0.03.
    expect(onUso(15_000, 0)).toBe(true);
    expect(gasto.valor).toBeCloseTo(calcularCosto('claude-sonnet-5', 15_000, 0), 6);
    // Otros 15k pasan de 0.05 y el freno dice que no se siga.
    expect(onUso(15_000, 0)).toBe(false);
    expect(gasto.valor).toBeCloseTo(0.06, 6);
  });

  it('el freno acumula entre llamadas: lo que importa es el total de la petición', () => {
    const { gasto, onUso } = frenoDeGasto('claude-sonnet-5', 100);
    onUso(1_000, 1_000);
    onUso(1_000, 1_000);
    expect(gasto.valor).toBeCloseTo(2 * calcularCosto('claude-sonnet-5', 1_000, 1_000), 6);
  });

  it('cada petición arranca de cero: el tope es por pieza, no por sesión', () => {
    const uno = frenoDeGasto('claude-sonnet-5', 0.05);
    uno.onUso(10_000, 10_000);
    expect(frenoDeGasto('claude-sonnet-5', 0.05).gasto.valor).toBe(0);
  });

  it('generarPropuestas le pasa su freno a pedirJson y devuelve lo que costó', async () => {
    process.env.MODEL_RESEARCH = 'claude-sonnet-5';
    pedir.mockImplementation(async (o: any) => {
      o.onUso?.(1_000, 1_000);
      return { datos: respuesta, tokensEntrada: 1_000, tokensSalida: 1_000 };
    });

    const r = await generarPropuestas('ctx', tema, pieza);
    expect(r.opciones).toHaveLength(OPCIONES);
    expect(r.tokensEntrada).toBe(1_000);
    expect(r.costoUsd).toBeCloseTo(calcularCosto('claude-sonnet-5', 1_000, 1_000), 6);
    expect(r.topeUsd).toBe(topePropuestasUsd());
    expect(r.topeAlcanzado).toBe(false);
  });

  it('avisa cuando la petición alcanzó su tope, y el propio freno ya lo había dicho', async () => {
    let frenado: boolean | undefined;
    pedir.mockImplementation(async (o: any) => {
      frenado = o.onUso?.(1_000_000, 1_000_000);
      return { datos: respuesta, tokensEntrada: 1_000_000, tokensSalida: 1_000_000 };
    });

    const r = await generarPropuestas('ctx', tema, pieza, { tope: 0.01, modelo: 'claude-sonnet-5' });
    // 18 USD contra un tope de 0.01: el freno contesta «no sigas».
    expect(frenado).toBe(false);
    expect(r.topeAlcanzado).toBe(true);
    expect(r.topeUsd).toBe(0.01);
  });

  it('el fallo del modelo sube tal cual: la ruta decide qué contestar', async () => {
    pedir.mockRejectedValue(new Error('El modelo no devolvió JSON válido tras dos intentos.'));
    await expect(generarPropuestas('ctx', tema, pieza)).rejects.toThrow('dos intentos');
  });
});
