import { recogerTextos } from './jerga';

// Un número completo: dígitos con sus separadores de miles o decimales, sin
// cortar a la mitad. Comparar por número, no por dígito suelto del texto
// entero, evita que «de $10,000 a $18,000» (que concatenado da «1000018000»)
// deje pasar un «$180» inventado solo porque sus dígitos son un prefijo.
const NUMERO = /\d[\d.,]*/g;

const limpiar = (token: string) => token.replace(/[.,]/g, '');

/** «mil», «K» o «millones»/«M» pegados a un dígito: el multiplicador implícito de la cifra. */
function multiplicador(texto: string): number {
  if (/\bmil\b/i.test(texto) || /\d\s*k\b/i.test(texto)) return 1_000;
  if (/mill[oó]n/i.test(texto) || /\d\s*m\b/i.test(texto)) return 1_000_000;
  return 1;
}

/**
 * Cifras de la portada que no salen de la investigación. Se compara número
 * completo contra número completo: «18 mil» y «16.4K» sí valen como «18,000»
 * y «16,400» (mismo número, otro formato), pero «$180» no vale como prefijo
 * de «18,000» aunque comparta dígitos.
 */
export function cifrasSinRespaldo(lectura: { cifras: { valor: string }[] }, fuente: unknown): string[] {
  const disponibles = recogerTextos(fuente).flatMap((t) => [...t.matchAll(NUMERO)].map((m) => limpiar(m[0])));

  return lectura.cifras
    .filter((c) => {
      const primero = c.valor.match(NUMERO)?.[0];
      if (!primero) return true; // sin ningún dígito: no hay nada que verificar contra la fuente.
      const mult = multiplicador(c.valor);
      const valor = mult === 1 ? limpiar(primero) : String(Math.round(parseFloat(primero) * mult));
      return !disponibles.includes(valor);
    })
    .map((c) => c.valor);
}
