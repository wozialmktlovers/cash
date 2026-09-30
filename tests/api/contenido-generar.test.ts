import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * El paso «Elegir los temas del mes» (`…/lotes/[id]/temas`) y «Autorizar temas y
 * generar contenido» (`…/lotes/[id]/generar`). Sin base ni modelo: `@/db` y los
 * servicios que leen el banco están simulados, y lo que se comprueba son las
 * decisiones de las rutas —quién puede, qué valida, qué guarda y qué deja en la
 * cola—.
 */
const espia = vi.hoisted(() => ({
  lote: null as any,
  cliente: null as any,
  piezas: [] as any[],
  jobs: [] as any[],
  insertados: [] as any[],
  /** Lo que se escribió en `contenido_lotes.temas_mes`. */
  guardados: [] as any[],
  dependencias: { ok: true, razon: '' },
  responsables: new Set<string>(),
  catalogo: [] as any[],
  usadoEn: new Map<string, string>(),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const lectura = () => {
    let tabla: unknown;
    const datos = () => (tabla === real.researchJobs ? espia.jobs : tabla === real.clienteEtapas ? [{ id: 'etapa-mensual' }] : (() => { throw new Error('Consulta no prevista'); })());
    const b: Record<string, unknown> = {
      from(t: unknown) { tabla = t; return b; },
      where() { return b; },
      limit: async () => datos(),
    };
    return b;
  };
  const escritura = (tx: boolean) => ({
    update: () => ({ set: (v: any) => ({ where: async () => { if ('temasMes' in v) espia.guardados.push(v.temasMes); } }) }),
    insert: () => ({ values: (v: any) => ({ returning: async () => { espia.insertados.push(v); return [{ id: 'job-nuevo' }]; } }) }),
    ...(tx ? {} : {}),
  });
  return { ...real, db: { select: () => lectura(), ...escritura(false), transaction: async (fn: any) => fn(escritura(true)) } };
});

vi.mock('@/lib/visibilidad', async (importarReal) => ({
  ...(await importarReal<typeof import('@/lib/visibilidad')>()),
  loteVisible: async (u: any) => (u.rol === 'cliente' ? null : { lote: espia.lote, cliente: espia.cliente }),
}));
vi.mock('@/flujo/dependencias', () => ({ dependenciasDelMes: async () => espia.dependencias }));
vi.mock('@/flujo/servicio', async (importarReal) => ({ ...(await importarReal<typeof import('@/flujo/servicio')>()), etapasDelCliente: async () => [] }));
vi.mock('@/flujo/responsables', () => ({ esResponsableDeEtapa: async (_e: string, u: string) => espia.responsables.has(u) }));
vi.mock('@/contenido/mes/banco-servicio', async (importarReal) => ({
  ...(await importarReal<typeof import('@/contenido/mes/banco-servicio')>()),
  cargarBancoDelMes: async () => ({
    mapaId: 'mapa-1', mapa: espia.mapa, catalogo: espia.catalogo, piezasLote: espia.piezas,
    temasDelCliente: espia.piezas.map((p) => ({ id: p.id, temaId: p.temaId })), usadoEn: espia.usadoEn,
  }),
}));

import { POST as GENERAR } from '@/pages/api/contenido/lotes/[id]/generar';
import { POST as PROPONER, PUT as GUARDAR } from '@/pages/api/contenido/lotes/[id]/temas';
import { leerSeleccion } from '@/contenido/mes/propuesta';
import { catalogoDeTemas } from '@/contenido/mes/temas';
import { mapaFalso } from '../fixtures/pilares';

const LOTE = '00000000-0000-4000-8000-0000000000b1';
const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const usuario = (id: string, rol: 'admin' | 'operador' | 'cliente' = 'operador') =>
  ({ id, email: `${id}@x.mx`, nombre: id, apellido: null, rol, clientId: rol === 'cliente' ? CLIENTE : null, activo: true });
const admin = usuario('admin', 'admin');
const contenido = usuario('contenido');
const diseno = usuario('diseno');
const otro = usuario('otro');
const cliente = usuario('cliente', 'cliente');

const pieza = (id: string, extra: Record<string, unknown> = {}) =>
  ({ id, numero: 1, formato: 'post', estadoCliente: 'pendiente', arte: [], fechaPublicacion: null, temaId: null, ...extra });

const peticion = (metodo: 'POST' | 'PUT', cuerpo: unknown, quien: unknown) => ({
  params: { id: LOTE },
  request: new Request(`http://x/api/contenido/lotes/${LOTE}/x`, {
    method: metodo,
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  }),
  locals: { usuario: quien },
}) as any;
const proponer = (cuerpo?: unknown, quien: unknown = contenido) => PROPONER(peticion('POST', cuerpo, quien));
const guardar = (cuerpo: unknown, quien: unknown = contenido) => GUARDAR(peticion('PUT', cuerpo, quien));
const generar = (cuerpo?: unknown, quien: unknown = contenido) => GENERAR(peticion('POST', cuerpo, quien));

/** Propone y devuelve las filas, como lo haría la pantalla. */
async function filasPropuestas(cuerpo?: unknown) {
  const r = await (await proponer(cuerpo)).json();
  return r.seleccion.filas as { ref: number; formato: string; fecha: string; temaId: string | null }[];
}

beforeEach(() => {
  espia.mapa = mapaFalso();
  espia.catalogo = catalogoDeTemas(espia.mapa);
  espia.lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-10', estado: 'en_proceso', temasMes: null };
  espia.cliente = { id: CLIENTE, nombre: 'Negocio de prueba', paquete: { post: 2, reel: 1 } };
  espia.piezas = [];
  espia.jobs = [];
  espia.insertados = [];
  espia.guardados = [];
  espia.dependencias = { ok: true, razon: '' };
  espia.responsables = new Set(['contenido', 'diseno']);
  espia.usadoEn = new Map();
});

describe('permisos: proponer, editar y autorizar', () => {
  it('el admin y los responsables de contenido y de diseño sí', async () => {
    for (const quien of [admin, contenido, diseno]) {
      expect((await proponer(undefined, quien)).status, quien.id).toBe(200);
      espia.lote = { ...espia.lote, temasMes: espia.guardados.at(-1) };
      expect((await generar(undefined, quien)).status, quien.id).toBe(201);
      espia.jobs = [];
    }
  });

  it('otro operador ve pero no toca: 403 y nada se guarda ni se encola', async () => {
    for (const r of [await proponer(undefined, otro), await guardar({ filas: [] }, otro), await generar(undefined, otro)]) {
      expect(r.status).toBe(403);
      expect((await r.json()).errores[0]).toMatch(/responsables del desarrollo mensual/);
    }
    expect(espia.guardados).toHaveLength(0);
    expect(espia.insertados).toHaveLength(0);
  });

  it('el usuario cliente recibe 404', async () => {
    expect((await proponer(undefined, cliente)).status).toBe(404);
    expect((await generar(undefined, cliente)).status).toBe(404);
  });
});

describe('dependencia dura', () => {
  it('sin investigación o sin mapa, proponer y generar responden 409 con la razón y no hacen nada', async () => {
    espia.dependencias = { ok: false, razon: 'Falta generar el mapa de pilares antes de armar el mes.' };
    for (const r of [await proponer(), await guardar({ filas: [] }), await generar()]) {
      expect(r.status).toBe(409);
      expect((await r.json()).errores[0]).toBe('Falta generar el mapa de pilares antes de armar el mes.');
    }
    expect(espia.guardados).toHaveLength(0);
    expect(espia.insertados).toHaveLength(0);
  });
});

describe('lo que pide antes de continuar', () => {
  it('sin paquete, pide definirlo y manda a la ficha', async () => {
    espia.cliente = { ...espia.cliente, paquete: null };
    const r = await proponer();
    expect(r.status).toBe(409);
    expect((await r.json()).enlace).toBe(`/clientes/${CLIENTE}#paquete`);
  });

  it('solo un mes en proceso', async () => {
    espia.lote = { ...espia.lote, estado: 'en_revision' };
    expect((await proponer()).status).toBe(409);
  });

  it('con piezas, hay que elegir completar o reemplazar', async () => {
    espia.piezas = [pieza('p1')];
    const r = await proponer({});
    expect(r.status).toBe(400);
    expect((await r.json()).errores[0]).toMatch(/completar|reemplazar/);
  });

  it('si el mes ya cuadra, no hay nada que proponer ni generar', async () => {
    espia.piezas = [pieza('p1'), pieza('p2'), pieza('r1', { formato: 'reel' })];
    expect((await proponer({ modo: 'completar' })).status).toBe(409);
    expect((await generar({ modo: 'completar' })).status).toBe(409);
  });
});

describe('POST …/temas: la propuesta', () => {
  it('propone una fila por pieza del paquete, con tema distinto, dentro del mes, y la guarda como borrador', async () => {
    const r = await (await proponer()).json();
    const { filas } = r.seleccion;
    expect(filas).toHaveLength(3);
    expect(filas.filter((f: any) => f.formato === 'post')).toHaveLength(2);
    expect(filas.filter((f: any) => f.formato === 'reel')).toHaveLength(1);
    for (const f of filas) { expect(f.fecha.startsWith('2026-10-')).toBe(true); expect(f.temaId).toMatch(/^P\d-S\d-\d{2}$/); }
    expect(new Set(filas.map((f: any) => f.temaId)).size).toBe(3);
    expect(espia.guardados).toHaveLength(1);
    expect(leerSeleccion(espia.guardados[0])).toMatchObject({ autorizada: null, propuestaPor: 'contenido' });
    expect(espia.insertados).toHaveLength(0); // proponer no encola IA
  });

  it('prefiere pendientes y no propone los temas de otras piezas del cliente', async () => {
    const avance: Record<string, string> = {};
    for (const t of espia.catalogo.slice(0, 250)) avance[t.id] = 'en_desarrollo';
    espia.catalogo = catalogoDeTemas(espia.mapa, avance);
    const usados = espia.catalogo.filter((t) => t.estado === 'pendiente').slice(0, 3).map((t) => t.id);
    espia.piezas = usados.map((temaId, i) => pieza(`x${i}`, { temaId, estadoCliente: 'aprobada', formato: 'historia' }));
    const filas = await filasPropuestas({ modo: 'completar' });
    const ids = filas.map((f) => f.temaId!);
    for (const id of ids) {
      expect(usados).not.toContain(id);
      expect(espia.catalogo.find((t) => t.id === id)?.estado).toBe('pendiente');
    }
  });

  it('volver a proponer regenera todo y descarta lo editado', async () => {
    const [primera] = await filasPropuestas();
    await guardar({ filas: [{ ...primera, temaId: 'P5-S3-20' }] }).catch(() => null);
    const otra = await filasPropuestas();
    expect(otra[0].temaId).toBe(primera.temaId);
  });
});

describe('PUT …/temas: cambiar un tema por otro del banco', () => {
  it('acepta cualquier tema del banco, incluso de otro pilar, y el borrador sobrevive a recargar', async () => {
    const filas = await filasPropuestas();
    const de = (n: number) => espia.catalogo.find((t) => t.pilar === n && !filas.some((f) => f.temaId === t.id))!;
    const cambiadas = filas.map((f, i) => (i === 0 ? { ...f, temaId: de(5).id, formato: 'reel', fecha: '2026-10-31' } : f));
    const r = await guardar({ filas: cambiadas });
    expect(r.status).toBe(200);
    // «Recargar»: lo último que quedó en el lote es lo que ve la pantalla.
    const leida = leerSeleccion(espia.guardados.at(-1))!;
    expect(leida.filas).toEqual(cambiadas);
    expect(leida.autorizada).toBeNull();
  });

  it('no deja repetir el mismo tema dos veces en el mes', async () => {
    const filas = await filasPropuestas();
    const r = await guardar({ filas: filas.map((f, i) => (i === 1 ? { ...f, temaId: filas[0].temaId } : f)) });
    expect(r.status).toBe(409);
    expect((await r.json()).errores[0]).toMatch(/no se puede repetir/);
  });

  it('tampoco el de una pieza que se queda en el mes', async () => {
    espia.piezas = [pieza('p1', { numero: 7, temaId: 'P1-S1-01', estadoCliente: 'aprobada' })];
    const filas = await filasPropuestas({ modo: 'completar' });
    const r = await guardar({ modo: 'completar', filas: filas.map((f, i) => (i === 0 ? { ...f, temaId: 'P1-S1-01' } : f)) });
    expect(r.status).toBe(409);
    expect((await r.json()).errores[0]).toMatch(/pieza 7/);
  });

  it('un tema inventado, una fecha fuera del mes o un conteo distinto del paquete se rechazan', async () => {
    const filas = await filasPropuestas();
    expect((await guardar({ filas: filas.map((f, i) => (i === 0 ? { ...f, temaId: 'P9-S9-99' } : f)) })).status).toBe(409);
    expect((await guardar({ filas: filas.map((f, i) => (i === 0 ? { ...f, fecha: '2026-11-02' } : f)) })).status).toBe(409);
    expect((await guardar({ filas: filas.slice(1) })).status).toBe(409);
  });

  it('avisa, sin impedirlo, que un cambio de formato rompe el conteo del paquete', async () => {
    const filas = await filasPropuestas();
    const r = await guardar({ filas: filas.map((f, i) => (i === 0 ? { ...f, formato: 'historia' } : f)) });
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.avisos[0]).toMatch(/no cuadra/);
    expect(cuerpo.desajuste).not.toBeNull();
  });
});

describe('POST …/generar: autorizar y lanzar', () => {
  it('sin temas elegidos (ni filas ni borrador) pide elegirlos primero', async () => {
    const r = await generar();
    expect(r.status).toBe(409);
    expect((await r.json()).errores[0]).toMatch(/Primero elige los temas/);
    expect(espia.insertados).toHaveLength(0);
  });

  it('autoriza el borrador guardado: guarda quién y cuándo y encola el job con los temas fijos', async () => {
    const filas = await filasPropuestas();
    espia.lote = { ...espia.lote, temasMes: espia.guardados.at(-1) };
    const antes = Date.now();
    const r = await generar(undefined, diseno);
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ ok: true, id: 'job-nuevo', piezas: 3 });

    const auth = leerSeleccion(espia.guardados.at(-1))!.autorizada!;
    expect(auth).toMatchObject({ usuarioId: 'diseno', nombre: 'diseno' });
    expect(Date.parse(auth.en)).toBeGreaterThanOrEqual(antes - 1000);

    expect(espia.insertados[0]).toMatchObject({
      clientId: CLIENTE, tipo: 'contenido', estado: 'encolado', creadoPor: 'diseno',
      parametros: { loteId: LOTE, periodo: '2026-10', modo: 'completar', incluirConArte: false, planeadas: [], autorizadaPor: 'diseno', autorizadaEn: auth.en },
    });
    expect(espia.insertados[0].parametros.temas).toEqual(filas.map((f) => ({ ref: f.ref, formato: f.formato, fecha: f.fecha, temaId: f.temaId })));
  });

  it('autoriza las filas que manda la pantalla, con el tema que el usuario cambió', async () => {
    const filas = await filasPropuestas();
    const nuevo = espia.catalogo.find((t) => t.pilar === 4 && !filas.some((f) => f.temaId === t.id))!.id;
    const editadas = filas.map((f, i) => (i === 0 ? { ...f, temaId: nuevo } : f));
    expect((await generar({ filas: editadas })).status).toBe(201);
    expect(espia.insertados[0].parametros.temas[0].temaId).toBe(nuevo);
  });

  it('todas las filas necesitan tema y no se repite ninguno', async () => {
    const filas = await filasPropuestas();
    const sin = await generar({ filas: filas.map((f, i) => (i === 0 ? { ...f, temaId: null } : f)) });
    expect(sin.status).toBe(409);
    expect((await sin.json()).errores[0]).toMatch(/Elige un tema/);
    const dup = await generar({ filas: filas.map((f, i) => (i === 1 ? { ...f, temaId: filas[0].temaId } : f)) });
    expect(dup.status).toBe(409);
    expect(espia.insertados).toHaveLength(0);
  });

  it('si el conteo del paquete no cuadra, hay que confirmarlo de forma explícita', async () => {
    const filas = await filasPropuestas();
    const cambiadas = filas.map((f, i) => (i === 0 ? { ...f, formato: 'historia' } : f));
    const r = await generar({ filas: cambiadas });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ requiereConfirmar: true });
    expect(espia.insertados).toHaveLength(0);
    expect((await generar({ filas: cambiadas, confirmarDesajuste: true })).status).toBe(201);
  });

  it('un cliente con otro trabajo en curso no lanza un segundo', async () => {
    const filas = await filasPropuestas();
    espia.jobs = [{ id: 'job-viejo' }];
    const r = await generar({ filas });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ ok: false, jobId: 'job-viejo' });
    expect(espia.insertados).toHaveLength(0);
  });

  it('reemplazar: solo planea borrar las sin revisar, y las con arte solo si se confirma', async () => {
    espia.piezas = [
      pieza('aprobada', { numero: 1, estadoCliente: 'aprobada' }),
      pieza('cambios', { numero: 2, estadoCliente: 'cambios' }),
      pieza('conArte', { numero: 3, arte: [{ tipo: 'imagen', fileId: 'f' }] }),
      pieza('libre', { numero: 4, formato: 'reel' }),
    ];
    const filas = async (extra: object) => (await (await proponer({ modo: 'reemplazar', ...extra })).json()).seleccion.filas;
    expect((await generar({ modo: 'reemplazar', filas: await filas({}) })).status).toBe(201);
    expect(espia.insertados[0].parametros).toMatchObject({ modo: 'reemplazar', incluirConArte: false, planeadas: ['libre'] });

    espia.insertados = [];
    const conArte = await filas({ incluirConArte: true });
    expect((await generar({ modo: 'reemplazar', incluirConArte: true, filas: conArte })).status).toBe(201);
    expect(espia.insertados[0].parametros.planeadas.sort()).toEqual(['conArte', 'libre']);
  });

  it('`incluirConArte` no significa nada al completar', async () => {
    espia.piezas = [pieza('conArte', { numero: 1, arte: [{ tipo: 'imagen', fileId: 'f' }] })];
    const filas = (await (await proponer({ modo: 'completar' })).json()).seleccion.filas;
    await generar({ modo: 'completar', incluirConArte: true, filas });
    expect(espia.insertados[0].parametros).toMatchObject({ modo: 'completar', incluirConArte: false, planeadas: [] });
  });
});
