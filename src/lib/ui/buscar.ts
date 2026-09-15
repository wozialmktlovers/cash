/** Minúsculas y sin acentos, para que «cosmetologia» encuentre «Cosmetología». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-MX').trim();
}

export function coincide(consulta: string, campos: Array<string | null | undefined>): boolean {
  const q = normalizar(consulta);
  if (!q) return true;
  const pajar = normalizar(campos.filter(Boolean).join(' '));
  return q.split(/\s+/).every((palabra) => pajar.includes(palabra));
}
