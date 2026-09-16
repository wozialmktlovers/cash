import { describe, it, expect } from 'vitest';
import { rutaPermitida, puedeVerCliente, puedeOperarCliente, destinoTrasLogin, type UsuarioSesion , rutaPublica } from '@/lib/permisos';

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
  // La API de contenido (lotes y piezas, B1) es trabajo interno: la arma el
  // operador y el cliente solo ve el resultado desde su portal (fase C). No
  // está en RUTAS_CLIENTE, así que el middleware la corta con 403 antes de
  // llegar a la ruta. Esta prueba fija ese candado: si alguien añade
  // `/api/contenido` a las rutas del cliente, se entera aquí.
  it('el rol cliente no entra a la API de contenido', () => {
    for (const r of ['/api/contenido/lotes', '/api/contenido/lotes/abc/piezas', '/api/contenido/piezas/abc']) {
      expect(rutaPermitida('cliente', r), r).toBe('prohibido');
    }
    // El personal sí, y la visibilidad por cliente la decide cada ruta.
    for (const r of ['/api/contenido/lotes', '/api/contenido/piezas/abc']) {
      expect(rutaPermitida('admin', r), r).toBe('ok');
      expect(rutaPermitida('operador', r), r).toBe('ok');
    }
  });

  // La única excepción (C2, diseño §6): el cliente revisa sus piezas. Se abre
  // esa ruta y nada más; las pruebas de aquí abajo son el candado de que la
  // excepción siga siendo una y no una puerta a `/api/contenido`.
  const PIEZA = '11111111-2222-4333-8444-555555555555';

  it('el rol cliente sí entra a la revisión de una pieza', () => {
    expect(rutaPermitida('cliente', `/api/contenido/piezas/${PIEZA}/revision`)).toBe('ok');
    // Y el personal también: la ruta rechaza por rol, no por middleware.
    expect(rutaPermitida('admin', `/api/contenido/piezas/${PIEZA}/revision`)).toBe('ok');
    expect(rutaPermitida('operador', `/api/contenido/piezas/${PIEZA}/revision`)).toBe('ok');
  });

  it('abrir la revisión no abre ninguna otra ruta de contenido', () => {
    const cerradas = [
      `/api/contenido/piezas/${PIEZA}`,
      `/api/contenido/piezas/${PIEZA}/propuestas`,
      `/api/contenido/piezas/${PIEZA}/revision/algo`,
      `/api/contenido/piezas/${PIEZA}/revisiones`,
      '/api/contenido/piezas/revision',
      `/api/contenido/lotes/${PIEZA}/piezas`,
      // Un id que no es UUID no casa: el patrón no es un comodín con
      // «/revision» detrás.
      '/api/contenido/piezas/../revision',
      '/api/contenido/piezas/cualquiera/revision',
    ];
    for (const r of cerradas) expect(rutaPermitida('cliente', r), r).toBe('prohibido');
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
  it('la página /perfil la abren los tres roles', () => {
    expect(rutaPermitida('admin', '/perfil')).toBe('ok');
    expect(rutaPermitida('operador', '/perfil')).toBe('ok');
    expect(rutaPermitida('cliente', '/perfil')).toBe('ok');
  });
  it('/perfil solo abre esa página, no lo que empiece igual', () => {
    expect(rutaPermitida('cliente', '/perfiles')).toBe('redirigir-portal');
    expect(rutaPermitida('cliente', '/perfil/otro')).toBe('redirigir-portal');
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


/**
 * Cerrar sesión no puede depender de tener una sesión válida: cuando vencía,
 * «Salir» respondía «No autorizado» y dejaba a esa persona atrapada, sin poder
 * entrar ni salir. La protección contra peticiones de otros sitios no se apoya
 * en esta lista, sino en la comprobación de origen que el middleware hace antes.
 */
describe('rutaPublica', () => {
  it('salir funciona sin sesión', () => {
    expect(rutaPublica('/api/logout')).toBe(true);
  });

  it('entrar y las páginas de invitación y enlaces públicos siguen abiertas', () => {
    for (const r of ['/login', '/api/login', '/invitacion/abc', '/api/invitacion/aceptar', '/p/slug/token']) {
      expect(rutaPublica(r)).toBe(true);
    }
  });

  // Las imágenes del entregable cuelgan del mismo enlace y las pide un
  // navegador sin sesión: si dejaran de ser públicas, el cliente vería el
  // documento con los huecos del arte.
  it('los archivos de un enlace público también están abiertos', () => {
    expect(rutaPublica('/p/cafe-malinche/t0ken/archivo/00000000-0000-4000-8000-0000000000a1')).toBe(true);
  });

  it('no abre nada más: el resto sigue exigiendo sesión', () => {
    for (const r of ['/', '/clientes', '/api/clientes', '/admin/usuarios', '/api/perfil', '/portal']) {
      expect(rutaPublica(r)).toBe(false);
    }
  });

  // Las expresiones van ancladas: un prefijo parecido no debe colarse.
  it('rutas parecidas no se cuelan', () => {
    for (const r of ['/api/logout/otro', '/api/logouts', '/loginx', '/api/login/extra']) {
      expect(rutaPublica(r)).toBe(false);
    }
  });
});
