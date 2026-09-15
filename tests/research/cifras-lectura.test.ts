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
});
