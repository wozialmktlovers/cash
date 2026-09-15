import { ESTADOS_TEMA, type EstadoTema, type MapaPilares } from './schemas';
import { todosLosTemas } from './revision';

export type AvanceTema = { estado: EstadoTema; nota: string | null; actualizadoPor: string | null; actualizadoEn: string };

export function temaExiste(datos: unknown, temaId: string): boolean {
  const pilares = (datos as MapaPilares | null)?.pilares;
  if (!Array.isArray(pilares)) return false;
  return todosLosTemas(pilares).some((t) => t.id === temaId);
}

export function validarCambioTema(cuerpo: unknown):
  | { ok: true; estado?: EstadoTema; nota?: string | null }
  | { ok: false; errores: string[] } {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, errores: ['El cuerpo debe ser un objeto.'] };
  const c = cuerpo as Record<string, unknown>;
  const salida: { ok: true; estado?: EstadoTema; nota?: string | null } = { ok: true };
  if ('estado' in c) {
    if (!ESTADOS_TEMA.includes(c.estado as EstadoTema)) return { ok: false, errores: ['Estado no válido.'] };
    salida.estado = c.estado as EstadoTema;
  }
  if ('nota' in c) {
    if (c.nota !== null && typeof c.nota !== 'string') return { ok: false, errores: ['La nota debe ser texto.'] };
    const nota = typeof c.nota === 'string' ? c.nota.trim() : '';
    if (nota.length > 2000) return { ok: false, errores: ['La nota admite hasta 2000 caracteres.'] };
    salida.nota = nota || null;
  }
  if (!('estado' in salida) && !('nota' in salida)) return { ok: false, errores: ['Nada que actualizar.'] };
  return salida;
}
