import {
  lecturaSchema, type Lectura, type Competencia, type Audiencia, type Canales, type Mercado, type Sintesis,
} from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { JERGA_PROHIBIDA } from '@/research/jerga';

export type PreviosLectura = {
  competencia?: Competencia;
  audiencia?: Audiencia;
  canales?: Canales;
  mercado?: Mercado;
  sintesis?: Sintesis;
};

export const SISTEMA_LECTURA = `Eres consultor de una agencia mexicana de marketing. Recibes una investigación de mercado ya hecha y la explicas al dueño del negocio, que no sabe nada de marketing.

Cómo escribes:
- Le hablas de tú, con frases cortas y una idea por frase.
- Tono seguro y concreto, como un consultor que explica sin presumir. Nada de rellenos, frases motivacionales ni signos de exclamación.
- Nunca usas estas palabras, ni en inglés ni en español: ${JERGA_PROHIBIDA.join(', ')}. Si una idea técnica es necesaria, la explicas con palabras de todos los días.

Reglas que no se rompen:
- No inventes nada. Usa solo lo que trae la investigación y conserva las cifras tal como vienen.
- Si un tema no tiene datos, no lo rellenes: menciónalo en faltaConfirmar.
- precio es null si la investigación no sustenta una recomendación de precio.
- Cada hallazgo se marca como a_favor (lo que ya juega a su favor), cuidar (un riesgo o error que corregir) u oportunidad.
- Los pasos son acciones concretas que el dueño puede entender y decidir, en orden de importancia.
- Responde solo con JSON válido, sin texto antes ni después.`;

const NOMBRES: Record<keyof PreviosLectura, string> = {
  competencia: 'Competencia',
  audiencia: 'Audiencia',
  canales: 'Canales',
  mercado: 'Mercado',
  sintesis: 'Síntesis estratégica',
};

// El esquema no viaja al modelo por sí solo: se le describe la forma exacta
// para que el primer intento ya cumpla y no se pague un reintento.
const FORMA = `{
  "portada": { "titular": "una frase, máx. 160 caracteres", "resumen": "2 o 3 frases, máx. 500" },
  "descubrimos": [ { "tipo": "a_favor | cuidar | oportunidad", "titulo": "máx. 100", "explicacion": "máx. 500" } ],   // 3 o 4
  "clienteIdeal": {
    "quienEs": "un párrafo, máx. 700",
    "lePreocupa": ["exactamente 3, máx. 200 cada uno"],
    "quiereLograr": ["exactamente 3, máx. 200 cada uno"],
    "perfiles": [ { "nombre": "máx. 50", "descripcion": "máx. 320", "comoHablarle": "máx. 320" } ]   // exactamente 2
  },
  "recomendamos": {
    "pasos": [ { "titulo": "máx. 100", "queHacer": "máx. 420", "porQue": "máx. 360" } ],   // 3 a 5
    "dondeAnunciarte": [ { "canal": "máx. 50", "porQue": "máx. 280" } ],   // 1 a 4
    "precio": "máx. 500, o null"
  },
  "faltaConfirmar": ["máx. 240 cada uno"]   // 0 a 5
}`;

export function armarEntradaLectura(ctx: string, previos: PreviosLectura): string {
  const claves = Object.keys(NOMBRES) as Array<keyof PreviosLectura>;
  const bloques = claves
    .filter((k) => previos[k])
    .map((k) => `### ${NOMBRES[k]}\n${JSON.stringify(previos[k], null, 2)}`)
    .join('\n\n');
  const faltantes = claves.filter((k) => !previos[k]).map((k) => `- ${NOMBRES[k]}`);

  const huecos = faltantes.length
    ? `\n\n## Temas sin datos\n${faltantes.join('\n')}\nNo los rellenes: menciónalos en faltaConfirmar.`
    : '';

  return `${ctx}\n\n## Lo que ya se investigó\n${bloques || '(nada)'}${huecos}\n\nDevuelve el JSON de la lectura para el cliente con esta forma:\n${FORMA}`;
}

export async function correrLectura(
  ctx: string,
  previos: PreviosLectura,
  onUso?: (e: number, s: number) => boolean,
) {
  return pedirJson<Lectura>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA_LECTURA,
    usuario: armarEntradaLectura(ctx, previos),
    schema: lecturaSchema,
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento consume del mismo presupuesto que el texto.
    maxTokens: 24_000,
  });
}
