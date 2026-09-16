// El agente que escribe el copy de una pieza (diseño §5, tarea B2).
//
// Es el hermano chico del estratega de `src/pilares/agentes.ts`: aquel decide
// POR QUÉ existe cada pieza y este escribe lo que se publica. Por eso comparte
// su voz —escenas humanas, nada de frases de agencia, no inventar datos del
// cliente— y no la repite palabra por palabra: allá se piden 300 temas de una
// vez, aquí tres opciones de una sola pieza.
//
// **Una pieza por petición** (diseño §5). No hay función que genere el mes
// entero, y no es un olvido: el costo se reparte, el operador elige y edita
// antes de pedir la siguiente, y un fallo no tumba el lote. Cada llamada trae
// su propio tope de gasto.

import { pedirJson } from '@/research/claude';
import { armarContexto } from '@/research/contexto';
import { todosLosTemas } from '@/pilares/revision';
import { calcularCosto, leerTopeUsd } from '@/lib/cost';
import { superaTope } from '@/research/pipeline';
import type { MapaPilares } from '@/pilares/schemas';
import {
  propuestasCopySchema, LIMITES, OPCIONES,
  type PiezaParaCopy, type Plataforma, type PropuestasCopy, type ResultadoPropuestas, type TemaParaCopy,
} from './schemas';
import type { Formato } from './reglas';

// El contexto del cliente se arma con el mismo `armarContexto` de la
// investigación y del mapa de pilares: ficha, enlaces y documentos, recortados
// igual. Se reexporta para que la ruta lo tome de aquí y no haya dos maneras
// de contarle al modelo quién es el cliente.
export { armarContexto };

/**
 * Las reglas del redactor. Las cuatro primeras son las del estratega
 * (`SISTEMA_PILARES`) dichas para quien redacta: si allá un tema no podía ser
 * un slogan vacío, aquí el copy tampoco.
 */
export const SISTEMA_COPY = `Eres redactor de contenidos para Facebook e Instagram en una agencia mexicana. Escribes en español de México, listo para publicarse tal cual.

Recibes el contexto de un cliente, un tema de su mapa de pilares y el formato de una pieza. Devuelves tres opciones de copy para esa misma pieza, más un brief visual para quien haga el arte.

Reglas:
- Parte de escenas y verdades humanas reconocibles, en el lenguaje de la audiencia. Evita ideas genéricas, slogans vacíos y frases de agencia como «descubre», «innovador» o «la mejor opción».
- Las tres opciones atacan el mismo tema por caminos distintos: otra entrada, otro ángulo, otro tono. Si una es la otra reescrita, el operador no tiene nada que elegir.
- El gancho es la primera línea, la que se lee antes del «ver más»: ahí va la escena o el conflicto, nunca el nombre de la marca ni un adjetivo.
- No inventes datos del cliente. Nada de precios, promociones, horarios, premios, cifras ni testimonios que no estén en el contexto. Si te falta un dato para cerrar la idea, escribe la idea sin él.
- No le atribuyas una carencia a quien lee ni prometas un resultado: Meta castiga los dos, y el cliente se queda con el anuncio rechazado.
- Calibra el tono con el contexto y los documentos del cliente: no fuerces una personalidad estándar.
- El llamado a la acción dice qué hacer y por dónde, con los canales que el cliente sí tiene. Uno solo por opción.
- Los hashtags son los de la conversación real del giro y de la ciudad, no adornos ni relleno.
- El brief visual describe lo que se ve —encuadre, qué aparece, qué texto va en pantalla—, no lo que se siente. Quien hace el arte tiene que poder ejecutarlo sin preguntarte nada.
- Responde solo con JSON válido, sin texto antes ni después.`;

/** Qué le pide cada formato al copy. El de la pieza manda sobre el que sugirió el mapa. */
const GUIA_FORMATO: Record<Formato, string> = {
  post: 'Post de una sola imagen: el copy carga la idea completa, porque la imagen no la explica.',
  carrusel: 'Carrusel: el gancho es la primera lámina y el copy avanza por pasos, uno por lámina. El brief visual dice cuántas láminas son y qué va en cada una.',
  reel: 'Reel: el gancho es lo que se dice y se ve en los tres primeros segundos. El copy es el pie del video, no el guion; el guion va en el brief visual.',
  historia: 'Historia: una sola idea, texto corto, se lee de un vistazo y desaparece en 24 horas. El llamado a la acción aprovecha el encuestar, el responder o el enlace.',
};

const NOMBRE_PLATAFORMA: Record<Plataforma, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  ambas: 'Facebook e Instagram (el mismo copy sirve para las dos)',
};

/** La forma del JSON que se pide, con los límites del esquema escritos donde el modelo los lea. */
const FORMA_PROPUESTAS = `{
  "opciones": [
    {
      "gancho": "la primera línea, máx. ${LIMITES.gancho}",
      "copy": "el texto completo listo para copiar, máx. ${LIMITES.copy}",
      "cta": "el llamado a la acción, máx. ${LIMITES.cta}",
      "hashtags": ["#unaSolaPalabra"],
      "briefVisual": "la indicación para quien hace el arte, máx. ${LIMITES.briefVisual}"
    }
  ]
}   // exactamente ${OPCIONES} opciones, de ${LIMITES.hashtagsMin} a ${LIMITES.hashtagsMax} hashtags cada una`;

/**
 * El mensaje del usuario: contexto del cliente, el tema del mapa y la pieza.
 *
 * El tema trae el formato que le sugirió la estrategia y la pieza trae el suyo,
 * y pueden no coincidir —el operador arma el mes con lo que el paquete pide, no
 * con lo que el mapa propuso—. El prompt lo dice sin rodeos para que el modelo
 * no intente escribir un reel dentro de una historia.
 */
export function armarEntradaPropuestas(ctx: string, tema: TemaParaCopy, pieza: PiezaParaCopy): string {
  const fecha = pieza.fechaPublicacion ? `\nFecha de publicación: ${pieza.fechaPublicacion}` : '';
  const mismoFormato = tema.formato === pieza.formato;

  return `${ctx}

## El tema del mapa de pilares
Id: ${tema.id}
Tema: ${tema.texto}
Función en el mix: ${tema.funcion}
Formato que sugirió la estrategia: ${tema.formato}

## La pieza
Formato: ${pieza.formato}
Plataforma: ${NOMBRE_PLATAFORMA[pieza.plataforma]}${fecha}
${GUIA_FORMATO[pieza.formato]}
${mismoFormato ? '' : `El formato de la pieza es ${pieza.formato} y manda sobre el que sugirió la estrategia (${tema.formato}): escribe para ${pieza.formato}.\n`}
## Tu tarea
Escribe ${OPCIONES} opciones de copy para esta pieza, desde ese tema y respetando su función en el mix.

Devuelve el JSON con esta forma:
${FORMA_PROPUESTAS}`;
}

/**
 * Busca un tema por su id en los mapas de pilares de un cliente, del más
 * reciente al más viejo, y lo devuelve en la forma que necesita el prompt.
 *
 * Se recorren todas las versiones a propósito. Una pieza guarda el id del tema
 * (`P2-S1-07`), no una copia de su texto, y regenerar el mapa reescribe lo que
 * hay detrás de ese id: si solo se mirara la última versión, pedir propuestas
 * para una pieza planeada con el mapa anterior contestaría «ese tema no
 * existe». Gana la versión más reciente que sí lo tenga, que es la vigente
 * para ese tema.
 *
 * `datos` llega como `unknown` porque es una columna `jsonb`: un mapa donde los
 * cinco pilares fallaron no tiene `pilares` que recorrer, y eso no debe reventar.
 */
export function temaDelMapa(mapas: { datos: unknown }[], temaId: string): TemaParaCopy | null {
  for (const mapa of mapas) {
    const pilares = (mapa?.datos as MapaPilares | null)?.pilares;
    if (!Array.isArray(pilares)) continue;
    const tema = todosLosTemas(pilares).find((t) => t.id === temaId);
    if (tema) return { id: tema.id, texto: tema.texto, funcion: tema.funcion, formato: tema.formato };
  }
  return null;
}

/**
 * El modelo que escribe el copy. El mismo `MODEL_RESEARCH` que escribe los
 * temas de un pilar: es trabajo de redacción sobre un contexto ya razonado,
 * no de estrategia. El de síntesis (Opus) se reserva para lo que decide, y
 * aquí se pide muchas veces al mes —una por pieza—, así que el precio importa.
 */
export function modeloCopy(): string {
  return process.env.MODEL_RESEARCH || 'claude-sonnet-5';
}

/**
 * Tope de gasto de UNA petición de propuestas, en dólares.
 *
 * Medio dólar es varias veces lo que cuesta la llamada esperada (el contexto
 * de un cliente con documentos, más tres opciones de copy, ronda los centavos
 * con Sonnet), así que deja lugar al reintento por esquema de `pedirJson` sin
 * frenar una petición legítima. No se parece al `COST_LIMIT_USD` de 15 de la
 * investigación porque no se parecen: aquel paga un job entero de once
 * agentes, este una pieza de un lote de veintitantas.
 */
export function topePropuestasUsd(): number {
  return leerTopeUsd(process.env.COST_LIMIT_PROPUESTAS_USD, 0.5, 'COST_LIMIT_PROPUESTAS_USD');
}

/**
 * El freno de gasto de una petición, con la misma mecánica del resto del
 * sistema: se cuenta cada respuesta con `calcularCosto` y se devuelve `false`
 * cuando lo acumulado alcanza el tope, que es lo que `pedirJson` entiende como
 * «no reanudes».
 *
 * Alcance honesto: como en los otros agentes, esto no corta una respuesta a la
 * mitad —nadie puede—, corta lo que vendría después. Aquí eso es poco, porque
 * la petición es una sola llamada sin búsqueda web; su trabajo de verdad es
 * medir lo que se gastó y dejarlo dicho en el resultado. El freno que importa
 * en esta etapa es el diseño: una pieza por petición, no el mes de golpe.
 */
export function frenoDeGasto(modelo: string, tope: number) {
  const gasto = { valor: 0 };
  const onUso = (entrada: number, salida: number): boolean => {
    gasto.valor += calcularCosto(modelo, entrada, salida);
    return !superaTope(gasto.valor, tope);
  };
  return { gasto, onUso };
}

/** La llamada cruda al modelo. Sin búsqueda web: todo lo que necesita saber va en el contexto. */
export async function correrPropuestas(
  ctx: string, tema: TemaParaCopy, pieza: PiezaParaCopy,
  onUso?: (e: number, s: number) => boolean,
  modelo = modeloCopy(),
) {
  return pedirJson<PropuestasCopy>({
    modelo,
    sistema: SISTEMA_COPY,
    usuario: armarEntradaPropuestas(ctx, tema, pieza),
    schema: propuestasCopySchema,
    buscarWeb: false,
    onUso,
    // Tres copys de hasta 2200 caracteres, con sus hashtags y sus briefs, caben
    // de sobra en 8k. Subirlo solo encarecería el reintento por esquema.
    maxTokens: 8_000,
  });
}

/**
 * Las propuestas de una pieza, con su tope de gasto puesto y su costo contado.
 * Es lo que llama la ruta `POST /api/contenido/piezas/[id]/propuestas`.
 *
 * No guarda nada: devuelve las tres opciones y el operador elige, edita y
 * guarda con la API de piezas (diseño §5). Generar y guardar son dos gestos
 * distintos, y mezclarlos obligaría a pisar el copy que alguien ya trabajó
 * cada vez que pide una segunda tanda de ideas.
 */
export async function generarPropuestas(
  ctx: string, tema: TemaParaCopy, pieza: PiezaParaCopy,
  opciones: { tope?: number; modelo?: string } = {},
): Promise<ResultadoPropuestas> {
  const modelo = opciones.modelo ?? modeloCopy();
  const tope = opciones.tope ?? topePropuestasUsd();
  const freno = frenoDeGasto(modelo, tope);

  const r = await correrPropuestas(ctx, tema, pieza, freno.onUso, modelo);

  return {
    opciones: r.datos.opciones,
    tokensEntrada: r.tokensEntrada,
    tokensSalida: r.tokensSalida,
    costoUsd: freno.gasto.valor,
    topeUsd: tope,
    topeAlcanzado: superaTope(freno.gasto.valor, tope),
  };
}
