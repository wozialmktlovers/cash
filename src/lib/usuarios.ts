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
  // además no tendría portal que ver. Hay que invitarlo de nuevo a un cliente.
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
