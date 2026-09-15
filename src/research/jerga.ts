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
const PATRONES = JERGA_PROHIBIDA.map((termino) => ({
  termino,
  regex: new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegex(normalizar(termino))}(?=$|[^\\p{L}\\p{N}])`, 'u'),
}));

function textos(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => textos(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => textos(v, salida));
  return salida;
}

export function detectarJerga(valor: unknown): string[] {
  const todo = normalizar(textos(valor).join('\n'));
  return PATRONES.filter((p) => p.regex.test(todo)).map((p) => p.termino);
}
