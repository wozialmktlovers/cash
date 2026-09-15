import { describe, it, expect } from 'vitest';
import { validarCambioUsuario, nombreVisible, ordenUsuarios, validarDatosUsuario } from '@/lib/usuarios';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, apellido: null, rol, clientId: null, activo: true, ...extra });

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

describe('validarCambioUsuario: cliente sin cliente (M2 punto 6)', () => {
  const admin = u('admin', { id: 'a1' });

  it('no se reactiva un usuario cliente que quedó sin client_id (lo desactivó el saneo de 0005)', () => {
    const huerfano = { id: 'c1', rol: 'cliente' as const, activo: false, clientId: null };
    expect(validarCambioUsuario(admin, huerfano, { activo: true }, 2)).toEqual({ ok: false, error: 'cliente-sin-cliente' });
  });

  it('un usuario cliente con cliente sí se reactiva, y el huérfano se puede dejar inactivo', () => {
    expect(validarCambioUsuario(admin, { id: 'c1', rol: 'cliente', activo: false, clientId: 'cl1' }, { activo: true }, 2)).toEqual({ ok: true });
    expect(validarCambioUsuario(admin, { id: 'c1', rol: 'cliente', activo: false, clientId: null }, { activo: false }, 2)).toEqual({ ok: true });
  });
});

describe('nombreVisible', () => {
  it('junta nombre y apellido', () => {
    expect(nombreVisible({ nombre: 'Ana', apellido: 'Pau', email: 'a@x.mx' })).toBe('Ana Pau');
  });
  it('con solo nombre no deja espacios sueltos', () => {
    expect(nombreVisible({ nombre: 'Ana', apellido: null, email: 'a@x.mx' })).toBe('Ana');
    expect(nombreVisible({ nombre: null, apellido: 'Pau', email: 'a@x.mx' })).toBe('Pau');
  });
  it('sin nombre ni apellido, el correo', () => {
    expect(nombreVisible({ nombre: null, apellido: null, email: 'a@x.mx' })).toBe('a@x.mx');
    expect(nombreVisible({ nombre: '  ', apellido: '', email: 'a@x.mx' })).toBe('a@x.mx');
  });
});

describe('ordenUsuarios', () => {
  it('ordena por apellido y luego nombre, sin que los acentos manden al final', () => {
    const lista = [
      { nombre: 'Beto', apellido: 'Zamora', email: 'b@x.mx' },
      { nombre: 'Ana', apellido: 'Álvarez', email: 'a@x.mx' },
      { nombre: 'Ana', apellido: 'Pau', email: 'ap@x.mx' },
      { nombre: 'Zoe', apellido: 'Pau', email: 'z@x.mx' },
    ];
    expect([...lista].sort(ordenUsuarios).map((u) => u.email)).toEqual(['a@x.mx', 'ap@x.mx', 'z@x.mx', 'b@x.mx']);
  });
  it('los que no tienen nombre van al final, por correo', () => {
    const lista = [
      { nombre: null, apellido: null, email: 'zzz@x.mx' },
      { nombre: null, apellido: null, email: 'aaa@x.mx' },
      { nombre: 'Beto', apellido: 'Zamora', email: 'b@x.mx' },
    ];
    expect([...lista].sort(ordenUsuarios).map((u) => u.email)).toEqual(['b@x.mx', 'aaa@x.mx', 'zzz@x.mx']);
  });
});

describe('validarDatosUsuario', () => {
  const admin = u('admin', { id: 'u1', email: 'a@x.mx' });
  const operador = u('operador', { id: 'u2', email: 'a@x.mx' });

  it('recorta y normaliza', () => {
    const r = validarDatosUsuario(admin, 'u9', { nombre: '  Ana ', apellido: 'Pau', email: '  ANA@X.MX ' });
    expect(r).toEqual({ ok: true, datos: { nombre: 'Ana', apellido: 'Pau', email: 'ana@x.mx' } });
  });
  it('vacío borra el dato', () => {
    const r = validarDatosUsuario(admin, 'u9', { nombre: '   ' });
    expect(r).toEqual({ ok: true, datos: { nombre: null } });
  });
  it('rechaza nombres larguísimos', () => {
    expect(validarDatosUsuario(admin, 'u9', { nombre: 'a'.repeat(61) })).toEqual({ ok: false, error: 'nombre-largo' });
    expect(validarDatosUsuario(admin, 'u9', { apellido: 'a'.repeat(61) })).toEqual({ ok: false, error: 'apellido-largo' });
  });
  it('rechaza correos que no lo parecen', () => {
    expect(validarDatosUsuario(admin, 'u9', { email: 'ana' })).toEqual({ ok: false, error: 'correo-invalido' });
    expect(validarDatosUsuario(admin, 'u9', { email: 'ana@x' })).toEqual({ ok: false, error: 'correo-invalido' });
  });
  it('un operador solo se edita a sí mismo', () => {
    expect(validarDatosUsuario(operador, 'u9', { nombre: 'Ana' })).toEqual({ ok: false, error: 'solo-admin' });
    expect(validarDatosUsuario(operador, 'u2', { nombre: 'Ana' })).toEqual({ ok: true, datos: { nombre: 'Ana' } });
  });
  it('un operador nunca cambia un correo, ni el suyo', () => {
    expect(validarDatosUsuario(operador, 'u2', { email: 'otro@x.mx' })).toEqual({ ok: false, error: 'solo-admin-correo' });
  });
  it('sin campos, sin cambios', () => {
    expect(validarDatosUsuario(admin, 'u9', {})).toEqual({ ok: false, error: 'sin-cambios' });
  });
});
