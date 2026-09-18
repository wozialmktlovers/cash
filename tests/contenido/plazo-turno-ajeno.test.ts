import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **Un plazo que se consumió mientras la pelota era del otro no revive.**
 *
 * Es la última puerta de la familia del plazo, y la que no cerraba la
 * invariante de `./plazo-contenido-tocado.test.ts`. Allí la pregunta era «¿es
 * este el contenido que se compartió?», y se contesta con
 * `contenido_actualizado_en`. Aquí el operador **no toca nada**, así que esa
 * pregunta contesta que sí —el contenido es exactamente el que se repartió— y
 * el plazo vencido vuelve a correr sobre piezas que el cliente no miró.
 *
 * La secuencia: el cliente devuelve una pieza (el mes pasa a `con_cambios`, que
 * no se auto-aprueba), el plazo vence mientras el trabajo es del operador, y el
 * cliente se retracta y aprueba él mismo esa pieza. Ya no queda ninguna en
 * `cambios`, `estadoLoteSegunPiezas` deduce `en_revision` y el lote volvía ahí
 * con la fecha muerta de la ronda 1 — y el siguiente barrido aprobaba en el acto
 * las dos piezas que nadie había mirado, con constancia de que «no respondió».
 *
 * Lo que falla no es de qué contenido habla el plazo, sino **de quién era el
 * turno mientras corría**: el mes estuvo esperando al operador y el reloj siguió.
 * La decisión tomada es apagar el plazo, no devolver el mes al operador: el
 * cliente acaba de demostrar que está trabajando en el mes, quitarle el acceso
 * justo ahí sería brusco. Queda `en_revision` con `limite_revision` nulo —sigue
 * revisando, pero nada se aprueba solo— y para volver a tener fecha hay que
 * repartir el mes otra vez.
 *
 * Mismo doble y mismo manejo del reloj que `./plazo-contenido-tocado.test.ts`:
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
  cliente: '00000000-0000-4000-8000-0000000000c2',
  lote: '00000000-0000-4000-8000-00000000010f',
  usuario: '00000000-0000-4000-8000-0000000000a2',
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
import { limiteRevision, loteAutoAprobado } from '@/contenido/reglas';
import { registrarRevision } from '@/contenido/revision';
import { compartirLote, type LoteCompartible } from '@/contenido/servicio';
import type { UsuarioSesion } from '@/lib/permisos';

/** Martes de septiembre de 2026: el operador abre el lote del mes. */
const CREADO = new Date('2026-09-08T16:00:00.000Z');
/** Jueves a media mañana de México: se comparte el mes. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El plazo de esa ronda, con los 2 días hábiles de la casa. */
const LIMITE_1 = limiteRevision(RONDA_1, 2);
/** Dos horas después de recibirlo, el cliente devuelve una pieza. */
const PIDE_CAMBIOS = new Date(RONDA_1.getTime() + 2 * 3_600_000);
/** Un minuto después del límite, con el mes todavía del lado del operador. */
const VENCIDO = new Date(LIMITE_1.getTime() + 60_000);
/** Dos días después, el cliente vuelve al portal y se retracta. */
const ARREPIENTE = new Date(LIMITE_1.getTime() + 2 * 86_400_000);
/** El barrido del worker que viene detrás. */
const BARRIDO = new Date(ARREPIENTE.getTime() + 10 * 60_000);

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
 * El guión del planteamiento, con el operador sin hacer nada entre medias: por
 * eso `contenido_actualizado_en` se queda en `CREADO` y la invariante del
 * contenido tocado no interviene en ningún momento.
 */
async function hastaLaRetractacion() {
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

  // El operador no toca nada: ni corrige la pieza ni vuelve a compartir. El
  // plazo vence con la pelota de su lado, y un `con_cambios` no se auto-aprueba.
  reloj(VENCIDO);
  expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: VENCIDO })).toEqual({ aprobados: 0 });
  expect(filaLote().contenidoActualizadoEn).toEqual(CREADO);

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

describe('el cliente se retracta después de que el plazo venciera en turno del operador', () => {
  it('el mes vuelve a revisión, pero sin fecha límite', async () => {
    await hastaLaRetractacion();

    // El estado deducido es correcto —quedan dos piezas sin mirar—, y el plazo
    // que arrastraba se apaga en vez de resucitar.
    expect(filaLote().estado).toBe('en_revision');
    expect(filaLote().limiteRevision).toBeNull();
    // El reparto no se deshace: el cliente sigue teniendo el mes delante.
    expect(filaLote().compartidoEn).toEqual(RONDA_1);
  });

  it('el siguiente barrido NO aprueba las piezas que el cliente no ha mirado', async () => {
    await hastaLaRetractacion();

    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO })).toEqual({ aprobados: 0 });
    expect(estados()).toEqual(['pendiente', 'pendiente', 'aprobada']);
  });

  it('y no queda constancia de que el cliente no respondió', async () => {
    await hastaLaRetractacion();
    await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO });

    expect(espia.eventos).toHaveLength(0);
  });

  it('el cliente sigue pudiendo decidir sobre las piezas que le quedan', async () => {
    await hastaLaRetractacion();
    await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO });

    // Es el motivo de haber elegido apagar el plazo en vez de devolver el mes al
    // operador: quien acaba de opinar no se queda sin poder seguir.
    const luego = new Date(BARRIDO.getTime() + 60_000);
    reloj(luego);
    const r = await registrarRevision({
      piezaId: 'pieza-1', usuario: CLIENTE, decision: 'aprobar', nota: '', ahora: luego,
    });
    expect(r.ok).toBe(true);
    expect(estados()).toEqual(['aprobada', 'pendiente', 'aprobada']);
  });

  it('volver a compartir el mes es lo que le arma una fecha nueva', async () => {
    await hastaLaRetractacion();

    // Sin esto el mes quedaría congelado: `en_revision` para siempre, sin plazo
    // posible, porque la regla de `compartirLote` solo arranca desde el lado del
    // operador y este lote ya está `en_revision`.
    const r = await compartirLote(comoCompartible(), 2, BARRIDO);
    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().limiteRevision).toEqual(limiteRevision(BARRIDO, 2));

    const despues = new Date(limiteRevision(BARRIDO, 2).getTime() + 60_000);
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: despues })).toEqual({ aprobados: 1 });
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
  });

  it('pero recompartir un mes con su plazo vivo sigue sin mover la fecha', async () => {
    reloj(RONDA_1);
    await compartirLote(comoCompartible(), 2, RONDA_1);

    // La puerta del anti-juego sigue cerrada: un `en_revision` con fecha no
    // reinicia nada, así que no se puede alargar el mes a base de pulsar
    // «Compartir». Solo el `en_revision` SIN fecha —el que este arreglo crea—
    // vuelve a armarla.
    const r = await compartirLote(comoCompartible(), 2, PIDE_CAMBIOS);
    expect(r.arrancoElPlazo).toBe(false);
    expect(filaLote().limiteRevision).toEqual(LIMITE_1);
  });
});

/**
 * La otra mitad del arreglo: que un lote sin fecha no se auto-apruebe no es una
 * comprobación nueva, es la que `loteAutoAprobado` ya hacía. Se fija aquí para
 * que quede atada a este caso: si alguien la relajara, el apagado del plazo
 * dejaría de significar nada.
 */
describe('un lote «en_revision» sin fecha límite no se auto-aprueba', () => {
  it('la regla lo dice sola, sin mirar el reloj', () => {
    expect(loteAutoAprobado(
      { compartidoEn: RONDA_1, limiteRevision: null, estado: 'en_revision', contenidoActualizadoEn: CREADO },
      BARRIDO,
    )).toBe(false);
  });

  it('y el prefiltro del barrido ni siquiera lo trae', async () => {
    espia.lotes[0] = {
      ...filaLote(),
      estado: 'en_revision',
      compartidoEn: RONDA_1,
      limiteRevision: null,
      contenidoActualizadoEn: CREADO,
    };
    expect(await autoAprobarVencidos({ clientId: ids.cliente, ahora: BARRIDO })).toEqual({ aprobados: 0 });
    expect(estados()).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });
});
