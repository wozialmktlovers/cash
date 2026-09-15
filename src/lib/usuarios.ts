import type { Rol, UsuarioSesion } from '@/lib/permisos';

/** `clientId` es opcional para no obligar a quien solo cambia rol/activo de un interno; si falta, no se revisa la regla de cliente sin cliente. */
export type ObjetivoUsuario = { id: string; rol: Rol; activo: boolean; clientId?: string | null };
export type CambioUsuario = { rol?: Rol; activo?: boolean };

/**
 * Reglas para que un admin cambie el rol o el estado de otro usuario (o el
 * suyo). Pura: quien llama cuenta los admins activos en la misma petición,
 * justo antes de aplicar el cambio (aceptable sin transacción, ver reporte).
 */
export function validarCambioUsuario(
  actor: UsuarioSesion,
  objetivo: ObjetivoUsuario,
  cambio: CambioUsuario,
  adminsActivos: number,
): { ok: true } | { ok: false; error: string } {
  if (actor.rol !== 'admin') return { ok: false, error: 'solo-admin' };

  // El rol de un usuario cliente nunca cambia (ni hacia, ni desde cliente);
  // desactivarlo o reactivarlo sí está permitido.
  if (cambio.rol !== undefined && (objetivo.rol === 'cliente' || cambio.rol === 'cliente')) {
    return { ok: false, error: 'rol-cliente-fijo' };
  }

  // Un usuario cliente sin `client_id` solo puede existir inactivo (CHECK de
  // la migración 0005, M2 punto 6): reactivarlo violaría la restricción y
  // además no tendría portal que ver. Como la invitación rechaza correos que ya
  // tienen cuenta, el acceso se da invitando a esa persona con otro correo.
  if (cambio.activo === true && objetivo.rol === 'cliente' && objetivo.clientId === null) {
    return { ok: false, error: 'cliente-sin-cliente' };
  }

  const seDesactiva = cambio.activo === false;
  const seDegrada = cambio.rol === 'operador' && objetivo.rol === 'admin';

  if (actor.id === objetivo.id) {
    if (seDesactiva) return { ok: false, error: 'no-autodesactivar' };
    if (seDegrada) return { ok: false, error: 'no-autodegradarse' };
  }

  // Último admin activo: no se le quita ni el acceso ni el rol.
  if (objetivo.rol === 'admin' && objetivo.activo && (seDesactiva || seDegrada) && adminsActivos <= 1) {
    return { ok: false, error: 'ultimo-admin' };
  }

  return { ok: true };
}

/** Lo mínimo para mostrar a una persona: si aún no tiene nombre, su correo. */
export type UsuarioMostrable = { nombre: string | null; apellido: string | null; email: string };

/** Exportado porque la invitación valida el mismo tope: si aceptara nombres más
 *  largos, esa persona quedaría con datos que ninguna pantalla puede guardar
 *  después (ni ella en /perfil, ni un admin en Usuarios). */
export const MAXIMO_NOMBRE = 60;
const MAXIMO_CORREO = 200;
// Deliberadamente laxa: solo descarta lo que claramente no es un correo. La
// verdad la tiene el buzón de la persona, no una expresión regular.
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function nombreVisible(u: UsuarioMostrable): string {
  const completo = [u.nombre, u.apellido].map((p) => p?.trim() ?? '').filter(Boolean).join(' ');
  return completo || u.email;
}

/** Comparador para `sort`: apellido, nombre, y al final quien no tenga ninguno. */
export function ordenUsuarios(a: UsuarioMostrable, b: UsuarioMostrable): number {
  const cmp = (x: string, y: string) => x.localeCompare(y, 'es', { sensitivity: 'base' });
  const conNombre = (u: UsuarioMostrable) => Boolean(u.nombre?.trim() || u.apellido?.trim());
  if (conNombre(a) !== conNombre(b)) return conNombre(a) ? -1 : 1;
  if (!conNombre(a)) return cmp(a.email, b.email);
  const porApellido = cmp(a.apellido?.trim() ?? '', b.apellido?.trim() ?? '');
  return porApellido !== 0 ? porApellido : cmp(a.nombre?.trim() ?? '', b.nombre?.trim() ?? '');
}

export type DatosUsuario = { nombre?: string | null; apellido?: string | null; email?: string };

/**
 * Reglas para editar los datos de identidad de alguien. Pura: la unicidad del
 * correo la decide la restricción única de la base, no esta función.
 */
export function validarDatosUsuario(
  actor: UsuarioSesion,
  objetivoId: string,
  datos: DatosUsuario,
): { ok: true; datos: DatosUsuario } | { ok: false; error: string } {
  const pide = (c: keyof DatosUsuario) => datos[c] !== undefined;
  if (!pide('nombre') && !pide('apellido') && !pide('email')) return { ok: false, error: 'sin-cambios' };
  if (actor.rol !== 'admin' && actor.id !== objetivoId) return { ok: false, error: 'solo-admin' };
  if (pide('email') && actor.rol !== 'admin') return { ok: false, error: 'solo-admin-correo' };

  const limpios: DatosUsuario = {};
  for (const campo of ['nombre', 'apellido'] as const) {
    if (!pide(campo)) continue;
    const valor = (datos[campo] ?? '').trim();
    if (valor.length > MAXIMO_NOMBRE) return { ok: false, error: `${campo}-largo` };
    limpios[campo] = valor || null;
  }
  if (pide('email')) {
    const valor = (datos.email ?? '').trim().toLowerCase();
    if (!valor || valor.length > MAXIMO_CORREO || !CORREO.test(valor)) return { ok: false, error: 'correo-invalido' };
    limpios.email = valor;
  }
  return { ok: true, datos: limpios };
}
