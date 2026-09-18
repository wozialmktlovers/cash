import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * La **segunda ronda de revisión**: qué pasa con las piezas que el cliente
 * devolvió cuando el operador las corrige y vuelve a compartir el mes
 * (diseño §6, «una ronda nueva sobre contenido que el cliente no ha visto»).
 *
 * Usa la base en miniatura de `./doble-base.ts` y no el doble de siempre. La
 * razón está en lo que se prueba: la secuencia completa —compartir, pedir
 * cambios, recompartir, dar de alta una pieza— es una cadena de escrituras
 * donde **cada paso lee lo que escribió el anterior**. Los dobles de
 * `servicio.test.ts` y `auto-aprobacion.test.ts` devuelven filas fijas y solo
 * apuntan los `set`, así que no pueden encadenar: con ellos el error de esta
 * secuencia es literalmente invisible.
 */

const espia = vi.hoisted(() => ({
  lotes: [] as Fila[],
  piezas: [] as Fila[],
  etapas: [] as Fila[],
  eventos: [] as Fila[],
}));

vi.mock('@/flujo/avisos', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/avisos')>()),
  avisarLoteAutoAprobado: vi.fn(async () => {}),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const { dobleDeBase } = await import('./doble-base');
  return { ...real, db: dobleDeBase(real, espia) };
});

import { autoAprobarVencidos } from '@/contenido/auto-aprobacion';
import { avanceRevision, estadoLoteSegunPiezas, limiteRevision } from '@/contenido/reglas';
import { compartirLote, refrescarLote, type LoteCompartible } from '@/contenido/servicio';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const LOTE = '00000000-0000-4000-8000-00000000010e';

/** El día anterior: el operador armó las piezas del mes. */
const ARMADO = new Date('2026-09-09T16:00:00.000Z');
/** Jueves de septiembre de 2026, a media mañana de México. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El viernes siguiente: el operador ya corrigió lo que el cliente pidió. */
const RONDA_2 = new Date('2026-09-11T16:00:00.000Z');

const piezaDe = (n: number): Fila => ({
  id: `pieza-${n}`,
  loteId: LOTE,
  numero: n,
  formato: 'post',
  estadoCliente: 'pendiente',
  notaCliente: null,
  revisadoEn: null,
});

const filaLote = (): Fila => espia.lotes[0]!;

/** El lote tal como lo lee `compartirLote` desde la ruta de compartir. */
const comoCompartible = (): LoteCompartible => {
  const l = filaLote();
  return {
    id: l.id as string,
    clientId: l.clientId as string,
    estado: l.estado as LoteCompartible['estado'],
    compartidoEn: (l.compartidoEn ?? null) as Date | null,
    limiteRevision: (l.limiteRevision ?? null) as Date | null,
    contenidoActualizadoEn: (l.contenidoActualizadoEn ?? null) as Date | null,
  };
};

/** El lote tal como lo lee `refrescarLote` desde el alta o el borrado de una pieza. */
const comoRefrescable = () => {
  const l = filaLote();
  return {
    id: l.id as string,
    clientId: l.clientId as string,
    estado: l.estado as LoteCompartible['estado'],
    compartidoEn: (l.compartidoEn ?? null) as Date | null,
    limiteRevision: (l.limiteRevision ?? null) as Date | null,
    contenidoActualizadoEn: (l.contenidoActualizadoEn ?? null) as Date | null,
  };
};

/**
 * Lo que hace `registrarRevision` cuando el cliente pide cambios en una pieza,
 * reducido a sus dos escrituras: la pieza queda `cambios` con su nota, y el
 * lote se recalcula con `estadoLoteSegunPiezas`, que es la misma función que
 * usa la ruta de verdad. No se llama a `registrarRevision` porque arrastra
 * sesión, permisos, visibilidad y tope de observaciones, nada de lo cual
 * interviene en lo que aquí se prueba.
 */
const clientePideCambios = (numero: number, nota: string, cuando: Date) => {
  const pieza = espia.piezas.find((p) => p.numero === numero)!;
  Object.assign(pieza, { estadoCliente: 'cambios', notaCliente: nota, revisadoEn: cuando });
  filaLote().estado = estadoLoteSegunPiezas(
    espia.piezas.map((p) => ({ formato: p.formato as 'post', estadoCliente: p.estadoCliente as 'cambios' })),
  );
};

const estados = () => espia.piezas.map((p) => p.estadoCliente);

beforeEach(async () => {
  // `contenidoActualizadoEn` anterior al reparto: el plazo vale sobre lo que el
  // cliente recibe (ver `loteAutoAprobado`, src/contenido/reglas.ts).
  espia.lotes = [{ id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_proceso', compartidoEn: null, limiteRevision: null, contenidoActualizadoEn: ARMADO }];
  espia.piezas = [piezaDe(1), piezaDe(2), piezaDe(3)];
  espia.etapas = [];
  espia.eventos = [];
});

/** Ronda 1 completa: se comparte el mes y el cliente devuelve la pieza 3. */
async function hastaLaRonda2() {
  await compartirLote(comoCompartible(), 2, RONDA_1);
  clientePideCambios(3, 'Cambien la foto por una del consultorio nuevo.', RONDA_1);
  expect(filaLote().estado).toBe('con_cambios');
  // El operador corrige la pieza 3 —`PATCH` no puede tocar `estado_cliente`,
  // a propósito— y vuelve a compartir el mes.
  return compartirLote(comoCompartible(), 2, RONDA_2);
}

describe('recompartir un lote con cambios', () => {
  it('reinicia el plazo Y devuelve a pendiente las piezas que el cliente había devuelto', async () => {
    const r = await hastaLaRonda2();

    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().estado).toBe('en_revision');
    expect(filaLote().limiteRevision).toEqual(limiteRevision(RONDA_2, 2));
    // Lo que faltaba: la pieza 3 empieza la ronda 2 sin la respuesta que el
    // cliente dio a la ronda 1.
    expect(estados()).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });

  it('no toca las piezas que el cliente ya había aprobado', async () => {
    espia.piezas[0]!.estadoCliente = 'aprobada';
    espia.piezas[0]!.revisadoEn = RONDA_1;
    await hastaLaRonda2();

    // Aprobado sigue aprobado: la ronda nueva es sobre lo que se corrigió, no
    // un borrón y cuenta nueva del mes entero.
    expect(estados()).toEqual(['aprobada', 'pendiente', 'pendiente']);
    expect(espia.piezas[0]!.revisadoEn).toEqual(RONDA_1);
  });

  it('la nota de la ronda anterior no viaja a la ronda nueva', async () => {
    await hastaLaRonda2();

    const pieza3 = espia.piezas[2]!;
    expect(pieza3.notaCliente).toBeNull();
    expect(pieza3.revisadoEn).toBeNull();
  });

  it('compartir un lote que no reinicia el plazo tampoco toca ninguna pieza', async () => {
    await compartirLote(comoCompartible(), 2, RONDA_1);
    clientePideCambios(3, 'Otra foto, por favor.', RONDA_1);
    // `en_revision` no reinicia (es el enlace reenviado a otra persona): para
    // probarlo hace falta un lote en ese estado, así que se fuerza la fila.
    filaLote().estado = 'en_revision';

    const r = await compartirLote(comoCompartible(), 2, RONDA_2);
    expect(r.arrancoElPlazo).toBe(false);
    expect(estados()).toEqual(['pendiente', 'pendiente', 'cambios']);
  });
});

describe('la ronda nueva deja la máquina de estados otra vez en marcha', () => {
  it('dar de alta una pieza después de recompartir NO saca al lote de en_revision', async () => {
    await hastaLaRonda2();

    // El alta de una pieza (B1) mete la fila y refresca el lote.
    espia.piezas.push(piezaDe(4));
    const estado = await refrescarLote(comoRefrescable());

    // Con la pieza 3 arrastrando su `cambios`, esto deducía `con_cambios`: el
    // lote salía de `en_revision` y su plazo ya no vencía nunca.
    expect(estado).toBe('en_revision');
    expect(filaLote().estado).toBe('en_revision');
  });

  it('al vencer el plazo de la ronda nueva el mes queda aprobado entero', async () => {
    await hastaLaRonda2();

    const despues = new Date(limiteRevision(RONDA_2, 2).getTime() + 60_000);
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: despues })).toEqual({ aprobados: 1 });

    expect(filaLote().estado).toBe('aprobada');
    // Ninguna pieza se queda fuera de la aprobación: el entregable diría
    // «2 de 3 aprobadas» sobre un mes aprobado, y el cliente ya no podría
    // arreglarlo (la ruta de revisión contesta 409).
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
    const avance = avanceRevision(espia.piezas.map((p) => ({ formato: 'post', estadoCliente: p.estadoCliente as 'aprobada' })));
    expect(avance).toEqual({ aprobadas: 3, total: 3, porcentaje: 100 });
  });

  it('y esa aprobación no se deshace sola al tocar otra pieza del mes', async () => {
    await hastaLaRonda2();
    const despues = new Date(limiteRevision(RONDA_2, 2).getTime() + 60_000);
    await autoAprobarVencidos({ clientId: CLIENTE, ahora: despues });

    // Borrar una pieza de un mes ya aprobado: el lote sigue aprobado porque
    // las que quedan lo están. (Un ALTA sí lo saca de ahí —hay contenido que el
    // cliente no ha visto—, pero lo devuelve al OPERADOR, no a una revisión con
    // el plazo ya vencido: ver `./lote-reabierto.test.ts`.)
    espia.piezas.splice(1, 1);
    expect(await refrescarLote(comoRefrescable())).toBe('aprobada');
    expect(espia.etapas[0]?.estado).toBe('aprobada');
  });
});
