// El esquema de lo que devuelve el agente del mes, tolerante por diseño
// (lección de 6e88ba5 y 87ea948): **recorta en vez de rechazar**. Un copy de
// 2300 caracteres se corta a 2200 con elipsis; un hashtag con espacio se
// descarta y los demás se quedan; una pieza sin copy se cae de la tanda y las
// otras siete se guardan. Rechazar la respuesta entera por un detalle de forma
// costaba una segunda llamada, y a veces la tanda completa.
//
// Lo único que el esquema exige de verdad es lo que haría inútil a la pieza:
// que tenga copy y que diga a qué ranura pertenece (`ref`, que el normalizador
// ya rellena por posición si faltaba).

import { z } from 'zod';
import { aArreglo, aTexto, recortar } from '@/research/normalizar';
import { ID_TEMA } from '@/pilares/schemas';
import { LIMITES_PIEZA, PLATAFORMAS, type Escena, type Plataforma } from '../reglas';

/**
 * Un campo que puede faltar o venir en cualquier forma. `optional()` va ANTES
 * del `transform` a propósito: en Zod 4, una llave cuyo esquema no es opcional
 * es obligatoria aunque acepte `unknown`, y una pieza sin `cta` se caería.
 */
const suelto = () => z.unknown().optional();

/** Texto de cualquier forma (arreglo, objeto, número), sin espacios de sobra y recortado a `max`. */
const textoRecortado = (max: number) => suelto().transform((v) => recortar(aTexto(v).trim(), max));

/** Un hashtag publicable: una sola palabra de letras, números o guion bajo. */
const HASHTAG_RE = /^#[\p{L}\p{N}_]{2,60}$/u;

/**
 * Hashtags en una línea, como los guarda la pieza: se aceptan en lista o en
 * texto, con o sin almohadilla; se quitan los que no se pueden publicar y los
 * repetidos, y se dejan diez como máximo.
 */
export function hashtagsEnLinea(v: unknown): string {
  const crudos = aArreglo(v).flatMap((h) => aTexto(h).split(/[\s,;]+/));
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const c of crudos) {
    const h = `#${c.trim().replace(/^#+/, '')}`;
    if (!HASHTAG_RE.test(h) || vistos.has(h.toLowerCase())) continue;
    vistos.add(h.toLowerCase());
    salida.push(h);
    if (salida.length === 10) break;
  }
  return recortar(salida.join(' '), LIMITES_PIEZA.hashtags);
}

const escenaSchema = z.object({
  visual: textoRecortado(LIMITES_PIEZA.escena),
  texto: textoRecortado(LIMITES_PIEZA.escena),
});

const guionSchema = suelto().transform((v): Escena[] => aArreglo(v)
  .map((e) => escenaSchema.safeParse(e))
  .filter((r) => r.success)
  .map((r) => r.data!)
  .filter((e) => e.visual || e.texto)
  .slice(0, LIMITES_PIEZA.escenas));

const tarjetasSchema = suelto().transform((v): string[] => aArreglo(v)
  .map((t) => recortar(aTexto(t).trim(), LIMITES_PIEZA.tarjeta))
  .filter((t) => t !== '')
  .slice(0, LIMITES_PIEZA.tarjetas));

/** Una pieza de la tanda, tal como la escribió el modelo y ya limpia. */
export const piezaMesSchema = z.object({
  ref: z.coerce.number().int().positive(),
  temaId: suelto().transform((v) => {
    const t = aTexto(v).trim().toUpperCase();
    return ID_TEMA.test(t) ? t : null;
  }),
  plataforma: suelto().transform((v): Plataforma => ((PLATAFORMAS as readonly unknown[]).includes(v) ? (v as Plataforma) : 'ambas')),
  fecha: suelto().transform((v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
  copy: textoRecortado(LIMITES_PIEZA.copy).pipe(z.string().min(1, 'La pieza no trae copy.')),
  cta: textoRecortado(LIMITES_PIEZA.cta),
  hashtags: suelto().transform(hashtagsEnLinea),
  briefVisual: textoRecortado(LIMITES_PIEZA.briefVisual),
  promptImagen: textoRecortado(LIMITES_PIEZA.promptImagen),
  guion: guionSchema,
  tarjetas: tarjetasSchema,
});
export type PiezaMes = z.infer<typeof piezaMesSchema>;

/**
 * La tanda: una lista de piezas, cada una validada aparte. La que no pasa se
 * cae sola en vez de tumbar a las demás (mismo patrón que `reemplazosSchema`
 * del mapa de pilares). Una tanda sin ninguna pieza útil sí se rechaza: es la
 * señal para que `pedirJson` intente corregirla o rescatarla.
 */
export const tandaMesSchema = z.object({
  piezas: z.array(z.unknown()),
}).transform((v, ctx): { piezas: PiezaMes[] } => {
  const piezas: PiezaMes[] = [];
  const vistas = new Set<number>();
  for (const item of v.piezas) {
    const r = piezaMesSchema.safeParse(item);
    // Dos piezas para la misma ranura: se queda la primera.
    if (r.success && !vistas.has(r.data.ref)) { vistas.add(r.data.ref); piezas.push(r.data); }
  }
  if (piezas.length === 0 && v.piezas.length > 0) {
    ctx.addIssue({ code: 'custom', message: 'Ninguna pieza trae copy: cada pieza necesita al menos su «copy».' });
    return z.NEVER;
  }
  return { piezas };
});
export type TandaMes = z.infer<typeof tandaMesSchema>;
