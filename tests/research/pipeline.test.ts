import { describe, it, expect } from 'vitest';
import { decidirEtapasPendientes, superaTope, repartirPorTope } from '@/research/pipeline';

describe('reanudación', () => {
  it('omite las etapas ya completadas', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'ok' });
    expect(p).toEqual(['canales','mercado','sintesis']);
  });

  it('reintenta las etapas que fallaron', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'fallo' });
    expect(p).toContain('audiencia');
  });

  it('con estado vacío corre las cinco', () => {
    expect(decidirEtapasPendientes({})).toHaveLength(5);
  });
});

describe('tope de costo', () => {
  it('detiene al superar el límite', () => {
    expect(superaTope(16, 15)).toBe(true);
  });

  it('permite continuar por debajo', () => {
    expect(superaTope(9.5, 15)).toBe(false);
  });
});

describe('reparto con freno de costo', () => {
  /** Corre las etapas de una en una para que el gasto de la primera lo vean las siguientes. */
  const enSerie = async (etapas: string[], tope: number, costes: Record<string, number>) => {
    const estado: Record<string, string> = {};
    const gasto = { valor: 0 };
    const corridas: string[] = [];
    for (const e of etapas) {
      await repartirPorTope([e], tope, gasto, estado, async (etapa) => {
        corridas.push(etapa);
        gasto.valor += costes[etapa] ?? 0;
      });
    }
    return { estado, corridas, gasto };
  };

  it('marca omitidas las etapas que no arrancaron cuando una se pasó del tope', async () => {
    const { estado, corridas } = await enSerie(
      ['competencia', 'audiencia', 'canales', 'mercado'],
      3,
      { competencia: 4 },
    );
    expect(corridas).toEqual(['competencia']);
    expect(estado.competencia).toBe('ok');
    expect(estado.audiencia).toBe('omitido_por_costo');
    expect(estado.mercado).toBe('omitido_por_costo');
  });

  it('deja correr todas las etapas si el gasto no llega al tope', async () => {
    const { estado, corridas } = await enSerie(
      ['competencia', 'audiencia'],
      15,
      { competencia: 1, audiencia: 1 },
    );
    expect(corridas).toEqual(['competencia', 'audiencia']);
    expect(Object.values(estado)).toEqual(['ok', 'ok']);
  });

  it('una etapa que revienta queda en fallo sin arrastrar a las demás', async () => {
    const estado: Record<string, string> = {};
    const gasto = { valor: 0 };
    await repartirPorTope(['competencia', 'audiencia'], 15, gasto, estado, async (etapa) => {
      if (etapa === 'competencia') throw new Error('boom');
    });
    expect(estado.competencia).toBe('fallo');
    expect(estado.audiencia).toBe('ok');
  });

  it('publica el avance en cada cambio de estado, no solo al final', async () => {
    const estado: Record<string, string> = {};
    let publicaciones = 0;
    await repartirPorTope(['competencia'], 15, { valor: 0 }, estado, async () => {}, () => { publicaciones++; });
    expect(publicaciones).toBeGreaterThanOrEqual(2);
  });
});
