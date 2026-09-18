import { aEntero, aListaDeTextos, aTexto } from '@/research/normalizar';
import { CLAVES_GOOGLE, GRUPOS, FORMATOS, RATIO_POR_FORMATO } from './schemas';

/**
 * Arreglos de forma de los agentes del manual de campaña, antes de validar.
 *
 * Nace del manual de «Mar de miel» (no educativo): `estructura` y `google`
 * terminaron en `fallo` sin que el pedido describiera la forma del JSON, así
 * que el modelo la adivinaba. Las variantes que se ven con más frecuencia y
 * que aquí se convierten en vez de rechazarse:
 * - llaves en español con acento («ángulo», «intención», «campañasMeta»);
 * - la respuesta envuelta en otro objeto (`{ "estructura": { … } }`);
 * - `googleKeywords` como objeto indexado por clave en vez de lista;
 * - un `rsa` por campaña en vez de uno común;
 * - «Grupo A», «M1» o «Categoría» donde va `a` o `categoria`;
 * - `semanas` como texto («8 semanas») o fuera de rango.
 * Nada de esto inventa contenido: solo mueve lo que ya vino a su sitio.
 */

const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '');
const esObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** Quita los acentos de todas las llaves, a cualquier profundidad. */
export function llavesSinAcentos(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(llavesSinAcentos);
  if (!esObjeto(v)) return v;
  const salida: Record<string, unknown> = {};
  for (const [k, valor] of Object.entries(v)) {
    const limpia = sinAcentos(k);
    // Si vienen las dos versiones de la misma llave, gana la que ya estaba bien escrita.
    if (limpia in salida && limpia !== k) continue;
    salida[limpia] = llavesSinAcentos(valor);
  }
  return salida;
}

/**
 * Si ninguna de las llaves esperadas está en la raíz pero sí dentro de un
 * objeto de primer nivel, se devuelve ese objeto.
 */
function desenvolver(v: unknown, esperadas: string[]): unknown {
  if (!esObjeto(v) || esperadas.some((k) => k in v)) return v;
  for (const interno of Object.values(v)) {
    if (esObjeto(interno) && esperadas.some((k) => k in interno)) return interno;
  }
  return v;
}

/** Renombra la primera llave que exista de `alias` a `destino`, si `destino` falta. */
function renombrar(o: Record<string, unknown>, destino: string, alias: string[]): void {
  if (destino in o) return;
  const k = alias.find((a) => a in o);
  if (k) { o[destino] = o[k]; delete o[k]; }
}

const SINONIMOS_CLAVE: Record<string, (typeof CLAVES_GOOGLE)[number]> = {
  marca: 'marca', branded: 'marca', brand: 'marca', 'de marca': 'marca',
  categoria: 'categoria', generica: 'categoria', generico: 'categoria', genericas: 'categoria',
  producto: 'categoria', servicio: 'categoria', category: 'categoria',
  precio: 'precio', precios: 'precio', costo: 'precio', costos: 'precio', price: 'precio',
  geo: 'geo', geografia: 'geo', geografica: 'geo', local: 'geo', ubicacion: 'geo', ciudad: 'geo', zona: 'geo',
  contenido: 'contenido', informativa: 'contenido', informacional: 'contenido', blog: 'contenido', content: 'contenido',
};

/** «Categoría», «Campaña geo», «G4 · Geografía» → la clave estándar, si se reconoce. */
export function claveGoogle(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const t = sinAcentos(v).toLowerCase().trim();
  if (SINONIMOS_CLAVE[t]) return SINONIMOS_CLAVE[t];
  const palabras = t.split(/[^a-z]+/).filter(Boolean);
  for (const p of palabras) if (SINONIMOS_CLAVE[p]) return SINONIMOS_CLAVE[p];
  return v;
}

/** «Grupo A», «A», «M2», «b)» → a/b/c. Sin letra reconocible, `undefined`. */
export function grupoMeta(v: unknown): (typeof GRUPOS)[number] | undefined {
  if (typeof v === 'number') return GRUPOS[v - 1];
  if (typeof v !== 'string') return undefined;
  const t = sinAcentos(v).toLowerCase().trim();
  if ((GRUPOS as readonly string[]).includes(t)) return t as (typeof GRUPOS)[number];
  const letra = t.match(/(?:^|grupo\s*|[^a-z])([abc])(?:[^a-z]|$)/);
  if (letra) return letra[1] as (typeof GRUPOS)[number];
  const numero = t.match(/(?:^|m|meta\s*|grupo\s*)([123])\b/);
  if (numero) return GRUPOS[Number(numero[1]) - 1];
  return undefined;
}

/** Un objeto indexado por clave (`{ marca: {…}, geo: {…} }`) → lista con `clave`. */
function porClaveALista(v: unknown): unknown {
  if (!esObjeto(v)) return v;
  return Object.entries(v).map(([clave, valor]) =>
    esObjeto(valor) ? { clave, ...valor } : { clave, keywords: valor });
}

export function prepararEstructura(crudo: unknown): unknown {
  const v = desenvolver(llavesSinAcentos(crudo), ['campanasMeta', 'campanasGoogle', 'bloqueantes']);
  if (!esObjeto(v)) return v;
  renombrar(v, 'campanasMeta', ['meta', 'campanasDeMeta', 'metaAds']);
  renombrar(v, 'campanasGoogle', ['google', 'campanasDeGoogle', 'googleAds']);
  renombrar(v, 'reglasCopy', ['reglasDeCopy', 'reglas']);

  if ('semanas' in v) {
    const n = aEntero(v.semanas);
    if (typeof n === 'number' && Number.isFinite(n)) v.semanas = Math.min(12, Math.max(2, Math.round(n)));
    else delete v.semanas;
  }

  if (Array.isArray(v.campanasMeta)) {
    const vistos = new Set<string>();
    v.campanasMeta = v.campanasMeta.filter(esObjeto).map((c, i) => {
      const grupo = grupoMeta(c.grupo) ?? GRUPOS[i];
      return { ...c, grupo };
    }).filter((c) => {
      // Un grupo repetido es la misma campaña contada dos veces: se queda la primera.
      if (!c.grupo || vistos.has(c.grupo)) return false;
      vistos.add(c.grupo);
      return true;
    });
  }

  if (esObjeto(v.campanasGoogle)) v.campanasGoogle = porClaveALista(v.campanasGoogle);
  if (Array.isArray(v.campanasGoogle)) {
    const vistas = new Set<unknown>();
    v.campanasGoogle = v.campanasGoogle.filter(esObjeto)
      .map((c) => ({ ...c, clave: claveGoogle(c.clave) }))
      .filter((c) => !vistas.has(c.clave) && vistas.add(c.clave));
  }

  for (const k of ['bloqueantes', 'reglasCopy']) if (k in v) v[k] = aListaDeTextos(v[k]);
  return v;
}

export function prepararGoogle(crudo: unknown): unknown {
  const v = desenvolver(llavesSinAcentos(crudo), ['googleKeywords', 'rsa']);
  if (!esObjeto(v)) return v;
  renombrar(v, 'googleKeywords', ['keywords', 'campanas', 'palabrasClave', 'campanasSearch']);
  renombrar(v, 'rsa', ['anuncios', 'anunciosAdaptables', 'anuncio']);

  if (esObjeto(v.googleKeywords)) v.googleKeywords = porClaveALista(v.googleKeywords);

  // Titulares y descripciones repartidos por campaña: se juntan en un solo
  // bloque común, que es lo que pide el esquema.
  const titulares: unknown[] = [];
  const descripciones: unknown[] = [];
  const recoger = (o: Record<string, unknown>) => {
    renombrar(o, 'titulares', ['titulos', 'headlines']);
    renombrar(o, 'descripciones', ['descriptions']);
    if ('titulares' in o) titulares.push(...[o.titulares].flat());
    if ('descripciones' in o) descripciones.push(...[o.descripciones].flat());
  };

  if (Array.isArray(v.googleKeywords)) {
    const vistas = new Set<unknown>();
    v.googleKeywords = v.googleKeywords.filter(esObjeto).map((k) => {
      const copia = { ...k };
      renombrar(copia, 'keywords', ['palabrasClave', 'terminos']);
      renombrar(copia, 'negativas', ['negativos', 'palabrasNegativas', 'keywordsNegativas']);
      if (!v.rsa) recoger(copia);
      delete copia.titulares; delete copia.descripciones;
      return { ...copia, clave: claveGoogle(copia.clave) };
    }).filter((k) => !vistas.has(k.clave) && vistas.add(k.clave));
  }

  if (Array.isArray(v.rsa)) v.rsa.filter(esObjeto).forEach(recoger);
  else if (esObjeto(v.rsa)) {
    const r = { ...v.rsa };
    if (Object.values(r).every(esObjeto)) Object.values(r).forEach((o) => recoger(o as Record<string, unknown>));
    else recoger(r);
  }
  if (titulares.length || descripciones.length) {
    v.rsa = {
      titulares: titulares.map(aTexto).filter((t) => t.trim()),
      descripciones: descripciones.map(aTexto).filter((t) => t.trim()),
    };
  }
  return v;
}

const SINONIMOS_FORMATO: Record<string, (typeof FORMATOS)[number]> = {
  imagen: 'imagen', image: 'imagen', estatico: 'imagen', estatica: 'imagen', foto: 'imagen', post: 'imagen',
  carrusel: 'carrusel', carousel: 'carrusel', carrousel: 'carrusel',
  video: 'video', reel: 'video', reels: 'video', historia: 'video', story: 'video',
};
const MEDIDAS_POR_RATIO: Record<string, string> = { '1x1': '1080 × 1080 px', '4x5': '1080 × 1350 px', '9x16': '1080 × 1920 px' };

/** «Carrusel 4:5», «Reel», «Imagen estática» → imagen/carrusel/video, si se reconoce. */
function formatoMeta(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const t = sinAcentos(v).toLowerCase();
  for (const p of t.split(/[^a-z]+/).filter(Boolean)) if (SINONIMOS_FORMATO[p]) return SINONIMOS_FORMATO[p];
  return v;
}

/**
 * Creativos: el ratio y las medidas no los elige el modelo, los dicta el
 * formato (Mar de miel falló por «4:5» en vez de `4x5`). El ángulo, si no
 * vino, se toma del de su grupo en la estructura, que es de donde sale.
 */
export function prepararCreativos(angulos: Partial<Record<(typeof GRUPOS)[number], string>> = {}) {
  return (crudo: unknown): unknown => {
    let v = desenvolver(llavesSinAcentos(crudo), ['creativos']);
    if (Array.isArray(v)) v = { creativos: v };
    if (!esObjeto(v)) return v;
    renombrar(v, 'creativos', ['anuncios', 'piezas', 'creatividades']);
    if (!Array.isArray(v.creativos)) return v;
    v.creativos = v.creativos.filter(esObjeto).map((c) => {
      const o: Record<string, unknown> = { ...c };
      renombrar(o, 'copyA', ['copy1', 'opcionA', 'textoA']);
      renombrar(o, 'copyB', ['copy2', 'opcionB', 'textoB']);
      if ((!o.copyA || !o.copyB) && Array.isArray(o.copies ?? o.copys ?? o.opciones)) {
        const lista = (o.copies ?? o.copys ?? o.opciones) as unknown[];
        o.copyA ??= lista[0]; o.copyB ??= lista[1];
      }
      for (const k of ['copyA', 'copyB', 'angulo']) if (k in o) o[k] = aTexto(o[k]);
      const grupo = grupoMeta(o.grupo);
      if (grupo) o.grupo = grupo;
      o.formato = formatoMeta(o.formato);
      const ratio = RATIO_POR_FORMATO[o.formato as (typeof FORMATOS)[number]];
      if (ratio) { o.ratio = ratio; o.medidas = MEDIDAS_POR_RATIO[ratio]; }
      if (!o.angulo && grupo && angulos[grupo]) o.angulo = angulos[grupo];
      return o;
    });
    return v;
  };
}
