import { describe, it, expect } from 'vitest';
import { rutaPermitida, puedeVerCliente, puedeOperarCliente, destinoTrasLogin, type UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, apellido: null, rol, clientId: null, activo: true, ...extra });

describe('rutaPermitida', () => {
  it('admin entra a todo', () => {
    for (const r of ['/', '/admin/usuarios', '/api/admin/usuarios', '/portal', '/clientes/x']) expect(rutaPermitida('admin', r)).toBe('ok');
  });
  it('operador todo menos admin', () => {
    expect(rutaPermitida('operador', '/clientes/x')).toBe('ok');
    expect(rutaPermitida('operador', '/admin/usuarios')).toBe('prohibido');
    expect(rutaPermitida('operador', '/api/admin/usuarios')).toBe('prohibido');
  });
  it('cliente solo portal, comentarios, avisos, logout y links públicos', () => {
    for (const r of ['/portal', '/portal/documentos/1', '/api/portal/x', '/api/comentarios', '/api/comentarios/1', '/api/notificaciones', '/api/logout', '/p/a/b']) {
      expect(rutaPermitida('cliente', r), r).toBe('ok');
    }
    expect(rutaPermitida('cliente', '/')).toBe('redirigir-portal');
    expect(rutaPermitida('cliente', '/clientes')).toBe('redirigir-portal');
    expect(rutaPermitida('cliente', '/api/clientes')).toBe('prohibido');
    expect(rutaPermitida('cliente', '/portalx')).toBe('redirigir-portal');
  });
  it('/api/perfil lo abren los tres roles', () => {
    expect(rutaPermitida('admin', '/api/perfil')).toBe('ok');
    expect(rutaPermitida('operador', '/api/perfil')).toBe('ok');
    expect(rutaPermitida('cliente', '/api/perfil')).toBe('ok');
  });
  it('/api/perfil solo abre esa ruta, no lo que empiece igual', () => {
    expect(rutaPermitida('cliente', '/api/perfiles')).toBe('prohibido');
    expect(rutaPermitida('cliente', '/api/perfil/otro')).toBe('prohibido');
  });
});

describe('visibilidad', () => {
  const cliente = { id: 'c1', operadorId: 'op1' };
  it('admin ve y opera todo', () => {
    expect(puedeVerCliente(u('admin'), cliente)).toBe(true);
    expect(puedeOperarCliente(u('admin'), cliente)).toBe(true);
  });
  it('operador solo lo asignado', () => {
    expect(puedeVerCliente(u('operador', { id: 'op1' }), cliente)).toBe(true);
    expect(puedeVerCliente(u('operador', { id: 'op2' }), cliente)).toBe(false);
    expect(puedeOperarCliente(u('operador', { id: 'op1' }), cliente)).toBe(true);
  });
  it('cliente ve su empresa pero nunca opera', () => {
    expect(puedeVerCliente(u('cliente', { clientId: 'c1' }), cliente)).toBe(true);
    expect(puedeVerCliente(u('cliente', { clientId: 'c2' }), cliente)).toBe(false);
    expect(puedeOperarCliente(u('cliente', { clientId: 'c1' }), cliente)).toBe(false);
  });
  it('usuario inactivo no ve nada', () => {
    expect(puedeVerCliente(u('admin', { activo: false }), cliente)).toBe(false);
  });
  it('destino tras login', () => {
    expect(destinoTrasLogin('cliente')).toBe('/portal');
    expect(destinoTrasLogin('operador')).toBe('/');
  });
});
