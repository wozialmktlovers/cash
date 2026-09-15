type JobIndicador = { estado: string; costoUsd: string | number; createdAt: Date };

/**
 * El servidor corre en UTC. Sin fijar la zona, lo gastado la noche del último
 * día del mes en México se contaría en el mes siguiente.
 */
export function claveMes(d: Date, zona = 'America/Mexico_City'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const valor = (t: string) => partes.find((p) => p.type === t)?.value;
  return `${valor('year')}-${valor('month')}`;
}

export function indicadores(d: { clientes: number; jobs: JobIndicador[]; entregables: number; ahora: Date }) {
  const mes = claveMes(d.ahora);
  const gasto = d.jobs
    .filter((j) => claveMes(j.createdAt) === mes)
    .reduce((s, j) => s + Number(j.costoUsd), 0);
  return {
    clientes: d.clientes,
    enCurso: d.jobs.filter((j) => j.estado === 'encolado' || j.estado === 'corriendo').length,
    entregables: d.entregables,
    gastoMes: Math.round(gasto * 100) / 100,
  };
}
