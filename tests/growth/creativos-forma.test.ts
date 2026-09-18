import { describe, it, expect } from 'vitest';
import { prepararCreativos } from '@/growth/normalizar';
import { creativosSchema } from '@/growth/schemas';
import { FORMA_CREATIVOS } from '@/growth/agents/creativos';

// Reproduce el fallo de producción (Mar de miel, job f4f4f04e):
// «creativos.0.ratio: expected one of 1x1|4x5|9x16; creativos.0.angulo: received undefined».
describe('prepararCreativos', () => {
  const crudo = {
    creativos: ['a', 'b', 'c'].flatMap((g) => [
      { grupo: `Grupo ${g.toUpperCase()}`, formato: 'Imagen', ratio: '1:1', medidas: '1080x1080', copyA: 'Uno', copyB: 'Dos' },
      { grupo: g, formato: 'Carrusel 4:5', ratio: '4:5', copyA: 'Uno', copyB: 'Dos' },
      { grupo: g, formato: 'Reel', ratio: '9:16', ángulo: 'Ángulo propio', copyA: 'Uno', copyB: 'Dos' },
    ]),
  };

  it('fija ratio y medidas por formato y toma el ángulo de su grupo en la estructura', () => {
    const preparado = prepararCreativos({ a: 'Ángulo A', b: 'Ángulo B', c: 'Ángulo C' })(crudo);
    const r = creativosSchema.safeParse(preparado);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.creativos).toHaveLength(9);
    expect(r.data.creativos[0]).toMatchObject({ grupo: 'a', formato: 'imagen', ratio: '1x1', medidas: '1080 × 1080 px', angulo: 'Ángulo A' });
    expect(r.data.creativos[1]).toMatchObject({ formato: 'carrusel', ratio: '4x5' });
    expect(r.data.creativos[2]).toMatchObject({ formato: 'video', ratio: '9x16', angulo: 'Ángulo propio' });
  });

  it('acepta menos de nueve creativos en vez de tirar la etapa', () => {
    const preparado = prepararCreativos({ a: 'Ángulo A' })({ creativos: [crudo.creativos[0]] });
    expect(creativosSchema.safeParse(preparado).success).toBe(true);
  });

  it('el pedido describe la forma con el ratio escrito con x', () => {
    expect(FORMA_CREATIVOS).toContain('"creativos"');
    expect(FORMA_CREATIVOS).toContain('4x5, no 4:5');
  });
});
