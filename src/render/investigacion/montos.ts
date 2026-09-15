// Número con miles separados por coma o número simple, con K/M opcional.
// La letra no puede ir seguida de otra letra: así «MXN» no se lee como millones.
const PATRON = /(\$\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*([kKmM])(?![A-Za-zÀ-ÿ]))?/g;

/**
 * Montos legibles de un texto libre del modelo. Si el texto trae signo de
 * pesos, solo cuentan los números con signo: «12 mensualidades de $3,066»
 * habla de $3,066, no de 12.
 */
export function parsearMontos(texto: string): number[] {
  const hallados = [...texto.matchAll(PATRON)];
  const conSigno = texto.includes('$');
  return hallados
    .filter((m) => !conSigno || m[1])
    .map((m) => {
      let n = Number(m[2].replace(/,/g, ''));
      if (m[3]) n *= /k/i.test(m[3]) ? 1_000 : 1_000_000;
      return Math.round(n);
    });
}

export function formatearMonto(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
