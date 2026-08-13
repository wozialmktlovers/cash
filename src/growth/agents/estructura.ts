import { estructuraSchema, type Estructura } from '@/growth/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_GROWTH } from '@/growth/contexto';

const SISTEMA = `${SISTEMA_GROWTH}

Tu tarea: definir la arquitectura de campaña y lo que impide arrancarla.

Criterios:
- Cada grupo de Meta ataca un ángulo distinto. Tres ángulos que digan lo mismo con otras palabras son un solo ángulo y desperdician el presupuesto.
- La audiencia de cada grupo sale de las personas de la investigación, no de una descripción genérica.
- Las cinco campañas de Google responden a intenciones distintas: quien busca la marca ya decidió, quien busca la categoría todavía compara, quien busca precio está a punto de descartar.
- semanas: la duración realista de la primera vuelta según el ciclo de compra investigado.

Bloqueantes: lo que hay que resolver ANTES de gastar el primer peso. Cada uno accionable y verificable: qué está mal hoy y qué tiene que quedar. Incluye siempre lo que la investigación dejó sin responder y el monto de inversión mensual, que el cliente aún no ha dado. Un bloqueante que no se puede comprobar no sirve.

Reglas de copy: restricciones que aplican a todo anuncio de este cliente, derivadas de la regulación del giro y de las políticas de plataforma. Cada una debe poder contrastarse contra la investigación o contra una política publicada.`;

export async function correrEstructura(ctx: string, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Estructura>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nDevuelve el JSON con semanas, campanasMeta, campanasGoogle, bloqueantes y reglasCopy.`,
    schema: estructuraSchema,
    buscarWeb: false,
    onUso,
  });
}
