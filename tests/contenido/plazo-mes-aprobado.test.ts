import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **La puerta hermana: un mes `aprobada` no se cierra por estar aprobado, sino
 * porque el plazo del cliente ya no vive.**
 *
 * `./plazo-turno-ajeno.test.ts` cubre la retractación que deja el lote
 * `en_revision`: quedaban piezas sin mirar. Si NO queda ninguna pendiente,
 * `estadoLoteSegunPiezas` deduce `aprobada` y el lote se quedaba ahí arrastrando
 * el límite muerto de la ronda anterior. A partir de ese momento
 * `aceptaDecision` le cerraba la puerta al cliente con un mensaje doblemente
 * falso: ni el mes se auto-aprobó —lo aprobó él, un minuto antes— ni ese plazo
 * venció en su turno, porque se consumió esperando al operador.
 *
 * La decisión del dueño, que es lo que fijan estas pruebas: **el cliente puede
 * retractarse de una pieza mientras su plazo siga vivo**, y el estado del lote
 * no es lo que decide. Los tres casos de un lote `aprobada`:
 *
 * 1. `limite_revision` **en el futuro** → sí puede volver a opinar. El mes vuelve
 *    al estado que le corresponda según sus piezas.
 * 2. `limite_revision` **vencido** → cerrado. Es la auto-aprobación por
 *    vencimiento, y ahí el mensaje sí es cierto.
 * 3. `limite_revision` **nulo** → sí puede volver a opinar: ese reloj se detuvo a
 *    su favor (commit c9da8cb), nunca venció para él. El remedio del equipo es
 *    volver a compartir el mes, que le pone fecha nueva y lo cierra.
 *
 * Mismo doble y mismo manejo del reloj que los otros dos archivos del plazo:
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
import { registrarRevision } from '@/contenido/revision';
import { compartirLote, type LoteCompartible } from '@/contenido/servicio';
import type { UsuarioSesion } from '@/lib/permisos';

/** El operador abre el lote del mes. */
const CREADO = new Date('2026-09-08T16:00:00.000Z');
/** Jueves a media mañana de México: se comparte el mes. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El plazo de esa ronda: lunes 14 a las 11:59 p.m. de México. */
const LIMITE_1 = limiteRevision(RONDA_1, 2);
/** Dos horas después de recibirlo, el cliente empieza a revisar. */
const REVISA = new Date(RONDA_1.getTime() + 2 * 3_600_000);
/** Un minuto más tarde, todavía muy dentro del plazo. */
const SE_ARREPIENTE_A_TIEMPO = new Date(REVISA.getTime() + 60_000);
/** Un minuto después del límite. */
const VENCIDO = new Date(LIMITE_1.getTime() + 60_000);
/** Dos días después del límite, con el mes todavía del lado del operador. */
const TARDE = new Date(LIMITE_1.getTime() + 2 * 86_400_000);
/** El barrido del worker que viene detrás. */
const BARRIDO = new Date(TARDE.getTime() + 10 * 60_000);

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

const estados = () => espia.piezas.map((p) => p.estadoCliente);

const reloj = (t: Date) => vi.setSystemTime(t);

/** Aprobar una pieza en un instante dado, con el reloj del sistema en él. */
async function aprueba(pieza: string, ahora: Date) {
  reloj(ahora);
  return registrarRevision({ piezaId: pieza, usuario: CLIENTE, decision: 'aprobar', nota: '', ahora });
}

/** Devolver una pieza con nota, con el reloj del sistema en ese instante. */
async function pideCambios(pieza: string, ahora: Date) {
  reloj(ahora);
  return registrarRevision({
    piezaId: pieza,
    usuario: CLIENTE,
    decision: 'cambios',
    nota: 'Cambien la foto por una del consultorio nuevo.',
    ahora,
  });
}

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
 * Caso 1. El cliente aprueba el mes entero por su cuenta y, dentro de su plazo,
 * se arrepiente de una pieza. El lote está `aprobada`, pero el plazo sigue
 * siendo suyo: la puerta no se cierra por el estado.
 */
describe('lote aprobado con el plazo VIVO', () => {
  async function apruebaElMesEntero() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    for (const n of [1, 2, 3]) {
      const r = await aprueba(`pieza-${n}`, REVISA);
      expect(r.ok).toBe(true);
    }
    expect(filaLote().estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);
  }

  it('el cliente puede retractarse de una pieza', async () => {
    await apruebaElMesEntero();

    const r = await pideCambios('pieza-2', SE_ARREPIENTE_A_TIEMPO);
    expect(r.ok).toBe(true);
    expect(estados()).toEqual(['aprobada', 'cambios', 'aprobada']);
  });

  it('y el mes vuelve al estado que le toca por sus piezas, sin plazo: la pelota es del equipo', async () => {
    await apruebaElMesEntero();
    await pideCambios('pieza-2', SE_ARREPIENTE_A_TIEMPO);

    expect(filaLote().estado).toBe('con_cambios');
    // Antes de la invariante (1) el plazo de esta ronda se conservaba, porque
    // todavía corría. Ahora no: `con_cambios` es del lado del EQUIPO, y ahí no
    // vive ninguna fecha. Da igual que quedara tiempo —el reloj que siguiera
    // corriendo se lo comería el operador corrigiendo—, y da igual quién
    // provocó la transición. Lo que el cliente pierde por esto es nada: sigue
    // pudiendo opinar (`aceptaDecision` solo cierra meses `aprobada`), nada se
    // auto-aprueba desde `con_cambios`, y la ronda corregida le traerá su plazo
    // nuevo cuando `compartirLote` la reparta.
    expect(filaLote().limiteRevision).toBeNull();
  });

  it('el equipo se entera: queda el comentario anclado a la pieza', async () => {
    await apruebaElMesEntero();
    await pideCambios('pieza-2', SE_ARREPIENTE_A_TIEMPO);

    expect(espia.comentarios).toHaveLength(1);
    expect(espia.comentarios[0]!.ancla).toBe('pieza:pieza-2');
  });
});

/**
 * Caso 2. Nadie contestó y el plazo venció: el mes se auto-aprobó. Aquí la
 * puerta sí se cierra, y el mensaje que la cierra es cierto.
 */
describe('lote aprobado con el plazo VENCIDO', () => {
  async function seAutoAprueba() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    reloj(VENCIDO);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 1 });
    expect(filaLote().estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);
  }

  it('la decisión que llega tarde se rechaza con 409', async () => {
    await seAutoAprueba();

    const r = await pideCambios('pieza-2', TARDE);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
  });

  it('y la razón dice la verdad: el plazo terminó, con su fecha exacta', async () => {
    await seAutoAprueba();

    const r = await pideCambios('pieza-2', TARDE);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]).toContain('14 sep 2026');
    expect(r.errores[0]).toContain('plazo de revisión');
    expect(r.errores[0]).toContain('escríbele a tu equipo');
  });

  it('nada se escribe: ni la nota, ni el comentario, ni el aviso', async () => {
    await seAutoAprueba();
    await pideCambios('pieza-2', TARDE);

    expect(espia.comentarios).toHaveLength(0);
    expect(espia.piezas.find((p) => p.id === 'pieza-2')!.notaCliente).toBeNull();
  });
});

/**
 * Caso 3. **La puerta hermana.** El plazo se consumió mientras el mes esperaba
 * al operador; el cliente se retracta de la pieza que había devuelto y, como no
 * queda ninguna pendiente, el mes queda `aprobada`. El plazo que arrastraba no
 * revive: se apaga, igual que cuando queda `en_revision`.
 */
describe('lote aprobado con el plazo NULO (consumido en turno ajeno)', () => {
  async function hastaLaRetractacion() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    // Revisa el mes entero dentro de su plazo: dos aprobadas y una devuelta.
    expect((await aprueba('pieza-1', REVISA)).ok).toBe(true);
    expect((await aprueba('pieza-2', REVISA)).ok).toBe(true);
    expect((await pideCambios('pieza-3', REVISA)).ok).toBe(true);
    expect(filaLote().estado).toBe('con_cambios');

    // El operador no toca nada: el plazo vence con la pelota de su lado, y un
    // `con_cambios` no se auto-aprueba.
    reloj(VENCIDO);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 0 });

    // Dos días tarde, el cliente retira lo que había pedido y aprueba la pieza.
    const r = await aprueba('pieza-3', TARDE);
    expect(r.ok).toBe(true);
  }

  it('el mes queda aprobado, pero SIN fecha límite', async () => {
    await hastaLaRetractacion();

    expect(filaLote().estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toBeNull();
    // El reparto no se deshace: el mes sigue delante del cliente.
    expect(filaLote().compartidoEn).toEqual(RONDA_1);
  });

  it('y el cliente todavía puede retractarse: ese reloj nunca venció para él', async () => {
    await hastaLaRetractacion();

    const r = await pideCambios('pieza-1', BARRIDO);
    expect(r.ok).toBe(true);
    expect(filaLote().estado).toBe('con_cambios');
    expect(estados()).toEqual(['cambios', 'aprobada', 'aprobada']);
  });

  it('el barrido no tiene nada que hacer con él, ni deja constancia de nada', async () => {
    await hastaLaRetractacion();

    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO })).toEqual({ aprobados: 0 });
    expect(espia.eventos).toHaveLength(0);
  });
});

/**
 * El remedio del equipo para el caso 3, y la respuesta a la objeción de que «un
 * mes aprobado quedaría reabrible indefinidamente»: **volver a compartirlo le
 * pone fecha nueva y lo cierra**. El mes no vuelve a `en_revision` —ya está
 * aprobado, y mandarlo ahí haría que el barrido dejara una constancia diciendo
 * que el cliente no respondió cuando acababa de aprobarlo todo—: sigue
 * `aprobada` y lo que arranca es el plazo dentro del cual todavía puede cambiar
 * de opinión.
 */
describe('recompartir el mes aprobado sin plazo', () => {
  async function hastaElMesAprobadoSinPlazo() {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);
    await aprueba('pieza-1', REVISA);
    await aprueba('pieza-2', REVISA);
    await pideCambios('pieza-3', REVISA);
    reloj(VENCIDO);
    await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO });
    await aprueba('pieza-3', TARDE);
    expect(filaLote().limiteRevision).toBeNull();
  }

  it('le arma una fecha nueva sin mover el mes de aprobado', async () => {
    await hastaElMesAprobadoSinPlazo();

    reloj(BARRIDO);
    const r = await compartirLote(comoCompartible(), 2, BARRIDO);
    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().estado).toBe('aprobada');
    expect(filaLote().limiteRevision).toEqual(limiteRevision(BARRIDO, 2));
  });

  it('dentro de esa fecha nueva el cliente sigue pudiendo cambiar de opinión', async () => {
    await hastaElMesAprobadoSinPlazo();
    reloj(BARRIDO);
    await compartirLote(comoCompartible(), 2, BARRIDO);

    const dentro = new Date(BARRIDO.getTime() + 3_600_000);
    const r = await pideCambios('pieza-1', dentro);
    expect(r.ok).toBe(true);
  });

  it('y cuando esa fecha pasa, la puerta se cierra de verdad', async () => {
    await hastaElMesAprobadoSinPlazo();
    reloj(BARRIDO);
    await compartirLote(comoCompartible(), 2, BARRIDO);

    const despues = new Date(limiteRevision(BARRIDO, 2).getTime() + 60_000);
    const r = await pideCambios('pieza-1', despues);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);

    // Y nadie escribe una constancia de auto-aprobación: el mes ya estaba
    // aprobado por el cliente, no se aprobó solo.
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: despues })).toEqual({ aprobados: 0 });
    expect(espia.eventos).toHaveLength(0);
  });
});
