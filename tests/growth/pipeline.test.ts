import { describe, it, expect, vi } from 'vitest';
import {
  ETAPAS_GROWTH, decidirFases, decidirPendientesGrowth, razonDeVacioGrowth, conRegistro,
} from '@/growth/pipeline';

describe('etapas del manual de campaña', () => {
  it('son cuatro, en su orden', () => {
    expect(ETAPAS_GROWTH).toEqual(['estructura', 'creativos', 'google', 'prompts']);
  });

  it('estructura va primero; creativos y Google, que la leen, después y en paralelo; prompts aparte', () => {
    expect(decidirFases(ETAPAS_GROWTH)).toEqual([['estructura'], ['creativos', 'google']]);
  });

  it('al reanudar sin estructura pendiente, solo queda la fase que falta', () => {
    expect(decidirFases(['google', 'prompts'])).toEqual([['google']]);
  });

  it('reanuda solo lo que no salió bien', () => {
    expect(decidirPendientesGrowth({ estructura: 'ok', creativos: 'fallo' }))
      .toEqual(['creativos', 'google', 'prompts']);
  });

  it('con estado vacío corre las cuatro', () => {
    expect(decidirPendientesGrowth({})).toHaveLength(4);
  });
});

describe('registro de fallos por etapa', () => {
  it('deja el error con el id del trabajo y el nombre de la etapa, y lo propaga', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('El modelo no devolvió JSON válido tras dos intentos.');
    await expect(conRegistro('job-123', 'google', () => Promise.reject(error))).rejects.toBe(error);
    expect(espia).toHaveBeenCalledWith('[job-123] google:', error);
    espia.mockRestore();
  });

  it('si la etapa sale bien no registra nada', async () => {
    const espia = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(conRegistro('job-123', 'estructura', async () => 7)).resolves.toBe(7);
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
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
