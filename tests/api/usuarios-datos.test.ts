import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Datos de identidad (nombre, apellido y correo) en el PATCH del admin.
 *
 * Como en `ids-no-uuid.test.ts`, las pruebas corren sin `DATABASE_URL`: si la
 * ruta consultara la base de verdad, la promesa se rechazaría y se notaría. La
 * escritura sí se simula, porque el 409 de correo repetido solo puede provocarlo
 * el error de la restricción única de Postgres.
 */
const espia = vi.hoisted(() => ({
  fallo: null as unknown,
  filas: [] as unknown[],
  cambio: undefined as Record<string, unknown> | undefined,
  columnas: undefined as Record<string, unknown> | undefined,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const escritura = {
    set(cambio: Record<string, unknown>) {
      espia.cambio = cambio;
      return escritura;
    },
    where() {
      return escritura;
    },
    async returning(columnas: Record<string, unknown>) {
      espia.columnas = columnas;
      if (espia.fallo) throw espia.fallo;
      return espia.filas;
    },
  };
  // Este `db` solo sabe actualizar: si la ruta intentara un `select` (el conteo
  // de admins activos, por ejemplo) para un cuerpo que solo trae datos de
  // identidad, reventaría, que es justo lo que queremos notar.
  return { ...real, db: { update: () => escritura } };
});

import { PATCH } from '@/pages/api/admin/usuarios/[id]';

const admin = { id: '00000000-0000-4000-8000-000000000001', email: 'a@x.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const OTRO = '00000000-0000-4000-8000-0000000000bb';

let urlPrevia: string | undefined;
beforeEach(() => {
  urlPrevia = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  espia.fallo = null;
  espia.filas = [];
  espia.cambio = undefined;
  espia.columnas = undefined;
});
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

const llamar = (cuerpo: unknown) => PATCH({
  params: { id: OTRO },
  request: new Request(`http://x/api/admin/usuarios/${OTRO}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  locals: { usuario: admin },
} as any);

/** Lo que lanza postgres.js: un `Error` con los campos que mandó el servidor. */
const errorPostgres = (campos: Record<string, unknown>, mensaje = 'duplicate key value violates unique constraint') =>
  Object.assign(new Error(mensaje), campos);

/** Drizzle envuelve el error de arriba y deja el original en `cause`. */
const envueltoPorDrizzle = (causa: unknown) =>
  Object.assign(new Error('Failed query: update "users" set ...'), { cause: causa });

// El middleware ya reserva /api/admin/* para el admin, pero la ruta lo vuelve
// a comprobar: un cuerpo de pura identidad no pasa por validarCambioUsuario,
// que era la segunda barrera. Sin este candado, un operador que alcanzara la
// ruta podría editarse a sí mismo.
describe('PATCH usuarios: solo un admin entra', () => {
  for (const rol of ['operador', 'cliente'] as const) {
    it(`un ${rol} recibe 403 sin tocar la base`, async () => {
      const res = await PATCH({
        params: { id: OTRO },
        request: new Request(`http://x/api/admin/usuarios/${OTRO}`, { method: 'PATCH', body: JSON.stringify({ nombre: 'Ana' }) }),
        locals: { usuario: { ...admin, id: OTRO, rol } },
      } as any);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe('solo-admin');
      expect(espia.cambio).toBeUndefined();
    });
  }
});

describe('PATCH usuarios: datos de identidad', () => {
  it('un nombre larguísimo se rechaza antes de tocar la base', async () => {
    const res = await llamar({ nombre: 'a'.repeat(61) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('nombre-largo');
    expect(espia.cambio).toBeUndefined();
  });

  it('un correo mal formado se rechaza antes de tocar la base', async () => {
    const res = await llamar({ email: 'ana' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('correo-invalido');
    expect(espia.cambio).toBeUndefined();
  });

  it('un cuerpo vacío sigue siendo sin-cambios', async () => {
    const res = await llamar({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('sin-cambios');
  });

  it('tipos equivocados se rechazan', async () => {
    const res = await llamar({ nombre: 7 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('nombre-invalido');

    const res2 = await llamar({ apellido: 7 });
    expect((await res2.json()).error).toBe('apellido-invalido');

    const res3 = await llamar({ email: 7 });
    expect((await res3.json()).error).toBe('email-invalido');
  });

  it('un null borra el nombre, no es un tipo equivocado', async () => {
    espia.filas = [{ id: OTRO, email: 'b@x.mx', nombre: null, apellido: null, rol: 'operador', activo: true, clientId: null }];
    const res = await llamar({ nombre: null });
    expect(res.status).toBe(200);
    expect(espia.cambio).toEqual({ nombre: null });
  });

  it('guarda los datos ya normalizados y devuelve el apellido', async () => {
    espia.filas = [{ id: OTRO, email: 'ana@x.mx', nombre: 'Ana', apellido: 'Pau', rol: 'operador', activo: true, clientId: null }];
    const res = await llamar({ nombre: '  Ana ', apellido: 'Pau', email: '  ANA@X.MX ' });
    expect(res.status).toBe(200);
    expect(espia.cambio).toEqual({ nombre: 'Ana', apellido: 'Pau', email: 'ana@x.mx' });
    // El renglón de la pantalla necesita el apellido de vuelta para repintarse.
    expect(Object.keys(espia.columnas ?? {})).toContain('apellido');
    expect((await res.json()).usuario.apellido).toBe('Pau');
  });

  it('si el usuario no existe, 404', async () => {
    espia.filas = [];
    const res = await llamar({ nombre: 'Ana' });
    expect(res.status).toBe(404);
  });

  it('el correo de otra cuenta se vuelve 409 correo-ocupado', async () => {
    espia.fallo = envueltoPorDrizzle(errorPostgres({ code: '23505', constraint_name: 'users_email_unique' }));
    const res = await llamar({ email: 'ana@x.mx' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('correo-ocupado');
  });

  it('lo reconoce también cuando la restricción solo se nombra en el mensaje', async () => {
    espia.fallo = errorPostgres({ code: '23505' }, 'duplicate key value violates unique constraint "users_email_unique"');
    const res = await llamar({ email: 'ana@x.mx' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('correo-ocupado');
  });

  it('otra violación de unicidad no se disfraza de correo ocupado', async () => {
    espia.fallo = envueltoPorDrizzle(errorPostgres({ code: '23505', constraint_name: 'sessions_token_unique' }));
    await expect(llamar({ email: 'ana@x.mx' })).rejects.toThrow();
  });

  it('cualquier otro error se relanza', async () => {
    espia.fallo = new Error('se cayó la conexión');
    await expect(llamar({ email: 'ana@x.mx' })).rejects.toThrow('se cayó la conexión');
  });
});
