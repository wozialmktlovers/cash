import { z } from 'zod';

// Opcionales de Datos: vaciarlo guarda `null` (así se puede borrar desde la
// ficha, que manda "" en los campos vacíos) y no mandarlo lo deja como estaba.
// Antes "" se convertía en «no tocar» y el valor viejo nunca se borraba.
const opcional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

/** Tope de «Objetivos y líneas de investigación». El formulario muestra el mismo. */
export const OBJETIVOS_MAX = 2000;

/**
 * Objetivos del cliente. Como los otros opcionales, vaciarlo
 * guarda `null` (se puede borrar desde la ficha) y no mandarlo lo deja como
 * estaba. Los saltos de línea se normalizan antes de contar: un `<textarea>`
 * los envía como CRLF, y sin esto un texto que el contador del navegador da
 * por bueno pasaría del tope aquí.
 */
const objetivos = z
  .string()
  .transform((v) => v.replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().max(OBJETIVOS_MAX, `Los objetivos admiten hasta ${OBJETIVOS_MAX} caracteres`))
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional();

export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  giro: z.string().trim().min(1, 'El giro es obligatorio'),
  producto: z.string().trim().min(1, 'El producto es obligatorio'),
  ciudad: opcional,
  ticket: opcional,
  contacto: opcional,
  notas: opcional,
  objetivos,
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export function validarCliente(datos: unknown):
  | { ok: true; datos: ClienteInput }
  | { ok: false; errores: string[] } {
  const r = clienteSchema.safeParse(datos);
  if (r.success) return { ok: true, datos: r.data };
  return { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}

export type ResumenCliente = { id: string; nombre: string; giro: string; ciudad: string | null };

/**
 * Lo que la paleta ⌘K puede ver de un cliente. Se arma campo por campo para
 * que añadir columnas a la tabla nunca las filtre a la respuesta.
 */
export function resumenCliente(c: ResumenCliente): ResumenCliente {
  return { id: c.id, nombre: c.nombre, giro: c.giro, ciudad: c.ciudad };
}
