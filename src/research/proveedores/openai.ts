import {
  entradaEquivalenteOpenAI, COSTO_BUSQUEDA_WEB_OPENAI_USD, usdAEntradaEquivalente,
} from '@/lib/cost';
import {
  MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO, SISTEMA_CORRECCION, MAX_TOKENS_CORRECCION,
  evaluar, intentarRescate, type PedirJsonOpts, type ResultadoJson,
} from './comun';

/**
 * Implementación de `pedirJson` contra la Responses API de OpenAI, usada
 * cuando `PROVEEDOR_IA` (o `PROVEEDOR_IA_BUSQUEDA`) vale "openai". Réplica lo
 * más fiel posible del comportamiento de `./anthropic.ts` —mismo contrato de
 * entrada/salida, mismo `evaluar`/`preparar`/rescate— con las diferencias que
 * impone la API de OpenAI, documentadas abajo.
 *
 * Se llama por `fetch` directo, sin el SDK `openai` (no está instalado y
 * `npm install` está prohibido en este trabajo). La Responses API es HTTP
 * llano y no necesita más.
 *
 * Decisiones de diseño:
 *
 * - MODELO: se ignora el `modelo` de Anthropic que traen los agentes
 *   (`opts.modelo`, p. ej. "claude-sonnet-5") y se elige un modelo de OpenAI
 *   aparte, según `buscarWeb`: económico para las cuatro etapas de búsqueda,
 *   de mejor calidad para el resto (síntesis, lectura, growth, mes). Ver
 *   `modeloDe` abajo para los nombres y por qué.
 *
 * - JSON "a mano" en vez de JSON Schema estricto: la Responses API soporta
 *   forzar una forma exacta (`text.format.type: "json_schema"`), pero eso
 *   pide el JSON Schema del zod de cada agente, y no hay ninguna librería de
 *   zod→JSON Schema instalada (tampoco se puede instalar una para este
 *   trabajo). Construirlo a mano por agente duplicaría cada esquema. En su
 *   lugar se usa `text.format.type: "json_object"`: OpenAI garantiza JSON
 *   sintácticamente válido (nunca falla `extraerJson`), y la FORMA exacta se
 *   sigue validando con el mismo `schema` de zod, el mismo `preparar` y el
 *   mismo ajuste/rescate que ya usa Anthropic. Es menos estricto que un JSON
 *   Schema real, pero no pierde ninguna de las protecciones que ya había.
 *
 * - SIN reanudaciones (`pause_turn`): la búsqueda web de la Responses API
 *   corre del lado del servidor dentro de UNA sola llamada; no hay un
 *   equivalente de `pause_turn` que el cliente deba reanudar. Por eso no hay
 *   aquí un bucle como el de `anthropic.ts` ni un tope de búsquedas
 *   (`BUSQUEDAS_MAX`): la Responses API no expone un `max_uses` por turno, así
 *   que no hay nada razonable que replicar. `onUso` se llama una sola vez, al
 *   terminar la llamada (y otra más si hay corrección), no se puede frenar a
 *   media búsqueda como con Anthropic.
 *
 * - SIN marcas de caché: OpenAI cachea automáticamente los prompts repetidos
 *   (a partir de cierto tamaño) sin que el cliente tenga que marcar nada, así
 *   que no hay equivalente de `cache_control` que declarar aquí; el ahorro ya
 *   ocurre solo y se refleja en `input_tokens_details.cached_tokens`
 *   (`entradaEquivalenteOpenAI` en `@/lib/cost`).
 */

const URL_RESPUESTAS = 'https://api.openai.com/v1/responses';

/**
 * Modelo económico para las cuatro etapas con búsqueda web (competencia,
 * audiencia, canales, mercado) y modelo de mejor calidad para el resto
 * (síntesis, lectura, growth, contenido del mes). Replica el mismo patrón
 * barato/caro que `MODEL_BUSQUEDA`/`MODEL_SYNTHESIS` ya tienen con Anthropic,
 * pero con nombres propios (`MODEL_BUSQUEDA_OPENAI`/`MODEL_SYNTHESIS_OPENAI`):
 * el "barato" de Anthropic (sonnet) también es el modelo de `MODEL_RESEARCH`
 * que usan growth y el contenido del mes SIN búsqueda, y esos dos deben caer
 * en el tramo de mejor calidad con OpenAI, no en el económico; no hay forma
 * de replicar eso reutilizando los mismos nombres de variable que Anthropic.
 *
 * Modelos por omisión, elegidos el 2026-09-30 (con capacidad de búsqueda web
 * real vía la herramienta integrada `web_search` de la Responses API):
 * - gpt-5-mini: económico, para las cuatro búsquedas.
 * - gpt-5: mejor calidad, para síntesis/lectura/growth/mes.
 */
function modeloDe(buscarWeb: boolean): string {
  return buscarWeb
    ? (process.env.MODEL_BUSQUEDA_OPENAI || 'gpt-5-mini')
    : (process.env.MODEL_SYNTHESIS_OPENAI || 'gpt-5');
}

function textoDe(res: any): string {
  if (typeof res?.output_text === 'string' && res.output_text) return res.output_text;
  const salidas = Array.isArray(res?.output) ? res.output : [];
  return salidas
    .filter((o: any) => o?.type === 'message')
    .flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
    .filter((c: any) => c?.type === 'output_text')
    .map((c: any) => c.text)
    .join('\n');
}

function refusalDe(res: any): string | undefined {
  const salidas = Array.isArray(res?.output) ? res.output : [];
  const bloque = salidas
    .filter((o: any) => o?.type === 'message')
    .flatMap((o: any) => (Array.isArray(o.content) ? o.content : []))
    .find((c: any) => c?.type === 'refusal');
  return bloque?.refusal;
}

/** Cuántas veces invocó la respuesta la herramienta de búsqueda web. */
function llamadasDeBusqueda(res: any): number {
  const salidas = Array.isArray(res?.output) ? res.output : [];
  return salidas.filter((o: any) => o?.type === 'web_search_call').length;
}

async function llamar(cuerpo: Record<string, unknown>): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY');
  const res = await fetch(URL_RESPUESTAS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(cuerpo),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const mensaje = json?.error?.message ?? res.statusText ?? `HTTP ${res.status}`;
    throw new Error(`OpenAI: ${mensaje}`);
  }
  return json;
}

export async function pedirJsonOpenAI<T>(opts: PedirJsonOpts<T>): Promise<ResultadoJson<T>> {
  const { sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000, onUso, forma, preparar } = opts;
  const rescatar = opts.rescatar ?? buscarWeb;
  const modelo = modeloDe(buscarWeb);

  let entrada = 0, salida = 0;

  const contabilizar = (res: any): boolean => {
    let e = Math.round(entradaEquivalenteOpenAI(res?.usage));
    const s = res?.usage?.output_tokens ?? 0;
    const busquedas = llamadasDeBusqueda(res);
    if (busquedas > 0) {
      e += Math.round(usdAEntradaEquivalente(modelo, busquedas * COSTO_BUSQUEDA_WEB_OPENAI_USD));
    }
    entrada += e; salida += s;
    return onUso ? onUso(e, s) : true;
  };

  // Siempre se pide JSON sintácticamente válido; la forma exacta la valida
  // `evaluar` con el `schema` de zod, igual que con Anthropic. Al sistema se
  // le agrega un recordatorio explícito porque el modo `json_object` de
  // OpenAI exige que la palabra "json" aparezca en las instrucciones.
  const instrucciones = `${sistema}\n\nResponde únicamente con un objeto JSON válido, sin texto antes ni después.`;

  const cuerpo = (mensaje: string, conBusqueda: boolean, modeloLlamada = modelo, tope = maxTokens) => ({
    model: modeloLlamada,
    instructions: instrucciones,
    input: mensaje,
    max_output_tokens: tope,
    text: { format: { type: 'json_object' } },
    ...(conBusqueda ? { tools: [{ type: 'web_search' }] } : {}),
  });

  const turno = async (mensaje: string): Promise<any> => {
    const res = await llamar(cuerpo(mensaje, buscarWeb));
    contabilizar(res);
    const rechazo = refusalDe(res);
    if (rechazo) throw new Error(`${MENSAJE_DECLINO} (${rechazo}).`);
    return res;
  };

  const errorDeCorte = () =>
    `La respuesta se agotó por max_output_tokens (${maxTokens}). Sube el límite o reduce el alcance.`;
  const cortada = (res: any) => res?.status === 'incomplete' && res?.incomplete_details?.reason === 'max_output_tokens';

  // ---- Primer intento: el pedido completo.
  const res = await turno(usuario);
  const texto = textoDe(res);
  const primero = evaluar(texto, schema, preparar);
  if (primero.ok && !cortada(res)) {
    return { datos: primero.datos, tokensEntrada: entrada, tokensSalida: salida };
  }
  let ultimoError = cortada(res) ? errorDeCorte() : (primero as { error: string }).error;
  const crudos: unknown[] = [];
  if (!primero.ok && primero.crudo !== undefined) crudos.push(primero.crudo);

  // ---- Segundo intento. Mismo criterio que con Anthropic: con búsqueda web
  // (o si hay `forma`) se corrige la respuesta ya obtenida, sin repetir
  // herramientas ni contexto; sin búsqueda, se repite el pedido completo.
  if ((buscarWeb || forma) && texto.trim()) {
    const correccion = await llamar({
      model: modelo,
      instructions: `${SISTEMA_CORRECCION}\n\nResponde únicamente con un objeto JSON válido.`,
      input: `${forma ? `Forma esperada:\n${forma}\n\n` : ''}Problemas encontrados: ${ultimoError}\n\nRespuesta a corregir:\n${texto}\n\nDevuelve únicamente el JSON corregido.`,
      max_output_tokens: Math.min(maxTokens, MAX_TOKENS_CORRECCION),
      text: { format: { type: 'json_object' } },
    });
    contabilizar(correccion);
    const rechazo = refusalDe(correccion);
    if (rechazo) throw new Error(`${MENSAJE_DECLINO} (${rechazo}).`);
    const segundo = evaluar(textoDe(correccion), schema, preparar);
    if (segundo.ok && !cortada(correccion)) {
      return { datos: segundo.datos, tokensEntrada: entrada, tokensSalida: salida };
    }
    if (!segundo.ok) {
      ultimoError = segundo.error;
      if (segundo.crudo !== undefined) crudos.unshift(segundo.crudo);
    }
  } else if (!buscarWeb) {
    const res2 = await turno(
      `${usuario}\n\nTu respuesta anterior no cumplió el esquema. Error: ${ultimoError}\nDevuelve únicamente JSON válido.`,
    );
    const segundo = evaluar(textoDe(res2), schema, preparar);
    if (segundo.ok && !cortada(res2)) {
      return { datos: segundo.datos, tokensEntrada: entrada, tokensSalida: salida };
    }
    ultimoError = cortada(res2) ? errorDeCorte() : (segundo as { error: string }).error;
    if (!segundo.ok && segundo.crudo !== undefined) crudos.unshift(segundo.crudo);
  }

  // ---- Rescate: lo que valide de la mejor respuesta, en vez de nada.
  if (rescatar) {
    const r = intentarRescate(schema, crudos);
    if (r) return { datos: r.datos, tokensEntrada: entrada, tokensSalida: salida, parcial: true, descartes: r.descartes };
  }

  throw new Error(`${MENSAJE_JSON_INVALIDO} Último error: ${ultimoError}`);
}
