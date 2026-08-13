import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { CLIENTE_EJEMPLO, INVESTIGACION_EJEMPLO } from './datos-ejemplo.mjs';

/**
 * Siembra la investigación real de Ana Yessica Villa como ejemplo dentro del
 * sistema. Es idempotente: si el cliente ya existe, reemplaza su resultado en
 * vez de duplicarlo.
 *
 * Se ejecuta en el arranque si SEMBRAR_EJEMPLO=1.
 */
export async function sembrarEjemplo(sql) {
  const propio = !sql;
  sql = sql ?? postgres(process.env.DATABASE_URL, { max: 1 });

  try {
    const c = CLIENTE_EJEMPLO;

    const [existente] = await sql`SELECT id FROM clients WHERE nombre = ${c.nombre} LIMIT 1`;
    if (existente) {
      console.log('[ejemplo] ya estaba sembrado, no se duplica');
      return null;
    }

    const [cliente] = await sql`
      INSERT INTO clients (nombre, giro, producto, ciudad, ticket, contacto, notas)
      VALUES (${c.nombre}, ${c.giro}, ${c.producto}, ${c.ciudad}, ${c.ticket}, ${c.contacto}, ${c.notas})
      RETURNING id`;

    const [job] = await sql`
      INSERT INTO research_jobs (client_id, estado, etapas, costo_usd, finished_at)
      VALUES (${cliente.id}, 'completado',
              ${sql.json({ competencia: 'ok', audiencia: 'ok', canales: 'ok', mercado: 'ok', sintesis: 'ok' })},
              '0', now())
      RETURNING id`;

    const [resultado] = await sql`
      INSERT INTO research_results (job_id, client_id, datos, version)
      VALUES (${job.id}, ${cliente.id}, ${sql.json(INVESTIGACION_EJEMPLO)}, 1)
      RETURNING id`;

    console.log(`[ejemplo] cliente ${cliente.id} · resultado ${resultado.id}`);
    return resultado.id;
  } finally {
    if (propio) await sql.end();
  }
}

// Permite correrlo a mano: node --env-file=.env scripts/sembrar-ejemplo.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }
  await sembrarEjemplo();
}
