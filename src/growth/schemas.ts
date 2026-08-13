import { z } from 'zod';

/**
 * Estructura fija de la casa. No la decide el modelo: la impone el esquema.
 *
 * 3 campañas Meta (grupos a, b, c) × 3 formatos = 9 creativos.
 * + 5 campañas de Google = 14 URLs etiquetadas.
 *
 * Los tres números de la portada del machote son la misma estructura contada
 * de tres maneras, y por eso se derivan en vez de escribirse a mano.
 */
export const GRUPOS = ['a', 'b', 'c'] as const;
export const FORMATOS = ['imagen', 'video', 'carrusel'] as const;
export const CLAVES_GOOGLE = ['marca', 'categoria', 'precio', 'geo', 'contenido'] as const;

/** El ratio no lo elige el modelo: lo dicta el formato, y el machote lo fija. */
export const RATIO_POR_FORMATO = {
  imagen: '1x1',
  carrusel: '4x5',
  video: '9x16',
} as const;

export const campanaMetaSchema = z.object({
  grupo: z.enum(GRUPOS),
  nombre: z.string().trim().min(1),
  objetivo: z.string().trim().min(1),
  audiencia: z.string().trim().min(1),
  angulo: z.string().trim().min(1),
});

export const campanaGoogleSchema = z.object({
  clave: z.enum(CLAVES_GOOGLE),
  nombre: z.string().trim().min(1),
  intencion: z.string().trim().min(1),
});

export const creativoSchema = z.object({
  grupo: z.enum(GRUPOS),
  formato: z.enum(FORMATOS),
  ratio: z.enum(['1x1', '4x5', '9x16']),
  medidas: z.string().trim().min(1),
  angulo: z.string().trim().min(1),
  copyA: z.string().trim().min(1),
  copyB: z.string().trim().min(1),
});

export const keywordsSchema = z.object({
  clave: z.enum(CLAVES_GOOGLE),
  keywords: z.array(z.string().trim().min(1)).min(1),
  negativas: z.array(z.string().trim().min(1)),
});

export const growthSchema = z.object({
  // Lo único variable de la portada. El machote deja [N] Semanas como marcador
  // y fija los demás números.
  semanas: z.number().int().min(2).max(12),

  campanasMeta: z.array(campanaMetaSchema).length(3),
  campanasGoogle: z.array(campanaGoogleSchema).length(5),
  creativos: z.array(creativoSchema).length(9),

  promptsImagen: z.object({
    base: z.string().trim().min(1),
    porCreativo: z.array(z.string().trim().min(1)).length(9),
  }),

  googleKeywords: z.array(keywordsSchema).length(5),

  rsa: z.object({
    // Límites reales de Google Ads. Un titular de 31 caracteres no se puede
    // cargar, así que dejarlo pasar sería entregarle al cliente un manual que
    // no se puede ejecutar.
    titulares: z.array(z.string().trim().min(1).max(30)).length(15),
    descripciones: z.array(z.string().trim().min(1).max(90)).length(4),
  }),

  bloqueantes: z.array(z.string().trim().min(1)).min(1),
  reglasCopy: z.array(z.string().trim().min(1)).min(1),
});

export type Growth = z.infer<typeof growthSchema>;
export type CampanaMeta = z.infer<typeof campanaMetaSchema>;
export type CampanaGoogle = z.infer<typeof campanaGoogleSchema>;
export type Creativo = z.infer<typeof creativoSchema>;

/**
 * Sub-esquemas por agente. Cada uno valida solo su trozo, para que el fallo de
 * una etapa no invalide el trabajo de las otras tres.
 */
export const estructuraSchema = growthSchema.pick({
  semanas: true, campanasMeta: true, campanasGoogle: true,
  bloqueantes: true, reglasCopy: true,
});
export const creativosSchema = growthSchema.pick({ creativos: true });
export const googleSchema = growthSchema.pick({ googleKeywords: true, rsa: true });
export const promptsSchema = growthSchema.pick({ promptsImagen: true });

export type Estructura = z.infer<typeof estructuraSchema>;
export type Creativos = z.infer<typeof creativosSchema>;
export type GoogleDatos = z.infer<typeof googleSchema>;
export type Prompts = z.infer<typeof promptsSchema>;
