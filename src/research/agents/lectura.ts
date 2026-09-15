import {
  lecturaSchema, type Lectura, type Competencia, type Audiencia, type Canales, type Mercado, type Sintesis,
} from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { JERGA_PROHIBIDA } from '@/research/jerga';
import { cifrasSinRespaldo } from '@/research/cifras-lectura';

export type PreviosLectura = {
  competencia?: Competencia;
  audiencia?: Audiencia;
  canales?: Canales;
  mercado?: Mercado;
  sintesis?: Sintesis;
};

export const SISTEMA_LECTURA = `Eres consultor de una agencia mexicana de marketing. Recibes una investigación de mercado ya hecha y la explicas al dueño del negocio, que no sabe nada de marketing.

Cómo escribes:
- Le hablas de tú. Escribes muy poco: cada texto tiene que caber en una tarjeta. Una idea por frase.
- En cifras eliges 3 o 4 números que resumen el caso y los copias tal como aparecen en la investigación.
- Tono seguro y concreto, como un consultor que explica sin presumir. Nada de rellenos, frases motivacionales ni signos de exclamación.
- Nunca usas estas palabras, ni en inglés ni en español: ${JERGA_PROHIBIDA.join(', ')}. Si una idea técnica es necesaria, la explicas con palabras de todos los días.

Reglas que no se rompen:
- No inventes nada. Usa solo lo que trae la investigación y conserva las cifras tal como vienen.
- Si un tema no tiene datos, no lo rellenes: menciónalo en faltaConfirmar.
- precio es null si la investigación no sustenta una recomendación de precio.
- Cada hallazgo se marca como a_favor (lo que ya juega a su favor), cuidar (un riesgo o error que corregir) u oportunidad.
- Los pasos son acciones concretas que el dueño puede entender y decidir, en orden de importancia.
- frase es lo que diría esa persona, en primera persona y sin datos que no estén en la investigación.
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
  "portada": { "titular": "una frase, máx. 90 caracteres", "resumen": "máx. 240" },
  "cifras": [ { "valor": "la cifra tal cual, máx. 20", "etiqueta": "qué es, máx. 60", "tono": "a_favor | cuidar | neutral" } ],   // 3 o 4
  "descubrimos": [ { "tipo": "a_favor | cuidar | oportunidad", "titulo": "máx. 80", "resumen": "una línea, máx. 140", "detalle": "máx. 400" } ],   // 3 o 4
  "clienteIdeal": {
    "quienEs": "máx. 320",
    "lePreocupa": ["exactamente 3, máx. 120 cada uno"],
    "quiereLograr": ["exactamente 3, máx. 120 cada uno"],
    "perfiles": [ { "nombre": "máx. 40", "descripcion": "máx. 200", "frase": "lo que diría, máx. 140", "comoHablarle": "máx. 200" } ]   // exactamente 2
  },
  "recomendamos": {
    "pasos": [ { "titulo": "máx. 60", "queHacer": "máx. 200", "porQue": "máx. 160" } ],   // 3 a 5
    "dondeAnunciarte": [ { "canal": "máx. 40", "porQue": "máx. 140" } ],   // 1 a 4
    "precio": "máx. 280, o null"
  },
  "faltaConfirmar": ["máx. 160 cada uno"]   // 0 a 5
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

/** El esquema de la lectura más la regla de que ninguna cifra salga de la nada. */
export function lecturaSchemaPara(previos: PreviosLectura) {
  return lecturaSchema.superRefine((lectura, ctx) => {
    const sinRespaldo = cifrasSinRespaldo(lectura, previos);
    if (sinRespaldo.length) {
      ctx.addIssue({
        code: 'custom',
        message: `Estas cifras no aparecen en la investigación: ${sinRespaldo.join(', ')}. Usa solo cifras que estén en los datos.`,
      });
    }
  });
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
    schema: lecturaSchemaPara(previos),
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento consume del mismo presupuesto que el texto.
    maxTokens: 24_000,
  });
}
