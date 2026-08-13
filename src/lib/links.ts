export function normalizarUrl(entrada: string): string {
  const t = entrada.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function validarUrl(entrada: string): boolean {
  const t = entrada.trim();
  if (!t) return false;

  // Un esquema explícito que no sea http(s) se rechaza sin normalizar:
  // `javascript:alert(1)` no debe convertirse en `https://javascript:alert(1)`.
  const esquema = t.match(/^([a-z][a-z0-9+.-]*):/i);
  if (esquema && !/^https?$/i.test(esquema[1])) return false;

  try {
    const u = new URL(normalizarUrl(t));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    return u.hostname.includes('.') && !u.hostname.endsWith('.');
  } catch {
    return false;
  }
}
