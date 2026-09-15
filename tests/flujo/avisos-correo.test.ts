import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Fix round 1 de M2: el correo de un aviso solo enlaza a PUBLIC_BASE_URL.
 * Sin ella, en producción no se manda (el aviso queda dentro del Studio) y
 * fuera de producción se manda sin botón.
 */
const { enviarCorreo, insertar } = vi.hoisted(() => ({
  enviarCorreo: vi.fn(async () => ({ enviado: true })),
  insertar: vi.fn(async () => undefined),
}));
vi.mock('@/lib/correo', () => ({ enviarCorreo }));
vi.mock('@/db', () => ({
  db: { insert: () => ({ values: insertar }) },
  notificaciones: {}, users: {},
}));

import { notificar } from '@/flujo/avisos';

const operador = { id: 'op1', email: 'op@x.mx', nombre: 'Op', rol: 'operador' as const, activo: true };
const ctx = { admins: [], operador, autor: null, usuariosCliente: [], etapaVisibleCliente: false, datos: { cliente: 'Ana', etapa: 'Investigación' } };

const entorno = { ...process.env };
beforeEach(() => { enviarCorreo.mockClear(); insertar.mockClear(); });
afterEach(() => { process.env = { ...entorno }; });

describe('notificar: enlace del correo', () => {
  it('con PUBLIC_BASE_URL manda el botón a esa base', async () => {
    process.env.PUBLIC_BASE_URL = 'https://studio.wozial.mx/';
    process.env.NODE_ENV = 'production';
    await notificar('cambios_pedidos', ctx, '/clientes/c1');
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect((enviarCorreo.mock.calls[0] as any)[0].boton).toEqual({ texto: 'Ver en Wozial Studio', url: 'https://studio.wozial.mx/clientes/c1' });
  });

  it('sin PUBLIC_BASE_URL en producción: guarda el aviso pero no manda correo', async () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.NODE_ENV = 'production';
    await notificar('cambios_pedidos', ctx, '/clientes/c1');
    expect(insertar).toHaveBeenCalledTimes(1);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it('sin PUBLIC_BASE_URL fuera de producción: manda el correo sin botón', async () => {
    delete process.env.PUBLIC_BASE_URL;
    process.env.NODE_ENV = 'test';
    await notificar('cambios_pedidos', ctx, '/clientes/c1');
    expect(enviarCorreo).toHaveBeenCalledTimes(1);
    expect((enviarCorreo.mock.calls[0] as any)[0].boton).toBeUndefined();
  });
});
