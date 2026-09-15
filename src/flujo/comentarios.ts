// Reglas puras de los comentarios anclados (spec §3, «Comentarios anclados»;
// spec §4, «observaciones del cliente»). Sin acceso a base de datos: el
// servicio y las rutas de API (B7) se apoyan en estas para validar el cuerpo,
// decidir quién puede cambiar el estado de un comentario y filtrar qué ve
// cada rol. El formato del ancla es el mismo que escriben los renders
// (`data-ancla`, ./editorial/flujo-cliente.ts): secciones (`seccion:<id>`),
// tarjetas (la ruta del objeto) y temas (`tema:P2-S1-07`).

import type { Rol } from './reglas';

export const ESTADOS_COMENTARIO = ['abierto', 'atendido', 'descartado'] as const;
export type EstadoComentario = (typeof ESTADOS_COMENTARIO)[number];

const ANCLA_RE = /^[\w:.-]+$/;

/**
 * `texto`: de 1 a 2000 caracteres después de `trim`. `ancla`: de 1 a 200
 * caracteres, solo letras, dígitos, `_`, `:`, `.` y `-` (cubre `seccion:x`,
 * `tema:P2-S1-07` y rutas con puntos como `lectura.datos.descubrimos.2`).
 */
export function validarComentario(o: { texto: string; ancla: string }): { ok: true; texto: string; ancla: string } | { ok: false; errores: string[] } {
  const errores: string[] = [];

  const texto = typeof o.texto === 'string' ? o.texto.trim() : '';
  if (texto.length === 0) errores.push('Escribe el comentario');
  else if (texto.length > 2000) errores.push('El comentario no puede pasar de 2000 caracteres');

  const ancla = typeof o.ancla === 'string' ? o.ancla : '';
  if (ancla.length === 0 || ancla.length > 200) errores.push('El ancla no es válida');
  else if (!ANCLA_RE.test(ancla)) errores.push('El ancla no es válida');

  if (errores.length) return { ok: false, errores };
  return { ok: true, texto, ancla };
}

/**
 * Quién puede llevar un comentario a `nuevo` (spec §3, «panel lateral de
 * comentarios»):
 * - `atendido`: el operador asignado o un admin.
 * - `descartado`: solo un admin.
 * - `abierto` (reabrir uno ya atendido/descartado): solo un admin.
 * El cliente nunca cambia el estado de un comentario.
 */
export function puedeCambiarEstadoComentario(rol: Rol, esOperadorAsignado: boolean, nuevo: EstadoComentario): boolean {
  if (rol === 'cliente') return false;
  if (rol === 'admin') return true;
  // operador: solo si tiene el cliente asignado, y solo hacia 'atendido'.
  return esOperadorAsignado && nuevo === 'atendido';
}

export type ComentarioVisibilidad = { id: string; autorId: string | null; respuestaDe: string | null };

/**
 * Qué comentarios ve cada rol (spec §3, «El cliente ve sus comentarios y su
 * estado, no los internos»): el personal ve la lista completa tal cual llega
 * (la consulta ya la filtró por documento/versión); el cliente solo ve los
 * hilos que él mismo abrió (comentarios de primer nivel de su autoría) más
 * todas las respuestas dentro de esos hilos, sin importar quién respondió.
 */
export function comentariosVisibles<T extends ComentarioVisibilidad>(rol: Rol, usuarioId: string, lista: T[]): T[] {
  if (rol !== 'cliente') return lista;

  const hilosPropios = new Set(
    lista.filter((c) => c.respuestaDe === null && c.autorId === usuarioId).map((c) => c.id),
  );
  return lista.filter((c) => {
    if (c.respuestaDe === null) return c.autorId === usuarioId;
    return hilosPropios.has(c.respuestaDe);
  });
}
