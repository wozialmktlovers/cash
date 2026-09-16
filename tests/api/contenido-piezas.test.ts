import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LIMITES } from '@/contenido/schemas';

/**
 * Alta, edición y borrado de piezas (B1). Como en `contenido-lotes.test.ts`,
 * las pruebas corren sin `DATABASE_URL` y `@/db` está simulado: lo que se
 * comprueba son las decisiones de las rutas —permiso por el cliente del lote,
 * qué se escribe, el 409 del número repetido y qué pasa con el estado del lote
 * al quitar la última pieza—, no Drizzle.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  PIEZA: '00000000-0000-4000-8000-0000000000f1',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  OTRO_OPERADOR: '00000000-0000-4000-8000-000000000002',
  ARCHIVO: '00000000-0000-4000-8000-0000000000a1',
}));

/** Una fila de `contenido_piezas` como la devuelve la base. */
const filaPieza = vi.hoisted(() => () => ({
  id: '00000000-0000-4000-8000-0000000000f1',
  loteId: '00000000-0000-4000-8000-0000000000e1',
  numero: 1, formato: 'post', plataforma: 'ambas',
  fechaPublicacion: null, temaId: null, copy: '', cta: '', hashtags: '', briefVisual: '', arte: [],
  estadoCliente: 'pendiente', notaCliente: null, revisadoEn: null,
  creadoEn: new Date(0), actualizadoEn: new Date(0),
}));

const espia = vi.hoisted(() => ({
  lote: null as Record<string, unknown> | null,
  pieza: null as Record<string, unknown> | null,
  cliente: null as Record<string, unknown> | null,
  maximoNumero: null as number | null,
  fallo: null as unknown,
  insertado: undefined as Record<string, unknown> | undefined,
  actualizado: undefined as Record<string, unknown> | undefined,
  borradas: 1,
  refrescados: [] as string[],
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const lectura = { from: () => lectura, where: async () => [{ numero: espia.maximoNumero }] };
  const alta = {
    values(fila: Record<string, unknown>) {
      espia.insertado = fila;
      return alta;
    },
    async returning() {
      if (espia.fallo) throw espia.fallo;
      return [{ ...filaPieza(), ...espia.insertado, id: ids.PIEZA }];
    },
  };
  const escritura = {
    set(cambio: Record<string, unknown>) {
      espia.actualizado = cambio;
      return escritura;
    },
    where: () => escritura,
    async returning() {
      if (espia.fallo) throw espia.fallo;
      return [{ ...filaPieza(), ...espia.actualizado }];
    },
  };
  const baja = {
    where: () => baja,
    async returning() {
      return espia.borradas > 0 ? [{ id: ids.PIEZA }] : [];
    },
  };
  const ejecutor = { select: () => lectura, insert: () => alta, update: () => escritura, delete: () => baja };
  return {
    ...real,
    db: { ...ejecutor, transaction: async (fn: (tx: unknown) => unknown) => fn(ejecutor) },
  };
});

vi.mock('@/lib/visibilidad', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/visibilidad')>();
  return {
    ...real,
    loteVisible: async () => (espia.lote ? { lote: espia.lote, cliente: espia.cliente } : null),
    piezaVisible: async () => (espia.pieza ? { pieza: espia.pieza, lote: espia.lote, cliente: espia.cliente } : null),
  };
});

vi.mock('@/contenido/servicio', async (importarReal) => {
  const real = await importarReal<typeof import('@/contenido/servicio')>();
  return {
    ...real,
    refrescarLote: async (lote: { id: string; estado: string }) => {
      espia.refrescados.push(lote.id);
      return lote.estado;
    },
  };
});

import { POST } from '@/pages/api/contenido/lotes/[id]/piezas';
import { PATCH, DELETE } from '@/pages/api/contenido/piezas/[id]';

const { CLIENTE, LOTE, PIEZA, OPERADOR, OTRO_OPERADOR, ARCHIVO } = ids;

const usuario = (rol: 'admin' | 'operador' | 'cliente' = 'admin', id = OPERADOR) =>
  ({ id, email: 'a@x.mx', nombre: null, apellido: null, rol, clientId: null, activo: true });

const alta = (cuerpo: unknown, quien = usuario()) => POST({
  params: { id: LOTE },
  request: new Request(`http://x/api/contenido/lotes/${LOTE}/piezas`, { method: 'POST', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

const editar = (cuerpo: unknown, quien = usuario()) => PATCH({
  params: { id: PIEZA },
  request: new Request(`http://x/api/contenido/piezas/${PIEZA}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  locals: { usuario: quien },
} as any);

const borrar = (quien = usuario()) => DELETE({
  params: { id: PIEZA },
  locals: { usuario: quien },
} as any);

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.cliente = { id: CLIENTE, operadorId: OPERADOR, nombre: 'OLAM' };
  espia.lote = { id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_proceso', compartidoEn: null };
  espia.pieza = filaPieza();
  espia.maximoNumero = null;
  espia.fallo = null;
  espia.insertado = undefined;
  espia.actualizado = undefined;
  espia.borradas = 1;
  espia.refrescados = [];
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

const choqueDeUnicidad = (restriccion: string) =>
  Object.assign(new Error('Failed query: ...'), {
    cause: Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505', constraint_name: restriccion }),
  });

const PIEZA_MINIMA = { formato: 'carrusel', plataforma: 'instagram' };

describe('POST /api/contenido/lotes/[id]/piezas', () => {
  it('da de alta la pieza con los valores por omisión de la base', async () => {
    const res = await alta(PIEZA_MINIMA);
    expect(res.status).toBe(201);
    expect(espia.insertado).toMatchObject({
      loteId: LOTE, numero: 1, formato: 'carrusel', plataforma: 'instagram',
      fechaPublicacion: null, temaId: null, copy: '', cta: '', hashtags: '', briefVisual: '', arte: [],
    });
    expect(espia.refrescados).toEqual([LOTE]);
    const cuerpo = await res.json();
    expect(cuerpo.pieza.id).toBe(PIEZA);
    expect(cuerpo.estadoLote).toBe('en_proceso');
  });

  it('sin número, toma el siguiente libre del lote', async () => {
    espia.maximoNumero = 7;
    await alta(PIEZA_MINIMA);
    expect(espia.insertado?.numero).toBe(8);
  });

  it('con número, respeta el que pide el operador', async () => {
    espia.maximoNumero = 7;
    await alta({ ...PIEZA_MINIMA, numero: 3 });
    expect(espia.insertado?.numero).toBe(3);
  });

  it('guarda planeación, texto y arte', async () => {
    await alta({
      ...PIEZA_MINIMA, fechaPublicacion: '2026-09-15', temaId: 'P2-S1-03',
      copy: 'Hola', cta: 'Escríbenos', hashtags: '#agave #mx', briefVisual: 'Foto del taller a contraluz.',
      arte: [{ tipo: 'imagen', fileId: ARCHIVO }, { tipo: 'video', url: 'https://ejemplo.mx/v.mp4' }],
    });
    expect(espia.insertado).toMatchObject({
      fechaPublicacion: '2026-09-15', temaId: 'P2-S1-03', copy: 'Hola', cta: 'Escríbenos', hashtags: '#agave #mx',
      briefVisual: 'Foto del taller a contraluz.',
    });
    expect((espia.insertado?.arte as unknown[]).length).toBe(2);
  });

  it('el lote que no se opera responde 404', async () => {
    espia.lote = null;
    expect((await alta(PIEZA_MINIMA)).status).toBe(404);
    expect(espia.insertado).toBeUndefined();
  });

  it('un operador ajeno al cliente también recibe 404', async () => {
    const res = await alta(PIEZA_MINIMA, usuario('operador', OTRO_OPERADOR));
    expect(res.status).toBe(404);
    expect(espia.insertado).toBeUndefined();
  });

  it('un usuario cliente nunca opera, ni llegando a la ruta', async () => {
    const res = await alta(PIEZA_MINIMA, { ...usuario('cliente'), clientId: CLIENTE });
    expect(res.status).toBe(404);
    expect(espia.insertado).toBeUndefined();
  });

  it('el cuerpo que no es JSON se rechaza', async () => {
    const res = await POST({
      params: { id: LOTE },
      request: new Request(`http://x/api/contenido/lotes/${LOTE}/piezas`, { method: 'POST', body: 'nada' }),
      locals: { usuario: usuario() },
    } as any);
    expect(res.status).toBe(400);
  });

  it('valida formato, plataforma, fecha, tema, número y arte', async () => {
    const casos: [unknown, string][] = [
      [{ plataforma: 'ambas' }, 'formato'],
      [{ formato: 'story', plataforma: 'ambas' }, 'formato'],
      [{ ...PIEZA_MINIMA, plataforma: 'tiktok' }, 'plataforma'],
      [{ ...PIEZA_MINIMA, fechaPublicacion: '2026-09-31' }, 'fecha'],
      [{ ...PIEZA_MINIMA, temaId: 'P9-S9-99' }, 'tema'],
      [{ ...PIEZA_MINIMA, numero: 0 }, 'número'],
      [{ ...PIEZA_MINIMA, arte: [{ tipo: 'imagen' }] }, 'arte'],
      [{ ...PIEZA_MINIMA, arte: [{ tipo: 'imagen', fileId: ARCHIVO, url: 'https://x.mx/a.png' }] }, 'arte'],
    ];
    for (const [cuerpo, pista] of casos) {
      const res = await alta(cuerpo);
      expect(res.status, JSON.stringify(cuerpo)).toBe(400);
      expect(JSON.stringify(await res.json()).toLowerCase(), JSON.stringify(cuerpo)).toContain(pista.toLowerCase());
    }
    expect(espia.insertado).toBeUndefined();
  });

  // El operador no aprueba sus propias piezas: eso es del cliente y de su ruta
  // (C2). Se rechaza en vez de ignorarse en silencio.
  it('un cuerpo que intenta poner el estado de revisión se rechaza', async () => {
    const res = await alta({ ...PIEZA_MINIMA, estadoCliente: 'aprobada' });
    expect(res.status).toBe(400);
    expect((await res.json()).errores[0]).toContain('cliente');
    expect(espia.insertado).toBeUndefined();
  });

  it('el número repetido se reconoce por la restricción única, con 409', async () => {
    espia.fallo = choqueDeUnicidad('contenido_piezas_lote_id_numero');
    const res = await alta({ ...PIEZA_MINIMA, numero: 3 });
    expect(res.status).toBe(409);
    expect((await res.json()).errores[0]).toContain('número');
  });

  it('otro error se relanza', async () => {
    espia.fallo = new Error('se cayó la conexión');
    await expect(alta(PIEZA_MINIMA)).rejects.toThrow('se cayó la conexión');
  });
});

describe('PATCH /api/contenido/piezas/[id]', () => {
  it('guarda solo los campos que vinieron', async () => {
    const res = await editar({ copy: 'Nuevo copy', cta: '  Escríbenos  ' });
    expect(res.status).toBe(200);
    expect(espia.actualizado).toMatchObject({ copy: 'Nuevo copy', cta: 'Escríbenos' });
    expect(espia.actualizado).not.toHaveProperty('formato');
    expect(espia.actualizado?.actualizadoEn).toBeInstanceOf(Date);
  });

  // El brief visual es la indicación para quien haga el arte (diseño §5).
  // Hasta 0008 no tenía columna y se perdía al pedir otra tanda de propuestas.
  it('guarda el brief visual, con el mismo tope que el esquema de la propuesta', async () => {
    const res = await editar({ briefVisual: '  Foto del taller a contraluz, sin gente.  ' });
    expect(res.status).toBe(200);
    expect(espia.actualizado).toMatchObject({ briefVisual: 'Foto del taller a contraluz, sin gente.' });
    expect((await res.json()).pieza).toHaveProperty('briefVisual');

    // El tope se lee de donde vive, no se repite: si `LIMITES.briefVisual`
    // cambiara y esta validación se quedara atrás, la prueba lo cantaría.
    espia.actualizado = undefined;
    const largo = await editar({ briefVisual: 'a'.repeat(LIMITES.briefVisual + 1) });
    expect(largo.status).toBe(400);
    expect((await largo.json()).errores[0]).toContain('brief visual');
    expect(espia.actualizado).toBeUndefined();
  });

  it('un cuerpo vacío es «nada que actualizar»', async () => {
    const res = await editar({});
    expect(res.status).toBe(400);
    expect((await res.json()).errores[0]).toContain('Nada que actualizar');
    expect(espia.actualizado).toBeUndefined();
  });

  it('la fecha y el tema se pueden borrar con null', async () => {
    await editar({ fechaPublicacion: null, temaId: null });
    expect(espia.actualizado).toMatchObject({ fechaPublicacion: null, temaId: null });
  });

  it('no deja tocar el estado de revisión', async () => {
    const res = await editar({ copy: 'x', estadoCliente: 'aprobada' });
    expect(res.status).toBe(400);
    expect(espia.actualizado).toBeUndefined();
  });

  it('la pieza que no se opera responde 404', async () => {
    espia.pieza = null;
    expect((await editar({ copy: 'x' })).status).toBe(404);
    espia.pieza = filaPieza();
    expect((await editar({ copy: 'x' }, usuario('operador', OTRO_OPERADOR))).status).toBe(404);
    expect(espia.actualizado).toBeUndefined();
  });

  it('el número que ya tiene otra pieza del lote es 409', async () => {
    espia.fallo = choqueDeUnicidad('contenido_piezas_lote_id_numero');
    expect((await editar({ numero: 2 })).status).toBe(409);
  });

  // Editar el copy no mueve el estado del mes: `estadoLoteSegunPiezas` solo
  // mira `estado_cliente`, y este cuerpo tiene prohibido tocarlo.
  it('no recalcula el estado del lote', async () => {
    await editar({ copy: 'x' });
    expect(espia.refrescados).toEqual([]);
  });
});

describe('DELETE /api/contenido/piezas/[id]', () => {
  it('borra la pieza y devuelve el estado en que queda el lote', async () => {
    const res = await borrar();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, id: PIEZA, estadoLote: 'en_proceso' });
    expect(espia.refrescados).toEqual([LOTE]);
  });

  it('la pieza que no se opera responde 404', async () => {
    espia.pieza = null;
    expect((await borrar()).status).toBe(404);
    espia.pieza = filaPieza();
    expect((await borrar(usuario('operador', OTRO_OPERADOR))).status).toBe(404);
    expect(espia.refrescados).toEqual([]);
  });

  it('si la fila ya no estaba, 404 y no se toca el lote', async () => {
    espia.borradas = 0;
    expect((await borrar()).status).toBe(404);
    expect(espia.refrescados).toEqual([]);
  });
});
