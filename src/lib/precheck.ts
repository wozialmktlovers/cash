export function revisarAntesDeInvestigar(d: {
  enlaces: number; archivosConTexto: number; ticket: string | null; ciudad: string | null;
}): { advertencias: string[]; listo: boolean } {
  const advertencias: string[] = [];
  if (d.enlaces === 0) advertencias.push('No hay enlaces registrados. La investigación no podrá revisar los activos del cliente.');
  if (d.archivosConTexto === 0) advertencias.push('No hay archivos con texto extraído. Se perderá el detalle del producto.');
  if (!d.ticket) advertencias.push('Falta el ticket. Sin él no se puede determinar si el ciclo de compra es largo.');
  if (!d.ciudad) advertencias.push('Falta la ciudad. El foco geográfico será nacional por defecto.');
  // La investigación nunca se bloquea por falta de datos: se advierte y decide el operador.
  return { advertencias, listo: true };
}
