/**
 * Palabras que el cliente final no tiene por qué conocer. Si el modelo las usa,
 * el esquema rechaza la respuesta y el reintento recibe la lista: es más fiable
 * que confiar en que el prompt baste.
 */
export const JERGA_PROHIBIDA = [
  'buyer persona', 'funnel', 'embudo', 'CTA', 'call to action', 'engagement', 'target',
  'insight', 'lead', 'leads', 'KPI', 'ROI', 'awareness', 'branding', 'copy', 'benchmark',
  'nicho', 'segmento', 'touchpoint', 'conversión', 'conversiones', 'retargeting',
  'remarketing', 'SEO', 'SEM', 'B2B', 'B2C', 'pain point', 'stakeholder',
] as const;

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Palabra completa: ni letra ni dígito a los lados, para que «copyright» no cuente como «copy».
const PATRONES = JERGA_PROHIBIDA.map((termino) => {
  // Términos de varias palabras («buyer persona», «call to action»): el
  // espacio literal del término se vuelve `\s+` para que un salto de línea o
  // varios espacios seguidos (el modelo no siempre los normaliza) sigan
  // contando como el mismo término.
  const cuerpo = normalizar(termino).split(/\s+/).map(escaparRegex).join('\\s+');
  const regexNormalizado = new RegExp(`(^|[^\\p{L}\\p{N}])${cuerpo}(?=$|[^\\p{L}\\p{N}])`, 'u');
  // «CTA» se detecta aparte, sobre el texto ORIGINAL (sin normalizar) y
  // sensible a mayúsculas — no sobre `todo`, que ya viene en minúsculas.
  // Fix de revisión (ronda 1 de M3): un lookahead negativo por el punto
  // («no cuenta si sigue un punto») no distingue «CTA.» (jerga real al
  // cierre de una oración) de «Cta.» (abreviatura de «cuenta»), porque
  // normalizar() ya bajó ambas a `cta.` antes de que el lookahead corriera.
  // La única señal real es la mayúscula: «CTA» escrito TODO en mayúsculas,
  // como palabra completa, cuenta sin importar qué siga (incluido el punto
  // de cierre); «Cta.»/«cta» (no todo en mayúsculas) nunca cuentan.
  const regexOriginal = termino === 'CTA' ? new RegExp('(^|[^\\p{L}\\p{N}])CTA(?=$|[^\\p{L}\\p{N}])', 'u') : null;
  return { termino, regexNormalizado, regexOriginal };
});

/** Todos los textos de un valor anidado. Los números cuentan como texto: una cifra también es contenido. */
export function recogerTextos(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor);
  else if (typeof valor === 'number') salida.push(String(valor));
  else if (Array.isArray(valor)) valor.forEach((v) => recogerTextos(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => recogerTextos(v, salida));
  return salida;
}

export function detectarJerga(valor: unknown): string[] {
  const crudo = recogerTextos(valor).join('\n');
  const normalizado = normalizar(crudo);
  return PATRONES
    .filter((p) => (p.regexOriginal ? p.regexOriginal.test(crudo) : p.regexNormalizado.test(normalizado)))
    .map((p) => p.termino);
}
