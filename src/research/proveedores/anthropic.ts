import Anthropic from '@anthropic-ai/sdk';
import { entradaEquivalente } from '@/lib/cost';
import {
  MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO, SISTEMA_CORRECCION, MAX_TOKENS_CORRECCION,
  evaluar, intentarRescate, type PedirJsonOpts, type ResultadoJson,
} from './comun';

/**
 * Implementación de `pedirJson` contra la API de Anthropic (antes vivía
 * completa en `src/research/claude.ts`). El comportamiento es exactamente el
 * de siempre: es la parte que ya corrió en producción. `src/research/claude.ts`
 * ahora es la fachada que decide, por `PROVEEDOR_IA`, si llama aquí o a
 * `./openai.ts`.
 */

let cliente: Anthropic | null = null;

function obtenerCliente(): Anthropic {
  if (!cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY');
    cliente = new Anthropic({ apiKey });
  }
  return cliente;
}

/** Cuántas veces se reanuda un turno pausado por la búsqueda web antes de rendirse. */
const MAX_PAUSAS = 6;

/** Consultas web máximas por etapa de búsqueda (variable BUSQUEDAS_MAX; antes 12 fijas). */
const BUSQUEDAS_MAX = Math.max(1, Math.min(20, Number(process.env.BUSQUEDAS_MAX) || 6));

function textoDe(res: any): string {
  return (res?.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n');
}

/**
 * Pide al modelo un JSON validado con `schema`.
 *
 * Dos estrategias de reintento, según lo caro que sea repetir:
 *
 * - Sin búsqueda web (síntesis, lectura, growth…): se repite el pedido
 *   completo con el error anotado. El contexto es texto propio y barato, y
 *   las reglas de la lectura (cifras con respaldo) necesitan los datos.
 * - Con búsqueda web: NO se repite. Repetir era volver a pagar todas las
 *   búsquedas y todos sus resultados (el grueso de los 15.70 USD de «Mar de
 *   miel»: tres etapas investigaron dos veces cada una). Se manda solo la
 *   respuesta ya obtenida, sin herramientas ni contexto del cliente, y se
 *   pide que corrija la forma. Y si ni así valida, se rescata lo que sí
 *   valida (`rescatarParcial`) en vez de tirar la etapa.
 */
export async function pedirJsonAnthropic<T>(opts: PedirJsonOpts<T>): Promise<ResultadoJson<T>> {
  const { modelo, sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000, onUso, forma, preparar } = opts;
  const rescatar = opts.rescatar ?? buscarWeb;
  const api = obtenerCliente();

  let entrada = 0, salida = 0;

  const contabilizar = (r: any): boolean => {
    // Con caché, `input_tokens` no incluye lo escrito ni lo leído del caché:
    // se suman a precio equivalente para que el costo y los topes sean reales.
    const e = Math.round(entradaEquivalente(r.usage)), s = r.usage?.output_tokens ?? 0;
    entrada += e; salida += s;
    return onUso ? onUso(e, s) : true;
  };

  // Siempre en streaming. El SDK estima cuánto tardará una petición a partir
  // de `max_tokens` y rechaza de entrada, sin llegar a la red, cualquiera que
  // pase de diez minutos: con los 32k de la síntesis eso saltaba siempre
  // ("Streaming is required for operations that may take longer than 10
  // minutes"). `finalMessage()` acumula los eventos y devuelve el mismo
  // objeto Message que `create`, con `usage` y `stop_reason` incluidos.
  let cacheRechazado = false;
  const sinCache = (cuerpo: Record<string, unknown>) => {
    const { system, messages, ...resto } = cuerpo as any;
    const limpio = (b: any) => { const { cache_control, ...r } = b; return r; };
    return {
      ...resto,
      system: Array.isArray(system) ? system.map(limpio) : system,
      messages: (messages as any[]).map((m) => ({ ...m, content: Array.isArray(m.content) ? m.content.map(limpio) : m.content })),
    };
  };
  const pedir = async (cuerpo: Record<string, unknown>) => {
    const enviar = (c: Record<string, unknown>) => api.messages.stream(c as any).finalMessage() as Promise<any>;
    if (cacheRechazado) return enviar(sinCache(cuerpo));
    try {
      return await enviar(cuerpo);
    } catch (e: any) {
      // Si la API rechaza las marcas de caché, se sigue sin ellas en vez de
      // perder la etapa: el caché solo abarata, nunca es requisito.
      if (e?.status === 400 && /cache_control/i.test(String(e?.message ?? ''))) {
        cacheRechazado = true;
        console.warn('[pedirJson] la API rechazó cache_control; se sigue sin caché.');
        return enviar(sinCache(cuerpo));
      }
      throw e;
    }
  };

  // `web_search_20260209` trae filtrado dinámico: el servidor ejecuta código
  // para descartar resultados irrelevantes antes de que ocupen contexto.
  // No se declara `code_execution` aparte: ya va incluido, y un segundo
  // entorno de ejecución confunde al modelo.
  // Haiku no soporta el filtrado dinámico de la versión 20260209 (pide
  // «programmatic tool calling»), así que usa la anterior.
  const versionBusqueda = /haiku/i.test(modelo) ? 'web_search_20250305' : 'web_search_20260209';
  const herramientas = buscarWeb
    ? { tools: [{ type: versionBusqueda, name: 'web_search', max_uses: BUSQUEDAS_MAX }] }
    : {};

  // Caché de prompts, solo en las etapas con búsqueda: ahí el turno se
  // pausa y cada reanudación vuelve a mandar todo lo leído hasta entonces, y
  // leerlo del caché cuesta la décima parte. En una sola llamada sin
  // repetición no conviene (escribir cuesta 1.25×), por eso no se usa en el
  // resto. Un solo punto de corte al final de la conversación más el sistema
  // (máximo 4 permitidos), en copias: nunca se marcan los bloques originales,
  // o los cortes se acumularían en cada reanudación.
  const conCache = (msgs: any[]): any[] => {
    if (!buscarWeb || msgs.length === 0) return msgs;
    const copia = msgs.map((m) => ({ ...m }));
    const ult = copia[copia.length - 1];
    if (typeof ult.content === 'string') {
      ult.content = [{ type: 'text', text: ult.content, cache_control: { type: 'ephemeral' } }];
    } else if (Array.isArray(ult.content) && ult.content.length) {
      const bloques = ult.content.map((b: any) => ({ ...b }));
      const ultimo = bloques[bloques.length - 1];
      if (ultimo.type !== 'text' || (ultimo.text ?? '').trim()) ultimo.cache_control = { type: 'ephemeral' };
      ult.content = bloques;
    }
    return copia;
  };
  const sistemaConCache = buscarWeb ? [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }] : sistema;

  /** Un turno completo del modelo, con sus reanudaciones de `pause_turn`. */
  const turno = async (mensajeUsuario: string): Promise<any> => {
    const mensajes: any[] = [{ role: 'user', content: mensajeUsuario }];
    const cuerpo = () => ({ model: modelo, max_tokens: maxTokens, system: sistemaConCache, messages: conCache(mensajes), ...herramientas });

    let res: any = await pedir(cuerpo());
    let hayPresupuesto = contabilizar(res);

    // Con herramientas de servidor, el turno se pausa cada 10 iteraciones.
    // Se reanuda devolviendo el turno del asistente sin agregar mensaje nuevo.
    let pausas = 0;
    while (res.stop_reason === 'pause_turn' && pausas < MAX_PAUSAS && hayPresupuesto) {
      mensajes.push({ role: 'assistant', content: res.content });
      res = await pedir(cuerpo());
      hayPresupuesto = contabilizar(res);
      pausas++;
    }

    // Se acabó el presupuesto (o las pausas) a media búsqueda. Antes se tiraba
    // la etapa con todo lo ya buscado; ahora se le pide que cierre con lo que
    // encontró, sin buscar más (`tool_choice: none`). Cuesta releer el
    // contexto una vez, mucho menos que perder la etapa.
    if (res.stop_reason === 'pause_turn') {
      mensajes.push({ role: 'assistant', content: res.content });
      mensajes.push({
        role: 'user',
        content: 'Se acabó el presupuesto de búsqueda. No busques más: responde ya, solo con el JSON, usando lo que encontraste.',
      });
      res = await pedir({ ...cuerpo(), tool_choice: { type: 'none' } });
      contabilizar(res);
      if (res.stop_reason === 'pause_turn') {
        throw new Error('Se agotó el presupuesto a media búsqueda: el turno quedó pausado y no se pudo cerrar.');
      }
    }

    if (res.stop_reason === 'refusal') {
      throw new Error(`${MENSAJE_DECLINO} (${res.stop_details?.category ?? 'sin categoría'}).`);
    }
    return res;
  };

  const errorDeCorte = () =>
    `La respuesta se agotó por max_tokens (${maxTokens}). Sube el límite o reduce el alcance.`;

  // ---- Primer intento: el pedido completo.
  const res = await turno(usuario);
  const texto = textoDe(res);
  const primero = evaluar(texto, schema, preparar);
  if (primero.ok && res.stop_reason !== 'max_tokens') {
    return { datos: primero.datos, tokensEntrada: entrada, tokensSalida: salida };
  }
  let ultimoError = res.stop_reason === 'max_tokens' ? errorDeCorte() : (primero as { error: string }).error;
  const crudos: unknown[] = [];
  if (!primero.ok && primero.crudo !== undefined) crudos.push(primero.crudo);

  // ---- Segundo intento.
  if ((buscarWeb || forma) && texto.trim()) {
    // Corrección barata: la respuesta ya obtenida, sin herramientas ni contexto.
    const correccion = await pedir({
      model: modelo,
      max_tokens: Math.min(maxTokens, MAX_TOKENS_CORRECCION),
      system: SISTEMA_CORRECCION,
      messages: [{
        role: 'user',
        content: `${forma ? `Forma esperada:\n${forma}\n\n` : ''}Problemas encontrados: ${ultimoError}\n\nRespuesta a corregir:\n${texto}\n\nDevuelve únicamente el JSON corregido.`,
      }],
    });
    contabilizar(correccion);
    if (correccion.stop_reason === 'refusal') {
      throw new Error(`${MENSAJE_DECLINO} (${correccion.stop_details?.category ?? 'sin categoría'}).`);
    }
    const segundo = evaluar(textoDe(correccion), schema, preparar);
    if (segundo.ok && correccion.stop_reason !== 'max_tokens') {
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
    if (segundo.ok && res2.stop_reason !== 'max_tokens') {
      return { datos: segundo.datos, tokensEntrada: entrada, tokensSalida: salida };
    }
    ultimoError = res2.stop_reason === 'max_tokens' ? errorDeCorte() : (segundo as { error: string }).error;
    if (!segundo.ok && segundo.crudo !== undefined) crudos.unshift(segundo.crudo);
  }

  // ---- Rescate: lo que valide de la mejor respuesta, en vez de nada.
  if (rescatar) {
    const r = intentarRescate(schema, crudos);
    if (r) return { datos: r.datos, tokensEntrada: entrada, tokensSalida: salida, parcial: true, descartes: r.descartes };
  }

  throw new Error(`${MENSAJE_JSON_INVALIDO} Último error: ${ultimoError}`);
}
