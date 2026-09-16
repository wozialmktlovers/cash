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

/**
 * Lo gastado en jobs del mes en curso, en dólares y a dos decimales.
 *
 * Sale de `indicadores` porque el Inicio cambió sus cuatro cifras (diseño §2)
 * y de las de aquí solo conserva esta: pedirle el paquete completo lo obligaba
 * a seguir contando entregables con tres `count` que ya nadie enseña.
 */
export function gastoDelMes(jobs: JobIndicador[], ahora: Date): number {
  const mes = claveMes(ahora);
  const gasto = jobs
    .filter((j) => claveMes(j.createdAt) === mes)
    .reduce((s, j) => s + Number(j.costoUsd), 0);
  return Math.round(gasto * 100) / 100;
}

export function indicadores(d: { clientes: number; jobs: JobIndicador[]; entregables: number; ahora: Date }) {
  return {
    clientes: d.clientes,
    enCurso: d.jobs.filter((j) => j.estado === 'encolado' || j.estado === 'corriendo').length,
    entregables: d.entregables,
    gastoMes: gastoDelMes(d.jobs, d.ahora),
  };
}
