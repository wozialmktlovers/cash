import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Fila } from './doble-base';

/**
 * **Retirar un enlace ya compartido**, y qué le pasa al plazo del mes cuando se
 * retira el último.
 *
 * El agujero que cierra: cada «Compartir el mes» crea otro token —a propósito,
 * ver `compartirLote`— y ninguno se podía anular desde ninguna pantalla. Un
 * enlace mandado por WhatsApp al contacto equivocado quedaba abierto para
 * siempre.
 *
 * La decisión que estas pruebas fijan: retirar el **último** enlace vivo de un
 * mes `en_revision` **detiene el plazo** —el lote vuelve a `en_proceso` con
 * `compartido_en` y `limite_revision` limpios—, porque la auto-aprobación es
 * una promesa («si no respondes en 2 días, se aprueba») que solo es honesta
 * mientras el cliente pueda mirar, y retirar el acceso es justamente quitarle
 * esa posibilidad. Es la regla de la casa aplicada al otro lado: un plazo solo
 * corre sobre material que se le compartió al cliente (`refrescarLote`,
 * ./lote-reabierto.test.ts).
 *
 * Usa la base en miniatura de `./doble-base.ts` por la misma razón que sus
 * vecinas: lo que se prueba son secuencias —compartir, retirar, volver a
 * compartir, que venza— donde cada paso lee lo que escribió el anterior.
 */

const espia = vi.hoisted(() => ({
  lotes: [] as Fila[],
  piezas: [] as Fila[],
  etapas: [] as Fila[],
  eventos: [] as Fila[],
  enlaces: [] as Fila[],
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
import { limiteRevision } from '@/contenido/reglas';
import { enlacesDelLote, retirarEnlaceDelLote } from '@/contenido/enlaces';
import { compartirLote, type LoteCompartible } from '@/contenido/servicio';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const LOTE = '00000000-0000-4000-8000-00000000010e';
const OTRO_LOTE = '00000000-0000-4000-8000-00000000010f';

/** Jueves de septiembre de 2026, a media mañana de México: se comparte el mes. */
const COMPARTIDO = new Date('2026-09-10T16:00:00.000Z');
const LIMITE = limiteRevision(COMPARTIDO, 2);
/** Un minuto después del límite: el barrido encontraría el mes vencido. */
const VENCIDO = new Date(LIMITE.getTime() + 60_000);
/** Media hora después de compartir: el operador se da cuenta del error. */
const AL_RATO = new Date(COMPARTIDO.getTime() + 30 * 60_000);

const loteDe = (extra: Partial<Fila> = {}): Fila => ({
  id: LOTE,
  clientId: CLIENTE,
  periodo: '2026-09',
  estado: 'en_proceso',
  compartidoEn: null,
  limiteRevision: null,
  ...extra,
});

const enlaceDe = (token: string, extra: Partial<Fila> = {}): Fila => ({
  token,
  documentoId: LOTE,
  documentoTipo: 'contenido',
  revocado: false,
  visitas: 0,
  createdAt: COMPARTIDO,
  ...extra,
});

const lote = (): Fila => espia.lotes.find((l) => l.id === LOTE)!;
const etapaMensual = (): Fila | undefined =>
  espia.etapas.find((e) => e.clientId === CLIENTE && e.etapa === 'desarrollo_mensual');

beforeEach(() => {
  espia.lotes = [];
  espia.piezas = [];
  espia.etapas = [];
  espia.eventos = [];
  espia.enlaces = [];
});

describe('enlacesDelLote', () => {
  it('trae los enlaces de ese lote, vivos y retirados, sin los de otros meses', async () => {
    espia.enlaces = [
      enlaceDe('vivo', { createdAt: new Date('2026-09-11T00:00:00Z'), visitas: 4 }),
      enlaceDe('retirado', { revocado: true, createdAt: new Date('2026-09-10T00:00:00Z') }),
      enlaceDe('de-otro-mes', { documentoId: OTRO_LOTE }),
    ];
    const r = await enlacesDelLote(LOTE);
    expect(r.map((e) => e.token).sort()).toEqual(['retirado', 'vivo']);
    expect(r.find((e) => e.token === 'vivo')).toMatchObject({ visitas: 4, revocado: false });
  });

  // `share_links.documento_id` no tiene clave foránea: apunta a cuatro tablas
  // distintas según el tipo, así que el tipo es parte del filtro.
  it('no confunde un enlace de otro tipo de documento que apunte al mismo id', async () => {
    espia.enlaces = [enlaceDe('impostor', { documentoTipo: 'pilares' })];
    expect(await enlacesDelLote(LOTE)).toEqual([]);
  });
});

describe('retirarEnlaceDelLote', () => {
  it('retira el enlace y lo deja revocado para siempre', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('uno'), enlaceDe('dos')];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'uno', AL_RATO);

    expect(r.retirado).toBe(true);
    expect(espia.enlaces.find((e) => e.token === 'uno')!.revocado).toBe(true);
    expect(espia.enlaces.find((e) => e.token === 'dos')!.revocado).toBe(false);
  });

  it('mientras quede otro enlace vivo, el plazo sigue corriendo', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('uno'), enlaceDe('dos')];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'uno', AL_RATO);

    expect(r).toMatchObject({ activosRestantes: 1, detuvoElPlazo: false, estado: 'en_revision' });
    expect(lote()).toMatchObject({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE });
  });

  // El caso que da nombre a todo esto.
  it('retirar el último detiene el plazo y devuelve el mes al operador', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);

    expect(r).toMatchObject({ retirado: true, activosRestantes: 0, detuvoElPlazo: true, estado: 'en_proceso' });
    expect(lote()).toMatchObject({ estado: 'en_proceso', compartidoEn: null, limiteRevision: null });
  });

  it('y la etapa del cliente dice lo mismo que el lote', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);

    expect(etapaMensual()).toMatchObject({ estado: 'en_proceso' });
  });

  // La consecuencia que justifica la decisión: sin esto, el barrido aprobaba un
  // mes que nadie del lado del cliente podía abrir, y dejaba constancia de que
  // «no respondió».
  it('el mes retirado ya no se auto-aprueba cuando pasa la fecha límite', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.piezas = [{ id: 'p1', loteId: LOTE, numero: 1, formato: 'post', estadoCliente: 'pendiente' }];
    espia.enlaces = [enlaceDe('unico')];

    await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);
    const barrido = await autoAprobarVencidos({ clientId: CLIENTE, ahora: VENCIDO });

    expect(barrido.aprobados).toBe(0);
    expect(lote().estado).toBe('en_proceso');
    expect(espia.eventos).toEqual([]);
    expect(espia.piezas[0].estadoCliente).toBe('pendiente');
  });

  // Y volver a compartir es lo que le devuelve el acceso y arranca un plazo
  // nuevo — el mismo camino que ya usa un mes reabierto por cambio de piezas.
  it('volver a compartir arranca un plazo nuevo sobre el mes retirado', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);
    const resultado = await compartirLote(lote() as unknown as LoteCompartible, 2, VENCIDO);

    expect(resultado.arrancoElPlazo).toBe(true);
    expect(lote()).toMatchObject({ estado: 'en_revision', compartidoEn: VENCIDO });
    expect(lote().limiteRevision).not.toEqual(LIMITE);
  });

  // Los tres estados sin reloj se quedan como están, cada uno por su razón
  // (ver el comentario de `retirarEnlaceDelLote`).
  it('un mes aprobado no se reabre al retirarle el último enlace', async () => {
    espia.lotes = [loteDe({ estado: 'aprobada', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);

    expect(r).toMatchObject({ detuvoElPlazo: false, estado: 'aprobada' });
    expect(lote()).toMatchObject({ estado: 'aprobada', compartidoEn: COMPARTIDO, limiteRevision: LIMITE });
  });

  it('un mes con cambios sigue visible para el cliente: no hay plazo que detener', async () => {
    espia.lotes = [loteDe({ estado: 'con_cambios', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);

    expect(r).toMatchObject({ detuvoElPlazo: false, estado: 'con_cambios' });
    expect(lote()).toMatchObject({ compartidoEn: COMPARTIDO });
  });

  it('un token de otro lote no se retira desde aquí, aunque el permiso de este ya haya pasado', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('mio'), enlaceDe('ajeno', { documentoId: OTRO_LOTE })];

    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'ajeno', AL_RATO);

    expect(r.retirado).toBe(false);
    expect(espia.enlaces.find((e) => e.token === 'ajeno')!.revocado).toBe(false);
    // Y el mes no se toca: le queda su enlace vivo.
    expect(r).toMatchObject({ activosRestantes: 1, detuvoElPlazo: false });
  });

  // Dos pestañas abiertas sobre la misma lista, o dos operadores a la vez.
  it('retirar dos veces el mismo token no retira nada la segunda, pero deja el mes coherente', async () => {
    espia.lotes = [loteDe({ estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE })];
    espia.enlaces = [enlaceDe('unico')];

    const primera = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);
    const segunda = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);

    expect(primera).toMatchObject({ retirado: true, detuvoElPlazo: true });
    // La segunda no retira nada y tampoco vuelve a detener un plazo ya detenido.
    expect(segunda).toMatchObject({ retirado: false, activosRestantes: 0, detuvoElPlazo: false, estado: 'en_proceso' });
  });

  it('un lote que ya no existe no revienta', async () => {
    espia.enlaces = [enlaceDe('unico')];
    const r = await retirarEnlaceDelLote({ id: LOTE, clientId: CLIENTE }, 'unico', AL_RATO);
    expect(r).toMatchObject({ retirado: false, detuvoElPlazo: false });
  });
});
