import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **Un mes solo se auto-aprueba si nadie tocó su contenido desde que se
 * compartió** (diseño §6). Es la invariante que sustituye a ir tapando, uno por
 * uno, los caminos por los que un lote volvía a `en_revision` arrastrando un
 * `limite_revision` ya vencido.
 *
 * El problema de fondo era que el plazo sobrevivía a los cambios de estado: se
 * estampa al compartir y desde entonces vale para siempre, así que cada camino
 * que reabría un mes tenía que acordarse de limpiarlo. Se parchearon cuatro
 * (`refrescarLote` por tres vías, `compartirLote` por la cuarta) y quedaba al
 * menos uno abierto —el de aquí abajo—. En vez de un quinto parche, la pregunta
 * cambia: ya no es «¿por dónde pasó este lote?» sino «¿es este el contenido que
 * se le compartió?». Lo segundo se sabe con una fecha,
 * `contenido_lotes.contenido_actualizado_en`, y cierra también las puertas que
 * nadie ha encontrado todavía.
 *
 * Usa la base en miniatura de `./doble-base.ts` por la misma razón que
 * `./ronda-nueva.test.ts` y `./lote-reabierto.test.ts`: lo que se prueba son
 * secuencias donde cada paso lee lo que escribió el anterior. Y aquí se llama a
 * `registrarRevision` **de verdad**, no a un atajo, porque el camino abierto
 * estaba justo en ella.
 */

const espia = vi.hoisted(() => ({
  lotes: [] as Fila[],
  piezas: [] as Fila[],
  etapas: [] as Fila[],
  eventos: [] as Fila[],
  comentarios: [] as Fila[],
}));

const ids = vi.hoisted(() => ({
  cliente: '00000000-0000-4000-8000-0000000000c1',
  lote: '00000000-0000-4000-8000-00000000010e',
  usuario: '00000000-0000-4000-8000-0000000000a1',
}));

vi.mock('@/flujo/avisos', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/avisos')>()),
  avisarLoteAutoAprobado: vi.fn(async () => {}),
  avisarComentarioCliente: vi.fn(async () => {}),
}));

// El tope de observaciones del cliente no interviene en nada de lo que aquí se
// decide, y consultarlo pediría una tabla más al doble.
vi.mock('@/flujo/servicio', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/servicio')>()),
  rechazoPorLimite: vi.fn(async () => null),
}));

/**
 * `piezaVisible` resuelve permisos con un `innerJoin` de tres tablas; aquí se
 * sustituye por la búsqueda equivalente sobre el espía, devolviendo **la fila
 * viva** y no una copia, que es lo que hace la base real dentro de una petición.
 */
vi.mock('@/lib/visibilidad', async (importarReal) => ({
  ...(await importarReal<typeof import('@/lib/visibilidad')>()),
  piezaVisible: vi.fn(async (_u: unknown, piezaId: string) => {
    const pieza = espia.piezas.find((p) => p.id === piezaId);
    if (!pieza) return null;
    const lote = espia.lotes.find((l) => l.id === pieza.loteId);
    if (!lote) return null;
    return { pieza, lote, cliente: { id: ids.cliente, nombre: 'Clínica Norte', operadorId: null } };
  }),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const { dobleDeBase } = await import('./doble-base');
  return { ...real, db: dobleDeBase(real, espia) };
});

import { autoAprobarVencidos } from '@/contenido/auto-aprobacion';
import { limiteRevision } from '@/contenido/reglas';
import { registrarRevision } from '@/contenido/revision';
import {
  compartirLote, marcarContenidoTocado, type LoteCompartible,
} from '@/contenido/servicio';
import type { UsuarioSesion } from '@/lib/permisos';

/** Martes de septiembre de 2026: el operador abre el lote del mes. */
const CREADO = new Date('2026-09-08T16:00:00.000Z');
/** Jueves, a media mañana de México: se comparte el mes. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El plazo de esa ronda, con los 2 días hábiles de la casa. */
const LIMITE_1 = limiteRevision(RONDA_1, 2);
/** Dos horas después de recibirlo, el cliente devuelve una pieza. */
const PIDE_CAMBIOS = new Date(RONDA_1.getTime() + 2 * 3_600_000);
/** Al día siguiente el operador corrige lo que le pidieron. */
const CORRIGE = new Date(RONDA_1.getTime() + 86_400_000);
/** Un minuto después del límite. */
const VENCIDO = new Date(LIMITE_1.getTime() + 60_000);
/** Dos días después de vencido, el cliente vuelve al portal. */
const ARREPIENTE = new Date(LIMITE_1.getTime() + 2 * 86_400_000);
/** El barrido del worker que viene detrás. */
const BARRIDO = new Date(ARREPIENTE.getTime() + 10 * 60_000);

const CLIENTE: UsuarioSesion = {
  id: ids.usuario,
  email: 'marta@clinicanorte.mx',
  nombre: 'Marta',
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

/**
 * Lo que hace `PATCH /api/contenido/piezas/[id]`: cambia el texto de la pieza y
 * marca que el contenido del mes se movió. Las dos escrituras, y en ese orden,
 * son las de la ruta real.
 */
const operadorCorrige = async (piezaId: string, copy: string, cuando: Date) => {
  const pieza = espia.piezas.find((p) => p.id === piezaId)!;
  Object.assign(pieza, { copy, actualizadoEn: cuando });
  await marcarContenidoTocado(ids.lote, cuando);
};

const estados = () => espia.piezas.map((p) => p.estadoCliente);

/**
 * Mueve el reloj del sistema, no solo el `ahora` que se pasa por argumento.
 *
 * Hace falta porque `registrarRevision` empieza llamando a `asegurarLotesAlDia`,
 * que resuelve los vencimientos con la hora de verdad (`new Date()`) y no
 * acepta un instante. Sin fijar el reloj, el guión —fechas de septiembre de
 * 2026— se auto-aprobaría solo en cuanto la fecha real lo pasara, y la prueba
 * diría cualquier cosa según el día en que se ejecute.
 */
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
 * El camino que quedaba abierto, y que ningún parche anterior tapaba.
 *
 * El cliente devuelve una pieza (el mes pasa a `con_cambios`, que no es
 * auto-aprobable, así que el plazo vence sin que nadie se entere). El operador
 * corrige lo que le pidieron pero todavía no vuelve a compartir. Entonces el
 * cliente entra al portal y **aprueba él mismo la pieza que había devuelto**:
 * ya no queda ninguna en `cambios`, `estadoLoteSegunPiezas` deduce
 * `en_revision` y el lote vuelve ahí con la fecha muerta de la ronda 1. El
 * siguiente barrido daba por aprobadas, en el acto, las piezas que el cliente
 * aún no había mirado, y dejaba constancia de que «no respondió» justo cuando
 * acababa de responder.
 */
describe('el cliente aprueba la pieza que él mismo había devuelto', () => {
  async function hastaElArrepentimiento() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    reloj(PIDE_CAMBIOS);
    const cambios = await registrarRevision({
      piezaId: 'pieza-3',
      usuario: CLIENTE,
      decision: 'cambios',
      nota: 'Cambien la foto por una del consultorio nuevo.',
      ahora: PIDE_CAMBIOS,
    });
    expect(cambios.ok).toBe(true);
    expect(filaLote().estado).toBe('con_cambios');

    // El operador atiende la petición, pero no vuelve a compartir el mes.
    reloj(CORRIGE);
    await operadorCorrige('pieza-3', 'Copy nuevo con el consultorio.', CORRIGE);

    // El plazo de la ronda 1 vence mientras la pelota es del operador: un lote
    // `con_cambios` no se auto-aprueba, así que aquí no pasa nada.
    reloj(VENCIDO);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 0 });

    reloj(ARREPIENTE);
    const aprobar = await registrarRevision({
      piezaId: 'pieza-3',
      usuario: CLIENTE,
      decision: 'aprobar',
      nota: '',
      ahora: ARREPIENTE,
    });
    expect(aprobar.ok).toBe(true);
  }

  it('el mes vuelve a revisión, y el plazo de la ronda 1 ya no está', async () => {
    await hastaElArrepentimiento();

    // El estado deducido es correcto: quedan dos piezas sin mirar.
    expect(filaLote().estado).toBe('en_revision');

    // Aquí se solapan las dos reglas del plazo, y se solapan a propósito. La de
    // este archivo —«el plazo solo vale sobre el contenido que se compartió»—
    // bastaría para que el límite de la ronda 1 no hiciera daño, porque el
    // operador corrigió la pieza 3 y `contenido_actualizado_en` quedó después
    // de `compartido_en`. Pero el plazo también se consumió mientras la pelota
    // era del operador, así que `registrarRevision` lo APAGA al devolver el lote
    // a `en_revision` (ver ./plazo-turno-ajeno.test.ts). Una cuida qué contenido
    // cubre el plazo; la otra, de quién era el turno mientras corría.
    expect(filaLote().limiteRevision).toBeNull();
    expect(filaLote().contenidoActualizadoEn).toEqual(CORRIGE);
  });

  it('el siguiente barrido NO aprueba las piezas que el cliente no ha mirado', async () => {
    await hastaElArrepentimiento();

    // Este era el daño. El contenido del mes se movió después de compartirlo
    // (el operador corrigió la pieza 3), así que el plazo de la ronda 1 ya no
    // vale sobre él: no describe lo que el cliente tiene delante.
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO })).toEqual({ aprobados: 0 });
    expect(estados()).toEqual(['pendiente', 'pendiente', 'aprobada']);
  });

  it('y no queda constancia de que el cliente no respondió', async () => {
    await hastaElArrepentimiento();
    await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO });

    // La constancia dice, con esas palabras, «el cliente no respondió dentro
    // del plazo». Escribirla justo después de que el cliente respondiera es lo
    // que haría imposible defender el historial ante una reclamación.
    expect(espia.eventos).toHaveLength(0);
  });

  it('el cliente sigue pudiendo decidir sobre las piezas que le quedan', async () => {
    await hastaElArrepentimiento();
    await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO });

    // No se le aprueba nada por la espalda, pero tampoco se le cierra la
    // puerta: el mes sigue `en_revision`, así que `aceptaDecision` le deja
    // opinar de la pieza 1.
    reloj(new Date(BARRIDO.getTime() + 60_000));
    const r = await registrarRevision({
      piezaId: 'pieza-1',
      usuario: CLIENTE,
      decision: 'aprobar',
      nota: '',
      ahora: new Date(BARRIDO.getTime() + 60_000),
    });
    expect(r.ok).toBe(true);
    expect(estados()).toEqual(['aprobada', 'pendiente', 'aprobada']);
  });
});

/**
 * La otra mitad de la invariante, y la que impide arreglarla de más: **la
 * revisión del cliente no es tocar el contenido**. El cliente escribe en
 * `contenido_piezas` al opinar de una pieza, pero lo que escribe es su opinión,
 * no el material. Si contara como contenido nuevo, responder dentro del plazo
 * alargaría el plazo y la auto-aprobación no se cumpliría nunca.
 */
describe('lo que el cliente decide no mueve el reloj del contenido', () => {
  it('aprobar una pieza dentro del plazo no impide que venza el resto', async () => {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    reloj(PIDE_CAMBIOS);
    await registrarRevision({
      piezaId: 'pieza-1', usuario: CLIENTE, decision: 'aprobar', nota: '', ahora: PIDE_CAMBIOS,
    });
    expect(filaLote().contenidoActualizadoEn).toEqual(CREADO);

    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 1 });
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
    expect(espia.eventos).toHaveLength(1);
  });

  it('pedir cambios tampoco, aunque deje la pieza tocada y un comentario', async () => {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    reloj(PIDE_CAMBIOS);
    await registrarRevision({
      piezaId: 'pieza-3', usuario: CLIENTE, decision: 'cambios', nota: 'Otra foto.', ahora: PIDE_CAMBIOS,
    });

    expect(filaLote().contenidoActualizadoEn).toEqual(CREADO);
    expect(espia.comentarios).toHaveLength(1);
  });
});

/**
 * La puerta que ningún parche anterior miraba siquiera, porque no cambia el
 * estado del lote: el operador **edita** una pieza mientras el cliente revisa.
 * `PATCH` no pasa por `refrescarLote` —editar el copy no mueve el estado del
 * mes—, así que el lote seguía `en_revision` con su plazo corriendo, y al vencer
 * se daba por aprobado un texto que el cliente nunca vio.
 */
describe('el operador edita una pieza mientras el cliente revisa', () => {
  it('el plazo deja de valer: lo que hay delante ya no es lo que se compartió', async () => {
    await compartirLote(comoCompartible(), 2, RONDA_1);
    await operadorCorrige('pieza-2', 'Copy reescrito a media revisión.', CORRIGE);

    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 0 });
    expect(estados()).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });

  it('y volver a compartir es lo que arranca el plazo sobre el contenido nuevo', async () => {
    await compartirLote(comoCompartible(), 2, RONDA_1);
    await operadorCorrige('pieza-2', 'Copy reescrito a media revisión.', CORRIGE);

    // Sin esto el mes quedaría congelado: `en_revision` para siempre, sin
    // auto-aprobación posible y con un botón «Compartir» que no arrancaba nada
    // porque el lote ya estaba `en_revision`.
    const r = await compartirLote(comoCompartible(), 2, ARREPIENTE);
    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().limiteRevision).toEqual(limiteRevision(ARREPIENTE, 2));

    const despues = new Date(limiteRevision(ARREPIENTE, 2).getTime() + 60_000);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: despues })).toEqual({ aprobados: 1 });
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
  });

  it('pero recompartir sin haber tocado nada sigue sin mover la fecha límite', async () => {
    await compartirLote(comoCompartible(), 2, RONDA_1);

    // El segundo enlace del mismo mes (reenviarlo a otra persona del cliente)
    // no es una ronda nueva: si moviera el plazo, bastaría con pulsar
    // «Compartir» cada dos días para que el mes no venciera nunca.
    const r = await compartirLote(comoCompartible(), 2, CORRIGE);
    expect(r.arrancoElPlazo).toBe(false);
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);
  });
});
