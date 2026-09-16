import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * El lote activo y su reflejo en `cliente_etapas` (A3).
 *
 * `elegirLoteActivo` es pura y se prueba directo. Para `loteActivo` y
 * `sincronizarEtapa` se simula `@/db` con el patrón de
 * `tests/api/usuarios-datos.test.ts`: las pruebas corren sin `DATABASE_URL`,
 * así que cualquier consulta que no esté simulada revienta en vez de pasar
 * de largo. Lo que se comprueba no es Drizzle, sino las decisiones: a qué
 * lote se mira, qué se escribe en la etapa y —sobre todo— qué NO se escribe
 * cuando no hay ningún lote.
 */
const espia = vi.hoisted(() => ({
  lotes: [] as Record<string, unknown>[],
  cambios: [] as Record<string, unknown>[],
  insertados: [] as Record<string, unknown>[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const lectura = {
    from: () => lectura,
    where: () => lectura,
    orderBy: async () => espia.lotes,
  };
  const escritura = {
    set(cambio: Record<string, unknown>) {
      espia.cambios.push(cambio);
      return escritura;
    },
    async where() {},
  };
  const alta = {
    values(fila: Record<string, unknown>) {
      espia.insertados.push(fila);
      return alta;
    },
    async onConflictDoNothing() {},
  };
  return { ...real, db: { select: () => lectura, update: () => escritura, insert: () => alta } };
});

import { elegirLoteActivo, loteActivo, sincronizarEtapa } from '@/contenido/servicio';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const lote = (periodo: string, estado: string) => ({ periodo, estado });

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.lotes = [];
  espia.cambios = [];
  espia.insertados = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('elegirLoteActivo', () => {
  it('sin lotes no hay activo', () => {
    expect(elegirLoteActivo([])).toBeNull();
  });

  it('con un solo lote, ese es el activo sea cual sea su estado', () => {
    for (const estado of ['en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      expect(elegirLoteActivo([lote('2026-09', estado)])?.periodo).toBe('2026-09');
    }
  });

  it('el más reciente de los que no están aprobados', () => {
    const lotes = [lote('2026-07', 'aprobada'), lote('2026-08', 'con_cambios'), lote('2026-09', 'en_revision')];
    expect(elegirLoteActivo(lotes)?.periodo).toBe('2026-09');
  });

  it('si todos están aprobados, el último', () => {
    const lotes = [lote('2026-07', 'aprobada'), lote('2026-08', 'aprobada'), lote('2026-09', 'aprobada')];
    expect(elegirLoteActivo(lotes)?.periodo).toBe('2026-09');
  });

  it('un mes viejo sin aprobar gana a uno nuevo ya aprobado', () => {
    // Abrir tarde el lote de agosto cuando septiembre ya cerró: el mes que
    // sigue pendiente es el que el equipo tiene que atender, y es lo que dice
    // el criterio del diseño §2 al pie de la letra.
    const lotes = [lote('2026-08', 'en_proceso'), lote('2026-09', 'aprobada')];
    expect(elegirLoteActivo(lotes)?.periodo).toBe('2026-08');
  });

  it('no depende del orden en que vengan los lotes', () => {
    const lotes = [lote('2026-09', 'aprobada'), lote('2026-07', 'en_proceso'), lote('2026-08', 'aprobada')];
    expect(elegirLoteActivo(lotes)?.periodo).toBe('2026-07');
    expect(elegirLoteActivo([...lotes].reverse())?.periodo).toBe('2026-07');
  });

  it('el cambio de año ordena bien: YYYY-MM se compara como texto igual que como fecha', () => {
    const lotes = [lote('2026-12', 'aprobada'), lote('2027-01', 'aprobada')];
    expect(elegirLoteActivo(lotes)?.periodo).toBe('2027-01');
  });
});

describe('loteActivo', () => {
  it('devuelve null cuando el cliente no tiene ningún lote', async () => {
    expect(await loteActivo(CLIENTE)).toBeNull();
  });

  it('devuelve la fila completa del lote elegido', async () => {
    espia.lotes = [
      { id: 'l1', periodo: '2026-09', estado: 'aprobada' },
      { id: 'l2', periodo: '2026-10', estado: 'en_proceso' },
    ];
    expect((await loteActivo(CLIENTE))?.id).toBe('l2');
  });
});

describe('sincronizarEtapa', () => {
  it('copia el estado del lote activo tal cual, sin traducirlo', async () => {
    for (const estado of ['en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      espia.cambios = [];
      espia.lotes = [{ id: 'l1', periodo: '2026-09', estado }];

      expect(await sincronizarEtapa(CLIENTE)).toBe(estado);
      expect(espia.cambios).toHaveLength(1);
      expect(espia.cambios[0]?.estado).toBe(estado);
    }
  });

  it('asegura la fila de la etapa antes de escribirla', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_proceso' }];
    await sincronizarEtapa(CLIENTE);
    expect(espia.insertados).toEqual([{ clientId: CLIENTE, etapa: 'desarrollo_mensual', contratada: true, interna: false }]);
  });

  it('sin ningún lote no escribe nada y devuelve null', async () => {
    // El criterio, que es lo que importa de este caso: la etapa contratada y
    // sin empezar ya se describe con el `no_iniciada` por omisión de su fila.
    // Escribirlo de todos modos sería deshacer en silencio un `iniciar`
    // manual del operador, y esta función espeja el lote activo, no repone
    // estados por su cuenta.
    expect(await sincronizarEtapa(CLIENTE)).toBeNull();
    expect(espia.cambios).toEqual([]);
    expect(espia.insertados).toEqual([]);
  });

  it('aprobar el último lote deja la etapa aprobada; abrir el mes siguiente la devuelve a en_proceso', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'aprobada' }];
    expect(await sincronizarEtapa(CLIENTE)).toBe('aprobada');

    // Octubre entra sin aprobar: pasa a ser el activo y la etapa retrocede.
    // Es correcto (diseño §2): hay trabajo nuevo que hacer, y el % del
    // cliente baja con él. Septiembre no se pierde, sigue en la tabla.
    espia.lotes = [
      { id: 'l1', periodo: '2026-09', estado: 'aprobada' },
      { id: 'l2', periodo: '2026-10', estado: 'en_proceso' },
    ];
    expect(await sincronizarEtapa(CLIENTE)).toBe('en_proceso');
  });
});
