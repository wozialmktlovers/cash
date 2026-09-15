import { toast } from './toast';

/**
 * Sin permiso de portapapeles (http local, Safari antiguo) deja el texto
 * seleccionado en su campo para que baste con ⌘C.
 */
export async function copiar(texto: string, campo?: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Link copiado');
  } catch {
    campo?.focus();
    campo?.select();
    toast('Cópialo con ⌘C');
  }
}
