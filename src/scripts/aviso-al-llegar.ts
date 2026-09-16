import { toast } from './toast';

const CLAVE = 'wozial:aviso';

/**
 * Deja un aviso para la página a la que estamos a punto de navegar. Se usa
 * cuando la acción termina y la pantalla donde se hizo ya no existe (borrar un
 * cliente: el toast en la ficha no alcanzaría a leerse antes del salto).
 *
 * `sessionStorage` puede lanzar (modo privado, almacenamiento bloqueado): si
 * falla, se pierde el aviso, nunca la navegación.
 */
export function avisarEnLaSiguiente(mensaje: string, tipo: 'ok' | 'error' = 'ok') {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify({ mensaje, tipo }));
  } catch {
    /* sin almacén no hay aviso, y ya. */
  }
}

/** Muestra —una sola vez— el aviso que dejó la página anterior, si lo hubo. */
export function mostrarAvisoPendiente() {
  let crudo: string | null = null;
  try {
    crudo = sessionStorage.getItem(CLAVE);
    // Se retira antes de mostrarlo: recargar la página no debe repetirlo.
    sessionStorage.removeItem(CLAVE);
  } catch {
    return;
  }
  if (!crudo) return;
  try {
    const { mensaje, tipo } = JSON.parse(crudo) as { mensaje?: unknown; tipo?: unknown };
    if (typeof mensaje === 'string' && mensaje) toast(mensaje, tipo === 'error' ? 'error' : 'ok');
  } catch {
    /* basura en el almacén: se ignora. */
  }
}
