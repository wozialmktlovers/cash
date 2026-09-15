import { describe, it, expect } from 'vitest';
import { necesitaLectura, esRespuestaInvalida, previosDesde } from '@/research/convertir-lecturas';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

const vacia = {
  competencia: { estado: 'vacio', razon: 'x' }, audiencia: { estado: 'vacio', razon: 'x' },
  canales: { estado: 'vacio', razon: 'x' }, mercado: { estado: 'vacio', razon: 'x' }, sintesis: { estado: 'vacio', razon: 'x' },
};

describe('necesitaLectura', () => {
  it('sí, si no tiene lectura y alguna etapa trae datos', () => {
    expect(necesitaLectura(completa)).toBe(true);
    expect(necesitaLectura(parcial)).toBe(true);
  });
  it('no, si ya tiene lectura, aunque sea vacía', () => {
    expect(necesitaLectura({ ...completa, lectura: { estado: 'ok', datos: {} } })).toBe(false);
    expect(necesitaLectura({ ...completa, lectura: { estado: 'vacio', razon: 'x' } })).toBe(false);
  });
  it('no, si ninguna etapa trajo datos o los datos no son objeto', () => {
    expect(necesitaLectura(vacia)).toBe(false);
    expect(necesitaLectura(null)).toBe(false);
    expect(necesitaLectura('x')).toBe(false);
  });
});

describe('esRespuestaInvalida', () => {
  it('distingue una respuesta que no cumplió el esquema', () => {
    expect(esRespuestaInvalida(new Error('El modelo no devolvió JSON válido tras dos intentos. Último error: jerga'))).toBe(true);
    expect(esRespuestaInvalida(new Error('El modelo declinó la petición (x).'))).toBe(true);
  });
  it('trata todo lo demás como error de API que se reintenta después', () => {
    expect(esRespuestaInvalida(new Error('400 credit balance is too low'))).toBe(false);
    expect(esRespuestaInvalida(new Error('fetch failed'))).toBe(false);
    expect(esRespuestaInvalida('texto')).toBe(false);
  });
});

describe('previosDesde', () => {
  it('toma solo los datos de las etapas ok', () => {
    const p = previosDesde(parcial);
    expect(Object.keys(p)).toEqual(['competencia']);
    expect(p.competencia).toEqual((parcial as any).competencia.datos);
  });
});
