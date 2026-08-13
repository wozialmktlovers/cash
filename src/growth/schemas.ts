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


/* ── Segmentación de Meta ──────────────────────────────────────────────
   El machote pide «todos los campos que pide el administrador de anuncios,
   con el valor exacto a capturar en cada uno». Eso es lo que separa un
   resumen de un documento que se puede ejecutar sin pensar, así que la
   estructura de esta sección es tan fija como la de las campañas. */

export const perfilSchema = z.object({
  inicial: z.string().trim().length(1),
  nombre: z.string().trim().min(1),
  edad: z.number().int().min(16).max(90),
  ciudad: z.string().trim().min(1),
  titular: z.string().trim().min(1),
  etiqueta: z.string().trim().min(1),
  campos: z.array(z.object({
    campo: z.string().trim().min(1),
    valor: z.string().trim().min(1),
  })).min(6).max(10),
});

export const capaSchema = z.object({
  nombre: z.string().trim().min(1),
  proposito: z.string().trim().min(1),
  intereses: z.array(z.string().trim().min(1)).min(3).max(14),
  nota: z.string().trim().optional(),
});

export const audienciaPersonalizadaSchema = z.object({
  audiencia: z.string().trim().min(1),
  fuente: z.string().trim().min(1),
  ventana: z.string().trim().min(1),
  usarEn: z.string().trim().min(1),
  nombreSugerido: z.string().trim().min(1),
});

export const segmentacionSchema = z.object({
  perfiles: z.array(perfilSchema).length(2),
  notaSegmentacion: z.string().trim().min(1),
  // Una fila por campo del administrador, con su valor para cada campaña.
  configuracion: z.array(z.object({
    campo: z.string().trim().min(1),
    m1: z.string().trim().min(1),
    m2: z.string().trim().min(1),
    m3: z.string().trim().min(1),
  })).min(8).max(14),
  capas: z.array(capaSchema).length(3),
  combinaciones: z.array(z.object({
    conjunto: z.string().trim().min(1),
    combinacion: z.string().trim().min(1),
  })).min(3).max(6),
  noSegmentar: z.array(z.string().trim().min(1)).min(3).max(8),
  audienciasPersonalizadas: z.array(audienciaPersonalizadaSchema).min(5).max(10),
  audienciasSimilares: z.array(z.object({
    semilla: z.string().trim().min(1),
    porcentaje: z.string().trim().min(1),
    cuando: z.string().trim().min(1),
  })).min(2).max(6),
  geografia: z.array(z.object({
    zona: z.string().trim().min(1),
    detalle: z.string().trim().min(1),
  })).min(1).max(6),
});

export type Segmentacion = z.infer<typeof segmentacionSchema>;
export type Perfil = z.infer<typeof perfilSchema>;

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

  segmentacion: segmentacionSchema.optional(),
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
export const segmentacionAgenteSchema = z.object({ segmentacion: segmentacionSchema });

export type Estructura = z.infer<typeof estructuraSchema>;
export type Creativos = z.infer<typeof creativosSchema>;
export type GoogleDatos = z.infer<typeof googleSchema>;
export type Prompts = z.infer<typeof promptsSchema>;
export type SegmentacionAgente = z.infer<typeof segmentacionAgenteSchema>;
