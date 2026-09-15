import { describe, it, expect } from 'vitest';
import { validarCambioUsuario } from '@/lib/usuarios';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, rol, clientId: null, activo: true, ...extra });

describe('validarCambioUsuario', () => {
  it('solo un admin cambia usuarios', () => {
    const actor = u('operador', { id: 'op1' });
    const objetivo = { id: 'op2', rol: 'operador' as const, activo: true };
    const r = validarCambioUsuario(actor, objetivo, { activo: false }, 2);
    expect(r).toEqual({ ok: false, error: 'solo-admin' });
  });

  it('el rol solo cambia entre admin y operador, nunca hacia o desde cliente', () => {
    const admin = u('admin', { id: 'a1' });
    const objetivoCliente = { id: 'c1', rol: 'cliente' as const, activo: true };
    expect(validarCambioUsuario(admin, objetivoCliente, { rol: 'operador' }, 2)).toEqual({ ok: false, error: 'rol-cliente-fijo' });

    const objetivoOperador = { id: 'op1', rol: 'operador' as const, activo: true };
    expect(validarCambioUsuario(admin, objetivoOperador, { rol: 'cliente' }, 2)).toEqual({ ok: false, error: 'rol-cliente-fijo' });

    // en cambio, activo en un usuario cliente sí se puede tocar
    expect(validarCambioUsuario(admin, objetivoCliente, { activo: false }, 2)).toEqual({ ok: true });
  });

  it('nadie se desactiva ni se quita el rol de admin a sí mismo', () => {
    const admin = u('admin', { id: 'a1' });
    const elMismoComoObjetivo = { id: 'a1', rol: 'admin' as const, activo: true };
    expect(validarCambioUsuario(admin, elMismoComoObjetivo, { activo: false }, 3)).toEqual({ ok: false, error: 'no-autodesactivar' });
    expect(validarCambioUsuario(admin, elMismoComoObjetivo, { rol: 'operador' }, 3)).toEqual({ ok: false, error: 'no-autodegradarse' });
  });

  it('no se desactiva ni se degrada al último admin activo', () => {
    const actor = u('admin', { id: 'a1' });
    const ultimoAdmin = { id: 'a2', rol: 'admin' as const, activo: true };
    expect(validarCambioUsuario(actor, ultimoAdmin, { activo: false }, 1)).toEqual({ ok: false, error: 'ultimo-admin' });
    expect(validarCambioUsuario(actor, ultimoAdmin, { rol: 'operador' }, 1)).toEqual({ ok: false, error: 'ultimo-admin' });
    // con más de un admin activo, sí se puede
    expect(validarCambioUsuario(actor, ultimoAdmin, { activo: false }, 2)).toEqual({ ok: true });
  });

  it('cambios permitidos en el caso general', () => {
    const admin = u('admin', { id: 'a1' });
    const operador = { id: 'op1', rol: 'operador' as const, activo: true };
    expect(validarCambioUsuario(admin, operador, { rol: 'admin' }, 2)).toEqual({ ok: true });
    expect(validarCambioUsuario(admin, operador, { activo: false }, 2)).toEqual({ ok: true });
  });
});
