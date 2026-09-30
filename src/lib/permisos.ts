export type Rol = 'admin' | 'operador' | 'cliente';
export type UsuarioSesion = { id: string; email: string; nombre: string | null; apellido: string | null; rol: Rol; clientId: string | null; activo: boolean };

// `/api/perfil` sirve a los tres roles: cada quien edita su nombre y apellido,
// así que el cliente también necesita llegar a ella desde el portal. Y con la
// API no basta: `/perfil` es la página desde donde se llama, así que va aparte
// en la lista (la API y la página son dos rutas distintas).
/**
 * La única puerta del cliente a `/api/contenido/…` (C2, diseño §6): decir lo
 * que opina de UNA pieza de su mes.
 *
 * El patrón está escrito lo más estrecho posible a propósito. La API de
 * contenido es trabajo interno —abrir el lote, dar de alta y editar piezas,
 * pedirle propuestas de copy al agente— y sigue cerrada al rol `cliente`; lo
 * que se abre es este camino exacto y nada más. Por eso:
 *
 * - va anclado por los dos extremos, así que ni `/api/contenido/piezas` ni
 *   `/api/contenido/piezas/<id>/revision/otra-cosa` casan;
 * - el id solo admite la forma de un UUID, en vez de un `[^/]+` que aceptaría
 *   cualquier cosa con tal de llevar `/revision` detrás;
 * - `rutaPermitida` no distingue métodos, así que el archivo de esa ruta
 *   exporta **solo** `POST`: no hay ahí ningún GET, PATCH ni DELETE que esto
 *   pudiera estar abriendo de paso.
 *
 * De quién es esa pieza lo decide la ruta (`piezaVisible` + rol `cliente`), no
 * esta lista: aquí solo se dice que el cliente puede llamar a la puerta.
 */
const RUTA_REVISION_PIEZA = /^\/api\/contenido\/piezas\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/revision$/;

// `/api/perfil` sirve a los tres roles: cada quien edita su nombre y apellido,
// así que el cliente también necesita llegar a ella desde el portal. Y con la
// API no basta: `/perfil` es la página desde donde se llama, así que va aparte
// en la lista (la API y la página son dos rutas distintas).
const RUTAS_CLIENTE = [/^\/portal(\/|$)/, /^\/api\/portal(\/|$)/, /^\/api\/comentarios(\/|$)/, /^\/api\/notificaciones(\/|$)/, /^\/perfil$/, /^\/api\/perfil$/, /^\/api\/logout$/, /^\/p\//, RUTA_REVISION_PIEZA];
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

/**
 * Visibilidad total (rediseño 2026-09-30, puestos y responsables por etapa):
 * cualquier operador activo, de cualquier puesto, ve CUALQUIER cliente
 * completo —las 4 etapas, no solo las suyas—, ya no solo los que tenía
 * asignados por `clients.operador_id` (columna heredada, sin uso). Ver no es
 * lo mismo que poder actuar: quién puede mover una etapa lo decide
 * `esResponsableDeEtapa` (src/flujo/responsables.ts) contra
 * `etapa_responsables`, no esta función.
 */
export function puedeVerCliente(u: UsuarioSesion, c: { id: string }): boolean {
  if (!u.activo) return false;
  if (u.rol === 'admin') return true;
  if (u.rol === 'operador') return true;
  return u.clientId === c.id;
}

/**
 * DECISIÓN DEL DUEÑO, AISLADA AQUÍ A PROPÓSITO (rediseño de puestos): «operar»
 * un cliente a nivel de ficha —editar sus datos y paquete, subir archivos,
 * lanzar generaciones, invitar a sus usuarios— lo puede hacer cualquier
 * operador activo, igual que verlo. Lo que sigue atado a la asignación son las
 * acciones del FLUJO de cada etapa (solicitar autorización, comentar, editar
 * el documento, cambiar estado de comentarios), que se deciden con
 * `esResponsableDeEtapa` (src/flujo/responsables.ts).
 *
 * Si el dueño prefiere que editar/generar también quede atado a los
 * responsables, el cambio es solo este cuerpo: exigir aquí que el operador esté
 * en `etapa_responsables` de alguna etapa del cliente (o pasar la etapa).
 */
export function puedeOperarCliente(u: UsuarioSesion, c: { id: string }): boolean {
  return u.rol !== 'cliente' && puedeVerCliente(u, c);
}

export function destinoTrasLogin(rol: Rol): string {
  return rol === 'cliente' ? '/portal' : '/';
}
