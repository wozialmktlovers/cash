import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Auto-aprobación del lote al vencer el plazo (C3, diseño §6).
 *
 * La REGLA (`loteAutoAprobado`) ya está probada a fondo en `reglas.test.ts`,
 * sin base de datos. Aquí se prueba el EFECTO, que es lo nuevo: qué se escribe,
 * qué NO se escribe cuando la regla dice que no, qué pasa si dos lecturas
 * llegan a la vez, y que quede constancia de que la aprobación fue automática.
 *
 * Se simula `@/db` con el patrón de `servicio.test.ts`: las pruebas corren sin
 * `DATABASE_URL`, así que una consulta que no esté simulada revienta en vez de
 * pasar de largo. Lo que se comprueba no es Drizzle —el `FOR UPDATE` de verdad
 * lo pone Postgres—, sino las decisiones: que la regla se vuelva a evaluar
 * sobre la fila fresca y que nada se escriba ni se avise dos veces.
 */
const espia = vi.hoisted(() => ({
  /** Lo que devuelve la consulta de candidatos (lotes vencidos + su cliente). */
  candidatos: [] as Record<string, unknown>[],
  /** La fila del lote como la lee el `SELECT … FOR UPDATE`. Las escrituras la mutan. */
  lote: null as Record<string, unknown> | null,
  /** Los lotes del cliente, para `sincronizarEtapa`. */
  lotes: [] as Record<string, unknown>[],
  /** La fila de `cliente_etapas` (estado previo e id). */
  etapa: null as Record<string, unknown> | null,
  updates: [] as { tabla: string; cambio: Record<string, unknown> }[],
  eventos: [] as Record<string, unknown>[],
  avisos: [] as Record<string, unknown>[],
  fallar: false,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();

  const nombre = (tabla: unknown): string =>
    tabla === real.contenidoLotes ? 'lotes'
      : tabla === real.contenidoPiezas ? 'piezas'
      : tabla === real.clienteEtapas ? 'etapas'
      : tabla === real.etapaEventos ? 'eventos'
      : 'otra';

  /**
   * Qué contesta cada consulta. Se distingue por la tabla y por las columnas
   * pedidas, que es exactamente lo que distingue a las consultas reales:
   * `select()` entero es el de `sincronizarEtapa`, el que pide `cliente` es el
   * de candidatos, y el que pide `compartidoEn` es el bloqueado con `FOR
   * UPDATE`.
   */
  const filasDe = (tabla: string, columnas: string[] | null): Record<string, unknown>[] => {
    if (espia.fallar) throw new Error('la base no contesta');
    if (tabla === 'lotes') {
      if (columnas === null) return espia.lotes;
      if (columnas.includes('cliente')) return espia.candidatos;
      return espia.lote ? [espia.lote] : [];
    }
    if (tabla === 'etapas') return espia.etapa ? [espia.etapa] : [];
    return [];
  };

  const consulta = (columnas: string[] | null) => {
    let tabla = 'otra';
    const q: Record<string, unknown> = {
      from(t: unknown) { tabla = nombre(t); return q; },
      innerJoin() { return q; },
      where() { return q; },
      orderBy() { return q; },
      for() { return q; },
      limit() { return q; },
      then(resolver: (v: unknown) => unknown, rechazar: (e: unknown) => unknown) {
        try {
          return Promise.resolve(filasDe(tabla, columnas)).then(resolver, rechazar);
        } catch (e) {
          return Promise.reject(e).then(resolver, rechazar);
        }
      },
    };
    return q;
  };

  const escritura = (tabla: string) => {
    const w = {
      set(cambio: Record<string, unknown>) {
        espia.updates.push({ tabla, cambio });
        // La escritura del lote se refleja en la fila que verá el siguiente
        // `SELECT … FOR UPDATE`: es lo que hace realista la prueba de carrera.
        if (tabla === 'lotes') {
          // Solo el lote bloqueado, no todos: el `where` real lleva su id, y
          // hay pruebas con más de un mes abierto a la vez.
          if (espia.lote) Object.assign(espia.lote, cambio);
          for (const l of espia.lotes) {
            if (espia.lote && l.periodo === espia.lote.periodo) Object.assign(l, cambio);
          }
        }
        return w;
      },
      async where() {},
    };
    return w;
  };

  const alta = (tabla: string) => {
    const a = {
      values(fila: Record<string, unknown>) {
        if (tabla === 'eventos') espia.eventos.push(fila);
        return a;
      },
      async onConflictDoNothing() {},
    };
    return a;
  };

  const ejecutor = {
    select: (columnas?: Record<string, unknown>) => consulta(columnas ? Object.keys(columnas) : null),
    update: (tabla: unknown) => escritura(nombre(tabla)),
    insert: (tabla: unknown) => alta(nombre(tabla)),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(ejecutor),
  };

  return { ...real, db: ejecutor };
});

vi.mock('@/flujo/avisos', () => ({
  avisarLoteAutoAprobado: async (o: Record<string, unknown>) => { espia.avisos.push(o); },
}));

import {
  ACCION_AUTO_APROBADA,
  asegurarLotesAlDia,
  autoAprobarVencidos,
  textoConstancia,
} from '@/contenido/auto-aprobacion';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const LOTE = '00000000-0000-4000-8000-0000000000a1';
const ETAPA = '00000000-0000-4000-8000-0000000000e1';

/** El límite venció el 15 de septiembre a las 23:59:59.999 de México. */
const LIMITE = new Date('2026-09-15T23:59:59.999-06:00');
const DESPUES = new Date('2026-09-16T09:00:00-06:00');

const candidato = () => ({
  id: LOTE,
  clientId: CLIENTE,
  periodo: '2026-09',
  limiteRevision: LIMITE,
  cliente: 'Ana Villa',
  operadorId: null,
});

/** Un lote compartido, esperando al cliente, con el plazo ya cumplido. */
const vencido = (estado = 'en_revision') => ({
  periodo: '2026-09',
  estado,
  compartidoEn: new Date('2026-09-11T17:00:00-06:00'),
  limiteRevision: LIMITE,
  // Armado antes de repartirse: el plazo vale sobre lo que el cliente tiene
  // delante (ver `loteAutoAprobado`).
  contenidoActualizadoEn: new Date('2026-09-11T16:00:00-06:00'),
});

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.candidatos = [];
  espia.lote = null;
  espia.lotes = [];
  espia.etapa = { id: ETAPA, estado: 'en_revision' };
  espia.updates = [];
  espia.eventos = [];
  espia.avisos = [];
  espia.fallar = false;
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('textoConstancia', () => {
  it('dice el mes, la fecha límite y que la aprobación no fue del cliente', () => {
    const texto = textoConstancia('2026-09', LIMITE);
    expect(texto.toLowerCase()).toContain('septiembre');
    expect(texto).toContain('2026');
    // La fecha límite exacta, que es la mitad de la constancia.
    expect(texto).toContain('15 sep');
    expect(texto.toLowerCase()).toContain('no es una aprobación del cliente');
  });

  it('sin fecha límite guardada, sigue siendo una constancia legible', () => {
    const texto = textoConstancia('2026-09', null);
    expect(texto.toLowerCase()).toContain('septiembre');
    expect(texto.toLowerCase()).toContain('no es una aprobación del cliente');
  });
});

describe('autoAprobarVencidos', () => {
  it('sin lotes vencidos no escribe nada ni avisa a nadie', async () => {
    const r = await autoAprobarVencidos({ ahora: DESPUES });
    expect(r.aprobados).toBe(0);
    expect(espia.updates).toEqual([]);
    expect(espia.eventos).toEqual([]);
    expect(espia.avisos).toEqual([]);
  });

  it('aprueba el lote vencido y arrastra sus piezas pendientes', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    espia.lotes = [{ periodo: '2026-09', estado: 'en_revision' }];

    const r = await autoAprobarVencidos({ ahora: DESPUES });

    expect(r.aprobados).toBe(1);
    expect(espia.updates.find((u) => u.tabla === 'lotes')?.cambio.estado).toBe('aprobada');
    // Las piezas tienen que quedar aprobadas también: si no, el entregable
    // diría «14 de 22 aprobadas» de un lote aprobado, y `refrescarLote`
    // deshace la aprobación en cuanto alguien toque una pieza.
    const piezas = espia.updates.find((u) => u.tabla === 'piezas');
    expect(piezas?.cambio.estadoCliente).toBe('aprobada');
    expect(piezas?.cambio.revisadoEn).toEqual(DESPUES);
    // Y la etapa del cliente tiene que reflejarlo (`sincronizarEtapa`).
    expect(espia.updates.find((u) => u.tabla === 'etapas')?.cambio.estado).toBe('aprobada');
  });

  it('deja constancia en etapa_eventos de que fue automática, sin firmarla nadie', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    espia.lotes = [{ periodo: '2026-09', estado: 'en_revision' }];

    await autoAprobarVencidos({ ahora: DESPUES });

    expect(espia.eventos).toHaveLength(1);
    const ev = espia.eventos[0];
    expect(ev.etapaId).toBe(ETAPA);
    expect(ev.accion).toBe(ACCION_AUTO_APROBADA);
    // Nunca 'aprobar': esa es la acción de una persona, y es la que cuentan el
    // desempeño y la actividad del portal. Una aprobación que nadie hizo no
    // debe contarse como trabajo de nadie.
    expect(ev.accion).not.toBe('aprobar');
    // Sin usuario: la ficha pinta ese renglón como «Sistema».
    expect(ev.usuarioId).toBeNull();
    expect(ev.de).toBe('en_revision');
    expect(ev.a).toBe('aprobada');
    expect(String(ev.comentario).toLowerCase()).toContain('no es una aprobación del cliente');
  });

  it('el evento cuenta lo que le pasó a la ETAPA, no al lote: con otro mes abierto, la etapa no queda aprobada', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    // Septiembre se auto-aprueba, pero octubre ya está abierto: el lote activo
    // pasa a ser octubre y la etapa queda `en_proceso`.
    espia.lotes = [
      { periodo: '2026-09', estado: 'en_revision' },
      { periodo: '2026-10', estado: 'en_proceso' },
    ];

    await autoAprobarVencidos({ ahora: DESPUES });

    expect(espia.eventos[0].a).toBe('en_proceso');
    // El mes y el porqué van en el texto, que es donde se leen.
    expect(String(espia.eventos[0].comentario).toLowerCase()).toContain('septiembre');
  });

  it('avisa una sola vez, al equipo, con el enlace al mes', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    espia.lotes = [{ periodo: '2026-09', estado: 'en_revision' }];

    await autoAprobarVencidos({ ahora: DESPUES });

    expect(espia.avisos).toHaveLength(1);
    expect(espia.avisos[0]).toMatchObject({ cliente: 'Ana Villa', periodo: '2026-09' });
    expect(espia.avisos[0].enlace).toBe(`/clientes/${CLIENTE}/contenido/2026-09`);
  });

  it('dos lecturas a la vez no aprueban dos veces: la segunda encuentra el lote ya aprobado', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    espia.lotes = [{ periodo: '2026-09', estado: 'en_revision' }];

    const primera = await autoAprobarVencidos({ ahora: DESPUES });
    const escriturasTrasLaPrimera = espia.updates.length;

    // La segunda pestaña llega con la misma lista de candidatos (la armó antes
    // de que la primera terminara), pero al bloquear la fila la ve aprobada.
    espia.candidatos = [candidato()];
    const segunda = await autoAprobarVencidos({ ahora: DESPUES });

    expect(primera.aprobados).toBe(1);
    expect(segunda.aprobados).toBe(0);
    expect(espia.updates).toHaveLength(escriturasTrasLaPrimera);
    expect(espia.eventos).toHaveLength(1);
    expect(espia.avisos).toHaveLength(1);
  });

  it('manda la regla, no el prefiltro: si el cliente pidió cambios justo antes, no se aprueba', async () => {
    // El candidato se eligió cuando el lote seguía `en_revision`; al bloquear
    // la fila resulta que el cliente ya contestó. La pelota es del operador y
    // no vence nada (`loteAutoAprobado`).
    espia.candidatos = [candidato()];
    espia.lote = vencido('con_cambios');

    const r = await autoAprobarVencidos({ ahora: DESPUES });

    expect(r.aprobados).toBe(0);
    expect(espia.updates).toEqual([]);
    expect(espia.eventos).toEqual([]);
    expect(espia.avisos).toEqual([]);
  });

  it('un lote que se borró mientras tanto no rompe el barrido', async () => {
    espia.candidatos = [candidato()];
    espia.lote = null;

    await expect(autoAprobarVencidos({ ahora: DESPUES })).resolves.toEqual({ aprobados: 0 });
    expect(espia.eventos).toEqual([]);
  });

  it('el instante exacto del límite todavía es del cliente', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();

    const r = await autoAprobarVencidos({ ahora: LIMITE });

    expect(r.aprobados).toBe(0);
    expect(espia.updates).toEqual([]);
  });
});

describe('asegurarLotesAlDia', () => {
  it('resuelve el vencimiento igual que el barrido del worker', async () => {
    espia.candidatos = [candidato()];
    espia.lote = vencido();
    espia.lotes = [{ periodo: '2026-09', estado: 'en_revision' }];

    await asegurarLotesAlDia(CLIENTE);

    expect(espia.eventos).toHaveLength(1);
  });

  it('si la base falla, la pantalla sigue viva: no lanza', async () => {
    espia.fallar = true;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(asegurarLotesAlDia(CLIENTE)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
