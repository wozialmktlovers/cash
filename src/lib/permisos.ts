export type Rol = 'admin' | 'operador' | 'cliente';
export type UsuarioSesion = { id: string; email: string; nombre: string | null; apellido: string | null; rol: Rol; clientId: string | null; activo: boolean };

// `/api/perfil` sirve a los tres roles: cada quien edita su nombre y apellido,
// así que el cliente también necesita llegar a ella desde el portal. Y con la
// API no basta: `/perfil` es la página desde donde se llama, así que va aparte
// en la lista (la API y la página son dos rutas distintas).
const RUTAS_CLIENTE = [/^\/portal(\/|$)/, /^\/api\/portal(\/|$)/, /^\/api\/comentarios(\/|$)/, /^\/api\/notificaciones(\/|$)/, /^\/perfil$/, /^\/api\/perfil$/, /^\/api\/logout$/, /^\/p\//];
const RUTAS_ADMIN = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

/**
 * Rutas que no exigen sesión. Vivían dentro del middleware; están aquí para
 * poder probarlas.
 *
 * `/api/logout` es pública a propósito: cerrar sesión no puede depender de
 * tener una sesión válida. Cuando la de alguien vencía, el botón «Salir»
 * respondía «No autorizado» y dejaba a esa persona sin poder entrar ni salir.
 * La ruta sigue protegida contra peticiones de otros sitios, porque la
 * comprobación de origen del middleware corre antes que esta lista, y el
 * endpoint borra la cookie y lleva a /login aunque no hubiera sesión.
 */
const RUTAS_PUBLICAS = [/^\/login$/, /^\/api\/login$/, /^\/api\/logout$/, /^\/p\//, /^\/invitacion\//, /^\/api\/invitacion\//];

export function rutaPublica(ruta: string): boolean {
  return RUTAS_PUBLICAS.some((r) => r.test(ruta));
}

/** Reglas de ruta por rol. La visibilidad por cliente se decide después, en cada página. */
export function rutaPermitida(rol: Rol, ruta: string): 'ok' | 'redirigir-portal' | 'prohibido' {
  if (rol === 'admin') return 'ok';
  if (rol === 'operador') return RUTAS_ADMIN.some((r) => r.test(ruta)) ? 'prohibido' : 'ok';
  if (RUTAS_CLIENTE.some((r) => r.test(ruta))) return 'ok';
  return ruta.startsWith('/api/') ? 'prohibido' : 'redirigir-portal';
}

export function puedeVerCliente(u: UsuarioSesion, c: { id: string; operadorId: string | null }): boolean {
  if (!u.activo) return false;
  if (u.rol === 'admin') return true;
  if (u.rol === 'operador') return c.operadorId === u.id;
  return u.clientId === c.id;
}

export function puedeOperarCliente(u: UsuarioSesion, c: { id: string; operadorId: string | null }): boolean {
  return u.rol !== 'cliente' && puedeVerCliente(u, c);
}

export function destinoTrasLogin(rol: Rol): string {
  return rol === 'cliente' ? '/portal' : '/';
}
