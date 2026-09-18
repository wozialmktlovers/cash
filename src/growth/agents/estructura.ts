import { estructuraAgenteSchema, type Estructura } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH, MAX_TOKENS_GROWTH } from '@/growth/contexto';
import { prepararEstructura } from '@/growth/normalizar';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: definir la arquitectura de campaña y lo que impide arrancarla.

Criterios:
- Cada grupo de Meta ataca un ángulo distinto. Tres ángulos que digan lo mismo con otras palabras son un solo ángulo y desperdician el presupuesto.
- La audiencia de cada grupo sale de las personas de la investigación, no de una descripción genérica.
- Las cinco campañas de Google responden a intenciones distintas: quien busca la marca ya decidió, quien busca la categoría todavía compara, quien busca precio está a punto de descartar.
- semanas: la duración realista de la primera vuelta según el ciclo de compra investigado, como número entero entre 2 y 12.

Bloqueantes: lo que hay que resolver ANTES de gastar el primer peso. Cada uno accionable y verificable: qué está mal hoy y qué tiene que quedar. Incluye siempre lo que la investigación dejó sin responder y el monto de inversión mensual, que el cliente aún no ha dado. Un bloqueante que no se puede comprobar no sirve.

Reglas de copy: restricciones que aplican a todo anuncio de este cliente, derivadas de la regulación de su giro (alimentos, salud, finanzas, educación u otro: la que corresponda según la investigación) y de las políticas de plataforma. Cada una debe poder contrastarse contra la investigación o contra una política publicada.`;

// El esquema no viaja al modelo por sí solo: sin esta forma el modelo
// adivinaba las llaves de cada campaña («ángulo», «intención»…) y la etapa
// fallaba entera. Va en el pedido y en la corrección barata.
export const FORMA_ESTRUCTURA = `{
  "semanas": 6,
  "campanasMeta": [ { "grupo": "a | b | c", "nombre": "texto", "objetivo": "texto", "audiencia": "texto", "angulo": "texto" } ],
  "campanasGoogle": [ { "clave": "marca | categoria | precio | geo | contenido", "nombre": "texto", "intencion": "texto" } ],
  "bloqueantes": ["texto"],
  "reglasCopy": ["texto"]
}
Exactamente 3 campañas de Meta (una por grupo: a, b y c) y 5 de Google (una por clave). semanas es un número entero entre 2 y 12. Usa estas llaves tal cual, sin acentos y sin envolverlas en otro objeto.`;

export async function correrEstructura(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Estructura>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nDevuelve el JSON con esta forma exacta:\n${FORMA_ESTRUCTURA}`,
    forma: FORMA_ESTRUCTURA,
    schema: estructuraAgenteSchema,
    preparar: prepararEstructura,
    rescatar: true,
    buscarWeb: false,
    onUso,
    maxTokens: MAX_TOKENS_GROWTH,
  });
}
