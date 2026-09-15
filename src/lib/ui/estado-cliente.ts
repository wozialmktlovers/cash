export type EstadoCliente = 'listo' | 'en_curso' | 'sin_investigar' | 'otro';
export type FiltroCliente = 'todos' | 'listo' | 'en_curso' | 'sin_investigar';

export type JobResumible = { clientId: string; estado: string; costoUsd: string | number; createdAt: Date };
export type ResumenCliente = { estado: EstadoCliente; costo: number; ultimo: JobResumible | null };

const ACTIVO = new Set(['encolado', 'corriendo']);

export function resumirPorCliente(jobs: JobResumible[]): Map<string, ResumenCliente> {
  const m = new Map<string, { costo: number; ultimo: JobResumible; activo: boolean }>();
  for (const job of jobs) {
    const previo = m.get(job.clientId);
    m.set(job.clientId, {
      costo: (previo?.costo ?? 0) + Number(job.costoUsd),
      ultimo: !previo || job.createdAt > previo.ultimo.createdAt ? job : previo.ultimo,
      activo: (previo?.activo ?? false) || ACTIVO.has(job.estado),
    });
  }

  const salida = new Map<string, ResumenCliente>();
  for (const [id, r] of m) {
    // Un job activo manda sobre el histórico: es lo que el operador tiene que vigilar.
    const estado: EstadoCliente = r.activo ? 'en_curso' : r.ultimo.estado === 'completado' ? 'listo' : 'otro';
    salida.set(id, { estado, costo: Math.round(r.costo * 10_000) / 10_000, ultimo: r.ultimo });
  }
  return salida;
}

export function resumenDe(m: Map<string, ResumenCliente>, clientId: string): ResumenCliente {
  return m.get(clientId) ?? { estado: 'sin_investigar', costo: 0, ultimo: null };
}

/** Un cliente con su último job fallido o cancelado solo aparece en «Todos». */
export function pasaFiltro(estado: EstadoCliente, filtro: FiltroCliente): boolean {
  return filtro === 'todos' || estado === filtro;
}

export const ETIQUETA_CLIENTE: Record<EstadoCliente, string> = {
  listo: 'Listo',
  en_curso: 'En curso',
  sin_investigar: 'Sin investigar',
  otro: 'Revisar',
};
