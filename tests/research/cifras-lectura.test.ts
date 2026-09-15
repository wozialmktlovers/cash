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
});
