import { randomBytes, createHash } from 'node:crypto';
import type { Rol, UsuarioSesion } from '@/lib/permisos';

const DIAS_VENCIMIENTO = 7;

/** El token viaja solo en el enlace; en la base queda su hash, como una contraseña. */
export function generarInvitacion(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function vencimiento(desde: Date): Date {
  return new Date(desde.getTime() + DIAS_VENCIMIENTO * 86400_000);
}

export type InvitacionEstado = 'valida' | 'vencida' | 'usada' | 'inexistente' | 'revocada';

export function estadoInvitacion(inv: { expiraEn: Date; usadaEn: Date | null } | null, ahora: Date): 'valida' | 'vencida' | 'usada' | 'inexistente' {
  if (!inv) return 'inexistente';
  if (inv.usadaEn) return 'usada';
  if (inv.expiraEn < ahora) return 'vencida';
  return 'valida';
}

/**
 * `estadoInvitacion` solo mira fechas. Esta función añade el chequeo de
 * autoridad: quien creó la invitación pudo perder, desde entonces, el poder
 * para haberla emitido (lo desactivaron, lo reasignaron de cliente, al
 * cliente le cambiaron de operador). En ese caso la invitación sigue sin
 * vencer ni usarse, pero ya no es válida: queda `revocada`.
 */
export function invitacionVigente(
  inv: { expiraEn: Date; usadaEn: Date | null; rol: Rol } | null,
  creador: UsuarioSesion | null,
  cliente: { id: string; operadorId: string | null } | null,
  ahora: Date,
): InvitacionEstado {
  const estado = estadoInvitacion(inv, ahora);
  if (estado !== 'valida') return estado;
  if (!creador || !creador.activo || !puedeInvitar(creador, inv!.rol, cliente)) return 'revocada';
  return 'valida';
}

/**
 * Pendiente = todavía se puede aceptar por fecha: sin usar y sin vencer. Es
 * lo que listan la ficha del cliente y `/admin/usuarios` con su botón
 * «Revocar» (fix menores M2, punto 4); una vencida o usada ya no hace falta
 * revocarla.
 */
export function esPendiente(inv: { expiraEn: Date; usadaEn: Date | null }, ahora: Date): boolean {
  return estadoInvitacion(inv, ahora) === 'valida';
}

export function validarAceptacion(o: { nombre: string; password: string; confirmacion: string }): { ok: true } | { ok: false; errores: string[] } {
  const errores: string[] = [];
  if (!o.nombre || !o.nombre.trim()) errores.push('El nombre es obligatorio');
  if (!o.password || o.password.length < 12) errores.push('La contraseña debe tener al menos 12 caracteres');
  if (o.password !== o.confirmacion) errores.push('Las contraseñas no coinciden');
  return errores.length ? { ok: false, errores } : { ok: true };
}

/** Admin invita cualquier rol; operador solo `cliente` de un cliente que tenga asignado. */
export function puedeInvitar(u: UsuarioSesion, rol: Rol, cliente: { id: string; operadorId: string | null } | null): boolean {
  if (u.rol === 'admin') return true;
  if (u.rol === 'operador') return rol === 'cliente' && !!cliente && cliente.operadorId === u.id;
  return false;
}
