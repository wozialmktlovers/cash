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

/** El mapa de pilares, como el manual, parte de una investigación con datos. */
export function puedeGenerarPilares(d: { etapasConDatos: number }): { ok: boolean; razon: string } {
  if (d.etapasConDatos === 0) {
    return { ok: false, razon: 'Este cliente aún no tiene una investigación con datos. El mapa de pilares parte de ella.' };
  }
  return { ok: true, razon: '' };
}

/** Cuenta las etapas que sí produjeron datos en un resultado de investigación. */
export function contarEtapasConDatos(datos: unknown): number {
  if (!datos || typeof datos !== 'object') return 0;
  return Object.values(datos as Record<string, any>)
    .filter((e) => e && typeof e === 'object' && e.estado === 'ok').length;
}

/**
 * Entre varias filas de investigación del mismo cliente, la más reciente que
 * sí tiene datos. El pipeline inserta una fila aunque las cinco etapas
 * fallen (para dejar constancia del intento), así que la versión más alta no
 * siempre sirve de base: si la v2 falló entera pero la v1 tiene datos, hay
 * que generar sobre la v1. Growth y el mapa de pilares comparten esta regla
 * con el precheck de la API para que lo que el operador ve como «listo»
 * corresponda exactamente a la fila que el pipeline va a usar.
 */
export function investigacionUtil<T extends { datos: unknown; version: number }>(
  resultados: T[],
): T | undefined {
  return resultados
    .filter((r) => contarEtapasConDatos(r.datos) > 0)
    .sort((a, b) => b.version - a.version)[0];
}
