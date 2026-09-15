import { recogerTextos } from './jerga';

const digitos = (t: string) => t.replace(/\D/g, '');

/**
 * Cifras de la portada que no salen de la investigación. Se comparan solo los
 * dígitos: «$18,000» y «18 mil» no se parecen como texto, pero una portada con
 * un número que nadie investigó sería peor que una portada sin número.
 */
export function cifrasSinRespaldo(lectura: { cifras: { valor: string }[] }, fuente: unknown): string[] {
  const disponibles = recogerTextos(fuente).map(digitos).filter(Boolean);
  return lectura.cifras
    .filter((c) => {
      const d = digitos(c.valor);
      return !d || !disponibles.some((f) => f.includes(d));
    })
    .map((c) => c.valor);
}
