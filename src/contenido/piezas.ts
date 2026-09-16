// Validación del cuerpo con que se da de alta o se edita una pieza del lote
// mensual (diseño §4). Puro: entra `unknown`, sale o los datos ya limpios o la
// lista de errores en español, sin tocar la base ni Astro.
//
// Vive aparte de las rutas porque las dos operaciones comparten casi todos los
// campos —`POST /api/contenido/lotes/[id]/piezas` los exige, `PATCH
// /api/contenido/piezas/[id]` los acepta sueltos— y tenerlos en dos archivos
// los dejaría discrepar. Mismo reparto que `validarCliente` (src/lib/clientes.ts)
// y `validarCambioTema` (src/pilares/avance.ts).
//
// Lo que estas funciones NO miran, a propósito:
//
// - **Que el tema exista.** `contenido_piezas.tema_id` no tiene clave foránea
//   (ver el comentario de la columna: el mapa vive en un JSON y `pilares_temas`
//   solo tiene fila para los temas que alguien tocó), así que aquí solo se
//   comprueba la FORMA del id con `ID_TEMA`. La pantalla de B3 elige el tema de
//   una lista, que es donde la existencia sí se puede garantizar.
// - **Cuántos artes lleva cada formato.** El diseño §4 lo dice (post 1 imagen,
//   carrusel de 2 a 10, reel portada + video o enlace, historia 1), pero es una
//   regla de pieza TERMINADA: exigirla en el alta impediría crear la pieza
//   antes de tener el arte, que es justo el orden en que se trabaja el mes. El
//   tope duro de 10 sí se aplica, porque nada del diseño lleva más.
// - **Que el estado de revisión cambie.** `estado_cliente`, `nota_cliente` y
//   `revisado_en` son del cliente y de su ruta (C2). Un cuerpo que los traiga
//   se rechaza en vez de ignorarse en silencio: el operador no aprueba sus
//   propias piezas.

import { z } from 'zod';
import { ID_TEMA } from '@/pilares/schemas';
import { FORMATOS, PLATAFORMAS, PROTOCOLO_ARTE, type EstadoRevision, type Formato, type Plataforma } from './reglas';
// El tope del brief se importa, no se copia: es el mismo largo con que el
// agente escribe la propuesta (`opcionCopySchema`), y dos números separados
// dejarían guardar un brief que el modelo nunca podría producir, o al revés.
import { LIMITES } from './schemas';

/** Dónde se publica la pieza; el enum `plataforma_pieza` de la base. */

/** Qué es cada arte de la lista de `contenido_piezas.arte`. */
export const TIPOS_ARTE = ['imagen', 'video', 'portada'] as const;
export type TipoArte = (typeof TIPOS_ARTE)[number];

/** Un arte: o un archivo subido (`fileId` de `client_files`) o un enlace externo. */
export type Arte = { tipo: TipoArte; fileId?: string; url?: string };

/** Tope de artes por pieza: el carrusel, que es el formato más largo, llega a 10 (diseño §4). */
export const MAX_ARTES = 10;

/** Campos que solo la revisión del cliente (C2) puede tocar; aquí se rechazan. */
const CAMPOS_DEL_CLIENTE = ['estadoCliente', 'notaCliente', 'revisadoEn', 'estado_cliente', 'nota_cliente'] as const;

const arteSchema = z
  .object({
    tipo: z.enum(TIPOS_ARTE, { message: 'El tipo de arte no es válido.' }),
    fileId: z.uuid('El archivo del arte no es válido.').optional(),
    // **El esquema del enlace se comprueba aquí, y no basta con `z.url()`.**
    // `z.url()` (zod 4.4.3) solo pide que la cadena parsee como URL: acepta
    // `javascript:alert(1)`, `data:text/html,…`, `vbscript:` y `file:`. Ese
    // enlace acaba en el `href` de «Ver el reel» y en el `src`/`poster` del
    // visor del entregable, que abre el CLIENTE en el origen del Studio y con
    // su sesión: `escapar` le pone a salvo las comillas, pero el esquema no lo
    // mira nadie. Un operador (o un admin) podría así ejecutar script en la
    // pestaña de un cliente — escalada operador → cliente.
    //
    // `PROTOCOLO_ARTE` (./reglas.ts) es la lista blanca `http`/`https`, la
    // misma que usa el render para defenderse de lo que ya esté guardado.
    // Cortar aquí es lo que cierra la puerta: `POST /api/contenido/lotes/[id]/piezas`
    // y `PATCH /api/contenido/piezas/[id]` son los dos únicos caminos por los
    // que un arte entra a la base.
    url: z
      .url({ protocol: PROTOCOLO_ARTE, error: 'El enlace del arte debe empezar con http:// o https://.' })
      .max(2000, 'El enlace del arte es demasiado largo.')
      .optional(),
  })
  // Uno u otro, nunca los dos: con ambos no habría forma de saber cuál pinta
  // el entregable, y con ninguno el arte no apunta a nada.
  .refine((a) => (a.fileId === undefined) !== (a.url === undefined), {
    message: 'Cada arte lleva un archivo o un enlace, no los dos ni ninguno.',
  });

const campos = {
  // El número lo pone el operador al planear el mes y es lo que ve el cliente
  // («pieza 7 de septiembre»), así que es un entero positivo y no un índice.
  numero: z.int().min(1, 'El número de la pieza empieza en 1.').max(999, 'El número de la pieza no puede pasar de 999.'),
  formato: z.enum(FORMATOS, { message: 'El formato no es válido.' }),
  plataforma: z.enum(PLATAFORMAS, { message: 'La plataforma no es válida.' }),
  // `null` es un valor legítimo: una pieza puede no tener fecha todavía.
  fechaPublicacion: z.iso.date('La fecha de publicación debe ser una fecha real en formato AAAA-MM-DD.').nullable(),
  temaId: z.string().regex(ID_TEMA, 'El tema no es válido.').nullable(),
  copy: z.string().max(2200, 'El copy no puede pasar de 2200 caracteres.'),
  cta: z.string().trim().max(120, 'El llamado a la acción no puede pasar de 120 caracteres.'),
  hashtags: z.string().trim().max(600, 'Los hashtags no pueden pasar de 600 caracteres.'),
  // La indicación para quien haga el arte, la que venía en la opción elegida
  // (diseño §5). Se edita a mano como el resto del texto, así que aquí solo se
  // mide; vacío es legítimo, igual que un copy todavía sin escribir.
  briefVisual: z.string().trim().max(LIMITES.briefVisual, `El brief visual no puede pasar de ${LIMITES.briefVisual} caracteres.`),
  arte: z.array(arteSchema).max(MAX_ARTES, `Una pieza no lleva más de ${MAX_ARTES} artes.`),
};

/**
 * Alta: formato y plataforma son obligatorios —sin ellos la pieza no se puede
 * ni pintar ni contar contra el paquete—; el resto tiene valor por omisión,
 * el mismo que la base. `numero` se omite para que la ruta lo asigne sola.
 */
const altaSchema = z.object({
  numero: campos.numero.optional(),
  formato: campos.formato,
  plataforma: campos.plataforma,
  fechaPublicacion: campos.fechaPublicacion.optional().transform((v) => v ?? null),
  temaId: campos.temaId.optional().transform((v) => v ?? null),
  copy: campos.copy.default(''),
  cta: campos.cta.default(''),
  hashtags: campos.hashtags.default(''),
  briefVisual: campos.briefVisual.default(''),
  arte: campos.arte.default([]),
});

/** Edición: todo suelto, y al menos un campo. */
const cambioSchema = z.object({
  numero: campos.numero.optional(),
  formato: campos.formato.optional(),
  plataforma: campos.plataforma.optional(),
  fechaPublicacion: campos.fechaPublicacion.optional(),
  temaId: campos.temaId.optional(),
  copy: campos.copy.optional(),
  cta: campos.cta.optional(),
  hashtags: campos.hashtags.optional(),
  briefVisual: campos.briefVisual.optional(),
  arte: campos.arte.optional(),
});

export type NuevaPieza = z.infer<typeof altaSchema>;
export type CambioPieza = z.infer<typeof cambioSchema>;

type Resultado<T> = { ok: true; datos: T } | { ok: false; errores: string[] };

const errores = (r: z.ZodError): string[] => r.issues.map((i) => i.message);

/** Un objeto plano, o `null` si lo que llegó no lo es. */
function comoObjeto(cuerpo: unknown): Record<string, unknown> | null {
  return cuerpo !== null && typeof cuerpo === 'object' && !Array.isArray(cuerpo)
    ? (cuerpo as Record<string, unknown>)
    : null;
}

/** El cuerpo trae algo que solo la revisión del cliente puede escribir. */
function intentaRevisar(c: Record<string, unknown>): boolean {
  return CAMPOS_DEL_CLIENTE.some((campo) => campo in c);
}

export function validarNuevaPieza(cuerpo: unknown): Resultado<NuevaPieza> {
  const c = comoObjeto(cuerpo);
  if (!c) return { ok: false, errores: ['El cuerpo debe ser un objeto.'] };
  if (intentaRevisar(c)) return { ok: false, errores: ['El estado de revisión lo pone el cliente, no el operador.'] };

  const r = altaSchema.safeParse(c);
  return r.success ? { ok: true, datos: r.data } : { ok: false, errores: errores(r.error) };
}

export function validarCambioPieza(cuerpo: unknown): Resultado<CambioPieza> {
  const c = comoObjeto(cuerpo);
  if (!c) return { ok: false, errores: ['El cuerpo debe ser un objeto.'] };
  if (intentaRevisar(c)) return { ok: false, errores: ['El estado de revisión lo pone el cliente, no el operador.'] };

  const r = cambioSchema.safeParse(c);
  if (!r.success) return { ok: false, errores: errores(r.error) };

  // `safeParse` deja fuera las claves ausentes, así que un objeto vacío de
  // salida es literalmente «no pidió cambiar nada». Se distingue de «pidió
  // cambiar algo a su mismo valor», que sí pasa: comparar contra la fila
  // guardada no le toca a una función pura.
  if (Object.keys(r.data).length === 0) return { ok: false, errores: ['Nada que actualizar.'] };
  return { ok: true, datos: r.data };
}

/**
 * La fila de `contenido_piezas` tal como sale de Drizzle, en lo que a esta
 * función le importa. `arte` llega como `unknown` porque es `jsonb`: la forma
 * la pone el código (ver el comentario de la columna en `src/db/schema.ts`),
 * no el tipo.
 */
export type FilaPieza = {
  id: string;
  loteId: string;
  numero: number;
  formato: Formato;
  plataforma: Plataforma;
  fechaPublicacion: string | null;
  temaId: string | null;
  copy: string;
  cta: string;
  hashtags: string;
  briefVisual: string;
  arte: unknown;
  estadoCliente: EstadoRevision;
  notaCliente: string | null;
  revisadoEn: Date | null;
  actualizadoEn: Date;
};

/** Lo que devuelve la API por cada pieza. */
export type PiezaVisible = Omit<FilaPieza, 'arte'> & { arte: Arte[] };

/**
 * Arma la respuesta campo por campo, como `resumenCliente` (src/lib/clientes.ts):
 * así, añadir una columna a `contenido_piezas` nunca la filtra sola a la
 * respuesta. `creado_en` se queda fuera a propósito: quien pinta la pieza usa
 * `numero` para ordenar y `actualizado_en` para saber si se movió.
 */
export function piezaVisibleJson(p: FilaPieza): PiezaVisible {
  return {
    id: p.id,
    loteId: p.loteId,
    numero: p.numero,
    formato: p.formato,
    plataforma: p.plataforma,
    fechaPublicacion: p.fechaPublicacion,
    temaId: p.temaId,
    copy: p.copy,
    cta: p.cta,
    hashtags: p.hashtags,
    briefVisual: p.briefVisual,
    arte: (Array.isArray(p.arte) ? p.arte : []) as Arte[],
    estadoCliente: p.estadoCliente,
    notaCliente: p.notaCliente,
    revisadoEn: p.revisadoEn,
    actualizadoEn: p.actualizadoEn,
  };
}
