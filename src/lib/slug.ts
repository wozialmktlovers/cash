/**
 * Nombre de negocio a segmento de URL.
 *
 * Es cosmético y nunca sustituye al token: el token es lo único que protege
 * el documento. Si el link fuera solo el nombre, adivinar el de otro cliente
 * bastaría para leer su campaña.
 */
export function slugificar(nombre: string): string {
  const s = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  // Un nombre que se queda sin letras utilizables no puede romper la ruta.
  return s || 'cliente';
}
