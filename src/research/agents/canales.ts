import { canalesSchema, type Canales } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: determinar dónde y cómo alcanzar a esta audiencia.
- plataformas: dónde está de verdad la audiencia, con su alcance y qué la caracteriza ahí.
- formatos: qué formatos rinden en ese nicho, no en general.
- horarios: cuándo consume contenido esta audiencia en particular, en un solo texto (si varía por plataforma, dilo ahí mismo).
- tendencias: lo que está cambiando ahora mismo en el nicho.
- advertenciaRegulatoria: si el giro tiene restricciones de publicidad (salud, estética,
  alimentos y bebidas, educación con aval, financiero), decláralas. Si no aplica, usa null: no inventes una.`;

export const FORMA_CANALES = `{
  "plataformas": [ { "nombre": "texto", "alcance": "texto", "notas": "texto", "fuente": { "url": "https://...", "consultado": "AAAA-MM-DD" } } ],
  "formatos": ["texto", "..."],
  "horarios": "un solo texto, por ejemplo: Instagram de 19 a 22 h entre semana; TikTok sábados por la mañana",
  "tendencias": ["texto", "..."],
  "advertenciaRegulatoria": "texto o null"
}
"horarios" y "advertenciaRegulatoria" son cadenas de texto, no arreglos.`;

export async function correrCanales(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Canales>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga los canales y devuelve el JSON con esta forma exacta:\n${FORMA_CANALES}`,
    forma: FORMA_CANALES,
    schema: canalesSchema,
    buscarWeb: true,
    onUso,
  });
}
