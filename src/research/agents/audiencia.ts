import { audienciaSchema, type Audiencia } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: reconstruir cómo habla y qué teme la audiencia del cliente.
- Escalera de términos: cómo se nombra a sí misma la audiencia, del término más humilde al más aspiracional, con la connotación de cada uno.
- Jerga: expresiones propias del giro, tal como las dice la audiencia. jergaNegocio: cómo hablan de dinero y clientes.
- Tono: cómo suena la conversación real del nicho, no cómo suena la publicidad.
- Dolores y aspiraciones: citas textuales de foros, comentarios y reseñas, siempre anonimizadas.
  Describe a la persona ("mamá de dos, compra por internet los fines de semana"), nunca su usuario.
- miedoPrincipal: el que de verdad frena la compra, con la evidencia que lo sustenta.
- unidadDeCompra: qué cree la audiencia que está comprando. Rara vez es el producto que se vende.
- personas: exactamente dos, deliberadamente contrastantes entre sí.`;

const FUENTE = '{ "url": "https://...", "consultado": "AAAA-MM-DD" }';

export const FORMA_AUDIENCIA = `{
  "escalera": [ { "termino": "texto", "connotacion": "texto" } ],
  "jerga": ["una expresión y lo que significa, en un solo texto", "..."],
  "jergaNegocio": ["texto", "..."],
  "tono": ["texto", "..."],
  "dolores": [ { "texto": "la cita", "contexto": "quién lo dice, anonimizado", "anonimizada": true, "fuente": ${FUENTE} } ],
  "aspiraciones": [ /* misma forma que dolores */ ],
  "miedoPrincipal": { "nombre": "texto", "evidencia": "texto", "fuente": ${FUENTE} },
  "unidadDeCompra": "texto",
  "personas": [ {
    "nombre": "texto", "edad": "texto", "ciudad": "texto", "situacion": "texto",
    "demografia": ["texto"], "comportamiento": ["texto"], "dolor": ["texto"], "objeciones": ["texto"],
    "comoSeGana": "texto", "riesgo": "texto"
  } ]
}
Los elementos de jerga, jergaNegocio y tono son cadenas de texto, no objetos. Los campos "texto" son cadenas, nunca arreglos.`;

export async function correrAudiencia(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Audiencia>({
    modelo: process.env.MODEL_BUSQUEDA || process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga la audiencia y devuelve el JSON con esta forma exacta:\n${FORMA_AUDIENCIA}`,
    forma: FORMA_AUDIENCIA,
    schema: audienciaSchema,
    buscarWeb: true,
    onUso,
  });
}
