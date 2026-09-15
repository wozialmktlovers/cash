import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PATCH } from '@/pages/api/perfil';

/**
 * Mismo patrón que `tests/api/ids-no-uuid.test.ts`: sin `DATABASE_URL`,
 * cualquier consulta a la base lanza «Falta DATABASE_URL». Así, si la ruta
 * llega a escribir en un caso que debería rechazar antes, la promesa se
 * rechaza y la prueba falla en vez de pasar por accidente.
 */
const operador = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'op@x.mx',
  nombre: null,
  apellido: null,
  rol: 'operador' as const,
  clientId: null,
  activo: true,
};
const OTRO = '00000000-0000-4000-8000-0000000000bb';

let urlPrevia: string | undefined;
beforeEach(() => { urlPrevia = process.env.DATABASE_URL; delete process.env.DATABASE_URL; });
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

const llamar = (cuerpo: unknown, usuario: typeof operador = operador) => PATCH({
  request: new Request('http://x/api/perfil', { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  locals: { usuario },
} as any);

describe('PATCH /api/perfil', () => {
  it('rechaza un cuerpo que no es JSON', async () => {
    const res = await PATCH({
      request: new Request('http://x/api/perfil', { method: 'PATCH', body: 'no soy json' }),
      locals: { usuario: operador },
    } as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('json-invalido');
  });

  it('un nombre larguísimo se rechaza antes de tocar la base', async () => {
    const res = await llamar({ nombre: 'a'.repeat(61) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('nombre-largo');
  });

  it('un apellido larguísimo se rechaza antes de tocar la base', async () => {
    const res = await llamar({ apellido: 'a'.repeat(61) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('apellido-largo');
  });

  it('tipos equivocados se rechazan', async () => {
    const nombre = await llamar({ nombre: 7 });
    expect(nombre.status).toBe(400);
    expect((await nombre.json()).error).toBe('nombre-invalido');

    const apellido = await llamar({ apellido: { a: 1 } });
    expect(apellido.status).toBe(400);
    expect((await apellido.json()).error).toBe('apellido-invalido');
  });

  it('ignora el correo aunque venga en el cuerpo', async () => {
    // Con un nombre válido llegaría a la base; se comprueba con un nombre
    // inválido que el correo no cambia la decisión: si se considerara, el
    // error sería `solo-admin-correo` y no `nombre-largo`.
    const res = await llamar({ email: 'otro@x.mx', nombre: 'a'.repeat(61) });
    expect((await res.json()).error).toBe('nombre-largo');
  });

  it('un cuerpo solo con correo es sin-cambios', async () => {
    const res = await llamar({ email: 'otro@x.mx' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('sin-cambios');
  });

  it('un cuerpo vacío es sin-cambios', async () => {
    const res = await llamar({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('sin-cambios');
  });

  it('ignora el id del cuerpo: siempre edita al de la sesión', async () => {
    // Si la ruta hiciera caso al `id` del cuerpo, un operador estaría editando
    // a otra persona y el error sería `solo-admin`.
    const res = await llamar({ id: OTRO, nombre: 'a'.repeat(61) });
    expect((await res.json()).error).toBe('nombre-largo');
  });
});
