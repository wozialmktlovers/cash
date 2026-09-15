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

export type InvitacionEstado = 'valida' | 'vencida' | 'usada' | 'inexistente';

export function estadoInvitacion(inv: { expiraEn: Date; usadaEn: Date | null } | null, ahora: Date): InvitacionEstado {
  if (!inv) return 'inexistente';
  if (inv.usadaEn) return 'usada';
  if (inv.expiraEn < ahora) return 'vencida';
  return 'valida';
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
