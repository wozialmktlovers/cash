import { audienciaSchema, type Audiencia } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: reconstruir cómo habla y qué teme la audiencia del cliente.
- Escalera de términos: cómo se nombra a sí misma la audiencia, del término más humilde al más aspiracional, con la connotación de cada uno.
- Jerga: expresiones propias del oficio. jergaNegocio: cómo hablan de dinero y clientes.
- Tono: cómo suena la conversación real del nicho, no cómo suena la publicidad.
- Dolores y aspiraciones: citas textuales de foros, comentarios y reseñas, siempre anonimizadas.
  Describe a la persona ("egresada de un curso corto, sin clientes"), nunca su usuario.
- miedoPrincipal: el que de verdad frena la compra, con la evidencia que lo sustenta.
- unidadDeCompra: qué cree la audiencia que está comprando. Rara vez es el producto que se vende.
- personas: exactamente dos, deliberadamente contrastantes entre sí.`;

export async function correrAudiencia(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Audiencia>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga la audiencia y devuelve el JSON del esquema.`,
    schema: audienciaSchema,
    buscarWeb: true,
    onUso,
  });
}
