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

Tu tarea: mapear la competencia del cliente, sea cual sea su giro (tienda, restaurante,
servicio profesional, producto de consumo, escuela…). No supongas que vende cursos.
- Directos: lo mismo que vende el cliente, en su mismo mercado. Busca precios reales en sus sitios,
  tiendas en línea o menús. Si no publican precio, deja precio vacío: no lo estimes.
- Indirectos: alternativas más baratas, fraccionadas o de otra categoría que compiten por el mismo presupuesto.
- detalles: lo que distingue cada oferta en ESTE giro (presentación, tamaño, formato, ubicación,
  horario, entrega, garantía, certificación, duración…). Solo lo que aplique; cada detalle, un texto corto.
- Referentes: las cuentas más grandes del giro, con su número de seguidores y país.
- Hallazgos: qué revela el mapa de precios. Si hay una franja desatendida, dilo.`;

export const FORMA_COMPETENCIA = `{
  "directos": [ {
    "nombre": "texto",
    "producto": "texto: qué vende (producto o servicio principal)",
    "precio": "texto tal como lo publica, o \"\" si no lo publica",
    "detalles": ["texto corto", "..."],
    "fuente": { "url": "https://...", "consultado": "AAAA-MM-DD" }
  } ],
  "indirectos": [ /* misma forma que directos */ ],
  "referentes": [ { "cuenta": "texto", "seguidores": 12400, "pais": "texto", "fuente": { "url": "https://...", "consultado": "AAAA-MM-DD" } } ],
  "hallazgos": ["texto", "..."]
}
Cada valor de texto es una cadena, nunca un arreglo ni un objeto. "seguidores" es un número entero.`;

export async function correrCompetencia(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Competencia>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga la competencia y devuelve el JSON con esta forma exacta:\n${FORMA_COMPETENCIA}`,
    forma: FORMA_COMPETENCIA,
    schema: competenciaSchema,
    buscarWeb: true,
    onUso,
  });
}
