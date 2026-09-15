import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PATCH as patchUsuario } from '@/pages/api/admin/usuarios/[id]';
import { DELETE as borrarEnlace } from '@/pages/api/clientes/[id]/links';
import { DELETE as borrarArchivo } from '@/pages/api/clientes/[id]/files';

/**
 * M2 punto 5: un id que no tiene forma de UUID responde 404 sin tocar la
 * base. Sin `DATABASE_URL` en las pruebas, cualquier consulta lanza «Falta
 * DATABASE_URL»: si la ruta llega a consultar, la promesa se rechaza (lo que
 * en el servidor sería un 500) y la prueba falla.
 */
const admin = { id: '00000000-0000-4000-8000-000000000001', email: 'a@x.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const CLIENTE_VALIDO = '00000000-0000-4000-8000-0000000000aa';

let urlPrevia: string | undefined;
beforeEach(() => { urlPrevia = process.env.DATABASE_URL; delete process.env.DATABASE_URL; });
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('ids que no son UUID → 404', () => {
  it('PATCH /api/admin/usuarios/[id]', async () => {
    const res = await patchUsuario({
      params: { id: 'no-es-uuid' },
      request: new Request('http://x/api/admin/usuarios/no-es-uuid', { method: 'PATCH', body: JSON.stringify({ activo: false }) }),
      locals: { usuario: admin },
    } as any);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/clientes/[id]/links con linkId inválido', async () => {
    const res = await borrarEnlace({
      params: { id: CLIENTE_VALIDO }, url: new URL('http://x/api/clientes/c/links?linkId=123'), locals: { usuario: admin },
    } as any);
    expect(res.status).toBe(404);
  });

  it('DELETE /api/clientes/[id]/files con fileId inválido', async () => {
    const res = await borrarArchivo({
      params: { id: CLIENTE_VALIDO }, url: new URL('http://x/api/clientes/c/files?fileId=abc'), locals: { usuario: admin },
    } as any);
    expect(res.status).toBe(404);
  });
});
