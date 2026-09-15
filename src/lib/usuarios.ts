import type { Rol, UsuarioSesion } from '@/lib/permisos';

export type ObjetivoUsuario = { id: string; rol: Rol; activo: boolean };
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
