// El agente que escribe el mes completo, por tandas (una por semana).
//
// Es el hermano mayor del redactor de propuestas (`src/contenido/agentes.ts`):
// comparte su voz —escenas humanas, nada de frases de agencia, no inventar
// datos del cliente— y su contexto (`armarContexto`, el mismo de la
// investigación y del mapa), pero en vez de tres opciones de una pieza escribe
// una pieza terminada por ranura, con todo lo que hace falta para producirla.
//
// Lo que NO decide: cuántas piezas, de qué formato ni qué día. Eso llega ya
// resuelto en las ranuras (./plan.ts). Decide el texto y cuál de los temas
// candidatos de su ranura usa.

import { pedirJson } from '@/research/claude';
import type { MapaPilares } from '@/pilares/schemas';
import { LIMITES_PIEZA, type Formato } from '../reglas';
import { prepararTanda } from './normalizar';
import { tandaMesSchema, type TandaMes } from './schemas';
import type { Ranura } from './plan';
import type { TemaCatalogo } from './temas';
import { respuestaSimulada, simulacionActiva } from './simulacion';

/** El modelo del mes: el de redacción, igual que las propuestas de copy. */
export function modeloMes(): string {
  return process.env.MODEL_RESEARCH || 'claude-sonnet-5';
}

/**
 * Tope de salida por tanda. En Sonnet 5 el razonamiento gasta del mismo
 * `max_tokens` que el JSON, y ocho piezas con copy largo, guion y tarjetas
 * rondan los 12k: 32k deja holgura para pensar sin cortar la respuesta. Solo
 * se paga lo que se usa.
 */
export const MAX_TOKENS_MES = 32_000;

export const SISTEMA_MES = `Eres redactor de contenidos para Facebook e Instagram en una agencia mexicana. Escribes en español de México, listo para publicarse tal cual.

Recibes el contexto de un cliente, su estrategia editorial y un grupo de ranuras del calendario del mes. Cada ranura ya trae su formato, su fecha, la función del mix que debe cumplir y unos temas candidatos del mapa de pilares. Para cada ranura eliges UNO de sus candidatos y escribes la pieza completa.

Reglas:
- Elige el tema solo de los candidatos de esa ranura, y copia su id tal cual. No repitas un tema entre ranuras.
- Parte de escenas y verdades humanas reconocibles, en el lenguaje de la audiencia. Evita ideas genéricas, slogans vacíos y frases de agencia como «descubre», «innovador» o «la mejor opción».
- El gancho es la primera línea del copy, la que se lee antes del «ver más»: ahí va la escena o el conflicto, nunca el nombre de la marca ni un adjetivo.
- No inventes datos del cliente. Nada de precios, promociones, horarios, premios, cifras ni testimonios que no estén en el contexto. Si te falta un dato para cerrar la idea, escribe la idea sin él.
- No supongas el tipo de negocio: sale del contexto. No conviertas todo en una clase o un consejo si el giro no lo pide.
- No le atribuyas una carencia a quien lee ni prometas un resultado: Meta castiga los dos.
- Calibra el tono con el contexto y los documentos del cliente.
- Varía las entradas entre piezas: que no empiecen igual ni repitan estructura.
- El llamado a la acción dice qué hacer y por dónde, con los canales que el cliente sí tiene. Uno solo por pieza.
- Los hashtags son los de la conversación real del giro y de la ciudad, no adornos.
- El brief visual describe lo que se ve —encuadre, qué aparece, qué texto va en pantalla—, no lo que se siente.
- El prompt de imagen es para una herramienta de generación de imágenes: sujeto, escena, encuadre, luz, estilo fotográfico y paleta, en una sola descripción. Sin texto dentro de la imagen, sin logotipos ni marcas, sin personas reales identificables.
- Responde solo con JSON válido, sin texto antes ni después.`;

/** Qué le pide cada formato a la pieza. */
const GUIA_FORMATO: Record<Formato, string> = {
  post: 'post de una imagen: el copy carga la idea completa. Sin guion ni tarjetas.',
  carrusel: 'carrusel 4:5: «tarjetas» lleva el texto de cada lámina (de 3 a 10), la primera es el gancho y la última invita a actuar; el copy acompaña, no repite las láminas. Sin guion.',
  reel: 'reel vertical 9:16: «guion» lleva las escenas en orden (de 3 a 8), cada una con lo que se ve y lo que se dice o aparece en pantalla; la primera escena resuelve los tres primeros segundos. El copy es el pie del video. Sin tarjetas.',
  historia: 'historia vertical 9:16: una sola idea que se lee de un vistazo, copy corto; el llamado aprovecha la encuesta, la respuesta o el enlace. Sin guion ni tarjetas.',
};

const NOMBRE_FUNCION: Record<string, string> = {
  autoridad: 'autoridad', conexion: 'conexión', engagement: 'conversación (engagement)', prueba_social: 'prueba social', venta: 'venta',
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const fechaLarga = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} (${iso})`;
};

/**
 * La forma exacta del JSON (lección de 99a13cb): va en el pedido y viaja como
 * `forma` al pedido de corrección de `pedirJson`, que así sabe a qué ajustar
 * una respuesta cortada o mal formada.
 */
export const FORMA_TANDA = `{
  "piezas": [
    {
      "ref": 3,
      "temaId": "P2-S1-07",
      "plataforma": "ambas",
      "copy": "texto completo listo para publicar, máx. ${LIMITES_PIEZA.copy} caracteres",
      "cta": "un solo llamado a la acción, máx. ${LIMITES_PIEZA.cta}",
      "hashtags": ["#unaSolaPalabra"],
      "briefVisual": "lo que se ve, para quien hace el arte, máx. ${LIMITES_PIEZA.briefVisual}",
      "promptImagen": "descripción para una herramienta de generación de imágenes, máx. ${LIMITES_PIEZA.promptImagen}",
      "guion": [{ "visual": "lo que se ve", "texto": "lo que se dice o aparece escrito" }],
      "tarjetas": ["texto de la lámina 1", "texto de la lámina 2"]
    }
  ]
}
Una pieza por ranura, con el mismo "ref" de la ranura. "plataforma" es "facebook", "instagram" o "ambas". De 5 a 10 hashtags. "guion" solo en reels y "tarjetas" solo en carruseles; en los demás formatos van vacíos: [].`;

/** Lo que el agente necesita de la estrategia del mapa: el porqué, no los 300 temas. */
export function resumenEstrategia(mapa: MapaPilares | null): string {
  const e = mapa?.estrategia;
  if (!e) return 'Sin estrategia editorial registrada.';
  const pilares = (e.pilares ?? []).map((p, i) => `${i + 1}. ${p.nombre}: ${p.objetivo} (frontera: ${p.frontera})`).join('\n');
  const mix = (e.mix ?? []).map((m) => `- ${NOMBRE_FUNCION[m.funcion] ?? m.funcion}: ${m.porcentaje} % · ${m.descripcion}`).join('\n');
  const principios = (e.principios ?? []).map((p) => `- ${p.titulo}`).join('\n');
  return `Idea rectora: ${e.resumen}
${e.reglaEspecial ? `Regla especial: ${e.reglaEspecial}\n` : ''}
Pilares:
${pilares}

Mix editorial:
${mix}

Principios:
${principios}

Camino a la conversión: ${e.conversion?.titulo ?? ''} · ${e.conversion?.texto ?? ''}`;
}

export type EntradaTanda = {
  /** Cliente (ficha, enlaces, documentos), estrategia e investigación, ya en texto. */
  contexto: string;
  periodo: string;
  nombreMes: string;
  ranuras: Ranura[];
  candidatos: Map<number, TemaCatalogo[]>;
  nombresPilares: string[];
  /** La primera línea de lo que ya se escribió este mes, para no repetir entradas. */
  yaEscritas: string[];
};

export function armarEntradaTanda(t: EntradaTanda): string {
  const ranuras = t.ranuras.map((r) => {
    const cands = (t.candidatos.get(r.ref) ?? []).map((c) =>
      `   - ${c.id} · ${c.texto} (función: ${NOMBRE_FUNCION[c.funcion] ?? c.funcion}; formato sugerido: ${c.formato}${c.estado === 'pendiente' ? '' : `; ya ${c.estado.replace('_', ' ')}`})`,
    ).join('\n');
    return `Ranura ${r.ref} · ${r.formato} · ${fechaLarga(r.fecha)}
 Función del mix: ${NOMBRE_FUNCION[r.funcion] ?? r.funcion} · pilar sugerido: ${t.nombresPilares[r.pilar - 1] ?? `Pilar ${r.pilar}`}
 Formato: ${GUIA_FORMATO[r.formato]}
 Temas candidatos:
${cands || '   (el mapa ya no tiene temas libres: escribe desde la estrategia y deja "temaId": null)'}`;
  }).join('\n\n');

  const previas = t.yaEscritas.length
    ? `\n## Ya escrito este mes (no repitas estas entradas)\n${t.yaEscritas.map((l) => `- ${l}`).join('\n')}\n`
    : '';

  return `${t.contexto}
${previas}
## Tu tarea
Escribe las piezas de estas ranuras de ${t.nombreMes}. Una pieza por ranura.

${ranuras}

Devuelve el JSON con esta forma exacta:
${FORMA_TANDA}`;
}

/**
 * La llamada al modelo de una tanda. Con todas las lecciones de hoy puestas:
 * forma exacta en el pedido y en la corrección, `preparar` con el
 * normalizador, esquema tolerante, rescate de lo parcial y salida holgada.
 *
 * En desarrollo, con `CONTENIDO_MES_SIMULADO=1`, no llama a la API: devuelve
 * una respuesta inventada (./simulacion.ts) que pasa por el mismo `preparar` y
 * el mismo esquema. En producción ese camino no existe (`simulacionActiva`).
 */
export async function correrTanda(
  t: EntradaTanda,
  onUso?: (entrada: number, salida: number) => boolean,
  modelo = modeloMes(),
): Promise<{ datos: TandaMes; tokensEntrada: number; tokensSalida: number; parcial?: boolean; descartes?: string[] }> {
  const preparar = prepararTanda(t.ranuras.map((r) => r.ref), t.periodo);
  if (simulacionActiva()) {
    const crudo = preparar(respuestaSimulada(t));
    return { datos: tandaMesSchema.parse(crudo), tokensEntrada: 0, tokensSalida: 0 };
  }
  return pedirJson<TandaMes>({
    modelo,
    sistema: SISTEMA_MES,
    usuario: armarEntradaTanda(t),
    schema: tandaMesSchema,
    buscarWeb: false,
    onUso,
    forma: FORMA_TANDA,
    preparar,
    rescatar: true,
    maxTokens: MAX_TOKENS_MES,
  });
}
