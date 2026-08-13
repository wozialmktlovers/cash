import { promptsSchema, type Prompts, type Creativos } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH } from '@/growth/contexto';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: los prompts para generar las piezas, en inglés, listos para pegar en Midjourney, DALL·E, Firefly o Ideogram.

Regla que no se rompe: ningún prompt genera rostros identificables. Cada prompt produce fondo, textura y composición; la foto real de la persona se monta encima en edición. Generar una cara parecida a la del cliente sería deshonesto con su audiencia y además arriesga el rechazo en Meta.

Criterios:
- El prompt base fija la identidad visual y se antepone a todos: fondo casi negro, grano de película sutil, luz volumétrica en rosa y azul, composición editorial premium.
- Cada prompt por creativo describe la escena de su ángulo y respeta el aspect ratio de su formato.
- Deja espacio negativo donde irá el texto: un fondo saturado obliga a rehacer la pieza.
- En inglés, sin traducir. Los generadores rinden peor en español.`;

export async function correrPrompts(
  ctx: string,
  creativos: Creativos | null,
  onUso?: (e: number, s: number) => boolean,
) {
  const lista = creativos
    ? creativos.creativos.map((c, i) => `${i + 1}. Grupo ${c.grupo} · ${c.formato} · ${c.ratio} — ${c.angulo}`).join('\n')
    : 'La etapa de creativos no produjo datos: genera los nueve prompts a partir de los ángulos de la investigación, tres por grupo.';

  return pedirJson<Prompts>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Creativos a ilustrar\n${lista}\n\nDevuelve el JSON con promptsImagen: base y porCreativo, nueve en el mismo orden.`,
    schema: promptsSchema,
    buscarWeb: false,
    onUso,
  });
}
