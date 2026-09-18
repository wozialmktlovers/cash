import { leerParametros } from '@/contenido/mes/plan';

/**
 * A dónde lleva un job de la generación del mes con IA (`tipo = 'contenido'`):
 * la pantalla de su mes. Los otros tres documentos llevan a su vista por el id
 * del resultado (`ProgresoJob`, `DESTINO`); este no tiene tabla de resultados,
 * así que su destino sale de `research_jobs.parametros`. `null` para los demás.
 */
export function destinoDeJob(job: { tipo: string; clientId: string; parametros: unknown }): { loteId: string; periodo: string; enlace: string } | null {
  if (job.tipo !== 'contenido') return null;
  const p = leerParametros(job.parametros);
  if (!p) return null;
  return { loteId: p.loteId, periodo: p.periodo, enlace: `/clientes/${job.clientId}/contenido/${p.periodo}` };
}
