import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Servir los archivos subidos: `GET /api/clientes/[id]/files/[fileId]` para el
 * equipo y `GET /p/{negocio}/{token}/archivo/[fileId]` para el cliente, que
 * abre el entregable sin sesión.
 *
 * Como en `clientes-borrar.test.ts`, corre sin `DATABASE_URL` y con `@/db`
 * simulado. Con una diferencia que aquí importa: el simulacro **sí filtra**.
 * Recoge los valores atados de la condición de Drizzle y se queda con las
 * filas que los llevan todos, así que una ruta que se olvidara de filtrar por
 * cliente devolvería el archivo ajeno y estas pruebas lo verían; con un
 * simulacro que ignora el `where`, la prueba del cliente ajeno no probaría
 * nada. El disco sí se simula (`@/lib/files`): lo que se comprueba aquí son
 * las decisiones de las rutas, no el sistema de archivos —eso está en
 * `tests/lib/files.test.ts`—.
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  OTRO_CLIENTE: '00000000-0000-4000-8000-0000000000c2',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  OTRO_OPERADOR: '00000000-0000-4000-8000-000000000002',
  ARTE: '00000000-0000-4000-8000-0000000000a1',
  BRIEF: '00000000-0000-4000-8000-0000000000a2',
  ARTE_AJENO: '00000000-0000-4000-8000-0000000000a3',
  DOCUMENTO: '00000000-0000-4000-8000-0000000000d1',
  LOTE: '00000000-0000-4000-8000-0000000000e1',
  PIEZA: '00000000-0000-4000-8000-0000000000f1',
}));

const espia = vi.hoisted(() => ({
  datos: {} as Record<string, Record<string, unknown>[]>,
  consultas: [] as { tabla: string; valores: unknown[] }[],
  actualizadas: [] as string[],
  leidos: [] as { clientId: string; ruta: string }[],
  fallaElDisco: false,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const clave = new Map<unknown, string>([
    [real.clients, 'clients'],
    [real.clientFiles, 'clientFiles'],
    [real.shareLinks, 'shareLinks'],
    [real.researchResults, 'researchResults'],
    [real.growthResults, 'growthResults'],
    [real.pilaresResults, 'pilaresResults'],
    [real.contenidoLotes, 'contenidoLotes'],
    [real.contenidoPiezas, 'contenidoPiezas'],
  ]);
  const nombre = (t: unknown) => clave.get(t) ?? 'desconocida';

  /**
   * Los valores atados de una condición de Drizzle. Un `eq(col, x)` guarda `x`
   * en un `Param`; una plantilla `sql` deja la cadena tal cual entre los
   * trozos. Se recogen los dos.
   */
  const atados = (x: unknown, salida: unknown[] = [], visto = new Set<unknown>()): unknown[] => {
    if (typeof x === 'string') { salida.push(x); return salida; }
    if (!x || typeof x !== 'object' || visto.has(x)) return salida;
    visto.add(x);
    const c = x as { constructor?: { name?: string }; value?: unknown; queryChunks?: unknown[] };
    if (c.constructor?.name === 'Param') { salida.push(c.value); return salida; }
    for (const trozo of c.queryChunks ?? []) atados(trozo, salida, visto);
    return salida;
  };

  const filtrar = (tabla: string, valores: unknown[]) => {
    const filas = espia.datos[tabla] ?? [];
    if (tabla === 'contenidoPiezas') {
      // Hace de `arte @> '[{"fileId": ...}]'` y del join con los lotes: la
      // pieza cuenta si su lote es del cliente y su arte trae ese archivo.
      const json = valores.find((v): v is string => typeof v === 'string' && v.startsWith('['));
      const fileId = json ? (JSON.parse(json)[0] as { fileId: string }).fileId : null;
      const clientId = valores.find((v) => typeof v === 'string' && v !== json);
      return filas.filter((p) => {
        const lote = (espia.datos.contenidoLotes ?? []).find((l) => l.id === p.loteId);
        return lote?.clientId === clientId
          && ((p.arte ?? []) as { fileId?: string }[]).some((a) => a.fileId === fileId);
      });
    }
    return filas.filter((f) => valores.every((v) => Object.values(f).includes(v)));
  };

  const seleccion = () => {
    const q: {
      tabla: string; valores: unknown[];
      from: (t: unknown) => typeof q; innerJoin: (t: unknown, c: unknown) => typeof q;
      where: (c: unknown) => typeof q; limit: () => typeof q;
      then: (ok: (f: unknown[]) => unknown, err: (e: unknown) => unknown) => Promise<unknown>;
    } = {
      tabla: 'desconocida',
      valores: [],
      from(t) { q.tabla = nombre(t); return q; },
      innerJoin(_t, c) { atados(c, q.valores); return q; },
      where(c) { atados(c, q.valores); return q; },
      limit() { return q; },
      then(ok, err) {
        espia.consultas.push({ tabla: q.tabla, valores: q.valores });
        return Promise.resolve(filtrar(q.tabla, q.valores)).then(ok, err);
      },
    };
    return q;
  };

  const escritura = (t: unknown) => {
    const q = { set: () => q, where: async () => { espia.actualizadas.push(nombre(t)); } };
    return q;
  };

  return { ...real, db: { select: seleccion, update: escritura } };
});

vi.mock('@/lib/files', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/files')>();
  return {
    ...real,
    async leerArchivo(clientId: string, ruta: string) {
      espia.leidos.push({ clientId, ruta });
      if (espia.fallaElDisco) throw new Error('Ruta fuera del directorio permitido');
      return Buffer.from('contenido-de-prueba');
    },
  };
});

import { GET as GET_INTERNO } from '@/pages/api/clientes/[id]/files/[fileId]';
import { GET as GET_PUBLICO } from '@/pages/p/[slug]/[token]/archivo/[fileId]';

const admin = { id: '00000000-0000-4000-8000-00000000000a', email: 'admin@wozial.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const operador = { ...admin, id: ids.OPERADOR, email: 'ope@wozial.mx', rol: 'operador' as const };
const otroOperador = { ...admin, id: ids.OTRO_OPERADOR, email: 'ajeno@wozial.mx', rol: 'operador' as const };
const usuarioCliente = { ...admin, id: '00000000-0000-4000-8000-00000000000b', email: 'cli@x.mx', rol: 'cliente' as const, clientId: ids.CLIENTE };
const usuarioOtroCliente = { ...usuarioCliente, id: '00000000-0000-4000-8000-00000000000c', clientId: ids.OTRO_CLIENTE };

const TOKEN = 'token-del-entregable';
const TOKEN_AJENO = 'token-de-otro-cliente';
const TOKEN_REVOCADO = 'token-ya-revocado';

/** La base tal como queda después de un mes de trabajo normal. */
function poblarBase({ nombreArte = 'portada.png', mimeArte = 'image/png' } = {}) {
  espia.datos.clients = [
    { id: ids.CLIENTE, nombre: 'Café Malinche', operadorId: ids.OPERADOR },
    { id: ids.OTRO_CLIENTE, nombre: 'Otro Negocio', operadorId: ids.OTRO_OPERADOR },
  ];
  espia.datos.clientFiles = [
    { id: ids.ARTE, clientId: ids.CLIENTE, nombreOriginal: nombreArte, mime: mimeArte, ruta: `${ids.CLIENTE}/arte.png` },
    { id: ids.BRIEF, clientId: ids.CLIENTE, nombreOriginal: 'brief del cliente.pdf', mime: 'application/pdf', ruta: `${ids.CLIENTE}/brief.pdf` },
    { id: ids.ARTE_AJENO, clientId: ids.OTRO_CLIENTE, nombreOriginal: 'ajeno.png', mime: 'image/png', ruta: `${ids.OTRO_CLIENTE}/ajeno.png` },
  ];
  espia.datos.shareLinks = [
    { token: TOKEN, documentoId: ids.DOCUMENTO, documentoTipo: 'research', revocado: false },
    { token: TOKEN_AJENO, documentoId: 'd-ajeno', documentoTipo: 'research', revocado: false },
    { token: TOKEN_REVOCADO, documentoId: ids.DOCUMENTO, documentoTipo: 'research', revocado: true },
  ];
  espia.datos.researchResults = [
    { id: ids.DOCUMENTO, clientId: ids.CLIENTE },
    { id: 'd-ajeno', clientId: ids.OTRO_CLIENTE },
  ];
  espia.datos.contenidoLotes = [{ id: ids.LOTE, clientId: ids.CLIENTE }];
  espia.datos.contenidoPiezas = [{ id: ids.PIEZA, loteId: ids.LOTE, arte: [{ tipo: 'imagen', fileId: ids.ARTE }] }];
}

let urlPrevia: string | undefined;
let errores: unknown[][];
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.datos = {};
  espia.consultas = [];
  espia.actualizadas = [];
  espia.leidos = [];
  espia.fallaElDisco = false;
  errores = [];
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => { errores.push(a); });
  poblarBase();
});
afterEach(() => {
  vi.restoreAllMocks();
  if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia;
});

const interno = (fileId: string, usuario: unknown = admin, clientId = ids.CLIENTE) =>
  GET_INTERNO({ params: { id: clientId, fileId }, locals: { usuario } } as never);

const publico = (fileId: string, token = TOKEN, slug = 'cafe-malinche') =>
  GET_PUBLICO({ params: { slug, token, fileId } } as never);

describe('GET archivo del equipo: quién puede', () => {
  it('el admin recibe el archivo', async () => {
    const res = await interno(ids.ARTE);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('contenido-de-prueba');
  });

  it('el operador del cliente recibe el archivo', async () => {
    expect((await interno(ids.ARTE, operador)).status).toBe(200);
  });

  // `puedeVerCliente`, no `puedeOperarCliente`: subir y borrar son del
  // operador, pero mirar el arte de su mes también le toca al cliente.
  it('el usuario del propio cliente recibe el archivo', async () => {
    expect((await interno(ids.ARTE, usuarioCliente)).status).toBe(200);
  });

  it('un operador que no lleva a ese cliente recibe 404 y no toca el disco', async () => {
    const res = await interno(ids.ARTE, otroOperador);
    expect(res.status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  it('el usuario de otro cliente recibe 404 y no toca el disco', async () => {
    expect((await interno(ids.ARTE, usuarioOtroCliente)).status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  it('una cuenta desactivada recibe 404', async () => {
    expect((await interno(ids.ARTE, { ...admin, activo: false })).status).toBe(404);
  });
});

describe('GET archivo del equipo: qué archivo', () => {
  it('un archivo de otro cliente responde igual que uno que no existe', async () => {
    const ajeno = await interno(ids.ARTE_AJENO);
    const inventado = await interno('00000000-0000-4000-8000-00000000ffff');
    expect(ajeno.status).toBe(404);
    expect(inventado.status).toBe(404);
    expect(await ajeno.json()).toEqual(await inventado.json());
    expect(espia.leidos).toEqual([]);
  });

  it('un id que no es UUID da 404 sin tocar la base', async () => {
    const res = await interno('no-es-uuid');
    expect(res.status).toBe(404);
    expect(espia.consultas).toEqual([]);
  });

  it('un cliente que no existe da 404', async () => {
    expect((await interno(ids.ARTE, admin, '00000000-0000-4000-8000-00000000cccc')).status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  // El recorrido de rutas lo para `leerArchivo` (ver tests/lib/files.test.ts);
  // aquí lo que importa es que la ruta le pase el cliente de la URL, que es lo
  // que hace valer el candado, y que un fallo no se convierta en un 500.
  it('pide el archivo con el cliente de la URL, para que aplique el candado', async () => {
    await interno(ids.ARTE);
    expect(espia.leidos).toEqual([{ clientId: ids.CLIENTE, ruta: `${ids.CLIENTE}/arte.png` }]);
  });

  it('si el disco se niega, responde 404 y lo deja en el registro', async () => {
    espia.fallaElDisco = true;
    const res = await interno(ids.ARTE);
    expect(res.status).toBe(404);
    expect(errores).toHaveLength(1);
    expect(String(errores[0][0])).toContain(`${ids.CLIENTE}/arte.png`);
  });
});

describe('GET archivo del equipo: cómo se sirve', () => {
  it('una imagen sale con su tipo, incrustada y con caché privada', async () => {
    const res = await interno(ids.ARTE);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Disposition')).toMatch(/^inline;/);
    expect(res.headers.get('Content-Length')).toBe('19');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300, must-revalidate');
    expect(res.headers.get('Vary')).toBe('Cookie');
  });

  it('lo que no es imagen sale como descarga y sin guardarse', async () => {
    const res = await interno(ids.BRIEF);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment;/);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  // Una fila con un tipo que hoy no se aceptaría al subir no se sirve con ese
  // tipo: binario opaco y descarga, que el navegador no lo ejecute.
  it('un tipo que ya no se acepta sale como binario y como descarga', async () => {
    poblarBase({ nombreArte: 'mapa.svg', mimeArte: 'image/svg+xml' });
    const res = await interno(ids.ARTE);
    expect(res.headers.get('Content-Type')).toBe('application/octet-stream');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment;/);
  });

  it('el nombre del archivo no puede partir la cabecera', async () => {
    poblarBase({ nombreArte: 'mal"o\r\nX-Inyectada: 1.png' });
    const cabecera = (await interno(ids.ARTE)).headers.get('Content-Disposition')!;
    expect(cabecera).not.toContain('"mal"');
    expect(cabecera).not.toMatch(/[\r\n]/);
    expect(cabecera).toContain('filename="mal_o__X-Inyectada: 1.png"');
  });

  it('un nombre con acentos viaja en `filename*`', async () => {
    poblarBase({ nombreArte: 'diseño de septiembre.png' });
    const cabecera = (await interno(ids.ARTE)).headers.get('Content-Disposition')!;
    expect(cabecera).toContain("filename*=UTF-8''dise%C3%B1o%20de%20septiembre.png");
    expect(cabecera).toContain('filename="dise_o de septiembre.png"');
  });
});

describe('GET archivo del enlace público', () => {
  it('un arte del entregable se sirve con el token, sin sesión', async () => {
    const res = await publico(ids.ARTE);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300, must-revalidate');
    // No depende de ninguna cookie: la llave está en la URL.
    expect(res.headers.get('Vary')).toBe(null);
  });

  it('el token de un cliente no abre un archivo de otro', async () => {
    const res = await publico(ids.ARTE, TOKEN_AJENO);
    expect(res.status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  it('tampoco al revés: el archivo ajeno con el token de aquí', async () => {
    expect((await publico(ids.ARTE_AJENO)).status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  // Lo que se reparte es el entregable, no la ficha del cliente: el brief que
  // el equipo subió para trabajar no se abre con el enlace.
  it('un archivo del cliente que no es arte de ninguna pieza no se sirve', async () => {
    const res = await publico(ids.BRIEF);
    expect(res.status).toBe(404);
    expect(espia.leidos).toEqual([]);
  });

  it('un token revocado y uno inventado responden igual', async () => {
    const revocado = await publico(ids.ARTE, TOKEN_REVOCADO);
    const inventado = await publico(ids.ARTE, 'nunca-existio');
    expect(revocado.status).toBe(404);
    expect(inventado.status).toBe(404);
    expect(await revocado.text()).toBe(await inventado.text());
  });

  it('un id de archivo que no es UUID da 404 sin tocar la base', async () => {
    expect((await publico('no-es-uuid')).status).toBe(404);
    expect(espia.consultas).toEqual([]);
  });

  // Si cada arte contara, `visitas` diría cuántas imágenes tiene el
  // entregable, no cuánta gente lo abrió.
  it('pedir un arte no cuenta una visita del enlace', async () => {
    await publico(ids.ARTE);
    expect(espia.actualizadas).toEqual([]);
  });

  it('el nombre del negocio es cosmético: con otro slug sirve igual', async () => {
    expect((await publico(ids.ARTE, TOKEN, 'nombre-que-no-es')).status).toBe(200);
  });

  it('pide el archivo con el cliente del documento, no con uno de la URL', async () => {
    await publico(ids.ARTE);
    expect(espia.leidos).toEqual([{ clientId: ids.CLIENTE, ruta: `${ids.CLIENTE}/arte.png` }]);
  });

  it('si el disco se niega, responde 404 y lo deja en el registro', async () => {
    espia.fallaElDisco = true;
    expect((await publico(ids.ARTE)).status).toBe(404);
    expect(errores).toHaveLength(1);
  });
});
