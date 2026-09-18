import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **Un plazo solo corre sobre material que se le compartió al cliente**
 * (diseño §6). Lo que aquí se prueba es qué pasa cuando las piezas de un mes se
 * mueven DESPUÉS de que su ronda de revisión terminó.
 *
 * El fallo que da origen a estas pruebas: `refrescarLote` devolvía el lote a
 * `en_revision` —«esperando al cliente»— sin tocar `limite_revision`. Un mes
 * `aprobada` al que el operador le daba de alta una pieza días después volvía a
 * `en_revision` arrastrando el límite ya vencido de la ronda anterior, y el
 * siguiente barrido de `autoAprobarVencidos` lo aprobaba **de inmediato**, con
 * la pieza nueva incluida, sin que el cliente hubiera podido verla, y dejaba
 * otra constancia en `etapa_eventos` diciendo que no respondió.
 *
 * La decisión, y es la que estas pruebas fijan: cuando cambian las piezas de un
 * lote cuya ronda ya terminó, el lote **vuelve al lado del operador**
 * (`en_proceso`, con `compartido_en` y `limite_revision` limpios). Para que el
 * cliente lo vuelva a ver hay que compartirlo otra vez, que es lo que estampa
 * un plazo nuevo. Es la misma decisión que ya había tomado `compartirLote`: un
 * mes cerrado no se reabre por un camino que no lo diga.
 *
 * Usa la base en miniatura de `./doble-base.ts`, que guarda filas y respeta el
 * `WHERE`, por la misma razón que `./ronda-nueva.test.ts`: la secuencia entera
 * —compartir, vencer, dar de alta, volver a compartir— es una cadena de
 * escrituras donde cada paso lee lo que dejó el anterior, y los dobles de filas
 * fijas de `servicio.test.ts` hacen invisible esta clase de error.
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
import { estadoLoteSegunPiezas, limiteRevision } from '@/contenido/reglas';
import { compartirLote, refrescarLote, type LoteCompartible, type LoteRefrescable } from '@/contenido/servicio';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const LOTE = '00000000-0000-4000-8000-00000000010e';

/** El día anterior: el operador armó las piezas del mes. */
const ARMADO = new Date('2026-09-09T16:00:00.000Z');
/** Jueves de septiembre de 2026, a media mañana de México: se comparte el mes. */
const COMPARTIDO = new Date('2026-09-10T16:00:00.000Z');
/** La fecha límite de esa ronda, con los 2 días hábiles de la casa. */
const LIMITE_1 = limiteRevision(COMPARTIDO, 2);
/** Un minuto después del límite: el barrido encuentra el mes vencido. */
const VENCIDO = new Date(LIMITE_1.getTime() + 60_000);
/** Tres días más tarde, con el mes ya cerrado, el operador toca las piezas. */
const DIAS_DESPUES = new Date(LIMITE_1.getTime() + 3 * 86_400_000);

const piezaDe = (n: number, estadoCliente = 'pendiente'): Fila => ({
  id: `pieza-${n}`,
  loteId: LOTE,
  numero: n,
  formato: 'post',
  estadoCliente,
  notaCliente: null,
  revisadoEn: null,
});

const filaLote = (): Fila => espia.lotes[0]!;

/** El lote tal como lo lee `compartirLote` desde `POST /api/share`. */
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
  };
};

/**
 * Lo que hace `registrarRevision` cuando el cliente pide cambios en una pieza,
 * reducido a sus dos escrituras (mismo atajo que en `./ronda-nueva.test.ts`:
 * la función de verdad arrastra sesión, permisos y tope de observaciones, nada
 * de lo cual interviene en lo que aquí se prueba).
 */
const clientePideCambios = (numero: number, nota: string, cuando: Date) => {
  const pieza = espia.piezas.find((p) => p.numero === numero)!;
  Object.assign(pieza, { estadoCliente: 'cambios', notaCliente: nota, revisadoEn: cuando });
  filaLote().estado = estadoLoteSegunPiezas(
    espia.piezas.map((p) => ({ formato: p.formato as 'post', estadoCliente: p.estadoCliente as 'cambios' })),
  );
};

const estados = () => espia.piezas.map((p) => p.estadoCliente);

beforeEach(() => {
  // `contenidoActualizadoEn` anterior al reparto: el plazo vale sobre lo que el
  // cliente recibe (ver `loteAutoAprobado`, src/contenido/reglas.ts).
  espia.lotes = [{ id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_proceso', compartidoEn: null, limiteRevision: null, contenidoActualizadoEn: ARMADO }];
  espia.piezas = [piezaDe(1), piezaDe(2), piezaDe(3)];
  espia.etapas = [];
  espia.eventos = [];
});

/** El mes se comparte, el cliente no contesta y el plazo vence: queda `aprobada`. */
async function hastaElMesAprobadoSolo() {
  await compartirLote(comoCompartible(), 2, COMPARTIDO);
  expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: VENCIDO })).toEqual({ aprobados: 1 });
  expect(filaLote().estado).toBe('aprobada');
  expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
  expect(espia.eventos).toHaveLength(1);
}

describe('dar de alta una pieza en un mes ya aprobado', () => {
  it('no arrastra el plazo vencido de la ronda anterior', async () => {
    await hastaElMesAprobadoSolo();

    // Tres días después el operador agrega una pieza al mes ya cerrado.
    espia.piezas.push(piezaDe(4));
    const estado = await refrescarLote(comoRefrescable());

    // Antes de este arreglo el lote volvía a `en_revision` con `LIMITE_1`
    // intacto: un plazo muerto corriendo sobre una pieza que el cliente no ha
    // visto.
    expect(estado).toBe('en_proceso');
    expect(filaLote().estado).toBe('en_proceso');
    expect(filaLote().compartidoEn).toBeNull();
    expect(filaLote().limiteRevision).toBeNull();
  });

  it('y por eso el siguiente barrido ya no lo aprueba de inmediato', async () => {
    await hastaElMesAprobadoSolo();
    espia.piezas.push(piezaDe(4));
    await refrescarLote(comoRefrescable());

    // Este era el daño: con el límite arrastrado, el primer barrido posterior
    // —el del worker, diez minutos después— daba por aprobada la pieza nueva
    // sin que el cliente hubiera tenido ocasión de verla.
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: DIAS_DESPUES })).toEqual({ aprobados: 0 });
    expect(espia.piezas.find((p) => p.numero === 4)!.estadoCliente).toBe('pendiente');

    // Y no queda una segunda constancia diciendo que el cliente no respondió a
    // algo que nunca se le mandó.
    expect(espia.eventos).toHaveLength(1);
  });

  it('el mes vuelve a estar del lado del operador, también en la etapa', async () => {
    await hastaElMesAprobadoSolo();
    expect(espia.etapas[0]?.estado).toBe('aprobada');

    espia.piezas.push(piezaDe(4));
    await refrescarLote(comoRefrescable());

    // La ficha, el Inicio y el portal leen de aquí: si el mes volvió al
    // operador, tienen que decirlo.
    expect(espia.etapas[0]?.estado).toBe('en_proceso');
  });

  it('lo que el cliente ya había aprobado sigue aprobado', async () => {
    await hastaElMesAprobadoSolo();
    espia.piezas.push(piezaDe(4));
    await refrescarLote(comoRefrescable());

    // Reabrir el mes es devolverlo al operador, no borrar lo que el cliente
    // decidió: las tres piezas de la ronda anterior conservan su estado.
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada', 'pendiente']);
  });

  it('compartirlo otra vez es lo que estampa un plazo nuevo', async () => {
    await hastaElMesAprobadoSolo();
    espia.piezas.push(piezaDe(4));
    await refrescarLote(comoRefrescable());

    const r = await compartirLote(comoCompartible(), 2, DIAS_DESPUES);

    // Con el lote `en_proceso`, «Compartir» vuelve a ser lo que era: el reparto
    // del mes, y con él el plazo. Antes del arreglo este botón no arrancaba
    // nada, porque el lote ya estaba `en_revision` con su límite muerto.
    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().estado).toBe('en_revision');
    expect(filaLote().limiteRevision).toEqual(limiteRevision(DIAS_DESPUES, 2));
    // El plazo nuevo es futuro: el barrido de ese mismo instante no lo toca.
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: DIAS_DESPUES })).toEqual({ aprobados: 0 });
  });

  it('y al vencer ese plazo nuevo la pieza nueva sí queda aprobada', async () => {
    await hastaElMesAprobadoSolo();
    espia.piezas.push(piezaDe(4));
    await refrescarLote(comoRefrescable());
    await compartirLote(comoCompartible(), 2, DIAS_DESPUES);

    const despues = new Date(limiteRevision(DIAS_DESPUES, 2).getTime() + 60_000);
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: despues })).toEqual({ aprobados: 1 });
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada', 'aprobada']);
    // Ahora sí hay dos constancias, y las dos son ciertas: son dos rondas.
    expect(espia.eventos).toHaveLength(2);
  });
});

describe('borrar piezas de un mes ya aprobado', () => {
  it('no lo reabre si las que quedan siguen aprobadas', async () => {
    await hastaElMesAprobadoSolo();

    espia.piezas.splice(1, 1);
    expect(await refrescarLote(comoRefrescable())).toBe('aprobada');
    // El límite de la ronda no estorba aquí: `loteAutoAprobado` solo mira los
    // `en_revision`, y además es el plazo real de lo que el cliente sí aprobó.
    expect(filaLote().compartidoEn).toEqual(COMPARTIDO);
  });

  it('pero vaciarlo del todo sí lo devuelve al operador', async () => {
    await hastaElMesAprobadoSolo();

    // Un lote sin piezas es `en_revision` para `estadoLoteSegunPiezas` («vacío
    // no es aprobado»), y ese es otro camino por el que el límite muerto volvía
    // a quedar corriendo.
    espia.piezas.length = 0;
    expect(await refrescarLote(comoRefrescable())).toBe('en_proceso');
    expect(filaLote().compartidoEn).toBeNull();
    expect(filaLote().limiteRevision).toBeNull();
  });
});

/**
 * El mismo arrastre por el otro camino. Un lote `con_cambios` tiene el plazo de
 * su ronda ya estampado —y normalmente vencido, porque el operador tarda en
 * corregir—, así que cualquier cosa que lo devuelva a `en_revision` sin pasar
 * por «Compartir» lo deja con un límite muerto. La regla es la misma, y por eso
 * se escribe una sola vez en `refrescarLote`: solo un lote que YA está
 * `en_revision` puede seguir estándolo; a los demás los devuelve el reparto.
 */
describe('un lote con cambios cuyo plazo venció', () => {
  /** Ronda 1 compartida y el cliente devuelve la pieza 3. */
  async function hastaElConCambios() {
    await compartirLote(comoCompartible(), 2, COMPARTIDO);
    clientePideCambios(3, 'Cambien la foto por una del consultorio nuevo.', COMPARTIDO);
    expect(filaLote().estado).toBe('con_cambios');
  }

  it('dar de alta una pieza no lo mueve: la pelota ya era del operador', async () => {
    await hastaElConCambios();

    espia.piezas.push(piezaDe(4));
    expect(await refrescarLote(comoRefrescable())).toBe('con_cambios');
    // Sigue `con_cambios`, que no es auto-aprobable: no hay plazo corriendo y
    // no hace falta limpiar nada. Lo que falta es que el operador corrija y
    // vuelva a compartir, que es la ronda nueva de `compartirLote`.
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: DIAS_DESPUES })).toEqual({ aprobados: 0 });
  });

  it('borrar la pieza devuelta no lo manda a revisión con el límite muerto', async () => {
    await hastaElConCambios();

    // El operador resuelve la petición del cliente quitando la pieza en vez de
    // corregirla. Sin la pieza en `cambios`, `estadoLoteSegunPiezas` deduce
    // `en_revision` de las dos pendientes que quedan: ahí se colaba el límite
    // de la ronda 1, ya vencido.
    espia.piezas.splice(2, 1);
    expect(await refrescarLote(comoRefrescable())).toBe('en_proceso');
    expect(filaLote().compartidoEn).toBeNull();
    expect(filaLote().limiteRevision).toBeNull();
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: DIAS_DESPUES })).toEqual({ aprobados: 0 });
  });

  it('pero si lo que queda está todo aprobado, el mes queda aprobado', async () => {
    await hastaElConCambios();
    // Las otras dos las había aprobado el cliente en la ronda 1.
    for (const p of espia.piezas.filter((p) => p.numero !== 3)) p.estadoCliente = 'aprobada';

    espia.piezas.splice(2, 1);
    // Esto no es un plazo corriendo sobre material no visto: es la conclusión
    // de lo que el cliente decidió pieza por pieza. No se reabre nada.
    expect(await refrescarLote(comoRefrescable(), DIAS_DESPUES)).toBe('aprobada');
    expect(filaLote().compartidoEn).toEqual(COMPARTIDO);
    // Lo que sí se apaga es el PLAZO: ese reloj se consumió mientras el mes
    // esperaba al operador, así que no puede cerrarle luego la puerta al cliente
    // (`aceptaDecision`, src/contenido/revision.ts). La secuencia entera, con lo
    // que el cliente todavía puede hacer, está en `./plazo-pieza-borrada.test.ts`.
    expect(filaLote().limiteRevision).toBeNull();
  });
});
