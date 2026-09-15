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
  // «CTA» no debe confundirse con la abreviatura «Cta.» (cuenta), que
  // siempre lleva el punto pegado justo después: se excluye ese caso con un
  // lookahead negativo, sin tocar el resto de los términos.
  const noAbreviaturaCuenta = termino === 'CTA' ? '(?!\\.)' : '';
  return {
    termino,
    regex: new RegExp(`(^|[^\\p{L}\\p{N}])${cuerpo}${noAbreviaturaCuenta}(?=$|[^\\p{L}\\p{N}])`, 'u'),
  };
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
  const todo = normalizar(recogerTextos(valor).join('\n'));
  return PATRONES.filter((p) => p.regex.test(todo)).map((p) => p.termino);
}
