import { describe, it, expect } from 'vitest';
import { cifrasSinRespaldo } from '@/research/cifras-lectura';

const fuente = { precios: ['$28,500 MXN', 'de $10,000 a $18,000'], seguidores: 16400, nota: '82% informal' };
const con = (...valores: string[]) => ({ cifras: valores.map((valor) => ({ valor })) });

describe('cifrasSinRespaldo', () => {
  it('acepta cifras cuyos dígitos aparecen en la fuente, con otro formato', () => {
    expect(cifrasSinRespaldo(con('$28,500', '18 mil', '82%'), fuente)).toEqual([]);
  });
  it('lee números sueltos de la fuente', () => {
    expect(cifrasSinRespaldo(con('16,400'), fuente)).toEqual([]);
  });
  it('rechaza las que no aparecen', () => {
    expect(cifrasSinRespaldo(con('$28,500', '$31,000'), fuente)).toEqual(['$31,000']);
  });
  it('rechaza valores sin ningún dígito', () => {
    expect(cifrasSinRespaldo(con('Mucho'), fuente)).toEqual(['Mucho']);
  });
  it('no deja pasar un número que solo es prefijo de otro concatenado en el mismo texto', () => {
    expect(cifrasSinRespaldo(con('$180', '$001'), { t: 'de $10,000 a $18,000' })).toEqual(['$180', '$001']);
  });
  it('sigue tolerando «mil» y «K» como el mismo número con otro formato', () => {
    expect(cifrasSinRespaldo(con('18 mil', '16.4K'), { t: 'de $10,000 a $18,000', s: 16400 })).toEqual([]);
  });

  it('acepta una cifra copiada tal cual, aunque la fuente use otro formato para el mismo número', () => {
    expect(cifrasSinRespaldo(con('18 mil'), { t: 'ganan 18 mil al mes' })).toEqual([]);
    expect(cifrasSinRespaldo(con('16.4K'), { t: 'tiene 16.4K seguidores' })).toEqual([]);
    expect(cifrasSinRespaldo(con('2.3 millones'), { t: 'factura 2.3 millones al año' })).toEqual([]);
    expect(cifrasSinRespaldo(con('$18,000'), { t: 'el precio es de $18,000.00' })).toEqual([]);
    expect(cifrasSinRespaldo(con('1,5 millones'), { t: 'un mercado de 1,5 millones de personas' })).toEqual([]);
  });

  it('acepta centavos y separadores mezclados en cualquier orden', () => {
    expect(cifrasSinRespaldo(con('$18,000.00'), { t: '$18,000 exactos' })).toEqual([]);
    expect(cifrasSinRespaldo(con('18000'), { t: 'cuesta $18,000.00 MXN' })).toEqual([]);
  });

  it('no lee «m²» ni «MXN» como multiplicador de millones', () => {
    // «Consultorio de 25 m²» no debe respaldar una cifra fabricada de 25 millones.
    expect(cifrasSinRespaldo(con('25,000,000'), { t: 'Consultorio de 25 m².' })).toEqual(['25,000,000']);
    // «$18,000.00 MXN» sigue valiendo 18,000, no 18,000,000,000 por leer la «M» de MXN.
    expect(cifrasSinRespaldo(con('$18,000'), { t: 'Cuesta $18,000.00 MXN' })).toEqual([]);
  });
});
