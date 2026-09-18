import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **El último hermano de la familia del plazo: el gesto que cierra el mes es
 * del OPERADOR, no del cliente.**
 *
 * `./plazo-turno-ajeno.test.ts` y `./plazo-mes-aprobado.test.ts` cerraron la
 * misma puerta por el lado de `registrarRevision`: el plazo que se consumió
 * mientras el mes esperaba al equipo no revive cuando el cliente se retracta de
 * la pieza que había devuelto. Queda el camino gemelo, y por él no pasa el
 * cliente:
 *
 * compartir → el cliente devuelve una pieza → el plazo vence con la pelota del
 * operador → el operador **resuelve la petición borrando esa pieza** en vez de
 * corregirla.
 *
 * Sin la pieza en `cambios`, `estadoLoteSegunPiezas` deduce `aprobada` de lo que
 * queda —lo que el cliente ya había aprobado en la ronda 1— y `refrescarLote`
 * aceptaba ese estado tal cual, **con el `limite_revision` muerto de la ronda 1
 * a cuestas**. A partir de ahí `aceptaDecision` (../../src/contenido/revision.ts)
 * le cerraba la puerta al cliente con `razonPlazoVencido`: el mismo mensaje, el
 * mismo daño y la misma causa raíz que en los dos hermanos anteriores —ese reloj
 * también corrió esperando al equipo—, con la única diferencia de quién movió el
 * mes al final.
 *
 * La decisión tomada es que **el principio manda sobre el actor**: un reloj
 * consumido en turno del equipo no cuenta contra el cliente, lo mueva él o lo
 * mueva el operador. Así que aquí el plazo se apaga igual (`limite_revision`
 * nulo) y el mes queda `aprobada` **pero no cerrado**, exactamente el estado que
 * `compartirLote` sabe cerrar al volver a repartir el mes (su «quinto caso»).
 *
 * Y lo que NO se afloja, que es lo que la familia entera existe para respetar:
 * un mes **auto-aprobado por vencimiento legítimo** —la pelota era del cliente y
 * no contestó— sigue cerrado con su fecha aunque después se le borre una pieza.
 * Ese plazo corrió en el turno de quien tenía que contestar.
 *
 * Mismo doble y mismo manejo del reloj que `./plazo-turno-ajeno.test.ts`:
 * `registrarRevision` arranca llamando a `asegurarLotesAlDia`, que resuelve los
 * vencimientos con `new Date()` y no acepta un instante, así que el reloj del
 * sistema se fija con `vi.setSystemTime` en cada paso.
 */

const espia = vi.hoisted(() => ({
  lotes: [] as Fila[],
  piezas: [] as Fila[],
  etapas: [] as Fila[],
  eventos: [] as Fila[],
  comentarios: [] as Fila[],
}));

const ids = vi.hoisted(() => ({
  cliente: '00000000-0000-4000-8000-0000000000c3',
  lote: '00000000-0000-4000-8000-000000000110',
  usuario: '00000000-0000-4000-8000-0000000000a3',
}));

vi.mock('@/flujo/avisos', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/avisos')>()),
  avisarLoteAutoAprobado: vi.fn(async () => {}),
  avisarComentarioCliente: vi.fn(async () => {}),
}));

vi.mock('@/flujo/servicio', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/servicio')>()),
  rechazoPorLimite: vi.fn(async () => null),
}));

vi.mock('@/lib/visibilidad', async (importarReal) => ({
  ...(await importarReal<typeof import('@/lib/visibilidad')>()),
  piezaVisible: vi.fn(async (_u: unknown, piezaId: string) => {
    const pieza = espia.piezas.find((p) => p.id === piezaId);
    if (!pieza) return null;
    const lote = espia.lotes.find((l) => l.id === pieza.loteId);
    if (!lote) return null;
    return { pieza, lote, cliente: { id: ids.cliente, nombre: 'Olam Dental', operadorId: null } };
  }),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const { dobleDeBase } = await import('./doble-base');
  return { ...real, db: dobleDeBase(real, espia) };
});

import { autoAprobarVencidos } from '@/contenido/auto-aprobacion';
import { limiteRevision } from '@/contenido/reglas';
import { razonPlazoVencido, registrarRevision } from '@/contenido/revision';
import {
  compartirLote,
  marcarContenidoTocado,
  refrescarLote,
  type LoteCompartible,
  type LoteRefrescable,
} from '@/contenido/servicio';
import type { UsuarioSesion } from '@/lib/permisos';

/** Martes de septiembre de 2026: el operador arma el lote del mes. */
const CREADO = new Date('2026-09-08T16:00:00.000Z');
/** Jueves a media mañana de México: se comparte el mes. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El plazo de esa ronda, con los 2 días hábiles de la casa. */
const LIMITE_1 = limiteRevision(RONDA_1, 2);
/** Dos horas después, el cliente aprueba dos piezas y devuelve la tercera. */
const REVISA = new Date(RONDA_1.getTime() + 2 * 3_600_000);
/** Un minuto después del límite, con el mes todavía del lado del operador. */
const VENCIDO = new Date(LIMITE_1.getTime() + 60_000);
/** Dos días después, el operador por fin atiende la petición. */
const BORRA = new Date(LIMITE_1.getTime() + 2 * 86_400_000);
/** El barrido del worker que viene detrás. */
const BARRIDO = new Date(BORRA.getTime() + 10 * 60_000);

const CLIENTE: UsuarioSesion = {
  id: ids.usuario,
  email: 'ana@olamdental.mx',
  nombre: 'Ana',
  apellido: null,
  rol: 'cliente',
  clientId: ids.cliente,
  activo: true,
};

const piezaDe = (n: number): Fila => ({
  id: `pieza-${n}`,
  loteId: ids.lote,
  numero: n,
  formato: 'post',
  copy: `Copy de la pieza ${n}`,
  estadoCliente: 'pendiente',
  notaCliente: null,
  revisadoEn: null,
});

const filaLote = (): Fila => espia.lotes[0]!;

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
const comoRefrescable = (): LoteRefrescable => {
  const l = filaLote();
  return {
    id: l.id as string,
    clientId: l.clientId as string,
    estado: l.estado as LoteRefrescable['estado'],
    compartidoEn: (l.compartidoEn ?? null) as Date | null,
    limiteRevision: (l.limiteRevision ?? null) as Date | null,
    contenidoActualizadoEn: (l.contenidoActualizadoEn ?? null) as Date | null,
  };
};

/**
 * El borrado de una pieza tal como lo hace la ruta de verdad (`DELETE
 * /api/contenido/piezas/[id]`): quitar la fila, dejar constancia de que el
 * contenido del mes se movió y recalcular el estado del lote, todo con el mismo
 * instante.
 */
async function operadorBorra(numero: number, cuando: Date) {
  const i = espia.piezas.findIndex((p) => p.numero === numero);
  espia.piezas.splice(i, 1);
  await marcarContenidoTocado(ids.lote, cuando);
  return refrescarLote(comoRefrescable(), cuando);
}

const estados = () => espia.piezas.map((p) => p.estadoCliente);

const reloj = (t: Date) => vi.setSystemTime(t);

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers();
  reloj(CREADO);
  espia.lotes = [{
    id: ids.lote,
    clientId: ids.cliente,
    periodo: '2026-09',
    estado: 'en_proceso',
    compartidoEn: null,
    limiteRevision: null,
    contenidoActualizadoEn: CREADO,
    creadoEn: CREADO,
  }];
  espia.piezas = [piezaDe(1), piezaDe(2), piezaDe(3)];
  espia.etapas = [];
  espia.eventos = [];
  espia.comentarios = [];
});

/**
 * El guión del planteamiento hasta justo antes del borrado: el cliente contestó
 * dentro de su plazo —aprobó dos piezas y devolvió una—, y el plazo venció
 * después, mientras el mes esperaba al operador.
 */
async function hastaElConCambiosVencido() {
  reloj(RONDA_1);
  await compartirLote(comoCompartible(), 2, RONDA_1);

  reloj(REVISA);
  for (const n of [1, 2]) {
    const r = await registrarRevision({
      piezaId: `pieza-${n}`, usuario: CLIENTE, decision: 'aprobar', nota: '', ahora: REVISA,
    });
    expect(r.ok).toBe(true);
  }
  const cambios = await registrarRevision({
    piezaId: 'pieza-3',
    usuario: CLIENTE,
    decision: 'cambios',
    nota: 'Cambien la foto por una del consultorio nuevo.',
    ahora: REVISA,
  });
  expect(cambios.ok).toBe(true);
  expect(filaLote().estado).toBe('con_cambios');

  // El plazo vence con la pelota del operador, y un `con_cambios` no se
  // auto-aprueba: nadie toca nada. Y la fecha ya no está ahí para vencer: la
  // invariante (1) se la quitó al mes en el instante en que el cliente devolvió
  // la pieza. Antes se conservaba hasta que algo la apagara más tarde, que es
  // exactamente lo que había que dejar de hacer.
  reloj(VENCIDO);
  expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 0 });
  expect(filaLote().limiteRevision).toBeNull();
}

describe('el operador resuelve la petición borrando la pieza, con el plazo ya vencido', () => {
  it('el mes queda aprobado pero SIN fecha límite', async () => {
    await hastaElConCambiosVencido();

    reloj(BORRA);
    // Lo que queda son las dos que el cliente aprobó en la ronda 1, así que el
    // recálculo deduce `aprobada`. Antes de este arreglo se quedaba con
    // `LIMITE_1` a cuestas, ya vencido.
    expect(await operadorBorra(3, BORRA)).toBe('aprobada');
    expect(filaLote().estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toBeNull();
    // El reparto no se deshace: el mes sigue en el portal del cliente.
    expect(filaLote().compartidoEn).toEqual(RONDA_1);
  });

  it('y el cliente conserva la puerta: todavía puede retirar una aprobación', async () => {
    await hastaElConCambiosVencido();
    reloj(BORRA);
    await operadorBorra(3, BORRA);

    // Es el daño concreto: con el límite muerto puesto, esto contestaba 409 con
    // `razonPlazoVencido` —contándole al cliente su propia aprobación como un
    // vencimiento— sobre un reloj que corrió esperando al equipo.
    reloj(BARRIDO);
    const r = await registrarRevision({
      piezaId: 'pieza-1',
      usuario: CLIENTE,
      decision: 'cambios',
      nota: 'Pensándolo bien, cambien el copy de esta.',
      ahora: BARRIDO,
    });
    expect(r.ok).toBe(true);
    expect(filaLote().estado).toBe('con_cambios');
    expect(estados()).toEqual(['cambios', 'aprobada']);
  });

  it('nada se aprueba solo mientras el mes no tenga fecha', async () => {
    await hastaElConCambiosVencido();
    reloj(BORRA);
    await operadorBorra(3, BORRA);

    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO })).toEqual({ aprobados: 0 });
    // Y no queda constancia diciendo que el cliente no respondió: respondió, y
    // dentro de su plazo.
    expect(espia.eventos).toHaveLength(0);
  });

  it('volver a compartir el mes es lo que lo cierra', async () => {
    await hastaElConCambiosVencido();
    reloj(BORRA);
    await operadorBorra(3, BORRA);

    // El «quinto caso» de `compartirLote`: estampa fecha nueva y deja el mes
    // `aprobada`, sin mandarlo a `en_revision` —eso acabaría en una constancia
    // de auto-aprobación sobre un mes que el cliente aprobó pieza por pieza—.
    reloj(BARRIDO);
    const r = await compartirLote(comoCompartible(), 2, BARRIDO);
    expect(r.arrancoElPlazo).toBe(true);
    expect(r.estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toEqual(limiteRevision(BARRIDO, 2));

    // Y cuando esa fecha pasa, la puerta se cierra sola.
    const despues = new Date(limiteRevision(BARRIDO, 2).getTime() + 60_000);
    reloj(despues);
    const tarde = await registrarRevision({
      piezaId: 'pieza-1', usuario: CLIENTE, decision: 'cambios', nota: 'Ahora sí, cámbienla.', ahora: despues,
    });
    expect(tarde).toEqual({
      ok: false,
      status: 409,
      errores: [razonPlazoVencido(limiteRevision(BARRIDO, 2))],
    });
  });
});

/**
 * La otra mitad, y la que no se puede aflojar: el mes que se auto-aprobó porque
 * el cliente no contestó **sigue cerrado con su fecha** aunque después se le
 * borre una pieza. Ese plazo corrió en el turno de quien tenía que contestar, y
 * es justo lo que la familia entera existe para respetar.
 */
describe('un mes auto-aprobado por vencimiento legítimo no se reabre al borrar una pieza', () => {
  async function hastaElMesAprobadoSolo() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    // El cliente no contesta y el plazo vence: el barrido aprueba el mes.
    reloj(VENCIDO);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 1 });
    expect(filaLote().estado).toBe('aprobada');
    expect(espia.eventos).toHaveLength(1);
  }

  it('conserva su fecha límite, y con ella el cierre', async () => {
    await hastaElMesAprobadoSolo();

    reloj(BORRA);
    // Quedan dos piezas aprobadas: el estado deducido es el mismo que ya tenía.
    expect(await operadorBorra(3, BORRA)).toBe('aprobada');
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);

    const tarde = await registrarRevision({
      piezaId: 'pieza-1', usuario: CLIENTE, decision: 'cambios', nota: 'Quiero cambiar esta.', ahora: BORRA,
    });
    expect(tarde).toEqual({ ok: false, status: 409, errores: [razonPlazoVencido(LIMITE_1)] });
  });

  it('y si lo que se borra es la última pieza, vuelve al operador como siempre', async () => {
    await hastaElMesAprobadoSolo();

    reloj(BORRA);
    await operadorBorra(1, BORRA);
    await operadorBorra(2, BORRA);
    // «Vacío no es aprobado»: `estadoLoteSegunPiezas` deduce `en_revision` de la
    // lista vacía y `refrescarLote` devuelve el mes al operador con el plazo
    // limpio, que es la regla de `./lote-reabierto.test.ts` y no cambia.
    expect(await operadorBorra(3, BORRA)).toBe('en_proceso');
    expect(filaLote().compartidoEn).toBeNull();
    expect(filaLote().limiteRevision).toBeNull();
  });
});

/**
 * **El mismo final aunque el operador corrija deprisa, y es un cambio de
 * comportamiento que conviene tener presente.**
 *
 * Antes de la invariante (1) esto se miraba con lupa: el apagado del plazo solo
 * ocurría si la fecha ya había vencido, así que un operador que resolviera la
 * petición dentro del plazo dejaba el mes `aprobada` con la fecha viva, y esa
 * fecha lo cerraba sola al pasar.
 *
 * Ahora no. El mes pasó por `con_cambios` —aunque fuera una hora— y ahí la
 * fecha se apagó, porque la pelota era del equipo. Al volver a `aprobada` no hay
 * nada que conservar. El mes queda **aprobado pero no cerrado**: el cliente
 * conserva la puerta hasta que el equipo vuelva a compartirlo, que es lo que le
 * pone fecha nueva (el quinto caso de `compartirLote`).
 *
 * Se acepta a sabiendas, y en la dirección segura de siempre: nada se aprueba
 * solo, nadie se queda sin poder opinar, y lo único que cuesta es un «Compartir»
 * de más para cerrar el mes. Lo contrario —conservar la fecha porque todavía
 * corría— es la condición con excepciones que trajo los ocho fallos.
 */
describe('borrar la pieza devuelta deja el mes aprobado sin fecha, aunque el plazo corriera', () => {
  it('el mes queda aprobado y SIN la fecha de su ronda: pasó por el lado del equipo', async () => {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    reloj(REVISA);
    for (const n of [1, 2]) {
      await registrarRevision({ piezaId: `pieza-${n}`, usuario: CLIENTE, decision: 'aprobar', nota: '', ahora: REVISA });
    }
    await registrarRevision({
      piezaId: 'pieza-3', usuario: CLIENTE, decision: 'cambios', nota: 'Cambien la foto.', ahora: REVISA,
    });
    expect(filaLote().estado).toBe('con_cambios');

    // El operador atiende la petición el mismo día, dentro del plazo.
    const pronto = new Date(REVISA.getTime() + 3_600_000);
    reloj(pronto);
    expect(await operadorBorra(3, pronto)).toBe('aprobada');
    expect(filaLote().limiteRevision).toBeNull();

    // Y el cliente conserva la puerta mientras no haya fecha, que es lo que
    // hace que este cambio no le quite nada a nadie.
    const r = await registrarRevision({
      piezaId: 'pieza-1', usuario: CLIENTE, decision: 'cambios', nota: 'Mejor cambien esta.', ahora: pronto,
    });
    expect(r.ok).toBe(true);
  });
});
