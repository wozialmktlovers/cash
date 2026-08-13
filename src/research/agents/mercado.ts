import { mercadoSchema, type Mercado } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: dimensionar el mercado con datos oficiales.
- datos: cifras del sector con fuente primaria. INEGI, IMSS, DENUE, secretarías,
  cámaras y colegios. Cada dato lleva su etiqueta y su valor tal como los publica la fuente.
- salarios: cuánto gana quien ejerce este oficio, por puesto y rango.
- regulacion: normas aplicables y qué implica cada una para el negocio.
- crecimiento: la tendencia del sector si hay serie histórica que la sustente.
  Si no la hay, usa null. No proyectes una cifra que no puedas respaldar.`;

export async function correrMercado(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Mercado>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga el mercado y devuelve el JSON del esquema.`,
    schema: mercadoSchema,
    buscarWeb: true,
    onUso,
  });
}
