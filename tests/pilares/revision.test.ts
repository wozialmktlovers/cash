import { describe, it, expect } from 'vitest';
import {
  normalizarTema, palabras, jaccard, sonParecidos, asignarIds, todosLosTemas,
  buscarDuplicados, mixReal, fueraDeMargen, aplicarReemplazos,
} from '@/pilares/revision';
import { estrategiaFalsa, pilarFalso, mapaFalso } from '../fixtures/pilares';

describe('similitud', () => {
  it('normaliza acentos, signos y espacios', () => {
    expect(normalizarTema('  ¿Esto es  NORMAL? ')).toBe('esto es normal');
  });
  it('palabras solo cuenta las de 4 letras o más', () => {
    expect([...palabras('No sé si esto pasa')]).toEqual(['esto', 'pasa']);
  });
  it('jaccard', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it('detecta textos iguales o muy parecidos', () => {
    expect(sonParecidos('¿Berrinche o manipulación?', 'berrinche o manipulacion')).toBe(true);
    expect(sonParecidos('Cuando tu hijo explota después de la escuela', 'Cuando tu hijo explota después del kínder escuela')).toBe(true);
    expect(sonParecidos('Miedos nocturnos en la infancia', 'Cómo elegir terapia de lenguaje')).toBe(false);
  });
});

describe('ids y recorridos', () => {
  it('asigna ids P-S-nn estables', () => {
    const p = asignarIds(2, pilarFalso(2, estrategiaFalsa()));
    expect(p.estado).toBe('ok');
    expect(p.subcategorias[0].temas[0].id).toBe('P2-S1-01');
    expect(p.subcategorias[2].temas[19].id).toBe('P2-S3-20');
  });
  it('todosLosTemas ignora pilares vacíos', () => {
    const m = mapaFalso();
    m.pilares[4] = { numero: 5, estado: 'vacio', razon: 'x' };
    expect(todosLosTemas(m.pilares)).toHaveLength(240);
  });
});

describe('revisión', () => {
  it('el mapa sintético no tiene duplicados', () => {
    expect(buscarDuplicados(todosLosTemas(mapaFalso().pilares))).toEqual([]);
  });
  it('encuentra duplicados entre pilares y devuelve el par en orden', () => {
    const m = mapaFalso();
    const a = (m.pilares[0] as any).subcategorias[0].temas[0];
    (m.pilares[3] as any).subcategorias[1].temas[4].texto = a.texto;
    expect(buscarDuplicados(todosLosTemas(m.pilares))).toEqual([['P1-S1-01', 'P4-S2-05']]);
  });
  it('mix real en porcentajes enteros', () => {
    const real = mixReal(todosLosTemas(mapaFalso().pilares));
    expect(real).toEqual({ autoridad: 30, conexion: 30, engagement: 10, prueba_social: 10, venta: 20 });
    expect(mixReal([])).toEqual({ autoridad: 0, conexion: 0, engagement: 0, prueba_social: 0, venta: 0 });
  });
  it('fuera de margen con más de 5 puntos', () => {
    const mix = estrategiaFalsa().mix;
    expect(fueraDeMargen(mix, { autoridad: 36, conexion: 25, engagement: 10, prueba_social: 10, venta: 19 })).toEqual(['autoridad']);
  });
  it('aplica reemplazos sin mutar el original', () => {
    const m = mapaFalso();
    const nuevos = aplicarReemplazos(m.pilares, [{ id: 'P3-S2-10', texto: 'Tema reescrito', funcion: 'venta', formato: 'story' }]);
    expect((nuevos[2] as any).subcategorias[1].temas[9]).toEqual({ id: 'P3-S2-10', texto: 'Tema reescrito', funcion: 'venta', formato: 'story' });
    expect((m.pilares[2] as any).subcategorias[1].temas[9].texto).not.toBe('Tema reescrito');
  });
});
