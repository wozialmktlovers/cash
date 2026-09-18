import { creativosSchema, type Creativos, type Estructura, RATIO_POR_FORMATO } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH, MAX_TOKENS_GROWTH } from '@/growth/contexto';
import { prepararCreativos } from '@/growth/normalizar';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: escribir los nueve creativos, uno por cada combinación de grupo y formato.

El ratio lo dicta el formato y no se negocia: imagen 1x1 (1080 × 1080 px), carrusel 4x5 (1080 × 1350 px), video 9x16 (1080 × 1920 px).

Criterios de copy:
- Cada copy abre con un dato duro de la investigación o con una objeción real de la audiencia, nunca con un adjetivo.
- Habla en tercera persona sobre lo que se ofrece, no sobre el lector. Meta rechaza los anuncios que le atribuyen una carencia a quien los lee.
- Usa el vocabulario que la audiencia usa de verdad, el que documentó la investigación, no el término técnico si no es el que se busca.
- Las dos opciones de copy tienen que atacar el mismo ángulo por caminos distintos. Si una es la otra reescrita, no sirven de prueba.
- El video abre en los primeros tres segundos con el conflicto, no con la marca.`;

// Sin la forma, el modelo mandaba «4:5» en vez de `4x5` y omitía el ángulo,
// y la etapa fallaba entera. Va en el pedido y en la corrección.
export const FORMA_CREATIVOS = `{
  "creativos": [
    { "grupo": "a | b | c", "formato": "imagen | carrusel | video", "ratio": "1x1 | 4x5 | 9x16", "medidas": "1080 × 1350 px", "angulo": "texto", "copyA": "texto", "copyB": "texto" }
  ]
}
Exactamente 9 creativos: los grupos a, b y c, cada uno en imagen, carrusel y video. El ratio se escribe con x (4x5, no 4:5). Usa estas llaves tal cual, sin acentos y sin envolverlas en otro objeto.`;

export async function correrCreativos(
  ctx: string,
  estructura: Estructura | null,
  onUso?: (e: number, s: number) => boolean,
) {
  const angulos = estructura
    ? estructura.campanasMeta.map((c) => `- Grupo ${c.grupo}: ${c.angulo} (audiencia: ${c.audiencia})`).join('\n')
    : 'La etapa de estructura no produjo datos: deduce tres ángulos distintos de la investigación y repártelos en los grupos a, b y c.';

  const ratios = Object.entries(RATIO_POR_FORMATO).map(([f, r]) => `${f}=${r}`).join(', ');

  return pedirJson<Creativos>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Ángulos por grupo\n${angulos}\n\nRatios obligatorios: ${ratios}.\n\nDevuelve el JSON con esta forma exacta:\n${FORMA_CREATIVOS}`,
    forma: FORMA_CREATIVOS,
    preparar: prepararCreativos(Object.fromEntries((estructura?.campanasMeta ?? []).map((c) => [c.grupo, c.angulo]))),
    rescatar: true,
    schema: creativosSchema,
    buscarWeb: false,
    onUso,
    maxTokens: MAX_TOKENS_GROWTH,
  });
}
