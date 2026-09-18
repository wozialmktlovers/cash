import { z } from 'zod';
import { detectarJerga } from './jerga';
import { aTexto, aTextoONulo, aArreglo, aListaDeTextos, aEntero } from './normalizar';

/*
 * Esquemas de las cuatro etapas con búsqueda web (competencia, audiencia,
 * canales, mercado). Normalizan en vez de rechazar (ver `normalizar.ts`): el
 * modelo no siempre respeta si un campo es texto, lista u objeto, y cada
 * rechazo tiraba una etapa que ya había pagado sus búsquedas. Lo único que se
 * sigue exigiendo es lo que no se puede reconstruir sin inventar: el nombre de
 * cada cosa y la URL de su fuente. Un elemento que no lo trae se descarta
 * (`rescatarParcial`), no la etapa.
 *
 * Sintesis y lectura no pasan por aquí: sus reglas (cuatro hallazgos, jerga,
 * cifras con respaldo) son deliberadas y se corrigen con el reintento.
 */

/** Texto que tolera arreglos, objetos, números y ausencia (queda ''). */
const textoLibre = z.preprocess(aTexto, z.string());
/** Texto que identifica al elemento: sin él, el elemento no sirve y se descarta. */
const textoRequerido = z.preprocess(aTexto, z.string().trim().min(1));
/** Texto o null (no aplica). */
const textoONulo = z.preprocess(aTextoONulo, z.string().nullable());
/** Lista de textos: un texto suelto se envuelve, los objetos se leen como texto. */
const listaTextos = z.preprocess(aListaDeTextos, z.array(z.string()));
/** Arreglo de objetos: ausente da [], un objeto suelto se envuelve. */
const arreglo = <T extends z.ZodTypeAny>(item: T) => z.preprocess(aArreglo, z.array(item));

/** «www.sitio.mx/x» → «https://www.sitio.mx/x». Lo que no parece dominio se deja para que zod lo rechace. */
const conEsquema = (u: unknown) => {
  if (typeof u !== 'string') return u;
  const t = u.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(t) || !/^[\w-]+(\.[\w-]+)+(\/|$)/.test(t) ? t : `https://${t}`;
};

export const fuenteSchema = z.preprocess(
  // Una URL suelta en lugar del objeto es la forma más común de desviarse.
  (v) => {
    if (typeof v === 'string') return { url: conEsquema(v) };
    if (v && typeof v === 'object' && !Array.isArray(v)) return { ...v, url: conEsquema((v as any).url) };
    return v;
  },
  z.object({
    url: z.url(),
    consultado: textoLibre,
    nota: z.preprocess((v) => (v == null ? undefined : aTexto(v)), z.string().optional()),
  }),
);

const conFuente = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, fuente: fuenteSchema });

/**
 * Un competidor de cualquier giro. `producto` es lo que vende (producto o
 * servicio), `precio` puede quedar vacío si no lo publica, y `detalles` junta
 * lo que distingue la oferta en ese giro: formato, presentación, ubicación,
 * horario, garantía, certificación… `duracion`, `modalidad` y `aval` son de la
 * primera versión, pensada para cursos: se conservan opcionales para leer las
 * investigaciones viejas y por si el giro sí es educativo.
 */
export const competidorSchema = conFuente({
  nombre: textoRequerido,
  producto: textoLibre,
  precio: textoLibre,
  detalles: listaTextos,
  duracion: textoLibre.optional(),
  modalidad: textoLibre.optional(),
  aval: textoLibre.optional(),
});

export const referenteSchema = conFuente({
  cuenta: textoRequerido,
  seguidores: z.preprocess(aEntero, z.number().int().nonnegative()),
  pais: textoLibre,
});

export const citaSchema = conFuente({
  texto: textoRequerido,
  contexto: textoLibre,
  // Las citas se piden anonimizadas: si el modelo no dice lo contrario, lo están.
  anonimizada: z.preprocess((v) => (v == null ? true : v === 'false' ? false : Boolean(v)), z.boolean()),
});

export const personaSchema = z.object({
  nombre: textoRequerido,
  edad: textoLibre,
  ciudad: textoLibre,
  situacion: textoLibre,
  demografia: listaTextos,
  comportamiento: listaTextos,
  dolor: listaTextos,
  objeciones: listaTextos,
  comoSeGana: textoLibre,
  riesgo: textoLibre,
});

export const competenciaSchema = z.object({
  directos: arreglo(competidorSchema),
  indirectos: arreglo(competidorSchema),
  referentes: arreglo(referenteSchema),
  hallazgos: listaTextos,
});

export const audienciaSchema = z.object({
  escalera: arreglo(z.preprocess(
    (v) => (typeof v === 'string' ? { termino: v } : v),
    z.object({ termino: textoRequerido, connotacion: textoLibre }),
  )),
  jerga: listaTextos,
  jergaNegocio: listaTextos,
  tono: listaTextos,
  dolores: arreglo(citaSchema),
  aspiraciones: arreglo(citaSchema),
  // Sin fuente se conserva el miedo (es la conclusión de la etapa); sin
  // nombre no hay nada que conservar y queda en null.
  miedoPrincipal: z.preprocess(
    (v) => (v == null || v === '' ? null : typeof v === 'string' ? { nombre: v } : v),
    z.object({ nombre: textoRequerido, evidencia: textoLibre, fuente: fuenteSchema.optional() }).nullable(),
  ),
  unidadDeCompra: textoLibre,
  // Se piden dos; si llegan más se toman las dos primeras y, si llega una,
  // se conserva en vez de tirar la etapa por eso.
  personas: arreglo(personaSchema).transform((ps) => ps.slice(0, 2)),
});

export const canalesSchema = z.object({
  plataformas: arreglo(conFuente({ nombre: textoRequerido, alcance: textoLibre, notas: textoLibre })),
  formatos: listaTextos,
  horarios: textoLibre,
  tendencias: listaTextos,
  advertenciaRegulatoria: textoONulo,
});

export const mercadoSchema = z.object({
  datos: arreglo(conFuente({ etiqueta: textoRequerido, valor: textoRequerido })),
  salarios: arreglo(conFuente({ puesto: textoRequerido, rango: textoLibre })),
  regulacion: arreglo(conFuente({ norma: textoRequerido, implicacion: textoLibre })),
  crecimiento: textoONulo,
});

export const sintesisSchema = z.object({
  hallazgos: z.array(z.object({
    tipo: z.enum(['problema','salida','bloqueante','oportunidad']),
    titulo: z.string(),
    texto: z.string(),
  })).length(4),
  posicionamiento: z.object({ frase: z.string(), sustento: z.string() }),
  focos: z.array(z.object({ nombre: z.string(), tipo: z.enum(['prioritario','expansion','descartado']), razon: z.string() })).length(3),
  oferta: z.object({
    problemaReal: z.string(),
    activosSinExplotar: z.array(z.string()),
    faltaConstruir: z.array(z.string()),
    traduccion: z.array(z.object({ antes: z.string(), despues: z.string(), porQue: z.string() })),
    titularFinal: z.string(),
  }),
  precios: z.object({
    diagnostico: z.string(),
    riesgos: z.array(z.string()),
    propuesta: z.array(z.object({ plan: z.string(), monto: z.string(), total: z.string() })),
  }).nullable(),
  ciclo: z.object({
    tipo: z.string(),
    etapas: z.array(z.object({ nombre: z.string(), quePiensa: z.string(), fraseTipo: z.string() })).length(4),
    fricciones: z.array(z.string()),
    aceleradores: z.array(z.string()),
  }),
  pendientes: z.array(z.string()),
});

const texto = (max: number) => z.string().min(1).max(max);

/**
 * Lo que lee el cliente final. Límites cortos a propósito: la primera versión
 * tenía demasiado texto para leerse en tarjetas.
 */
export const lecturaSchema = z.object({
  portada: z.object({ titular: texto(90), resumen: texto(240) }),
  cifras: z.array(z.object({
    valor: texto(20),
    etiqueta: texto(60),
    tono: z.enum(['a_favor', 'cuidar', 'neutral']),
  })).min(3).max(4),
  descubrimos: z.array(z.object({
    tipo: z.enum(['a_favor', 'cuidar', 'oportunidad']),
    titulo: texto(80),
    resumen: texto(140),
    detalle: texto(400),
  })).min(3).max(4),
  clienteIdeal: z.object({
    quienEs: texto(320),
    lePreocupa: z.array(texto(120)).length(3),
    quiereLograr: z.array(texto(120)).length(3),
    perfiles: z.array(z.object({
      nombre: texto(40),
      descripcion: texto(200),
      frase: texto(140),
      comoHablarle: texto(200),
    })).length(2),
  }),
  recomendamos: z.object({
    pasos: z.array(z.object({ titulo: texto(60), queHacer: texto(200), porQue: texto(160) })).min(3).max(5),
    dondeAnunciarte: z.array(z.object({ canal: texto(40), porQue: texto(140) })).min(1).max(4),
    precio: texto(280).nullable(),
  }),
  faltaConfirmar: z.array(texto(160)).max(5),
}).superRefine((lectura, ctx) => {
  const halladas = detectarJerga(lectura);
  if (halladas.length) {
    ctx.addIssue({
      code: 'custom',
      // `path` explícito (limpieza M3, punto 2): sin él, el issue queda con
      // path [] (es de la lectura entera, no de un campo), y quien formatea
      // errores como `${path.join('.')}: ${message}` (src/research/claude.ts)
      // producía «: Hay jerga...» con dos puntos colgando al inicio.
      path: ['jerga'],
      message: `Hay jerga que el cliente no entiende: ${halladas.join(', ')}. Explícalo con palabras de todos los días.`,
    });
  }
});

const etapa = <T extends z.ZodTypeAny>(datos: T) =>
  z.discriminatedUnion('estado', [
    z.object({ estado: z.literal('ok'), datos }),
    z.object({ estado: z.literal('vacio'), razon: z.string() }),
  ]);

export const investigacionSchema = z.object({
  competencia: etapa(competenciaSchema),
  audiencia: etapa(audienciaSchema),
  canales: etapa(canalesSchema),
  mercado: etapa(mercadoSchema),
  sintesis: etapa(sintesisSchema),
  // Opcional: las investigaciones anteriores a esta etapa no la traen.
  lectura: etapa(lecturaSchema).optional(),
});

export type Investigacion = z.infer<typeof investigacionSchema>;
export type Competencia = z.infer<typeof competenciaSchema>;
export type Audiencia = z.infer<typeof audienciaSchema>;
export type Canales = z.infer<typeof canalesSchema>;
export type Mercado = z.infer<typeof mercadoSchema>;
export type Sintesis = z.infer<typeof sintesisSchema>;
export type Fuente = z.infer<typeof fuenteSchema>;
export type Persona = z.infer<typeof personaSchema>;
export type Cita = z.infer<typeof citaSchema>;
export type Competidor = z.infer<typeof competidorSchema>;
export type Referente = z.infer<typeof referenteSchema>;
export type Lectura = z.infer<typeof lecturaSchema>;
