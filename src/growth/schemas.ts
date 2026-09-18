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


/* ── Google, extensiones y medición ────────────────────────────────────
   En el entregable real los títulos y descripciones van POR CAMPAÑA, no en
   una bolsa común: cada intención de búsqueda merece su propio anuncio, y
   mezclarlos obliga a reescribirlos al cargarlos. */

export const campanaSearchSchema = z.object({
  clave: z.enum(CLAVES_GOOGLE),
  presupuesto: z.string().trim().min(1),
  concordancia: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).min(4).max(20),
  negativas: z.array(z.string().trim().min(1)),
  titulares: z.array(z.string().trim().min(1).max(30)).min(4).max(15),
  descripciones: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
});

export const extensionSchema = z.object({
  tipo: z.string().trim().min(1),
  detalle: z.string().trim().min(1),
});

export const tecnicoSchema = z.object({
  arquitectura: z.array(z.object({
    capa: z.string().trim().min(1),
    herramienta: z.string().trim().min(1),
    funcion: z.string().trim().min(1),
    identificador: z.string().trim().min(1),
  })).min(3).max(8),
  etiquetas: z.array(z.object({
    etiqueta: z.string().trim().min(1),
    activador: z.string().trim().min(1),
  })).min(5).max(16),
  variables: z.array(z.string().trim().min(1)).min(3).max(20),
});

export const googleAmpliadoSchema = z.object({
  hallazgos: z.array(z.string().trim().min(1)).min(1).max(4),
  configuracionObligatoria: z.array(z.string().trim().min(1)).min(2).max(8),
  campanas: z.array(campanaSearchSchema).length(5),
  extensiones: z.array(extensionSchema).min(3).max(8),
  estacionalidad: z.array(z.object({
    periodo: z.string().trim().min(1),
    interes: z.string().trim().min(1),
    accion: z.string().trim().min(1),
  })).min(3).max(12),
  notaEstacionalidad: z.string().trim().min(1),
});

export type GoogleAmpliado = z.infer<typeof googleAmpliadoSchema>;
export type CampanaSearch = z.infer<typeof campanaSearchSchema>;
export type Tecnico = z.infer<typeof tecnicoSchema>;

export const growthSchema = z.object({
  // Lo único variable de la portada. El machote deja [N] Semanas como marcador
  // y fija los demás números.
  semanas: z.number().int().min(2).max(12),

  // La estructura de la casa es 3 + 5, pero el documento acepta menos: un
  // agente que entregó dos campañas buenas no debe dejar el manual sin
  // ninguna, ni el documento guardado debe quedar imposible de editar.
  campanasMeta: z.array(campanaMetaSchema).min(1).max(3),
  campanasGoogle: z.array(campanaGoogleSchema).min(1).max(5),
  // Nueve es lo esperado (3 grupos × 3 formatos), pero un manual con menos
  // se guarda y se puede completar a mano, en vez de perder la etapa entera.
  creativos: z.array(creativoSchema).min(1).max(9),

  promptsImagen: z.object({
    base: z.string().trim().min(1),
    porCreativo: z.array(z.string().trim().min(1)).length(9),
  }),

  googleKeywords: z.array(keywordsSchema).min(1).max(5),

  rsa: z.object({
    // Límites reales de Google Ads. Un titular de 31 caracteres no se puede
    // cargar, así que dejarlo pasar sería entregarle al cliente un manual que
    // no se puede ejecutar. El agente los recorta antes de guardar; aquí se
    // exige el límite. El mínimo es el de Google: 3 titulares y 2 descripciones.
    titulares: z.array(z.string().trim().min(1).max(30)).min(3).max(15),
    descripciones: z.array(z.string().trim().min(1).max(90)).min(2).max(4),
  }),

  segmentacion: segmentacionSchema.optional(),
  googleAmpliado: googleAmpliadoSchema.optional(),
  tecnico: tecnicoSchema.optional(),
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
 *
 * `estructuraSchema` y `googleSchema` son el trozo del DOCUMENTO (estricto).
 * Los agentes validan contra `estructuraAgenteSchema` y `googleAgenteSchema`,
 * más tolerantes: aceptan menos elementos de los ideales, recortan los textos
 * de anuncio al límite de Google en vez de rechazarlos y dejan fuera lo que
 * venga vacío. Todo lo que dejan pasar sigue cumpliendo `growthSchema.partial()`,
 * que es contra lo que se valida la edición del documento.
 */
export const estructuraSchema = growthSchema.pick({
  semanas: true, campanasMeta: true, campanasGoogle: true,
  bloqueantes: true, reglasCopy: true,
});
export const creativosSchema = growthSchema.pick({ creativos: true });
export const googleSchema = growthSchema.pick({ googleKeywords: true, rsa: true });
export const promptsSchema = growthSchema.pick({ promptsImagen: true });
export const segmentacionAgenteSchema = z.object({ segmentacion: segmentacionSchema });

/** Quita las listas vacías: el documento no admite `bloqueantes: []`, pero sí que falten. */
function sinListasVacias<T extends Record<string, unknown>>(o: T): T {
  const copia: Record<string, unknown> = { ...o };
  for (const [k, v] of Object.entries(copia)) {
    if (v === undefined || (Array.isArray(v) && v.length === 0)) delete copia[k];
  }
  return copia as T;
}

/**
 * Recorta un texto de anuncio a `max` caracteres por palabra completa y SIN
 * elipsis: en Google un «…» al final se lee como anuncio roto, y un titular
 * de 31 no se puede cargar. Si la última palabra entera deja el texto
 * demasiado corto, se corta en seco.
 */
export function recortarAnuncio(t: string, max: number): string {
  const limpio = t.replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  const corte = limpio.slice(0, max + 1);
  const espacio = corte.lastIndexOf(' ');
  if (espacio < max * 0.5) return limpio.slice(0, max).trim();
  const palabras = corte.slice(0, espacio).split(' ');
  // «Miel cruda de la península de» no se puede publicar: se quitan los
  // conectores que quedan colgando al final.
  while (palabras.length > 2 && CONECTORES.has(palabras[palabras.length - 1].toLowerCase().replace(/[^\p{L}]/gu, ''))) {
    palabras.pop();
  }
  return palabras.join(' ').replace(/[\s,;:\-–—|·]+$/u, '').trim();
}

const CONECTORES = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'o', 'u', 'a', 'al', 'en', 'con', 'sin',
  'para', 'por', 'que', 'tu', 'su', 'un', 'una', 'mas', 'más', 'desde', 'hasta', 'entre',
]);

/** Lista de textos de anuncio: recortados, sin vacíos ni repetidos, hasta `cuantos`. */
const textosDeAnuncio = (max: number, cuantos: number, minimo: number) =>
  z.array(z.string())
    .transform((lista) => {
      const vistos = new Set<string>();
      const salida: string[] = [];
      for (const t of lista) {
        const r = recortarAnuncio(t, max);
        const clave = r.toLowerCase();
        if (!r || vistos.has(clave)) continue;
        vistos.add(clave);
        salida.push(r);
      }
      return salida.slice(0, cuantos);
    })
    .pipe(z.array(z.string().min(1).max(max)).min(minimo));

export const estructuraAgenteSchema = z.object({
  semanas: z.number().int().min(2).max(12).optional(),
  campanasMeta: z.array(campanaMetaSchema).min(1).max(3),
  campanasGoogle: z.array(campanaGoogleSchema).max(5).optional(),
  bloqueantes: z.array(z.string().trim().min(1)).optional(),
  reglasCopy: z.array(z.string().trim().min(1)).optional(),
}).transform(sinListasVacias);

export const googleAgenteSchema = z.object({
  googleKeywords: z.array(z.object({
    clave: z.enum(CLAVES_GOOGLE),
    keywords: z.array(z.string().trim().min(1)).min(1),
    // La campaña de marca a menudo no lleva negativas propias.
    negativas: z.array(z.string().trim().min(1)).default([]),
  })).min(1).max(5),
  // Opcional para poder salvar las keywords si los anuncios no sirven.
  rsa: z.object({
    titulares: textosDeAnuncio(30, 15, 3),
    descripciones: textosDeAnuncio(90, 4, 2),
  }).optional(),
}).transform(sinListasVacias);

export type Estructura = z.output<typeof estructuraAgenteSchema>;
export type Creativos = z.infer<typeof creativosSchema>;
export type GoogleDatos = z.output<typeof googleAgenteSchema>;
export type Prompts = z.infer<typeof promptsSchema>;
export type SegmentacionAgente = z.infer<typeof segmentacionAgenteSchema>;
