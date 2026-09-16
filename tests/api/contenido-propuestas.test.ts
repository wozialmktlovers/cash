import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * POST /api/contenido/piezas/[id]/propuestas (B2).
 *
 * Se simula `@/db` con el patrón de `tests/api/usuarios-datos.test.ts` —sin
 * `DATABASE_URL`, así que cualquier consulta no prevista revienta— y se simula
 * `pedirJson`: **la prueba no llama al modelo ni gasta saldo**. El agente sí
 * corre de verdad, así que esto comprueba el cableado completo: permiso, tema,
 * contexto del cliente y la respuesta que ve el operador.
 */
const espia = vi.hoisted(() => ({
  piezas: [] as unknown[],
  mapas: [] as unknown[],
  links: [] as unknown[],
  archivos: [] as unknown[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const datosDe = (tabla: unknown) => {
    if (tabla === real.contenidoPiezas) return espia.piezas;
    if (tabla === real.pilaresResults) return espia.mapas;
    if (tabla === real.clientLinks) return espia.links;
    if (tabla === real.clientFiles) return espia.archivos;
    throw new Error('Consulta no prevista en la prueba');
  };
  const lectura = () => {
    let tabla: unknown;
    const b: Record<string, unknown> = {
      from(t: unknown) { tabla = t; return b; },
      innerJoin() { return b; },
      where() { return b; },
      orderBy: async () => datosDe(tabla),
      limit: async () => datosDe(tabla),
      // Las consultas sin `limit` ni `orderBy` se esperan tal cual.
      then: (ok: (v: unknown) => unknown, mal: (e: unknown) => unknown) => Promise.resolve().then(() => datosDe(tabla)).then(ok, mal),
    };
    return b;
  };
  return { ...real, db: { select: () => lectura() } };
});

const pedir = vi.fn();
vi.mock('@/research/claude', () => ({ pedirJson: (o: any) => pedir(o) }));

import { POST } from '@/pages/api/contenido/piezas/[id]/propuestas';

const PIEZA = '00000000-0000-4000-8000-0000000000a1';
const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const OPERADOR = '00000000-0000-4000-8000-0000000000e1';

const operador = { id: OPERADOR, email: 'o@x.mx', nombre: 'Ope', apellido: null, rol: 'operador' as const, clientId: null, activo: true };
const usuarioCliente = { id: '00000000-0000-4000-8000-0000000000f1', email: 'c@x.mx', nombre: null, apellido: null, rol: 'cliente' as const, clientId: CLIENTE, activo: true };

const cliente = {
  id: CLIENTE, operadorId: OPERADOR, nombre: 'Panadería Lupita', giro: 'Panadería',
  producto: 'Pan de masa madre', ciudad: 'San Luis Potosí', ticket: '$120', contacto: null, notas: null,
};
const pieza = {
  id: PIEZA, loteId: 'l1', numero: 3, formato: 'carrusel', plataforma: 'ambas',
  fechaPublicacion: '2026-09-18', temaId: 'P2-S1-07',
};
const mapa = {
  datos: {
    pilares: [{
      numero: 2, estado: 'ok',
      subcategorias: [{ nombre: 'Sub', temas: [{ id: 'P2-S1-07', texto: 'El pan que se acaba a las nueve', funcion: 'conexion', formato: 'reel' }] }],
    }],
  },
};
const opcion = (i: number) => ({
  gancho: `Gancho ${i}`, copy: `Copy ${i}`, cta: 'Aparta el tuyo por WhatsApp.',
  hashtags: ['#pan', '#masamadre', '#slp', '#panaderia', '#local'], briefVisual: `Brief ${i}`,
});

const llamar = (cuerpo?: unknown, usuario: unknown = operador, id = PIEZA) => POST({
  params: { id },
  request: new Request(`http://x/api/contenido/piezas/${id}/propuestas`, {
    method: 'POST',
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo), headers: { 'Content-Type': 'application/json' } }),
  }),
  locals: { usuario },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.piezas = [{ pieza, cliente }];
  espia.mapas = [mapa];
  espia.links = [];
  espia.archivos = [];
  pedir.mockReset();
  pedir.mockResolvedValue({ datos: { opciones: [opcion(1), opcion(2), opcion(3)] }, tokensEntrada: 1_000, tokensSalida: 800 });
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('quién puede pedir propuestas', () => {
  it('un id que no es UUID no llega a la base', async () => {
    const r = await llamar(undefined, operador, 'no-es-uuid');
    expect(r.status).toBe(404);
    expect(pedir).not.toHaveBeenCalled();
  });

  it('una pieza que no existe da 404', async () => {
    espia.piezas = [];
    expect((await llamar()).status).toBe(404);
  });

  it('el usuario cliente no entra aquí, y recibe el mismo 404 que un desconocido', async () => {
    const r = await llamar(undefined, usuarioCliente);
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ ok: false, errores: ['La pieza no existe.'] });
    expect(pedir).not.toHaveBeenCalled();
  });

  it('el operador de otro cliente tampoco', async () => {
    const r = await llamar(undefined, { ...operador, id: '00000000-0000-4000-8000-0000000000e9' });
    expect(r.status).toBe(404);
    expect(pedir).not.toHaveBeenCalled();
  });
});

describe('el tema', () => {
  it('sin tema en la pieza ni en el cuerpo, no se gasta nada', async () => {
    espia.piezas = [{ pieza: { ...pieza, temaId: null }, cliente }];
    const r = await llamar();
    expect(r.status).toBe(400);
    expect((await r.json()).errores[0]).toContain('mapa de pilares');
    expect(pedir).not.toHaveBeenCalled();
  });

  it('el del cuerpo manda sobre el guardado: el operador acaba de elegirlo en pantalla', async () => {
    espia.mapas = [{
      datos: {
        pilares: [{
          numero: 4, estado: 'ok',
          subcategorias: [{ nombre: 'Sub', temas: [{ id: 'P4-S2-01', texto: 'El horno de las cinco', funcion: 'autoridad', formato: 'carrusel' }] }],
        }],
      },
    }];
    const r = await llamar({ temaId: 'P4-S2-01' });
    expect(r.status).toBe(200);
    expect((await r.json()).temaId).toBe('P4-S2-01');
    expect(pedir.mock.calls[0][0].usuario).toContain('El horno de las cinco');
  });

  it('un tema que no está en el mapa del cliente da 409 y no llama al modelo', async () => {
    const r = await llamar({ temaId: 'P5-S3-20' });
    expect(r.status).toBe(409);
    expect((await r.json()).errores[0]).toContain('P5-S3-20');
    expect(pedir).not.toHaveBeenCalled();
  });

  it('un cuerpo que no es JSON da 400', async () => {
    const r = await POST({
      params: { id: PIEZA },
      request: new Request(`http://x/api/contenido/piezas/${PIEZA}/propuestas`, { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } }),
      locals: { usuario: operador },
    } as any);
    expect(r.status).toBe(400);
  });
});

describe('la generación', () => {
  it('devuelve las tres opciones, el tema y lo que costó', async () => {
    const r = await llamar();
    expect(r.status).toBe(200);
    const cuerpo = await r.json();
    expect(cuerpo.ok).toBe(true);
    expect(cuerpo.temaId).toBe('P2-S1-07');
    expect(cuerpo.opciones).toHaveLength(3);
    expect(cuerpo.opciones[0].briefVisual).toBe('Brief 1');
    expect(cuerpo.topeUsd).toBeGreaterThan(0);
    expect(cuerpo.topeAlcanzado).toBe(false);
    expect(typeof cuerpo.costoUsd).toBe('number');
  });

  it('le cuenta al modelo quién es el cliente, con sus enlaces y sus documentos', async () => {
    espia.links = [{ tipo: 'sitio', url: 'https://lupita.mx' }];
    espia.archivos = [{ nombreOriginal: 'marca.pdf', textoExtraido: 'La panadería abrió en 1998.' }];
    await llamar();
    const { usuario } = pedir.mock.calls[0][0];
    expect(usuario).toContain('Panadería Lupita');
    expect(usuario).toContain('https://lupita.mx');
    expect(usuario).toContain('La panadería abrió en 1998.');
    // Y la pieza: su formato manda sobre el que sugirió el mapa.
    expect(usuario).toContain('carrusel');
    expect(usuario).toContain('2026-09-18');
  });

  it('una petición, una pieza: nunca el lote entero', async () => {
    await llamar();
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('si el modelo falla, la ruta contesta 502 con el motivo y no guarda nada', async () => {
    pedir.mockRejectedValue(new Error('El modelo no devolvió JSON válido tras dos intentos.'));
    const r = await llamar();
    expect(r.status).toBe(502);
    expect((await r.json()).errores[0]).toContain('dos intentos');
  });
});
