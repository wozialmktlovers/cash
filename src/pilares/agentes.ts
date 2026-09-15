import { pedirJson } from '@/research/claude';
import {
  estrategiaSchema, pilarSchemaPara, reemplazosSchema, FUNCIONES, FORMATOS,
  type Estrategia, type PilarGenerado, type Tema,
} from './schemas';

// Listas explícitas para el prompt de corrección: se arman desde las
// constantes de `schemas.ts` para no repetir a mano los valores del enum.
const FUNCIONES_LISTA = FUNCIONES.join(' | ');
const FORMATOS_LISTA = FORMATOS.join(' | ');

export const SISTEMA_PILARES = `Eres estratega y planner de contenidos para Facebook e Instagram en una agencia mexicana. Tu trabajo no es redactar posts: defines por qué debe existir cada pieza y cómo conecta los objetivos del negocio con lo que la audiencia quiere ver y valora.

El entregable completo son 5 pilares, 3 subcategorías por pilar y 20 temas por subcategoría: 300 temas únicos.

Reglas:
- Los temas equilibran autoridad, conexión humana, participación, prueba social y venta.
- Un tema no es un post: es un headline, un disparador o un ángulo que funcione en Reels, carruseles y stories.
- Parte de escenas y verdades humanas reconocibles, en el lenguaje de la audiencia. Evita ideas genéricas, slogans vacíos y frases de agencia como «descubre», «innovador» o «la mejor opción».
- Nada de temas demasiado parecidos entre sí.
- Calibra el tono con la investigación y los documentos del cliente: no fuerces una personalidad estándar.
- No inventes datos del cliente. Si falta información, avanza con supuestos razonables y decláralos en supuestos.
- Responde solo con JSON válido, sin texto antes ni después.`;

const NOMBRES_INVESTIGACION: Record<string, string> = {
  competencia: 'Competencia', audiencia: 'Audiencia', canales: 'Canales', mercado: 'Mercado', sintesis: 'Síntesis estratégica',
};

const FORMA_ESTRATEGIA = `{
  "resumen": "máx. 240",
  "ideas": [ { "titulo": "máx. 80", "texto": "máx. 320" } ],   // exactamente 3: la idea que gobierna toda la comunicación
  "principios": [ { "titulo": "máx. 80", "texto": "máx. 220" } ],   // exactamente 12 no negociables
  "pilares": [ { "nombre": "máx. 50", "pregunta": "qué conversación resuelve, máx. 160", "funcion": "máx. 120", "objetivo": "máx. 320", "frontera": "qué le toca y qué no, máx. 220",
                 "subcategorias": [ { "nombre": "máx. 70" } ] } ],   // exactamente 5 pilares con 3 subcategorias cada uno
  "mix": [ { "funcion": "autoridad | conexion | engagement | prueba_social | venta", "porcentaje": 0, "descripcion": "máx. 140" } ],   // una por función, suman 100
  "conversion": { "titulo": "máx. 90", "texto": "máx. 320", "pasos": [ { "nombre": "máx. 30", "texto": "máx. 180" } ] },   // 3 pasos
  "reglaEspecial": "una regla editorial que el giro exige, máx. 400, o null",
  "supuestos": ["máx. 200"]   // 0 a 5
}`;

export function armarEntradaEstrategia(ctx: string, investigacion: Record<string, unknown>): string {
  const bloques = Object.entries(NOMBRES_INVESTIGACION)
    .filter(([k]) => (investigacion[k] as any)?.estado === 'ok')
    .map(([k, nombre]) => `### ${nombre}\n${JSON.stringify((investigacion[k] as any).datos, null, 2)}`)
    .join('\n\n');
  return `${ctx}\n\n## Investigación\n${bloques || '(sin datos)'}\n\nDefine la estrategia del mapa de pilares. Devuelve el JSON con esta forma:\n${FORMA_ESTRATEGIA}`;
}

const FORMA_PILAR = `{
  "subcategorias": [
    { "nombre": "exactamente el nombre definido en la estrategia", "temas": [ { "texto": "máx. 160", "funcion": "autoridad | conexion | engagement | prueba_social | venta", "formato": "reel | carrusel | story" } ] }
  ]
}   // 3 subcategorias en el orden de la estrategia, 20 temas cada una`;

export function armarEntradaPilar(ctx: string, estrategia: Estrategia, numero: number): string {
  const p = estrategia.pilares[numero - 1];
  return `${ctx}

## Estrategia completa
${JSON.stringify(estrategia, null, 2)}

## Tu tarea
Escribe los 60 temas del pilar ${numero}: «${p.nombre}».
Respeta su frontera y no invadas los otros cuatro pilares.
Reparte las funciones según el mix de la estrategia y alterna formatos.
Subcategorías, en este orden:
${p.subcategorias.map((s, i) => `${i + 1}. ${s.nombre}`).join('\n')}

Devuelve el JSON con esta forma:
${FORMA_PILAR}`;
}

export function armarEntradaCorreccion(estrategia: Estrategia, numero: number, aReescribir: Tema[], evitar: string[]): string {
  return `## Estrategia
${JSON.stringify(estrategia, null, 2)}

## Tu tarea
Estos temas del pilar ${numero} («${estrategia.pilares[numero - 1].nombre}») se parecen demasiado a otros del mapa. Reescribe cada uno con un ángulo nuevo, sin salirte de su subcategoría, y conserva su id.
${aReescribir.map((t) => `- ${t.id} [${t.funcion} · ${t.formato}]: ${t.texto}`).join('\n')}

Temas del mapa que no puedes repetir ni parafrasear:
${evitar.map((t) => `- ${t}`).join('\n')}

Devuelve { "temas": [ { "id": "el mismo", "texto": "máx. 160", "funcion": "${FUNCIONES_LISTA}", "formato": "${FORMATOS_LISTA}" } ] }`;
}

export async function correrEstrategia(ctx: string, investigacion: Record<string, unknown>, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Estrategia>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaEstrategia(ctx, investigacion),
    schema: estrategiaSchema,
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento consume del mismo presupuesto que el texto.
    maxTokens: 24_000,
  });
}

export async function correrPilar(ctx: string, estrategia: Estrategia, numero: number, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<PilarGenerado>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaPilar(ctx, estrategia, numero),
    schema: pilarSchemaPara(estrategia.pilares[numero - 1].subcategorias.map((s) => s.nombre)),
    buscarWeb: false,
    onUso,
    maxTokens: 16_000,
  });
}

export async function correrCorreccion(
  estrategia: Estrategia, numero: number, aReescribir: Tema[], evitar: string[], onUso?: (e: number, s: number) => boolean,
) {
  return pedirJson<{ temas: Tema[] }>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaCorreccion(estrategia, numero, aReescribir, evitar),
    schema: reemplazosSchema,
    buscarWeb: false,
    onUso,
  });
}
