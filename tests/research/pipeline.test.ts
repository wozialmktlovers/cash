import { describe, it, expect } from 'vitest';
import { APIError } from '@anthropic-ai/sdk';
import {
  decidirEtapasPendientes, superaTope, repartirPorTope, ETAPAS, hayDatosParaLectura,
  entradaLectura, marcarDetenidas, razonDeVacio,
} from '@/research/pipeline';
import { MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO } from '@/research/claude';
import { CorteDeTrabajo, MENSAJE_SALDO, nuevaCaja } from '@/lib/errores-agentes';

/** El 400 de saldo agotado tal como lo construye el SDK. No sale a la red. */
const errorSinSaldo = () => APIError.generate(
  400,
  {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
    },
  },
  undefined,
  new Headers(),
);

const errorRateLimit = () => APIError.generate(
  429,
  { type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit.' } },
  undefined,
  new Headers(),
);

describe('reanudación', () => {
  it('omite las etapas ya completadas', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'ok' });
    expect(p).toEqual(['canales','mercado','sintesis','lectura']);
  });

  it('reintenta las etapas que fallaron', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'fallo' });
    expect(p).toContain('audiencia');
  });

  it('con estado vacío corre las seis', () => {
    expect(decidirEtapasPendientes({})).toHaveLength(6);
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

  it('sin saldo: lanza el corte, no deja arrancar nada nuevo y conserva lo que ya salió bien', async () => {
    const estado: Record<string, string> = {};
    const corte = nuevaCaja();
    const corridas: string[] = [];
    // `competencia` termina bien antes de que `audiencia` choque con el 400.
    // Se corren en dos tandas para que la segunda vea la caja ya marcada, que
    // es lo que pasa con las etapas que aún no han arrancado.
    await expect(repartirPorTope(['competencia', 'audiencia'], 15, { valor: 0 }, estado, async (etapa) => {
      corridas.push(etapa);
      if (etapa === 'audiencia') throw errorSinSaldo();
    }, () => {}, corte)).rejects.toThrow(MENSAJE_SALDO);

    expect(estado.competencia).toBe('ok');   // datos buenos: no se tiran
    expect(estado.audiencia).toBe('abortado'); // no es «el agente falló»

    // Segunda tanda con la misma caja: ni se intenta.
    await expect(repartirPorTope(['canales', 'mercado'], 15, { valor: 0 }, estado, async (etapa) => {
      corridas.push(etapa);
    }, () => {}, corte)).rejects.toThrow(MENSAJE_SALDO);

    expect(corridas).toEqual(['competencia', 'audiencia']);
    expect(estado.canales).toBe('abortado');
    expect(estado.mercado).toBe('abortado');
  });

  it('el corte lanzado es un CorteDeTrabajo con su motivo y el error original', async () => {
    const corte = nuevaCaja();
    const lanzado = await repartirPorTope(['competencia'], 15, { valor: 0 }, {}, async () => {
      throw errorSinSaldo();
    }, () => {}, corte).catch((e) => e);
    expect(lanzado).toBeInstanceOf(CorteDeTrabajo);
    expect(lanzado.motivo).toBe('saldo');
    expect((lanzado.causa as any).status).toBe(400);
  });

  it('un 429 NO aborta: la etapa falla y las demás siguen su camino', async () => {
    const estado: Record<string, string> = {};
    const corte = nuevaCaja();
    const corridas: string[] = [];
    await expect(repartirPorTope(['competencia', 'audiencia'], 15, { valor: 0 }, estado, async (etapa) => {
      corridas.push(etapa);
      if (etapa === 'competencia') throw errorRateLimit();
    }, () => {}, corte)).resolves.toBeUndefined();

    expect(corridas).toEqual(['competencia', 'audiencia']);
    expect(estado.competencia).toBe('fallo');
    expect(estado.audiencia).toBe('ok');
    expect(corte.valor).toBeNull();
  });

  it('publica el avance en cada cambio de estado, no solo al final', async () => {
    const estado: Record<string, string> = {};
    let publicaciones = 0;
    await repartirPorTope(['competencia'], 15, { valor: 0 }, estado, async () => {}, () => { publicaciones++; });
    expect(publicaciones).toBeGreaterThanOrEqual(2);
  });
});

describe('lectura para cliente', () => {
  it('es la última etapa', () => {
    expect(ETAPAS[ETAPAS.length - 1]).toBe('lectura');
  });
  it('corre si al menos una etapa previa trajo datos', () => {
    expect(hayDatosParaLectura({ mercado: { datos: [] } })).toBe(true);
    expect(hayDatosParaLectura({ sintesis: {} })).toBe(true);
  });
  it('no corre sin datos previos', () => {
    expect(hayDatosParaLectura({})).toBe(false);
    expect(hayDatosParaLectura({ lectura: {} })).toBe(false);
  });
});

describe('entradaLectura: qué se guarda en datos.lectura', () => {
  it('con datos, se guarda ok sin importar el estado', () => {
    expect(entradaLectura('ok', { portada: {} }, undefined)).toEqual({ estado: 'ok', datos: { portada: {} } });
  });

  it('omitido_por_costo: se omite la clave para reintentar en el próximo job', () => {
    expect(entradaLectura('omitido_por_costo', undefined, undefined)).toBeUndefined();
  });

  it('fallo por respuesta inválida (jerga, JSON roto, rechazo): se guarda vacío, es definitivo', () => {
    const jsonInvalido = new Error(`${MENSAJE_JSON_INVALIDO} Último error: jerga`);
    const declino = new Error(`${MENSAJE_DECLINO} (x).`);
    expect(entradaLectura('fallo', undefined, jsonInvalido)).toEqual({
      estado: 'vacio', razon: 'El agente no devolvió datos válidos tras dos intentos.',
    });
    expect(entradaLectura('fallo', undefined, declino)).toEqual({
      estado: 'vacio', razon: 'El agente no devolvió datos válidos tras dos intentos.',
    });
  });

  it('abortado por el corte: se omite la clave, la lectura se reintenta cuando haya saldo', () => {
    expect(entradaLectura('abortado', undefined, new CorteDeTrabajo('saldo'))).toBeUndefined();
  });

  it('fallo transitorio (saldo, red, 5xx): se omite la clave para reintentar', () => {
    expect(entradaLectura('fallo', undefined, new Error('400 credit balance is too low'))).toBeUndefined();
    expect(entradaLectura('fallo', undefined, new Error('fetch failed'))).toBeUndefined();
  });

  it('no se intentó (sin estado): se guarda vacío, igual que antes', () => {
    expect(entradaLectura(undefined, undefined, undefined)).toEqual({
      estado: 'vacio', razon: 'Esta etapa no se ejecutó.',
    });
  });
});

describe('marcarDetenidas: qué queda de las etapas que el corte no dejó correr', () => {
  it('marca abortado lo que no tiene desenlace propio', () => {
    const estado: Record<string, string> = { competencia: 'corriendo' };
    marcarDetenidas(['competencia', 'sintesis', 'lectura'], estado);
    expect(estado).toEqual({ competencia: 'abortado', sintesis: 'abortado', lectura: 'abortado' });
  });

  it('no pisa lo que ya se resolvió: ok, fallo y omitido_por_costo se respetan', () => {
    const estado: Record<string, string> = { competencia: 'ok', audiencia: 'fallo', canales: 'omitido_por_costo' };
    marcarDetenidas(['competencia', 'audiencia', 'canales'], estado);
    expect(estado).toEqual({ competencia: 'ok', audiencia: 'fallo', canales: 'omitido_por_costo' });
  });
});

describe('razón del hueco de una etapa detenida', () => {
  it('no la confunde con un fallo del agente ni con el tope de costo', () => {
    expect(razonDeVacio('abortado')).toMatch(/se detuvo/i);
    expect(razonDeVacio('abortado')).toMatch(/vuelve a lanzarlo/i);
    expect(razonDeVacio('abortado')).not.toMatch(/dos intentos|tope de costo/i);
  });
});
