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
  piezas: [] as Record<string, unknown>[],
  cambios: [] as Record<string, unknown>[],
  cambiosLote: [] as Record<string, unknown>[],
  cambiosPiezas: [] as Record<string, unknown>[],
  insertados: [] as Record<string, unknown>[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  // La consulta es «thenable» como la de Drizzle: se puede encadenar y se
  // puede esperar en cualquier punto. `loteActivo` termina en `.orderBy()` y
  // `refrescarLote` en `.where()`, así que las dos formas tienen que servir.
  // Qué devuelve depende de si el `select` pidió columnas: los lotes se traen
  // enteros (`select()`), las piezas por columnas.
  let piezasPedidas = false;
  const consulta = {
    from: () => consulta,
    where: () => consulta,
    orderBy: () => consulta,
    then: (resolver: (v: unknown) => unknown, rechazar: (e: unknown) => unknown) =>
      Promise.resolve(piezasPedidas ? espia.piezas : espia.lotes).then(resolver, rechazar),
  };
  const escritura = (destino: Record<string, unknown>[]) => {
    const w = {
      set(cambio: Record<string, unknown>) {
        destino.push(cambio);
        return w;
      },
      async where() {},
    };
    return w;
  };
  const alta = {
    values(fila: Record<string, unknown>) {
      espia.insertados.push(fila);
      return alta;
    },
    async onConflictDoNothing() {},
  };
  return {
    ...real,
    db: {
      select: (columnas?: unknown) => {
        piezasPedidas = columnas !== undefined;
        return consulta;
      },
      // Cada tabla, a su cesta: `compartirLote` escribe en las tres —piezas,
      // lote y etapa— y mezclarlas haría que una prueba de la etapa pasara
      // mirando, sin saberlo, la escritura de las piezas.
      update: (tabla: unknown) => escritura(
        tabla === real.contenidoLotes ? espia.cambiosLote
          : tabla === real.contenidoPiezas ? espia.cambiosPiezas
          : espia.cambios,
      ),
      insert: () => alta,
    },
  };
});

import { compartirLote, elegirLoteActivo, loteActivo, refrescarLote, sincronizarEtapa } from '@/contenido/servicio';
import { DIAS_REVISION_POR_OMISION, limiteRevision } from '@/contenido/reglas';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const lote = (periodo: string, estado: string) => ({ periodo, estado });

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.lotes = [];
  espia.piezas = [];
  espia.cambios = [];
  espia.cambiosLote = [];
  espia.cambiosPiezas = [];
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

/**
 * `refrescarLote` (B1): qué queda del lote después de dar de alta o borrar una
 * pieza. El caso que más importa es el que el plan dejó abierto —borrar la
 * última pieza— y por eso está probado en los dos bordes.
 */
describe('refrescarLote', () => {
  const sinCompartir = { id: 'l1', clientId: CLIENTE, estado: 'en_proceso' as const, compartidoEn: null };
  const compartido = { id: 'l1', clientId: CLIENTE, estado: 'en_revision' as const, compartidoEn: new Date('2026-09-10T18:00:00Z') };
  const pieza = (estadoCliente: string) => ({ formato: 'post', estadoCliente });

  it('el lote sin compartir no se deduce de sus piezas: se queda como está', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_proceso' }];
    espia.piezas = [pieza('pendiente'), pieza('pendiente')];
    expect(await refrescarLote(sinCompartir)).toBe('en_proceso');
    expect(espia.cambiosLote).toEqual([]);
  });

  it('borrar la última pieza de un lote sin compartir lo deja en_proceso', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_proceso' }];
    espia.piezas = [];
    expect(await refrescarLote(sinCompartir)).toBe('en_proceso');
    expect(espia.cambiosLote).toEqual([]);
  });

  // Los dos casos que siguen son el mismo criterio: vaciar o ampliar un mes ya
  // cerrado lo devuelve al OPERADOR (`en_proceso`, sin plazo), no a una
  // revisión que nadie pidió. `en_revision` sería aquí un plazo corriendo sobre
  // material que el cliente no ha visto —y con el límite muerto de la ronda
  // anterior—. El porqué entero está en `refrescarLote`; la secuencia completa,
  // con el barrido que lo aprobaba de inmediato, en `./lote-reabierto.test.ts`.

  it('borrar la última pieza de un lote compartido lo devuelve al operador: vacío no es aprobado', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'aprobada' }];
    espia.piezas = [];
    expect(await refrescarLote({ ...compartido, estado: 'aprobada' })).toBe('en_proceso');
    expect(espia.cambiosLote[0]).toMatchObject({ estado: 'en_proceso', compartidoEn: null, limiteRevision: null });
  });

  it('una pieza nueva en un lote aprobado lo devuelve al operador, con el plazo limpio', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'aprobada' }];
    espia.piezas = [pieza('aprobada'), pieza('pendiente')];
    expect(await refrescarLote({ ...compartido, estado: 'aprobada' })).toBe('en_proceso');
    expect(espia.cambiosLote[0]).toMatchObject({ estado: 'en_proceso', compartidoEn: null, limiteRevision: null });
  });

  it('quitar la pieza con cambios puede completar el aprobado del mes', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'con_cambios' }];
    espia.piezas = [pieza('aprobada'), pieza('aprobada')];
    expect(await refrescarLote({ ...compartido, estado: 'con_cambios' })).toBe('aprobada');
    expect(espia.cambiosLote[0]?.estado).toBe('aprobada');
  });

  it('si el estado no se mueve, no escribe el lote', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    espia.piezas = [pieza('pendiente')];
    expect(await refrescarLote(compartido)).toBe('en_revision');
    expect(espia.cambiosLote).toEqual([]);
  });

  it('siempre deja la etapa al día, aunque el lote no se haya movido', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    espia.piezas = [pieza('pendiente')];
    await refrescarLote(compartido);
    expect(espia.cambios[0]?.estado).toBe('en_revision');
  });
});

/**
 * Compartir el lote (C2). Lo que se comprueba es la decisión —cuándo arranca el
 * plazo y cuándo no— y que el plazo estampado sea exactamente `limiteRevision`,
 * no una fecha calculada aquí otra vez.
 */
describe('compartirLote', () => {
  const VIERNES = new Date('2026-09-11T23:00:00.000Z');
  const base = { id: 'l1', clientId: CLIENTE, compartidoEn: null, limiteRevision: null, contenidoActualizadoEn: null };

  it('un lote en proceso queda en revisión, con su compartido y su fecha límite', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    const r = await compartirLote({ ...base, estado: 'en_proceso' }, 2, VIERNES);

    expect(r.arrancoElPlazo).toBe(true);
    expect(r.estado).toBe('en_revision');
    expect(r.compartidoEn).toEqual(VIERNES);
    expect(r.limiteRevision).toEqual(limiteRevision(VIERNES, 2));
    expect(espia.cambiosLote[0]).toMatchObject({
      estado: 'en_revision', compartidoEn: VIERNES, limiteRevision: limiteRevision(VIERNES, 2),
    });
  });

  it('sin días de revisión del cliente usa los de la casa', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    const r = await compartirLote({ ...base, estado: 'en_proceso' }, null, VIERNES);
    expect(r.limiteRevision).toEqual(limiteRevision(VIERNES, DIAS_REVISION_POR_OMISION));
  });

  it('un `dias_revision` imposible no impide compartir: cae al de la casa', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    const r = await compartirLote({ ...base, estado: 'en_proceso' }, -3, VIERNES);
    expect(r.limiteRevision).toEqual(limiteRevision(VIERNES, DIAS_REVISION_POR_OMISION));
  });

  it('deja la etapa al día cuando el plazo arranca', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    await compartirLote({ ...base, estado: 'en_proceso' }, 2, VIERNES);
    expect(espia.cambios[0]?.estado).toBe('en_revision');
  });

  // La decisión sobre compartir dos veces, fijada con pruebas para que no se
  // deshaga por descuido: ver el porqué en `compartirLote`.
  it('volver a compartir un lote ya en revisión NO mueve la fecha límite', async () => {
    const compartidoEn = new Date('2026-09-10T20:00:00.000Z');
    const limite = limiteRevision(compartidoEn, 2);
    const r = await compartirLote(
      { ...base, estado: 'en_revision', compartidoEn, limiteRevision: limite }, 2, VIERNES,
    );

    expect(r.arrancoElPlazo).toBe(false);
    expect(r.estado).toBe('en_revision');
    expect(r.limiteRevision).toEqual(limite);
    expect(espia.cambiosLote).toEqual([]);
    expect(espia.cambios).toEqual([]);
  });

  it('compartir un lote aprobado no lo reabre ni le pone plazo nuevo', async () => {
    const compartidoEn = new Date('2026-09-01T20:00:00.000Z');
    const r = await compartirLote(
      { ...base, estado: 'aprobada', compartidoEn, limiteRevision: limiteRevision(compartidoEn, 2) }, 2, VIERNES,
    );

    expect(r.arrancoElPlazo).toBe(false);
    expect(r.estado).toBe('aprobada');
    expect(espia.cambiosLote).toEqual([]);
  });

  it('un lote con cambios SÍ reinicia el plazo: es una ronda nueva', async () => {
    espia.lotes = [{ id: 'l1', periodo: '2026-09', estado: 'en_revision' }];
    const viejo = new Date('2026-09-01T20:00:00.000Z');
    const r = await compartirLote(
      { ...base, estado: 'con_cambios', compartidoEn: viejo, limiteRevision: limiteRevision(viejo, 2) }, 2, VIERNES,
    );

    expect(r.arrancoElPlazo).toBe(true);
    expect(r.compartidoEn).toEqual(VIERNES);
    expect(r.limiteRevision).toEqual(limiteRevision(VIERNES, 2));

    // Y la ronda nueva empieza con las piezas devueltas otra vez pendientes,
    // sin la nota ni la fecha de la ronda anterior. El porqué, y la secuencia
    // completa que lo destapó, están en `tests/contenido/ronda-nueva.test.ts`.
    expect(espia.cambiosPiezas).toHaveLength(1);
    expect(espia.cambiosPiezas[0]).toMatchObject({
      estadoCliente: 'pendiente', notaCliente: null, revisadoEn: null,
    });
  });

  it('el lote que NO reinicia el plazo tampoco toca sus piezas', async () => {
    const compartidoEn = new Date('2026-09-10T20:00:00.000Z');
    await compartirLote(
      { ...base, estado: 'en_revision', compartidoEn, limiteRevision: limiteRevision(compartidoEn, 2) }, 2, VIERNES,
    );
    expect(espia.cambiosPiezas).toEqual([]);
  });
});
