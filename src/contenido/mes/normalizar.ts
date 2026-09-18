// Arreglos de forma de la respuesta del agente del mes, antes de validar
// (lecciones de 710ab1d, 99a13cb, 6e88ba5 y 87ea948: normalizar en vez de tirar
// la tanda). Nada de esto inventa contenido: solo mueve a su sitio lo que ya
// vino, y lo que no se entiende se deja para que el esquema tolerante lo
// recorte o lo descarte.
//
// Las variantes que se convierten:
// - llaves con acento, mayúsculas, espacios o guiones («Guión», «prompt de
//   imagen», «llamado_a_la_accion») → el nombre del campo;
// - la respuesta envuelta (`{ "tanda": { "piezas": [...] } }`) o una lista suelta;
// - el formato escrito como lo diría una persona («Reel», «Carrusel 4:5»,
//   «Imagen estática», «Story») → el enum interno;
// - la plataforma («Facebook e Instagram», «FB/IG», ["facebook","instagram"]);
// - la fecha en varios formatos («2026-09-18», «18/09/2026», «18 de
//   septiembre», «jueves 18», 18) → ISO, solo si cae dentro del mes;
// - el ratio «4:5» → `4x5`;
// - la pieza sin `ref` → la ranura que le toca por su posición.

import { aArreglo, aTexto } from '@/research/normalizar';
import type { Formato, Plataforma } from '../reglas';

const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '');
const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const canon = (k: string) => sinAcentos(k).toLowerCase().replace(/[^a-z0-9]/g, '');

/** Nombre canónico (sin acentos, minúsculas, sin separadores) → campo del esquema. */
const ALIAS_PIEZA: Record<string, string> = {
  ref: 'ref', ranura: 'ref', numero: 'ref', num: 'ref', pieza: 'ref', slot: 'ref', id: 'ref', n: 'ref', referencia: 'ref',
  temaid: 'temaId', tema: 'temaId', idtema: 'temaId', idteme: 'temaId', temaelegido: 'temaId',
  plataforma: 'plataforma', plataformas: 'plataforma', red: 'plataforma', redes: 'plataforma', canal: 'plataforma',
  formato: 'formato', tipo: 'formato',
  fecha: 'fecha', fechapublicacion: 'fecha', fechadepublicacion: 'fecha', dia: 'fecha',
  copy: 'copy', texto: 'copy', caption: 'copy', pie: 'copy', piedefoto: 'copy', descripcion: 'copy', copycompleto: 'copy',
  cta: 'cta', llamadoalaaccion: 'cta', llamado: 'cta', calltoaction: 'cta', llamadoaaccion: 'cta',
  hashtags: 'hashtags', hashtag: 'hashtags', etiquetas: 'hashtags',
  briefvisual: 'briefVisual', brief: 'briefVisual', visual: 'briefVisual', indicacionvisual: 'briefVisual',
  promptimagen: 'promptImagen', promptdeimagen: 'promptImagen', prompt: 'promptImagen', promptparaimagen: 'promptImagen', imageprompt: 'promptImagen', promptimage: 'promptImagen',
  guion: 'guion', escenas: 'guion', script: 'guion', guionporescenas: 'guion',
  tarjetas: 'tarjetas', laminas: 'tarjetas', slides: 'tarjetas', diapositivas: 'tarjetas', textotarjetas: 'tarjetas',
  ratio: 'ratio', proporcion: 'ratio', relacion: 'ratio', aspecto: 'ratio',
};

const ALIAS_ESCENA: Record<string, 'visual' | 'texto'> = {
  visual: 'visual', seve: 'visual', loqueseve: 'visual', imagen: 'visual', plano: 'visual', toma: 'visual', descripcion: 'visual', accion: 'visual',
  texto: 'texto', voz: 'texto', dialogo: 'texto', audio: 'texto', locucion: 'texto', loquesedice: 'texto', sedice: 'texto', textoenpantalla: 'texto', narracion: 'texto', guion: 'texto',
};

/**
 * Renombra las llaves de un objeto según `alias`. Si dos llaves van al mismo
 * campo, gana la que ya venía bien escrita y, entre alias, la primera.
 */
function renombrarLlaves<T extends string>(o: Record<string, unknown>, alias: Record<string, T>): Record<string, unknown> {
  const destinos = new Set<string>(Object.values(alias));
  const salida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (destinos.has(k)) salida[k] = v;
  for (const [k, v] of Object.entries(o)) {
    if (destinos.has(k)) continue;
    const destino = alias[canon(k)] ?? k;
    if (!(destino in salida)) salida[destino] = v;
  }
  return salida;
}

const SINONIMOS_FORMATO: Record<string, Formato> = {
  post: 'post', imagen: 'post', foto: 'post', estatico: 'post', estatica: 'post', publicacion: 'post', image: 'post', single: 'post',
  carrusel: 'carrusel', carousel: 'carrusel', carrousel: 'carrusel', album: 'carrusel',
  reel: 'reel', reels: 'reel', video: 'reel', videos: 'reel',
  historia: 'historia', historias: 'historia', story: 'historia', stories: 'historia', estado: 'historia',
};

/** «Reel», «Carrusel 4:5», «Imagen estática», «Story» → el formato interno; `null` si no se reconoce. */
export function formatoDe(v: unknown): Formato | null {
  if (typeof v !== 'string') return null;
  for (const p of sinAcentos(v).toLowerCase().split(/[^a-z]+/).filter(Boolean)) {
    if (SINONIMOS_FORMATO[p]) return SINONIMOS_FORMATO[p];
  }
  return null;
}

/** «Facebook e Instagram», «FB/IG», «IG», ["facebook","instagram"] → la plataforma; por omisión, las dos. */
export function plataformaDe(v: unknown): Plataforma {
  const t = sinAcentos(aArreglo(v).map(aTexto).join(' ')).toLowerCase();
  const fb = /\b(facebook|fb|meta)\b/.test(t);
  const ig = /\b(instagram|ig|insta)\b/.test(t);
  if (/\b(ambas|ambos|las dos|todas)\b/.test(t) || (fb && ig)) return 'ambas';
  if (ig) return 'instagram';
  if (fb) return 'facebook';
  return 'ambas';
}

/** «4:5», «4/5», «4 x 5», «vertical 9:16» → `4x5`. */
export function ratioDe(v: unknown): string | null {
  const m = /(\d{1,2})\s*[:x×/]\s*(\d{1,2})/i.exec(aTexto(v));
  return m ? `${m[1]}x${m[2]}` : null;
}

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
};

/**
 * La fecha que escribió el modelo, en ISO, si cae dentro del mes; `null` si no
 * se entiende o es de otro mes. Acepta ISO (con o sin hora), `DD/MM/AAAA`,
 * `DD-MM-AAAA`, `DD/MM`, «18 de septiembre de 2026», «jueves 18» o el día solo.
 */
export function fechaDelMes(v: unknown, periodo: string): string | null {
  const anio = Number(periodo.slice(0, 4)), mes = Number(periodo.slice(5, 7));
  const armar = (a: number, m: number, d: number): string | null => {
    if (a !== anio || m !== mes || !Number.isInteger(d) || d < 1) return null;
    const iso = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const f = new Date(`${iso}T00:00:00Z`);
    return !Number.isNaN(f.getTime()) && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d ? iso : null;
  };
  if (typeof v === 'number') return armar(anio, mes, v);
  if (typeof v !== 'string') return null;
  const t = sinAcentos(v).toLowerCase().trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(t))) return armar(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/.exec(t))) {
    const a = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : anio;
    return armar(a, +m[2], +m[1]);
  }
  if ((m = /(\d{1,2})\s*(?:de\s+)?([a-z]+)(?:\s+(?:de(?:l)?\s+)?(\d{4}))?/.exec(t)) && MESES[m[2]]) {
    return armar(m[3] ? +m[3] : anio, MESES[m[2]], +m[1]);
  }
  if ((m = /^(?:[a-z]+\s+)?(\d{1,2})$/.exec(t))) return armar(anio, mes, +m[1]);
  return null;
}

/** Una escena: texto suelto (es lo que se ve) u objeto con alias. */
function escena(v: unknown): unknown {
  if (typeof v === 'string') return { visual: v, texto: '' };
  if (!esObjeto(v)) return v;
  const o = renombrarLlaves(v, ALIAS_ESCENA);
  return { visual: aTexto(o.visual), texto: aTexto(o.texto) };
}

/** Si la lista de piezas viene envuelta en otro objeto, la saca. */
function listaDePiezas(v: unknown): unknown {
  if (Array.isArray(v)) return { piezas: v };
  if (!esObjeto(v)) return v;
  const renombrado = renombrarLlaves(v, { piezas: 'piezas', publicaciones: 'piezas', contenido: 'piezas', contenidos: 'piezas', posts: 'piezas', items: 'piezas', ranuras: 'piezas', calendario: 'piezas' });
  if (Array.isArray(renombrado.piezas)) return renombrado;
  for (const interno of Object.values(v)) {
    const r = listaDePiezas(interno);
    if (esObjeto(r) && Array.isArray(r.piezas)) return r;
  }
  return v;
}

/**
 * El `preparar` que recibe `pedirJson` para una tanda. Necesita las ranuras de
 * la tanda (para poner `ref` a la pieza que no lo trae) y el mes (para leer las
 * fechas).
 */
export function prepararTanda(refs: number[], periodo: string) {
  return (crudo: unknown): unknown => {
    const v = listaDePiezas(crudo);
    if (!esObjeto(v) || !Array.isArray(v.piezas)) return v;
    v.piezas = v.piezas.filter(esObjeto).map((p, i) => {
      const o = renombrarLlaves(p, ALIAS_PIEZA);
      // «id»: "P2-S1-07" es el tema, no la ranura.
      if (typeof o.ref === 'string' && /^P\d-S\d-\d{2}$/i.test(o.ref.trim()) && !o.temaId) { o.temaId = o.ref; delete o.ref; }
      const ref = Number(typeof o.ref === 'string' ? o.ref.replace(/\D+/g, '') : o.ref);
      o.ref = Number.isInteger(ref) && refs.includes(ref) ? ref : refs[i];
      if ('formato' in o) o.formato = formatoDe(o.formato) ?? o.formato;
      if ('plataforma' in o) o.plataforma = plataformaDe(o.plataforma);
      if ('fecha' in o) o.fecha = fechaDelMes(o.fecha, periodo);
      if ('ratio' in o) o.ratio = ratioDe(o.ratio);
      if (typeof o.temaId === 'string') o.temaId = o.temaId.trim().toUpperCase().split(/\s/)[0];
      if ('guion' in o) o.guion = aArreglo(o.guion).map(escena);
      if ('tarjetas' in o) o.tarjetas = aArreglo(o.tarjetas).map((t) => aTexto(t));
      return o;
    });
    return v;
  };
}
