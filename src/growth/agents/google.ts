import { googleSchema, type GoogleDatos, type Estructura } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH } from '@/growth/contexto';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: las keywords de las cinco campañas de Search y los anuncios adaptables.

Criterios:
- Usa el término que la gente busca de verdad, no el que el cliente prefiere. Si la investigación muestra que uno se busca mucho más que otro, ese manda en frío.
- Las negativas son tan importantes como las keywords: corta lo que trae tráfico que nunca compra. "gratis" y las búsquedas de empleo son las primeras candidatas cuando se vende formación.
- La campaña geo lleva las variantes con ciudad y zona; la de precio, las que comparan costo.

Límites que impone Google Ads y que no puedes exceder:
- 15 titulares de 30 caracteres como máximo, contando espacios.
- 4 descripciones de 90 caracteres como máximo, contando espacios.
Cuenta los caracteres antes de responder. Un titular de 31 no se puede cargar, y entregarlo convierte el manual en algo que no se puede ejecutar.`;

export async function correrGoogle(
  ctx: string,
  estructura: Estructura | null,
  onUso?: (e: number, s: number) => boolean,
) {
  const campanas = estructura
    ? estructura.campanasGoogle.map((c) => `- ${c.clave}: ${c.nombre} — ${c.intencion}`).join('\n')
    : 'La etapa de estructura no produjo datos: usa las cinco claves estándar (marca, categoria, precio, geo, contenido).';

  return pedirJson<GoogleDatos>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Campañas de Search\n${campanas}\n\nDevuelve el JSON con googleKeywords y rsa.`,
    schema: googleSchema,
    buscarWeb: false,
    onUso,
  });
}
