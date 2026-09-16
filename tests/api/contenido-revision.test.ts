import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * La revisión del cliente, pieza por pieza (C2, diseño §6).
 *
 * Como en el resto de `tests/api`, las pruebas corren sin `DATABASE_URL` y
 * `@/db` está simulado: lo que se comprueba son las decisiones de la ruta y del
 * servicio —quién puede, qué se escribe en la pieza y en el lote, cuándo nace
 * el comentario anclado, cuándo sale el aviso al operador y qué pasa cuando el
 * plazo ya venció—, no Drizzle.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  PIEZA: '00000000-0000-4000-8000-0000000000f1',
  ETAPA: '00000000-0000-4000-8000-0000000000d1',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  USUARIO_CLIENTE: '00000000-0000-4000-8000-000000000009',
}));

const filaPieza = vi.hoisted(() => () => ({
  id: '00000000-0000-4000-8000-0000000000f1',
  loteId: '00000000-0000-4000-8000-0000000000e1',
  numero: 3, formato: 'post', plataforma: 'ambas',
  fechaPublicacion: null, temaId: null, copy: '', cta: '', hashtags: '', briefVisual: '', arte: [],
  estadoCliente: 'pendiente', notaCliente: null, revisadoEn: null,
  creadoEn: new Date(0), actualizadoEn: new Date(0),
}));

const espia = vi.hoisted(() => ({
  pieza: null as Record<string, unknown> | null,
  lote: null as Record<string, unknown> | null,
  cliente: null as Record<string, unknown> | null,
  /** Lo que devuelve el SELECT … FOR UPDATE del lote dentro de la transacción. */
  loteFresco: null as Record<string, unknown> | null,
  /** Las piezas del lote DESPUÉS de guardar la decisión. */
  piezasTrasGuardar: [] as Record<string, unknown>[],
  etapa: null as Record<string, unknown> | null,
  limite: null as { ok: false; status: 429; razon: string } | null,
  piezaActualizada: undefined as Record<string, unknown> | undefined,
  loteActualizado: undefined as Record<string, unknown> | undefined,
  comentarios: [] as Record<string, unknown>[],
  sincronizados: [] as string[],
  avisos: [] as Record<string, unknown>[],
  vencimientosResueltos: [] as (string | undefined)[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();

  const lectura = (filas: () => unknown[]) => {
    const c = {
      from: () => c,
      where: () => c,
      for: () => c,
      limit: async () => filas(),
      then: (r: (v: unknown) => unknown, j: (e: unknown) => unknown) => Promise.resolve(filas()).then(r, j),
    };
    return c;
  };

  const ejecutor = {
    select: () => ({
      from: (tabla: unknown) => {
        if (tabla === real.contenidoLotes) return lectura(() => (espia.loteFresco ? [espia.loteFresco] : []));
        if (tabla === real.contenidoPiezas) return lectura(() => espia.piezasTrasGuardar);
        if (tabla === real.clienteEtapas) return lectura(() => (espia.etapa ? [espia.etapa] : []));
        return lectura(() => []);
      },
    }),
    update: (tabla: unknown) => {
      const w = {
        set(cambio: Record<string, unknown>) {
          if (tabla === real.contenidoPiezas) espia.piezaActualizada = cambio;
          else espia.loteActualizado = cambio;
          return w;
        },
        where: () => w,
        async returning() {
          return espia.piezaActualizada ? [{ ...filaPieza(), ...espia.piezaActualizada }] : [];
        },
        then: (r: (v: unknown) => unknown, j: (e: unknown) => unknown) => Promise.resolve(undefined).then(r, j),
      };
      return w;
    },
    insert: (tabla: unknown) => ({
      async values(fila: Record<string, unknown>) {
        if (tabla === real.comentarios) espia.comentarios.push(fila);
      },
    }),
  };

  return { ...real, db: { ...ejecutor, transaction: async (fn: (tx: unknown) => unknown) => fn(ejecutor) } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return {
    ...real,
    piezaVisible: async () =>
      (espia.pieza ? { pieza: espia.pieza, lote: espia.lote, cliente: espia.cliente } : null),
  };
});

vi.mock('@/contenido/auto-aprobacion', () => ({
  asegurarLotesAlDia: async (clientId?: string) => { espia.vencimientosResueltos.push(clientId); },
}));

vi.mock('@/contenido/servicio', async (importarReal) => {
  const real = await importarReal<typeof import('@/contenido/servicio')>();
  return {
    ...real,
    sincronizarEtapa: async (clientId: string) => { espia.sincronizados.push(clientId); return null; },
  };
});

vi.mock('@/flujo/servicio', () => ({
  rechazoPorLimite: async () => espia.limite,
}));

vi.mock('@/flujo/avisos', () => ({
  avisarComentarioCliente: async (o: Record<string, unknown>) => { espia.avisos.push(o); },
}));

import { POST } from '@/pages/api/contenido/piezas/[id]/revision';

const { CLIENTE, LOTE, PIEZA, ETAPA, OPERADOR, USUARIO_CLIENTE } = ids;

const usuario = (rol: 'admin' | 'operador' | 'cliente' = 'cliente') => ({
  id: rol === 'cliente' ? USUARIO_CLIENTE : OPERADOR,
  email: 'a@x.mx', nombre: null, apellido: null, rol,
  clientId: rol === 'cliente' ? CLIENTE : null,
  activo: true,
});

const revisar = (cuerpo: unknown, quien = usuario()) => POST({
  params: { id: PIEZA },
  request: new Request(`http://x/api/contenido/piezas/${PIEZA}/revision`, { method: 'POST', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

const COMPARTIDO = new Date('2026-09-16T18:00:00.000Z');
const LIMITE_FUTURO = new Date('2126-09-19T05:59:59.999Z');
// Bien en el pasado: `registrarRevision` compara contra el reloj de verdad, así
// que la fecha tiene que haber quedado atrás corra la prueba el día que corra.
const LIMITE_PASADO = new Date('2020-01-10T05:59:59.999Z');

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'Olam Dental' };
  espia.lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE_FUTURO };
  espia.loteFresco = { estado: 'en_revision', compartidoEn: COMPARTIDO, limiteRevision: LIMITE_FUTURO };
  espia.pieza = filaPieza();
  espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'aprobada' }, { formato: 'post', estadoCliente: 'pendiente' }];
  espia.etapa = { id: ETAPA };
  espia.limite = null;
  espia.piezaActualizada = undefined;
  espia.loteActualizado = undefined;
  espia.comentarios = [];
  espia.sincronizados = [];
  espia.avisos = [];
  espia.vencimientosResueltos = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('POST /api/contenido/piezas/[id]/revision · quién puede', () => {
  it('el cliente de esa pieza aprueba', async () => {
    const res = await revisar({ decision: 'aprobar' });
    expect(res.status).toBe(200);
    expect(espia.piezaActualizada).toMatchObject({ estadoCliente: 'aprobada', notaCliente: null });
    expect(espia.piezaActualizada?.revisadoEn).toBeInstanceOf(Date);
  });

  it('un operador no revisa: la ruta es del cliente y contesta 404', async () => {
    const res = await revisar({ decision: 'aprobar' }, usuario('operador'));
    expect(res.status).toBe(404);
    expect(espia.piezaActualizada).toBeUndefined();
  });

  it('un admin tampoco', async () => {
    expect((await revisar({ decision: 'aprobar' }, usuario('admin'))).status).toBe(404);
    expect(espia.piezaActualizada).toBeUndefined();
  });

  it('un usuario cliente sin empresa no llega a la base', async () => {
    const res = await revisar({ decision: 'aprobar' }, { ...usuario(), clientId: null });
    expect(res.status).toBe(404);
    expect(espia.vencimientosResueltos).toEqual([]);
  });

  it('una pieza de otro cliente es un 404, no un 403', async () => {
    espia.pieza = null;
    expect((await revisar({ decision: 'aprobar' })).status).toBe(404);
  });
});

describe('POST /api/contenido/piezas/[id]/revision · el cuerpo', () => {
  it('rechaza lo que no es JSON', async () => {
    const res = await POST({
      params: { id: PIEZA },
      request: new Request(`http://x/api/contenido/piezas/${PIEZA}/revision`, { method: 'POST', body: 'nada' }),
      locals: { usuario: usuario() },
    } as any);
    expect(res.status).toBe(400);
  });

  it('cambios sin nota se rechaza sin escribir nada', async () => {
    const res = await revisar({ decision: 'cambios' });
    expect(res.status).toBe(400);
    expect(espia.piezaActualizada).toBeUndefined();
    expect(espia.comentarios).toEqual([]);
  });

  it('una decisión desconocida se rechaza', async () => {
    expect((await revisar({ decision: 'rechazar' })).status).toBe(400);
  });
});

describe('POST /api/contenido/piezas/[id]/revision · lo que hace', () => {
  it('resuelve el vencimiento ANTES de leer la pieza', async () => {
    await revisar({ decision: 'aprobar' });
    expect(espia.vencimientosResueltos).toEqual([CLIENTE]);
  });

  it('el lote queda aprobado solo cuando todas sus piezas lo están', async () => {
    espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'aprobada' }, { formato: 'post', estadoCliente: 'aprobada' }];
    const res = await revisar({ decision: 'aprobar' });
    expect((await res.json()).estadoLote).toBe('aprobada');
    expect(espia.loteActualizado).toMatchObject({ estado: 'aprobada' });
  });

  it('con una pieza pendiente el lote sigue en revisión y no se reescribe', async () => {
    const res = await revisar({ decision: 'aprobar' });
    expect((await res.json()).estadoLote).toBe('en_revision');
    expect(espia.loteActualizado).toBeUndefined();
  });

  it('siempre sincroniza la etapa', async () => {
    await revisar({ decision: 'aprobar' });
    expect(espia.sincronizados).toEqual([CLIENTE]);
  });

  it('devuelve el avance para que la portada se repinte sin recargar', async () => {
    const cuerpo = await (await revisar({ decision: 'aprobar' })).json();
    expect(cuerpo.avance).toEqual({ aprobadas: 1, total: 2, porcentaje: 50 });
  });

  it('nunca devuelve el brief visual: es trabajo interno', async () => {
    const cuerpo = await (await revisar({ decision: 'aprobar' })).json();
    expect(cuerpo.pieza).not.toHaveProperty('briefVisual');
    expect(cuerpo.pieza).not.toHaveProperty('copy');
  });
});

describe('POST /api/contenido/piezas/[id]/revision · solicitar cambios', () => {
  const CAMBIOS = { decision: 'cambios', nota: 'La foto no es del consultorio nuevo.' };

  beforeEach(() => {
    espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'cambios' }, { formato: 'post', estadoCliente: 'aprobada' }];
  });

  it('guarda la nota en la pieza y deja el lote con cambios', async () => {
    const res = await revisar(CAMBIOS);
    expect(res.status).toBe(200);
    expect(espia.piezaActualizada).toMatchObject({ estadoCliente: 'cambios', notaCliente: CAMBIOS.nota });
    expect(espia.loteActualizado).toMatchObject({ estado: 'con_cambios' });
  });

  it('crea un comentario anclado a la pieza, firmado por el cliente', async () => {
    await revisar(CAMBIOS);
    expect(espia.comentarios).toHaveLength(1);
    expect(espia.comentarios[0]).toMatchObject({
      etapaId: ETAPA,
      documentoTipo: 'contenido',
      documentoId: LOTE,
      versionNumero: 1,
      ancla: `pieza:${PIEZA}`,
      autorId: USUARIO_CLIENTE,
      autorRol: 'cliente',
    });
    expect(String(espia.comentarios[0].texto)).toContain(CAMBIOS.nota);
  });

  it('avisa al operador del cliente, con el enlace a la pantalla del mes', async () => {
    await revisar(CAMBIOS);
    expect(espia.avisos).toHaveLength(1);
    expect(espia.avisos[0]).toMatchObject({
      actorId: USUARIO_CLIENTE, clientId: CLIENTE, operadorId: OPERADOR, cliente: 'Olam Dental',
      enlace: `/clientes/${CLIENTE}/contenido/2026-09`,
    });
  });

  it('aprobar no crea comentario ni avisa a nadie', async () => {
    espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'aprobada' }];
    await revisar({ decision: 'aprobar' });
    expect(espia.comentarios).toEqual([]);
    expect(espia.avisos).toEqual([]);
  });

  it('respeta el tope de observaciones del cliente, sin escribir nada', async () => {
    espia.limite = { ok: false, status: 429, razon: 'Llegaste al máximo de observaciones por hora.' };
    const res = await revisar(CAMBIOS);
    expect(res.status).toBe(429);
    expect((await res.json()).errores[0]).toContain('máximo');
    expect(espia.piezaActualizada).toBeUndefined();
    expect(espia.comentarios).toEqual([]);
  });

  it('aprobar no cuenta contra el tope: no escribe comentario ni manda correo', async () => {
    espia.limite = { ok: false, status: 429, razon: 'Llegaste al máximo.' };
    espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'aprobada' }];
    expect((await revisar({ decision: 'aprobar' })).status).toBe(200);
  });

  it('sin fila de etapa la decisión vale igual, aunque se pierda el comentario', async () => {
    espia.etapa = null;
    const res = await revisar(CAMBIOS);
    expect(res.status).toBe(200);
    expect(espia.piezaActualizada).toMatchObject({ estadoCliente: 'cambios' });
    expect(espia.comentarios).toEqual([]);
  });
});

describe('POST /api/contenido/piezas/[id]/revision · el plazo', () => {
  it('un mes que todavía no se comparte no se revisa', async () => {
    espia.lote = { ...espia.lote, compartidoEn: null };
    const res = await revisar({ decision: 'aprobar' });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('todavía no está listo');
    expect(espia.piezaActualizada).toBeUndefined();
  });

  // El riesgo abierto de C3: tras la auto-aprobación no hay cambios a
  // destiempo. `asegurarLotesAlDia` corrió arriba, así que un lote vencido ya
  // llega aquí como `aprobada`.
  it('un lote auto-aprobado por vencimiento rechaza la decisión tardía', async () => {
    espia.lote = { ...espia.lote, estado: 'aprobada', limiteRevision: LIMITE_PASADO };
    const res = await revisar({ decision: 'cambios', nota: 'Cambien la foto.' });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('plazo de revisión');
    expect(espia.piezaActualizada).toBeUndefined();
    expect(espia.comentarios).toEqual([]);
    expect(espia.avisos).toEqual([]);
  });

  it('un lote aprobado dentro del plazo sí deja pedir cambios', async () => {
    espia.lote = { ...espia.lote, estado: 'aprobada' };
    espia.loteFresco = { estado: 'aprobada', compartidoEn: COMPARTIDO, limiteRevision: LIMITE_FUTURO };
    espia.piezasTrasGuardar = [{ formato: 'post', estadoCliente: 'cambios' }];
    const res = await revisar({ decision: 'cambios', nota: 'Mejor la otra foto.' });
    expect(res.status).toBe(200);
    expect(espia.loteActualizado).toMatchObject({ estado: 'con_cambios' });
  });

  // La carrera real: el worker auto-aprueba el lote mientras el cliente
  // aprieta el botón. La fila se relee bloqueada dentro de la transacción.
  it('si el lote venció entre la lectura y la transacción, no se escribe nada', async () => {
    espia.loteFresco = { estado: 'aprobada', compartidoEn: COMPARTIDO, limiteRevision: LIMITE_PASADO };
    const res = await revisar({ decision: 'cambios', nota: 'Cambien la foto.' });
    expect(res.status).toBe(409);
    expect(espia.piezaActualizada).toBeUndefined();
    expect(espia.avisos).toEqual([]);
  });

  it('si el lote desapareció mientras tanto, 404', async () => {
    espia.loteFresco = null;
    expect((await revisar({ decision: 'aprobar' })).status).toBe(404);
  });
});
