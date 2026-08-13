import { z } from 'zod';

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  giro: z.string().trim().min(1, 'El giro es obligatorio'),
  producto: z.string().trim().min(1, 'El producto es obligatorio'),
  ciudad: opcional,
  ticket: opcional,
  contacto: opcional,
  notas: opcional,
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export function validarCliente(datos: unknown):
  | { ok: true; datos: ClienteInput }
  | { ok: false; errores: string[] } {
  const r = clienteSchema.safeParse(datos);
  if (r.success) return { ok: true, datos: r.data };
  return { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
