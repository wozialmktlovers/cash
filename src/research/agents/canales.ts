import { canalesSchema, type Canales } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: determinar dónde y cómo alcanzar a esta audiencia.
- plataformas: dónde está de verdad la audiencia, con su alcance y qué la caracteriza ahí.
- formatos: qué formatos rinden en ese nicho, no en general.
- horarios: cuándo consume contenido esta audiencia en particular.
- tendencias: lo que está cambiando ahora mismo en el nicho.
- advertenciaRegulatoria: si el giro tiene restricciones de publicidad (salud, estética,
  educación con aval, financiero), decláralas. Si no aplica, usa null: no inventes una.`;

export async function correrCanales(ctx: string) {
  return pedirJson<Canales>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga los canales y devuelve el JSON del esquema.`,
    schema: canalesSchema,
    buscarWeb: true,
  });
}
