import { recogerTextos } from './jerga';

// Un número completo: dígitos con sus separadores de miles o decimales, sin
// cortar a la mitad. Comparar número contra número, no dígito suelto del
// texto entero, evita que «de $10,000 a $18,000» (que concatenado da
// «1000018000») deje pasar un «$180» inventado solo porque sus dígitos son
// un prefijo.
const NUMERO = /\d[\d.,]*/g;

/**
 * Convierte un token de dígitos («18,000», «18,000.00», «1,5», «001») a su
 * valor numérico. El separador más a la derecha cuenta como decimal solo si
 * a él le siguen uno o dos dígitos y nada más («.00» son centavos, «,5» es
 * medio): cualquier otro separador, antes o después, es de miles y se
 * descarta. Así «18,000.00» vale 18000 y «1,5» vale 1.5, sin confundirlos.
 */
function parseNumero(token: string): number {
  const ultimo = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
  if (ultimo === -1) return parseFloat(token) || 0;
  const cola = token.slice(ultimo + 1);
  if (cola.length >= 1 && cola.length <= 2) {
    const entero = token.slice(0, ultimo).replace(/[.,]/g, '') || '0';
    return parseFloat(`${entero}.${cola}`);
  }
  return parseFloat(token.replace(/[.,]/g, '')) || 0;
}

/**
 * «mil»/«k» (× 1,000) o «millones»/«M» (× 1,000,000) pegados al número como
 * su propio token, en el texto que sigue justo después del match. Nada de
 * letras después: la «M» de «MXN» no cuenta porque a la M le sigue otra
 * letra, no un límite de palabra. Y la abreviatura de millón solo cuenta en
 * mayúscula, para no leer «25 m²» (metros cuadrados) como 25 millones.
 */
function multiplicadorTras(resto: string): number {
  if (/^\s?mil\b/i.test(resto) || /^\s?k\b/i.test(resto)) return 1_000;
  if (/^\s?mill[oó]n(?:es)?\b/i.test(resto) || /^\s?M\b/.test(resto)) return 1_000_000;
  return 1;
}

/**
 * Las dos lecturas posibles de un número que trae multiplicador pegado: el
 * valor crudo («16.4» → 16) y, si aplica, el valor ya multiplicado
 * («16.4K» → 16400). Sin multiplicador solo hay una lectura. Se calcula el
 * producto antes de redondear para no perder precisión («16.4 × 1000», no
 * «round(16.4) × 1000»).
 */
function expandir(texto: string, match: RegExpMatchArray): number[] {
  const valor = parseNumero(match[0]);
  const mult = multiplicadorTras(texto.slice((match.index ?? 0) + match[0].length));
  const crudo = Math.round(valor);
  return mult === 1 ? [crudo] : [crudo, Math.round(valor * mult)];
}

/** Todos los números de un texto, cada uno en sus lecturas posibles (con y sin multiplicador). */
function numerosDe(texto: string): number[] {
  return [...texto.matchAll(NUMERO)].flatMap((m) => expandir(texto, m));
}

/**
 * La única lectura válida de una cifra de la PORTADA: si trae multiplicador
 * pegado («300 mil», «$180K», «2.5 mil»), vale el valor ya multiplicado, no
 * el crudo — el crudo de una cifra con multiplicador no es la cifra, es una
 * coincidencia de dígitos («300» de «300 mil» contra un «300 seguidores» de
 * la fuente no respalda nada). La fuente sigue conservando sus dos lecturas
 * en `numerosDe`/`expandir`, porque ella sí puede escribir el mismo número
 * con o sin la abreviatura.
 */
function valorPortada(texto: string, match: RegExpMatchArray): number {
  const valores = expandir(texto, match);
  return valores[valores.length - 1]; // último = multiplicado si lo hay; si no, el único valor.
}

/**
 * Cifras de la portada que no salen de la investigación. Del lado de la
 * fuente se acepta cualquiera de sus dos lecturas (con o sin el
 * multiplicador de «mil»/«K»/«millones»/«M»): «18 mil», «16.4K» y
 * «$18,000.00» valen como «18,000» (mismo número, otro formato). Del lado de
 * la portada solo cuenta el valor multiplicado cuando lo trae: «$180» no
 * vale como prefijo de «18,000» aunque comparta dígitos, y «300 mil» no se
 * respalda con un «300 seguidores» de la fuente aunque el crudo coincida.
 */
export function cifrasSinRespaldo(lectura: { cifras: { valor: string }[] }, fuente: unknown): string[] {
  const disponibles = new Set(recogerTextos(fuente).flatMap(numerosDe));

  return lectura.cifras
    .filter((c) => {
      const [primero] = [...c.valor.matchAll(NUMERO)];
      if (!primero) return true; // sin ningún dígito: no hay nada que verificar contra la fuente.
      return !disponibles.has(valorPortada(c.valor, primero));
    })
    .map((c) => c.valor);
}
