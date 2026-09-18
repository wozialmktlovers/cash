import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enlaceEtapa } from '@/lib/ui/enlaces';

/**
 * A dónde llevan los avisos del flujo: al documento de la etapa, donde se
 * resuelve (la barra con «Autorizar»/«Solicitar autorización» y los
 * comentarios), y no a la ficha del cliente.
 *
 * Primero la regla pura (`enlaceEtapa`); luego el servicio de verdad
 * (`ejecutarTransicion`, `crearComentarioCliente`, `responderComentario`)
 * con la base simulada, para fijar qué enlace le pasa a cada aviso. Las
 * pruebas corren sin `DATABASE_URL`: una consulta que no esté simulada
 * revienta en vez de pasar de largo.
 */

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const ETAPA = '22222222-2222-4222-8222-222222222222';
const DOC = '33333333-3333-4333-8333-333333333333';
const COMENTARIO = '44444444-4444-4444-8444-444444444444';
const PADRE = '55555555-5555-4555-8555-555555555555';

describe('enlaceEtapa', () => {
  const manual = { clientId: CLIENTE, etapa: 'manual_campana' as const, documentoTipo: 'growth' as const, documentoId: DOC };

  it('lleva al documento de la etapa, según su tipo', () => {
    expect(enlaceEtapa(manual)).toBe(`/growth/${DOC}`);
    expect(enlaceEtapa({ ...manual, etapa: 'pilares', documentoTipo: 'pilares' })).toBe(`/pilares/${DOC}`);
    expect(enlaceEtapa({ ...manual, etapa: 'investigacion', documentoTipo: 'research' })).toBe(`/resultados/${DOC}`);
  });

  it('a un comentario: el documento con #comentario-<id>', () => {
    expect(enlaceEtapa(manual, { comentarioId: COMENTARIO })).toBe(`/growth/${DOC}#comentario-${COMENTARIO}`);
  });

  it('al primer comentario abierto: #primer-comentario (el recorrido lo calcula el script)', () => {
    expect(enlaceEtapa(manual, { primerComentario: true })).toBe(`/growth/${DOC}#primer-comentario`);
  });

  it('sin documento todavía, o en el desarrollo mensual, la ficha es el respaldo', () => {
    expect(enlaceEtapa({ ...manual, documentoTipo: null, documentoId: null })).toBe(`/clientes/${CLIENTE}`);
    expect(enlaceEtapa({ ...manual, etapa: 'desarrollo_mensual' }, { comentarioId: COMENTARIO })).toBe(`/clientes/${CLIENTE}`);
  });

  it('nada de lo que llega se pega tal cual: ids sin forma de UUID caen al respaldo o se ignoran', () => {
    expect(enlaceEtapa({ ...manual, documentoId: '../admin' })).toBe(`/clientes/${CLIENTE}`);
    expect(enlaceEtapa(manual, { comentarioId: 'x"><script>' })).toBe(`/growth/${DOC}`);
    expect(enlaceEtapa({ ...manual, documentoId: null, clientId: '//evil.example' })).toBe('/clientes/%2F%2Fevil.example');
    for (const e of [enlaceEtapa(manual), enlaceEtapa(manual, { comentarioId: COMENTARIO })]) {
      expect(e.startsWith('/')).toBe(true);
      expect(e.startsWith('//')).toBe(false);
    }
  });
});

// ── El servicio, con la base simulada ────────────────────────────────────

const espia = vi.hoisted(() => ({
  etapa: null as Record<string, unknown> | null,
  abiertos: [] as Record<string, unknown>[],
  padre: null as Record<string, unknown> | null,
  version: null as Record<string, unknown> | null,
  cliente: null as Record<string, unknown> | null,
  avisos: [] as { tipo: string; datos: Record<string, unknown> }[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();

  const filas = (tabla: unknown, columnas: string[] | null): Record<string, unknown>[] => {
    if (tabla === real.clienteEtapas) return espia.etapa ? [espia.etapa] : [];
    if (tabla === real.comentarios) {
      if (columnas?.includes('enUltimaHora')) return [{ enUltimaHora: 0, enUltimoDia: 0 }];
      if (columnas === null) return espia.padre ? [espia.padre] : [];
      return espia.abiertos;
    }
    if (tabla === real.documentoVersiones) return espia.version ? [espia.version] : [];
    if (tabla === real.clients) return espia.cliente ? [espia.cliente] : [];
    if (tabla === real.growthResults) return [{ datos: {} }];
    throw new Error('consulta sin simular');
  };

  const consulta = (columnas: string[] | null) => {
    let tabla: unknown = null;
    const q: Record<string, unknown> = {
      from(t: unknown) { tabla = t; return q; },
      where() { return q; },
      orderBy() { return q; },
      for() { return q; },
      limit() { return q; },
      then(ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) {
        try { return Promise.resolve(filas(tabla, columnas)).then(ok, mal); } catch (e) { return Promise.reject(e).then(ok, mal); }
      },
    };
    return q;
  };

  const ejecutor = {
    select: (cols?: Record<string, unknown>) => consulta(cols ? Object.keys(cols) : null),
    update: (tabla: unknown) => {
      let cambio: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        set(c: Record<string, unknown>) { cambio = c; return q; },
        where() { return q; },
        returning() {
          if (tabla === real.clienteEtapas && espia.etapa) {
            espia.etapa = { ...espia.etapa, ...cambio };
            return Promise.resolve([espia.etapa]);
          }
          return Promise.resolve([]);
        },
        then(ok: (v: unknown) => unknown) { return Promise.resolve(undefined).then(ok); },
      };
      return q;
    },
    insert: (tabla: unknown) => ({
      values(v: Record<string, unknown>) {
        const fila = { id: tabla === real.comentarios ? COMENTARIO : 'x', ...v };
        return {
          returning: () => Promise.resolve([fila]),
          then(ok: (v: unknown) => unknown) { return Promise.resolve(undefined).then(ok); },
        };
      },
    }),
  };

  return { ...real, db: { ...ejecutor, transaction: (fn: (tx: unknown) => unknown) => fn(ejecutor) } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return {
    ...real,
    clienteOperable: vi.fn(async () => espia.cliente),
    clienteVisible: vi.fn(async () => espia.cliente),
  };
});

vi.mock('@/flujo/avisos', () => {
  const apuntar = (tipo: string) => vi.fn(async (datos: Record<string, unknown>) => { espia.avisos.push({ tipo, datos }); });
  return {
    avisarJob: apuntar('job'),
    avisarTransicion: apuntar('transicion'),
    avisarComentarioCliente: apuntar('comentario_cliente'),
    avisarRespuestaCliente: apuntar('respuesta_cliente'),
    avisarRespuestaDelCliente: apuntar('cliente_respondio'),
  };
});

const { ejecutarTransicion, crearComentarioCliente, responderComentario } = await import('@/flujo/servicio');

const OPERADOR = { id: 'op-1', rol: 'operador' as const, email: 'op@x.mx', nombre: 'Ana', apellido: 'Paw', clientId: null };
const ADMIN = { id: 'admin-1', rol: 'admin' as const, email: 'ad@x.mx', nombre: 'Luis', apellido: null, clientId: null };
const USUARIO_CLIENTE = { id: 'cli-1', rol: 'cliente' as const, email: 'c@x.mx', nombre: 'Yessica', apellido: null, clientId: CLIENTE };

const flush = () => new Promise((r) => setTimeout(r, 0));
const enlaceDelAviso = (tipo: string) => espia.avisos.find((a) => a.tipo === tipo)?.datos.enlace;

beforeEach(() => {
  espia.etapa = {
    id: ETAPA, clientId: CLIENTE, etapa: 'manual_campana', contratada: true, interna: false,
    estado: 'en_proceso', documentoTipo: 'growth', documentoId: DOC, versionAprobadaId: null, actualizadoEn: new Date(),
  };
  espia.abiertos = [];
  espia.padre = null;
  espia.version = null;
  espia.cliente = { id: CLIENTE, nombre: 'Ana Yessica Villa', operadorId: OPERADOR.id };
  espia.avisos = [];
});

describe('avisos de las transiciones', () => {
  it('solicitud de autorización → el documento (ahí está «Autorizar»), no la ficha', async () => {
    const r = await ejecutarTransicion({ etapaId: ETAPA, accion: 'solicitar', usuario: OPERADOR as never });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('transicion')).toBe(`/growth/${DOC}`);
  });

  it('cambios pedidos → el documento, en el primer comentario abierto', async () => {
    espia.etapa!.estado = 'en_revision';
    const r = await ejecutarTransicion({ etapaId: ETAPA, accion: 'pedir_cambios', usuario: ADMIN as never, comentario: 'Cambia el tono' });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('transicion')).toBe(`/growth/${DOC}#primer-comentario`);
  });

  it('reabierta → el documento, en el primer comentario (el general que deja quien reabre)', async () => {
    espia.etapa!.estado = 'aprobada';
    const r = await ejecutarTransicion({ etapaId: ETAPA, accion: 'reabrir', usuario: ADMIN as never, comentario: 'Falta la oferta' });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('transicion')).toBe(`/growth/${DOC}#primer-comentario`);
  });

  it('autorizada desde el documento (admin, en un paso) → el documento', async () => {
    espia.version = { numero: 2 };
    const r = await ejecutarTransicion({ etapaId: ETAPA, accion: 'aprobar', usuario: ADMIN as never });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('transicion')).toBe(`/growth/${DOC}`);
  });
});

describe('avisos de comentarios del cliente', () => {
  it('comentario del cliente → el documento con ESE hilo abierto', async () => {
    espia.etapa!.estado = 'aprobada';
    espia.etapa!.versionAprobadaId = 'v-1';
    espia.version = { id: 'v-1', documentoTipo: 'growth', documentoId: DOC, numero: 3 };
    const r = await crearComentarioCliente({ etapaId: ETAPA, usuario: USUARIO_CLIENTE as never, ancla: 'seccion:inicio', texto: 'Cambien la foto' });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('comentario_cliente')).toBe(`/growth/${DOC}#comentario-${COMENTARIO}`);
  });

  it('respuesta del cliente → el documento con el hilo al que respondió', async () => {
    espia.padre = {
      id: PADRE, etapaId: ETAPA, documentoTipo: 'growth', documentoId: DOC, versionNumero: 1, ancla: 'seccion:inicio',
      autorRol: 'cliente', autorId: USUARIO_CLIENTE.id, respuestaDe: null,
    };
    const r = await responderComentario({ comentarioId: PADRE, usuario: USUARIO_CLIENTE as never, texto: 'Gracias' });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('cliente_respondio')).toBe(`/growth/${DOC}#comentario-${PADRE}`);
  });

  it('una etapa sin documento todavía deja la ficha como respaldo', async () => {
    espia.padre = {
      id: PADRE, etapaId: ETAPA, documentoTipo: 'growth', documentoId: DOC, versionNumero: 1, ancla: 'general',
      autorRol: 'cliente', autorId: USUARIO_CLIENTE.id, respuestaDe: null,
    };
    espia.etapa!.documentoTipo = null;
    espia.etapa!.documentoId = null;
    const r = await responderComentario({ comentarioId: PADRE, usuario: USUARIO_CLIENTE as never, texto: 'Hola' });
    expect(r.ok).toBe(true);
    await flush();
    expect(enlaceDelAviso('cliente_respondio')).toBe(`/clientes/${CLIENTE}`);
  });
});
