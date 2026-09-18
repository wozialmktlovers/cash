import { sintesisSchema, type Sintesis, type Competencia, type Audiencia, type Canales, type Mercado } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: sintetizar cuatro investigaciones en decisiones estratégicas.

Criterios:
- De los cuatro hallazgos, al menos uno debe ser incómodo para el cliente. Si todos son buenas noticias, la investigación fue superficial.
- Si el diferenciador que el cliente declara lo tiene también un competidor más barato, dilo con la comparación de precios.
- El posicionamiento debe conectar el diferenciador real con el hueco del mercado.
- Descarta un foco explícitamente y explica por qué.
- En pendientes, declara lo que la investigación no pudo responder. No lo dejes vacío por quedar bien.`;

// El esquema no viaja al modelo por sí solo: sin esta forma, Opus inventaba
// sus propias llaves y la síntesis fallaba entera (pasó en producción: faltaban
// posicionamiento, focos, oferta y precios). Va en el pedido y en la corrección.
export const FORMA_SINTESIS = `{
  "hallazgos": [ { "tipo": "problema | salida | bloqueante | oportunidad", "titulo": "texto", "texto": "texto" } ],
  "posicionamiento": { "frase": "texto", "sustento": "texto" },
  "focos": [ { "nombre": "texto", "tipo": "prioritario | expansion | descartado", "razon": "texto" } ],
  "oferta": {
    "problemaReal": "texto",
    "activosSinExplotar": ["texto"],
    "faltaConstruir": ["texto"],
    "traduccion": [ { "antes": "texto", "despues": "texto", "porQue": "texto" } ],
    "titularFinal": "texto"
  },
  "precios": { "diagnostico": "texto", "riesgos": ["texto"], "propuesta": [ { "plan": "texto", "monto": "texto", "total": "texto" } ] } o null si no hay datos de precios,
  "ciclo": {
    "tipo": "texto",
    "etapas": [ { "nombre": "texto", "quePiensa": "texto", "fraseTipo": "texto" } ],
    "fricciones": ["texto"],
    "aceleradores": ["texto"]
  },
  "pendientes": ["texto"]
}
Exactamente 4 hallazgos, 3 focos y 4 etapas del ciclo. Usa estas llaves tal cual, sin envolverlas en otro objeto.`;

export async function correrSintesis(
  ctx: string,
  previos: { competencia?: Competencia; audiencia?: Audiencia; canales?: Canales; mercado?: Mercado },
  onUso?: (e: number, s: number) => boolean,
) {
  const bloques = Object.entries(previos)
    .filter(([, v]) => v)
    .map(([k, v]) => `### ${k}\n${JSON.stringify(v, null, 2)}`)
    .join('\n\n');

  const faltantes = ['competencia','audiencia','canales','mercado']
    .filter((k) => !(previos as any)[k]);

  const aviso = faltantes.length
    ? `\n\nEstas etapas no produjeron datos: ${faltantes.join(', ')}. No inventes su contenido; ajusta tus conclusiones a lo que sí tienes y menciónalo en pendientes.`
    : '';

  return pedirJson<Sintesis>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Investigaciones previas\n${bloques}${aviso}\n\nDevuelve el JSON con esta forma exacta:\n${FORMA_SINTESIS}`,
    forma: FORMA_SINTESIS,
    schema: sintesisSchema,
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento está activo por omisión y consume del mismo
    // presupuesto que el texto. La síntesis es el JSON más grande del pipeline,
    // así que se le da holgura para que no se corte a la mitad.
    maxTokens: 32_000,
  });
}
