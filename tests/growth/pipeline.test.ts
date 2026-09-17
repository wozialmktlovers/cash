import { describe, it, expect } from 'vitest';
import {
  ETAPAS_GROWTH, decidirParalelas, decidirPendientesGrowth, razonDeVacioGrowth,
} from '@/growth/pipeline';

describe('etapas del manual de campaña', () => {
  it('son cuatro, en su orden', () => {
    expect(ETAPAS_GROWTH).toEqual(['estructura', 'creativos', 'google', 'prompts']);
  });

  it('prompts espera; las otras tres van en paralelo', () => {
    expect(decidirParalelas(ETAPAS_GROWTH)).toEqual(['estructura', 'creativos', 'google']);
  });

  it('reanuda solo lo que no salió bien', () => {
    expect(decidirPendientesGrowth({ estructura: 'ok', creativos: 'fallo' }))
      .toEqual(['creativos', 'google', 'prompts']);
  });

  it('con estado vacío corre las cuatro', () => {
    expect(decidirPendientesGrowth({})).toHaveLength(4);
  });
});

describe('razón de los huecos', () => {
  it('distingue el fallo del agente del corte por costo', () => {
    expect(razonDeVacioGrowth('fallo')).toMatch(/no devolvió/i);
    expect(razonDeVacioGrowth('omitido_por_costo')).toMatch(/tope de costo/i);
    expect(razonDeVacioGrowth(undefined)).toMatch(/no se ejecutó/i);
  });

  it('la etapa detenida por un corte de cuenta no se confunde con un fallo del agente', () => {
    expect(razonDeVacioGrowth('abortado')).toMatch(/se detuvo/i);
    expect(razonDeVacioGrowth('abortado')).not.toMatch(/dos intentos|tope de costo/i);
  });

  it('nunca devuelve cadena vacía: un hueco sin razón es peor que el hueco', () => {
    for (const e of ['fallo', 'omitido_por_costo', 'abortado', 'corriendo', undefined, '']) {
      expect(razonDeVacioGrowth(e as any).length).toBeGreaterThan(10);
    }
  });
});
