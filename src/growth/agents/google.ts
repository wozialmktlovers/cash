import { googleAgenteSchema, type GoogleDatos, type Estructura } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH, MAX_TOKENS_GROWTH } from '@/growth/contexto';
import { prepararGoogle } from '@/growth/normalizar';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: las keywords de las cinco campañas de Search y los anuncios adaptables.

Criterios:
- Usa el término que la gente busca de verdad, no el que el cliente prefiere. Si la investigación muestra que uno se busca mucho más que otro, ese manda en frío.
- Las negativas son tan importantes como las keywords: corta lo que trae tráfico que nunca compra según el giro de este cliente (por ejemplo "gratis", "empleo", "hazlo tú mismo", "mayoreo" o "receta", solo cuando no correspondan a lo que vende).
- La campaña geo lleva las variantes con ciudad y zona; la de precio, las que comparan costo.

Límites que impone Google Ads:
- 15 titulares de 30 caracteres como máximo, contando espacios.
- 4 descripciones de 90 caracteres como máximo, contando espacios.
Escribe con holgura (titulares de unos 25 caracteres, descripciones de unos 80) en vez de contar letra por letra: lo que exceda el límite se recorta al guardar y el anuncio queda mutilado.`;

// Sin la forma, el modelo mandaba `googleKeywords` como objeto por clave o un
// `rsa` por campaña, y la etapa fallaba entera. Va en el pedido y en la corrección.
export const FORMA_GOOGLE = `{
  "googleKeywords": [ { "clave": "marca | categoria | precio | geo | contenido", "keywords": ["texto"], "negativas": ["texto"] } ],
  "rsa": { "titulares": ["texto de 30 caracteres o menos"], "descripciones": ["texto de 90 caracteres o menos"] }
}
Exactamente 5 elementos en googleKeywords (uno por clave), 15 titulares y 4 descripciones. rsa es un solo bloque común, no uno por campaña. Usa estas llaves tal cual, sin acentos y sin envolverlas en otro objeto.`;

export async function correrGoogle(
  ctx: string,
  estructura: Estructura | null,
  onUso?: (e: number, s: number) => boolean,
) {
  const campanas = estructura?.campanasGoogle?.length
    ? estructura.campanasGoogle.map((c) => `- ${c.clave}: ${c.nombre} — ${c.intencion}`).join('\n')
    : 'La etapa de estructura no produjo las campañas de Google: usa las cinco claves estándar (marca, categoria, precio, geo, contenido).';

  return pedirJson<GoogleDatos>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Campañas de Search\n${campanas}\n\nDevuelve el JSON con esta forma exacta:\n${FORMA_GOOGLE}`,
    forma: FORMA_GOOGLE,
    schema: googleAgenteSchema,
    preparar: prepararGoogle,
    rescatar: true,
    buscarWeb: false,
    onUso,
    maxTokens: MAX_TOKENS_GROWTH,
  });
}
