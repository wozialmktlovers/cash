import { describe, it, expect } from 'vitest';
import { SISTEMA_PILARES, armarEntradaEstrategia, armarEntradaPilar, armarEntradaCorreccion } from '@/pilares/agentes';
import { estrategiaFalsa } from '../fixtures/pilares';
import completa from '../fixtures/investigacion-completa.json';

describe('sistema', () => {
  it('fija las reglas del estratega', () => {
    for (const s of ['300', 'Reels', 'no inventes', 'supuestos', 'frases de agencia']) expect(SISTEMA_PILARES.toLowerCase()).toContain(s.toLowerCase());
  });
});

describe('entradas', () => {
  it('la estrategia recibe el contexto y solo las etapas de investigación con datos', () => {
    const inv = { ...(completa as any), audiencia: { estado: 'vacio', razon: 'x' } };
    const e = armarEntradaEstrategia('## Cliente\nAna', inv);
    expect(e).toContain('## Cliente');
    expect(e).toContain('### Competencia');
    expect(e).not.toContain('### Audiencia');
    for (const campo of ['ideas', 'principios', 'pilares', 'subcategorias', 'mix', 'conversion', 'reglaEspecial', 'supuestos']) expect(e).toContain(campo);
  });

  it('el pilar recibe la estrategia completa, su número, su nombre y sus subcategorías', () => {
    const est = estrategiaFalsa();
    const e = armarEntradaPilar('ctx', est, 3);
    expect(e).toContain(JSON.stringify(est, null, 2));
    expect(e).toContain('pilar 3');
    expect(e).toContain('Pilar 3');
    for (const s of est.pilares[2].subcategorias) expect(e).toContain(s.nombre);
    for (const campo of ['texto', 'funcion', 'formato', 'reel', 'carrusel', 'story']) expect(e).toContain(campo);
  });

  it('la corrección lista los ids a reescribir y los temas a evitar', () => {
    const e = armarEntradaCorreccion(estrategiaFalsa(), 2, [{ id: 'P2-S1-04', texto: 'Tema viejo', funcion: 'venta', formato: 'reel' }], ['Otro tema']);
    expect(e).toContain('P2-S1-04');
    expect(e).toContain('Tema viejo');
    expect(e).toContain('Otro tema');
  });
});
