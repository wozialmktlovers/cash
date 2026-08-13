import { z } from 'zod';

export const fuenteSchema = z.object({
  url: z.url(),
  consultado: z.string(),
  nota: z.string().optional(),
});

const conFuente = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, fuente: fuenteSchema });

export const competidorSchema = conFuente({
  nombre: z.string(),
  producto: z.string(),
  precio: z.string(),
  duracion: z.string(),
  modalidad: z.string(),
  aval: z.string(),
});

export const referenteSchema = conFuente({
  cuenta: z.string(),
  seguidores: z.number().int().nonnegative(),
  pais: z.string(),
});

export const citaSchema = conFuente({
  texto: z.string(),
  contexto: z.string(),
  anonimizada: z.boolean(),
});

export const personaSchema = z.object({
  nombre: z.string(),
  edad: z.string(),
  ciudad: z.string(),
  situacion: z.string(),
  demografia: z.array(z.string()),
  comportamiento: z.array(z.string()),
  dolor: z.array(z.string()),
  objeciones: z.array(z.string()),
  comoSeGana: z.string(),
  riesgo: z.string(),
});

export const competenciaSchema = z.object({
  directos: z.array(competidorSchema),
  indirectos: z.array(competidorSchema),
  referentes: z.array(referenteSchema),
  hallazgos: z.array(z.string()),
});

export const audienciaSchema = z.object({
  escalera: z.array(z.object({ termino: z.string(), connotacion: z.string() })),
  jerga: z.array(z.string()),
  jergaNegocio: z.array(z.string()),
  tono: z.array(z.string()),
  dolores: z.array(citaSchema),
  aspiraciones: z.array(citaSchema),
  miedoPrincipal: z.object({ nombre: z.string(), evidencia: z.string(), fuente: fuenteSchema }),
  unidadDeCompra: z.string(),
  personas: z.array(personaSchema).length(2),
});

export const canalesSchema = z.object({
  plataformas: z.array(conFuente({ nombre: z.string(), alcance: z.string(), notas: z.string() })),
  formatos: z.array(z.string()),
  horarios: z.string(),
  tendencias: z.array(z.string()),
  advertenciaRegulatoria: z.string().nullable(),
});

export const mercadoSchema = z.object({
  datos: z.array(conFuente({ etiqueta: z.string(), valor: z.string() })),
  salarios: z.array(conFuente({ puesto: z.string(), rango: z.string() })),
  regulacion: z.array(conFuente({ norma: z.string(), implicacion: z.string() })),
  crecimiento: z.string().nullable(),
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
