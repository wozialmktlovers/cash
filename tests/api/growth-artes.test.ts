import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * El arte de los anuncios del manual de campaña: quién lo sube y lo quita
 * (`POST/DELETE /api/growth/[id]/artes`), y quién lo ve por cada una de las
 * tres puertas (equipo, portal del cliente, enlace público).
 *
 * La base se cambia por datos en memoria a la altura de
 * `@/growth/artes-consultas` —solo consultas, sin decisiones—, así que lo que
 * se prueba aquí son las decisiones reales de `@/growth/artes` y de las rutas.
 * `@/db` se reemplaza por un espía que truena si alguien lo toca: subir arte
 * no debe escribir en ninguna otra tabla (ni etapas, ni versiones).
 */
const ids = vi.hoisted(() => ({
  CLIENTE: '00000000-0000-4000-8000-0000000000c1',
  OTRO_CLIENTE: '00000000-0000-4000-8000-0000000000c2',
  OPERADOR: '00000000-0000-4000-8000-000000000001',
  OTRO_OPERADOR: '00000000-0000-4000-8000-000000000002',
  MANUAL: '00000000-0000-4000-8000-0000000000d1',
  MANUAL_AJENO: '00000000-0000-4000-8000-0000000000d2',
  ETAPA: '00000000-0000-4000-8000-0000000000e1',
  ETAPA_AJENA: '00000000-0000-4000-8000-0000000000e2',
  ARTE: '00000000-0000-4000-8000-0000000000a1',
  ARTE_AJENO: '00000000-0000-4000-8000-0000000000a2',
  ENLACE: '00000000-0000-4000-8000-0000000000a3',
}));

type Fila = {
  id: string; growthId: string; creativo: number; orden: number; tipo: 'archivo' | 'enlace';
  mime: string | null; url: string | null; nombreOriginal: string | null; ruta: string | null;
};

const base = vi.hoisted(() => ({
  manuales: {} as Record<string, { datos: unknown; cliente: { id: string; operadorId: string | null } }>,
  artes: [] as Fila[],
  etapas: {} as Record<string, { clientId: string; contratada: boolean; interna: boolean; version: { documentoTipo: string; documentoId: string } | null }>,
  clientes: {} as Record<string, { id: string; operadorId: string | null }>,
  enlaces: {} as Record<string, { documentoId: string; documentoTipo: string; revocado: boolean }>,
  guardados: [] as string[],
  borrados: [] as string[],
  leidos: [] as string[],
  tocoLaBase: [] as string[],
  siguiente: 100,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const db = new Proxy({}, {
    get(_t, prop) {
      base.tocoLaBase.push(String(prop));
      throw new Error(`Nadie debería tocar la base directo aquí (db.${String(prop)})`);
    },
  });
  return { ...real, db };
});

vi.mock('@/growth/artes-consultas', () => ({
  async manualConCliente(growthId: string) {
    const m = base.manuales[growthId];
    return m ? { growthId, datos: m.datos, cliente: m.cliente } : null;
  },
  async artesDelManual(growthId: string) {
    return base.artes.filter((a) => a.growthId === growthId);
  },
  async maxOrden(growthId: string, creativo: number) {
    return Math.max(-1, ...base.artes.filter((a) => a.growthId === growthId && a.creativo === creativo).map((a) => a.orden));
  },
  async arteDelManual(growthId: string, arteId: string) {
    return base.artes.find((a) => a.id === arteId && a.growthId === growthId) ?? null;
  },
  async ponerArte(n: Record<string, unknown>) {
    const i = base.artes.findIndex((a) => a.growthId === n.growthId && a.creativo === n.creativo && a.orden === n.orden);
    const anterior = i >= 0 ? base.artes.splice(i, 1)[0] : null;
    const fila: Fila = {
      id: `00000000-0000-4000-8000-${String(base.siguiente++).padStart(12, '0')}`,
      growthId: n.growthId as string, creativo: n.creativo as number, orden: n.orden as number, tipo: n.tipo as 'archivo',
      mime: (n.mime as string) ?? null, url: (n.url as string) ?? null, nombreOriginal: (n.nombreOriginal as string) ?? null, ruta: (n.ruta as string) ?? null,
    };
    base.artes.push(fila);
    return { arte: fila, rutaAnterior: anterior?.ruta ?? null };
  },
  async quitarArte(growthId: string, arteId: string) {
    const i = base.artes.findIndex((a) => a.id === arteId && a.growthId === growthId);
    if (i < 0) return undefined;
    return { ruta: base.artes.splice(i, 1)[0].ruta };
  },
  async cliente(id: string) { return base.clientes[id] ?? null; },
  async etapaConVersion(id: string) { return base.etapas[id] ?? null; },
  async enlacePublico(token: string) {
    const l = base.enlaces[token];
    return l && !l.revocado ? { documentoId: l.documentoId, documentoTipo: l.documentoTipo } : null;
  },
}));

vi.mock('@/lib/files', async (importarReal) => {
  const real = await importarReal<typeof import('@/lib/files')>();
  return {
    ...real,
    async guardarArchivo(clientId: string, nombre: string, _buf: Buffer, mime: string) {
      if (!real.mimeGuardable(mime)) throw new Error('Tipo no permitido');
      const ruta = `${clientId}/nuevo-${base.guardados.length}.${nombre.split('.').pop()}`;
      base.guardados.push(ruta);
      return { ruta };
    },
    async borrarArchivo(ruta: string) { base.borrados.push(ruta); },
    async leerArchivo(clientId: string, ruta: string) {
      base.leidos.push(`${clientId}:${ruta}`);
      return Buffer.from('bytes-del-arte');
    },
  };
});

import { POST as SUBIR } from '@/pages/api/growth/[id]/artes';
import { GET as VER_EQUIPO, DELETE as QUITAR } from '@/pages/api/growth/[id]/artes/[arteId]';
import { GET as VER_PORTAL } from '@/pages/portal/documentos/[etapaId]/arte/[arteId]';
import { GET as VER_PUBLICO } from '@/pages/p/[slug]/[token]/arte/[arteId]';
import { rutaPermitida } from '@/lib/permisos';

const admin = { id: '00000000-0000-4000-8000-00000000000a', email: 'admin@ejemplo.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const operador = { ...admin, id: ids.OPERADOR, email: 'ope@ejemplo.mx', rol: 'operador' as const };
const operadorAjeno = { ...admin, id: ids.OTRO_OPERADOR, email: 'otro@ejemplo.mx', rol: 'operador' as const };
const clienteDuenio = { ...admin, id: '00000000-0000-4000-8000-00000000000b', email: 'cli@ejemplo.mx', rol: 'cliente' as const, clientId: ids.CLIENTE };
const clienteAjeno = { ...clienteDuenio, id: '00000000-0000-4000-8000-00000000000c', clientId: ids.OTRO_CLIENTE };

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(8)]);

const creativos = [
  { grupo: 'a', formato: 'imagen' }, { grupo: 'a', formato: 'video' }, { grupo: 'a', formato: 'carrusel' },
];

beforeEach(() => {
  base.manuales = {
    [ids.MANUAL]: { datos: { creativos }, cliente: { id: ids.CLIENTE, operadorId: ids.OPERADOR } },
    [ids.MANUAL_AJENO]: { datos: { creativos }, cliente: { id: ids.OTRO_CLIENTE, operadorId: ids.OTRO_OPERADOR } },
  };
  base.artes = [
    { id: ids.ARTE, growthId: ids.MANUAL, creativo: 0, orden: 0, tipo: 'archivo', mime: 'image/png', url: null, nombreOriginal: 'pieza.png', ruta: `${ids.CLIENTE}/pieza.png` },
    { id: ids.ENLACE, growthId: ids.MANUAL, creativo: 1, orden: 0, tipo: 'enlace', mime: null, url: 'https://video.ejemplo.mx/1', nombreOriginal: null, ruta: null },
    { id: ids.ARTE_AJENO, growthId: ids.MANUAL_AJENO, creativo: 0, orden: 0, tipo: 'archivo', mime: 'image/png', url: null, nombreOriginal: 'x.png', ruta: `${ids.OTRO_CLIENTE}/x.png` },
  ];
  base.clientes = {
    [ids.CLIENTE]: { id: ids.CLIENTE, operadorId: ids.OPERADOR },
    [ids.OTRO_CLIENTE]: { id: ids.OTRO_CLIENTE, operadorId: ids.OTRO_OPERADOR },
  };
  base.etapas = {
    [ids.ETAPA]: { clientId: ids.CLIENTE, contratada: true, interna: false, version: { documentoTipo: 'growth', documentoId: ids.MANUAL } },
    [ids.ETAPA_AJENA]: { clientId: ids.OTRO_CLIENTE, contratada: true, interna: false, version: { documentoTipo: 'growth', documentoId: ids.MANUAL_AJENO } },
  };
  base.enlaces = {
    vigente: { documentoId: ids.MANUAL, documentoTipo: 'growth', revocado: false },
    revocado: { documentoId: ids.MANUAL, documentoTipo: 'growth', revocado: true },
    investigacion: { documentoId: ids.MANUAL, documentoTipo: 'research', revocado: false },
  };
  base.guardados = []; base.borrados = []; base.leidos = []; base.tocoLaBase = []; base.siguiente = 100;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

function formulario(campos: Record<string, string | Blob>, nombre = 'arte.png'): Request {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (typeof v === 'string') f.append(k, v); else f.append(k, v, nombre);
  }
  return new Request('http://localhost/api/growth/x/artes', { method: 'POST', body: f });
}
const subir = (usuario: unknown, campos: Record<string, string | Blob>, manual = ids.MANUAL, nombre?: string) =>
  SUBIR({ params: { id: manual }, request: formulario(campos, nombre), locals: { usuario } } as never);
const archivo = (buf: Buffer) => new Blob([new Uint8Array(buf)]);

const equipo = (usuario: unknown, arteId = ids.ARTE, manual = ids.MANUAL) =>
  VER_EQUIPO({ params: { id: manual, arteId }, request: new Request('http://localhost/x'), locals: { usuario } } as never);
const portal = (usuario: unknown, arteId = ids.ARTE, etapa = ids.ETAPA, query = '') =>
  VER_PORTAL({ params: { etapaId: etapa, arteId }, request: new Request('http://localhost/x'), locals: { usuario }, url: new URL(`http://localhost/x${query}`) } as never);
const publico = (token: string, arteId = ids.ARTE) =>
  VER_PUBLICO({ params: { slug: 'negocio', token, arteId }, request: new Request('http://localhost/x') } as never);

describe('subir arte: quién puede', () => {
  it('el admin y el operador asignado suben; la respuesta trae el arte nuevo', async () => {
    for (const u of [admin, operador]) {
      const r = await subir(u, { creativo: '0', orden: '0', archivo: archivo(PNG) });
      expect(r.status, u.email).toBe(201);
      expect((await r.json()).arte).toMatchObject({ creativo: 0, orden: 0, tipo: 'archivo', mime: 'image/png' });
    }
  });

  it('el operador ajeno y los clientes reciben 404 y no se guarda nada', async () => {
    for (const u of [operadorAjeno, clienteDuenio, clienteAjeno, { ...admin, activo: false }]) {
      const r = await subir(u, { creativo: '0', orden: '0', archivo: archivo(PNG) });
      expect(r.status, u.email).toBe(404);
    }
    expect(base.guardados).toEqual([]);
  });

  it('el middleware no deja al rol cliente ni asomarse a la API de growth; el portal sí', () => {
    expect(rutaPermitida('cliente', `/api/growth/${ids.MANUAL}/artes`)).toBe('prohibido');
    expect(rutaPermitida('cliente', `/api/growth/${ids.MANUAL}/artes/${ids.ARTE}`)).toBe('prohibido');
    expect(rutaPermitida('cliente', `/portal/documentos/${ids.ETAPA}/arte/${ids.ARTE}`)).toBe('ok');
    expect(rutaPermitida('operador', `/api/growth/${ids.MANUAL}/artes`)).toBe('ok');
  });

  it('subir no toca la base fuera del arte: ni la etapa ni las versiones', async () => {
    const r = await subir(admin, { creativo: '2', orden: '', archivo: archivo(PNG) });
    expect(r.status).toBe(201);
    expect(base.tocoLaBase).toEqual([]);
  });
});

describe('subir arte: qué se acepta', () => {
  it('valida por contenido: un HTML llamado .png se rechaza', async () => {
    const r = await subir(admin, { creativo: '0', orden: '0', archivo: archivo(Buffer.from('<html><script>alert(1)</script>')) }, ids.MANUAL, 'arte.png');
    expect(r.status).toBe(400);
    expect((await r.json()).errores[0]).toContain('PNG o JPEG');
    expect(base.guardados).toEqual([]);
  });

  it('un PNG con nombre .jpg se guarda con la extensión de su tipo real', async () => {
    const r = await subir(admin, { creativo: '0', orden: '0', archivo: archivo(PNG) }, ids.MANUAL, 'foto.jpg');
    expect(r.status).toBe(201);
    expect(base.guardados[0]).toMatch(/\.png$/);
    expect((await r.json()).arte.nombreOriginal).toBe('foto.png');
  });

  it('más de 25 MB se rechaza sin leer el cuerpo', async () => {
    const req = new Request('http://localhost/x', { method: 'POST', headers: { 'content-length': String(26 * 1024 * 1024) }, body: 'x' });
    const r = await SUBIR({ params: { id: ids.MANUAL }, request: req, locals: { usuario: admin } } as never);
    expect(r.status).toBe(413);
  });

  it('el enlace del video: solo http/https', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'ftp://x.mx/v', 'no es url']) {
      const r = await subir(admin, { creativo: '1', orden: '0', url });
      expect(r.status, url).toBe(400);
    }
    const ok = await subir(admin, { creativo: '1', orden: '0', url: 'https://drive.ejemplo.mx/video' });
    expect(ok.status).toBe(201);
  });

  it('el video acepta un MP4; la pieza de una imagen no', async () => {
    expect((await subir(admin, { creativo: '1', orden: '0', archivo: archivo(MP4) }, ids.MANUAL, 'v.mp4')).status).toBe(201);
    expect((await subir(admin, { creativo: '0', orden: '0', archivo: archivo(MP4) }, ids.MANUAL, 'v.mp4')).status).toBe(400);
  });

  it('un anuncio que ya no existe en el manual es 400, no un arte huérfano nuevo', async () => {
    const r = await subir(admin, { creativo: '9', orden: '0', archivo: archivo(PNG) });
    expect(r.status).toBe(400);
  });

  it('reemplazar pone el nuevo en el mismo hueco y borra el archivo anterior', async () => {
    const r = await subir(operador, { creativo: '0', orden: '0', archivo: archivo(PNG) });
    expect(r.status).toBe(201);
    expect(base.borrados).toEqual([`${ids.CLIENTE}/pieza.png`]);
    expect(base.artes.filter((a) => a.growthId === ids.MANUAL && a.creativo === 0)).toHaveLength(1);
  });

  it('carrusel: agrega tarjetas en orden hasta cinco y la sexta se rechaza', async () => {
    for (let k = 0; k < 5; k++) {
      expect((await subir(admin, { creativo: '2', archivo: archivo(PNG) })).status).toBe(201);
    }
    const tarjetas = base.artes.filter((a) => a.growthId === ids.MANUAL && a.creativo === 2).map((a) => a.orden);
    expect(tarjetas).toEqual([0, 1, 2, 3, 4]);
    const sexta = await subir(admin, { creativo: '2', archivo: archivo(PNG) });
    expect(sexta.status).toBe(400);
    expect((await sexta.json()).errores[0]).toContain('5 tarjetas');
  });
});

describe('quitar arte', () => {
  it('el operador asignado quita y se borra el archivo; el ajeno recibe 404', async () => {
    const ajeno = await QUITAR({ params: { id: ids.MANUAL, arteId: ids.ARTE }, locals: { usuario: operadorAjeno } } as never);
    expect(ajeno.status).toBe(404);
    expect(base.artes.some((a) => a.id === ids.ARTE)).toBe(true);
    const r = await QUITAR({ params: { id: ids.MANUAL, arteId: ids.ARTE }, locals: { usuario: operador } } as never);
    expect(r.status).toBe(200);
    expect(base.borrados).toEqual([`${ids.CLIENTE}/pieza.png`]);
  });

  it('un arte de otro manual no se quita pidiéndolo por este', async () => {
    const r = await QUITAR({ params: { id: ids.MANUAL, arteId: ids.ARTE_AJENO }, locals: { usuario: admin } } as never);
    expect(r.status).toBe(404);
    expect(base.artes.some((a) => a.id === ids.ARTE_AJENO)).toBe(true);
  });
});

describe('ver el arte: equipo', () => {
  it('admin y operador asignado lo reciben, como imagen incrustada', async () => {
    for (const u of [admin, operador]) {
      const r = await equipo(u);
      expect(r.status).toBe(200);
      expect(r.headers.get('Content-Type')).toBe('image/png');
      expect(r.headers.get('X-Content-Type-Options')).toBe('nosniff');
    }
  });

  it('operador ajeno y clientes: 404 sin tocar el disco', async () => {
    for (const u of [operadorAjeno, clienteDuenio, clienteAjeno]) expect((await equipo(u)).status).toBe(404);
    expect(base.leidos).toEqual([]);
  });

  it('el id del arte no basta: uno de otro manual por este es 404', async () => {
    expect((await equipo(admin, ids.ARTE_AJENO)).status).toBe(404);
    expect((await equipo(admin, 'no-es-uuid')).status).toBe(404);
  });

  it('un enlace no se sirve como archivo', async () => {
    expect((await equipo(admin, ids.ENLACE)).status).toBe(404);
  });
});

describe('ver el arte: portal del cliente', () => {
  it('el cliente dueño lo ve desde su etapa', async () => {
    const r = await portal(clienteDuenio);
    expect(r.status).toBe(200);
    expect(base.leidos).toEqual([`${ids.CLIENTE}:${ids.CLIENTE}/pieza.png`]);
  });

  it('el cliente ajeno no, ni por su propia etapa pidiendo un arte de otro manual', async () => {
    expect((await portal(clienteAjeno)).status).toBe(404);
    expect((await portal(clienteAjeno, ids.ARTE, ids.ETAPA_AJENA)).status).toBe(404);
    expect(base.leidos).toEqual([]);
  });

  it('el personal solo en vista previa del cliente de esa etapa', async () => {
    expect((await portal(admin)).status).toBe(404);
    expect((await portal(admin, ids.ARTE, ids.ETAPA, `?cliente=${ids.CLIENTE}`)).status).toBe(200);
    expect((await portal(operador, ids.ARTE, ids.ETAPA, `?cliente=${ids.CLIENTE}`)).status).toBe(200);
    expect((await portal(operadorAjeno, ids.ARTE, ids.ETAPA, `?cliente=${ids.CLIENTE}`)).status).toBe(404);
  });

  it('sin versión autorizada, o si la etapa es interna, no hay arte', async () => {
    base.etapas[ids.ETAPA].version = null;
    expect((await portal(clienteDuenio)).status).toBe(404);
    base.etapas[ids.ETAPA] = { clientId: ids.CLIENTE, contratada: true, interna: true, version: { documentoTipo: 'growth', documentoId: ids.MANUAL } };
    expect((await portal(clienteDuenio)).status).toBe(404);
  });
});

describe('ver el arte: enlace público', () => {
  it('un token vigente del manual sirve su arte', async () => {
    const r = await publico('vigente');
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toMatch(/^private/);
  });

  it('un token revocado, inexistente o de otro documento: 404', async () => {
    for (const t of ['revocado', 'no-existe', 'investigacion']) expect((await publico(t)).status, t).toBe(404);
    expect(base.leidos).toEqual([]);
  });

  it('el token del manual no abre el arte de otro manual', async () => {
    expect((await publico('vigente', ids.ARTE_AJENO)).status).toBe(404);
  });
});
