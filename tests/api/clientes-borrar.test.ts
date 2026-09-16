import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * DELETE /api/clientes/[id] (spec §2). Como en `usuarios-datos.test.ts`, las
 * pruebas corren sin `DATABASE_URL` y con `@/db` simulado: el espía apunta
 * cada tabla leída y cada tabla borrada, así que «sin tocar la base» se puede
 * afirmar de verdad, y no solo suponer por el código de estado.
 */
const espia = vi.hoisted(() => ({
  datos: {} as Record<string, unknown[]>,
  leidas: [] as string[],
  borradas: [] as string[],
  transacciones: 0,
}));

const disco = vi.hoisted(() => ({
  borrados: [] as string[],
  carpetas: [] as string[],
  fallan: new Set<string>(),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const clave = new Map<unknown, string>([
    [real.clients, 'clients'],
    [real.clientFiles, 'clientFiles'],
    [real.clientLinks, 'clientLinks'],
    [real.users, 'users'],
    [real.researchResults, 'researchResults'],
    [real.growthResults, 'growthResults'],
    [real.pilaresResults, 'pilaresResults'],
    [real.documentoVersiones, 'documentoVersiones'],
    [real.shareLinks, 'shareLinks'],
  ]);
  const nombre = (t: unknown) => clave.get(t) ?? 'desconocida';
  const filas = (k: string) => espia.datos[k] ?? [];

  // Constructores de consulta de mentira: encadenables y «thenables», que es
  // lo único que la ruta necesita de Drizzle.
  const seleccion = () => {
    const q: any = {
      k: 'desconocida',
      from(t: unknown) { q.k = nombre(t); return q; },
      where: () => q,
      limit: () => q,
      then(ok: any, err: any) {
        espia.leidas.push(q.k);
        return Promise.resolve(filas(q.k)).then(ok, err);
      },
    };
    return q;
  };
  const borrado = (t: unknown) => {
    const k = nombre(t);
    const q: any = {
      where: () => q,
      returning() { espia.borradas.push(k); return Promise.resolve(filas(k)); },
      then(ok: any, err: any) { espia.borradas.push(k); return Promise.resolve(filas(k)).then(ok, err); },
    };
    return q;
  };
  const tx = { select: seleccion, delete: borrado };
  return {
    ...real,
    db: {
      select: seleccion,
      delete: borrado,
      transaction: async (cb: (t: typeof tx) => unknown) => { espia.transacciones++; return cb(tx); },
    },
  };
});

vi.mock('@/lib/files', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/files')>();
  return {
    ...real,
    async borrarArchivo(ruta: string) {
      if (disco.fallan.has(ruta)) throw new Error(`EACCES: ${ruta}`);
      disco.borrados.push(ruta);
    },
    async borrarCarpetaCliente(clientId: string) {
      if (disco.fallan.has(clientId)) throw new Error(`EACCES: ${clientId}`);
      disco.carpetas.push(clientId);
    },
  };
});

import { DELETE } from '@/pages/api/clientes/[id]';

const CLIENTE = '00000000-0000-4000-8000-0000000000aa';
const OPERADOR = '00000000-0000-4000-8000-000000000002';
const NOMBRE = 'Café Malinche';

const admin = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@wozial.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const operador = { ...admin, id: OPERADOR, email: 'ope@wozial.mx', rol: 'operador' as const };
const usuarioCliente = { ...admin, id: '00000000-0000-4000-8000-000000000003', email: 'cli@x.mx', rol: 'cliente' as const, clientId: CLIENTE };

/** El cliente tal como lo devolvería `clienteOperable`. */
const fichaCliente = { id: CLIENTE, nombre: NOMBRE, giro: 'Café', producto: 'Grano', ciudad: null, ticket: null, contacto: null, notas: null, operadorId: OPERADOR };

let urlPrevia: string | undefined;
let infos: string[];
let errores: unknown[][];
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.datos = {};
  espia.leidas = [];
  espia.borradas = [];
  espia.transacciones = 0;
  disco.borrados = [];
  disco.carpetas = [];
  disco.fallan = new Set();
  infos = [];
  errores = [];
  vi.spyOn(console, 'info').mockImplementation((...a: unknown[]) => { infos.push(a.map(String).join(' ')); });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errores.push(a); });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia;
});

/** Un cliente que existe, con cantidades a la medida. */
function poblarBase({ entregables = 0, archivos = [] as string[], cuentas = 0, enlaces = 0 } = {}) {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${i}` }));
  espia.datos.clients = [fichaCliente];
  espia.datos.researchResults = ids(entregables);
  espia.datos.growthResults = [];
  espia.datos.pilaresResults = [];
  espia.datos.clientFiles = archivos.map((ruta) => ({ ruta }));
  espia.datos.users = ids(cuentas);
  espia.datos.clientLinks = ids(enlaces);
}

const llamar = (cuerpo: unknown, usuario: unknown = admin, id = CLIENTE) => DELETE({
  params: { id },
  request: new Request(`http://x/api/clientes/${id}`, { method: 'DELETE', body: JSON.stringify(cuerpo) }),
  locals: { usuario },
} as any);

describe('DELETE clientes: quién puede', () => {
  // Spec §2: «Un operador no puede, ni siquiera con sus clientes». Por eso el
  // operador de la prueba es justo el asignado a este cliente.
  it('un operador recibe 403 sin tocar la base, aunque el cliente sea suyo', async () => {
    poblarBase();
    const res = await llamar({ nombre: NOMBRE }, operador);
    expect(res.status).toBe(403);
    expect((await res.json()).errores).toEqual(['Solo un administrador puede eliminar un cliente']);
    expect(espia.leidas).toEqual([]);
    expect(espia.transacciones).toBe(0);
    expect(espia.borradas).toEqual([]);
  });

  it('un usuario de cliente recibe 403 sin tocar la base', async () => {
    poblarBase();
    const res = await llamar({ nombre: NOMBRE }, usuarioCliente);
    expect(res.status).toBe(403);
    expect(espia.leidas).toEqual([]);
    expect(espia.transacciones).toBe(0);
  });
});

describe('DELETE clientes: qué cliente', () => {
  it('un id que no es UUID da 404 sin tocar la base', async () => {
    poblarBase();
    const res = await llamar({ nombre: NOMBRE }, admin, 'no-es-uuid');
    expect(res.status).toBe(404);
    expect(espia.leidas).toEqual([]);
    expect(espia.transacciones).toBe(0);
  });

  it('un UUID que no existe da 404 sin llegar a borrar', async () => {
    espia.datos.clients = [];
    const res = await llamar({ nombre: NOMBRE });
    expect(res.status).toBe(404);
    expect(espia.leidas).toEqual(['clients']); // la búsqueda, nada más
    expect(espia.transacciones).toBe(0);
  });
});

describe('DELETE clientes: el nombre tecleado', () => {
  it('un nombre que no coincide da 400 y no abre transacción', async () => {
    poblarBase();
    const res = await llamar({ nombre: 'Cafe Malinche' });
    expect(res.status).toBe(400);
    expect((await res.json()).errores).toEqual(['El nombre no coincide con el del cliente']);
    expect(espia.transacciones).toBe(0);
    expect(espia.borradas).toEqual([]);
    expect(disco.borrados).toEqual([]);
  });

  it('otra caja de mayúsculas tampoco coincide', async () => {
    poblarBase();
    expect((await llamar({ nombre: 'café malinche' })).status).toBe(400);
    expect(espia.transacciones).toBe(0);
  });

  it('un cuerpo sin nombre, vacío o de otro tipo da 400', async () => {
    poblarBase();
    for (const cuerpo of [{}, { nombre: '' }, { nombre: null }, { nombre: 7 }, null]) {
      expect((await llamar(cuerpo)).status).toBe(400);
    }
    expect(espia.transacciones).toBe(0);
  });

  it('un cuerpo que ni siquiera es JSON da 400, no un 500', async () => {
    poblarBase();
    const res = await DELETE({
      params: { id: CLIENTE },
      request: new Request(`http://x/api/clientes/${CLIENTE}`, { method: 'DELETE', body: 'esto no es json' }),
      locals: { usuario: admin },
    } as any);
    expect(res.status).toBe(400);
    expect(espia.transacciones).toBe(0);
  });

  it('los espacios de los extremos no estorban (regla de nombreConfirmado)', async () => {
    poblarBase();
    const res = await llamar({ nombre: `  ${NOMBRE} ` });
    expect(res.status).toBe(200);
  });
});

describe('DELETE clientes: el borrado', () => {
  it('borra cliente, versiones y enlaces públicos, y responde 200', async () => {
    poblarBase({ entregables: 2, archivos: ['aa/1.pdf', 'aa/2.png'], cuentas: 3, enlaces: 4 });
    const res = await llamar({ nombre: NOMBRE });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: CLIENTE });
    // El cliente primero: `cliente_etapas.version_aprobada_id` apunta a
    // `documento_versiones` con NO ACTION, así que al revés reventaría.
    expect(espia.borradas).toEqual(['clients', 'documentoVersiones', 'shareLinks']);
  });

  it('sin entregables no intenta limpiar versiones ni enlaces públicos', async () => {
    poblarBase({ archivos: [] });
    await llamar({ nombre: NOMBRE });
    expect(espia.borradas).toEqual(['clients']);
  });

  it('el disco se borra DESPUÉS de la base, archivo por archivo, más la carpeta', async () => {
    poblarBase({ archivos: ['aa/1.pdf', 'aa/2.png'] });
    await llamar({ nombre: NOMBRE });
    expect(disco.borrados).toEqual(['aa/1.pdf', 'aa/2.png']);
    expect(disco.carpetas).toEqual([CLIENTE]);
  });

  // Spec §2: un archivo huérfano es un problema menor que dejar el cliente a
  // medio borrar, así que un fallo en el disco se registra y no aborta nada.
  it('si un archivo del disco falla, sigue con los demás y responde 200', async () => {
    poblarBase({ archivos: ['aa/1.pdf', 'aa/2.png', 'aa/3.pdf'] });
    disco.fallan.add('aa/2.png');
    const res = await llamar({ nombre: NOMBRE });
    expect(res.status).toBe(200);
    expect(disco.borrados).toEqual(['aa/1.pdf', 'aa/3.pdf']);
    expect(disco.carpetas).toEqual([CLIENTE]);
    expect(errores.some((e) => String(e[0]).includes('aa/2.png'))).toBe(true);
  });

  it('si falla hasta la carpeta, tampoco se cae', async () => {
    poblarBase({ archivos: ['aa/1.pdf'] });
    disco.fallan.add(CLIENTE);
    const res = await llamar({ nombre: NOMBRE });
    expect(res.status).toBe(200);
    expect(errores.some((e) => String(e[0]).includes('carpeta'))).toBe(true);
  });
});

describe('DELETE clientes: el registro', () => {
  it('deja una línea con quién, qué cliente y qué cantidades, antes de borrar', async () => {
    poblarBase({ entregables: 2, archivos: ['aa/1.pdf'], cuentas: 3, enlaces: 4 });
    await llamar({ nombre: NOMBRE });
    expect(infos).toHaveLength(1);
    const linea = infos[0];
    expect(linea).toContain(NOMBRE);
    expect(linea).toContain(CLIENTE);
    expect(linea).toContain('admin@wozial.mx');
    expect(linea).toContain(admin.id);
    expect(linea).toContain('entregables=2');
    expect(linea).toContain('archivos=1');
    expect(linea).toContain('cuentas=3');
    expect(linea).toContain('enlaces=4');
  });

  it('un 403 o un 400 no dejan línea: no se borró nada', async () => {
    poblarBase();
    await llamar({ nombre: NOMBRE }, operador);
    await llamar({ nombre: 'otro' });
    expect(infos).toEqual([]);
  });
});
