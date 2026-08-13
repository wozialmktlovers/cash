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

/**
 * El manual de campaña solo existe encadenado a una investigación completada.
 * Aquí no hay «se advierte y decide el operador» como en la investigación:
 * sin datos de origen no hay nada sobre lo que razonar, y generarlo igualmente
 * sería inventar la campaña entera.
 */
export function puedeGenerarGrowth(d: { etapasConDatos: number }):
  { ok: boolean; razon: string } {
  // No basta con que exista una fila de resultado. El pipeline de
  // investigación inserta una aunque fallen las cinco etapas, para dejar
  // constancia del intento. Generar el manual sobre esa fila daría una
  // campaña construida sobre nada.
  if (d.etapasConDatos === 0) {
    return {
      ok: false,
      razon: 'Este cliente aún no tiene una investigación con datos. El manual de campaña parte de ella, y una investigación que falló entera no sirve de base.',
    };
  }
  return { ok: true, razon: '' };
}

/** Cuenta las etapas que sí produjeron datos en un resultado de investigación. */
export function contarEtapasConDatos(datos: unknown): number {
  if (!datos || typeof datos !== 'object') return 0;
  return Object.values(datos as Record<string, any>)
    .filter((e) => e && typeof e === 'object' && e.estado === 'ok').length;
}
