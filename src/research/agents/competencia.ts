import { competenciaSchema, type Competencia } from '@/research/schemas';
import { pedirJson } from '@/research/claude';

export const SISTEMA_COMUN = `Eres analista de mercado para una agencia mexicana. Investigas con búsqueda web y devuelves JSON.

Reglas que no se rompen:
- Toda cifra lleva fuente con URL y fecha de consulta. Sin fuente verificable, se omite el dato.
- No inventes precios, cifras, citas ni testimonios. Si no lo encuentras, deja el arreglo vacío.
- Las citas textuales de personas privadas van anonimizadas: describe quién es, nunca su nombre de usuario.
- Prioriza fuentes primarias: sitios oficiales, institutos de estadística, registros públicos.
- Marca claramente lo que es estimación tuya frente a lo verificado.
- Responde solo con JSON válido, sin texto antes ni después.`;

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: mapear la competencia del cliente.
- Directos: mismo producto y mismo mercado. Busca precios reales en sus sitios.
- Indirectos: alternativas más baratas o fraccionadas que compiten por el mismo presupuesto.
- Referentes: las cuentas más grandes del nicho, con su número de seguidores y país.
- Hallazgos: qué revela el mapa de precios. Si hay una franja desatendida, dilo.`;

export async function correrCompetencia(ctx: string) {
  return pedirJson<Competencia>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga la competencia y devuelve el JSON del esquema.`,
    schema: competenciaSchema,
    buscarWeb: true,
  });
}
