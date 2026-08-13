/**
 * Siembra un manual de campaña de demostración con contenido real.
 *
 * NO lo generan los agentes: el contenido viene del documento que el operador
 * ya tenía hecho a mano. Sirve para enseñar cómo rinde el motor, no para
 * presentarlo como una corrida automática.
 *
 * Se activa con SEED_GROWTH=1 y no hace nada si ya existe.
 */
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

if (!process.env.SEED_GROWTH) process.exit(0);
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const datos = JSON.parse(readFileSync(new URL('./growth-demo.json', import.meta.url), 'utf8'));
const nombre = process.env.SEED_GROWTH_CLIENTE ?? 'Yessica Villa';

const [cliente] = await sql`SELECT id FROM clients WHERE nombre = ${nombre} LIMIT 1`;
let clientId = cliente?.id;
if (!clientId) {
  const [nuevo] = await sql`
    INSERT INTO clients (nombre, giro, producto, ciudad, ticket, notas)
    VALUES (${nombre}, 'Cosmiatría y formación', 'Diplomado en Cosmiatría Integral',
            'Guadalajara, Jalisco', '$36,000 MXN en 12 mensualidades',
            'Ejemplo de demostración con contenido real del entregable hecho a mano.')
    RETURNING id`;
  clientId = nuevo.id;
  await sql`INSERT INTO client_links (client_id, tipo, url)
            VALUES (${clientId}, 'sitio', 'https://yessicavilla.com')`;
}

const [ya] = await sql`SELECT id FROM growth_results WHERE client_id = ${clientId} LIMIT 1`;
if (ya) { console.log('[seed] el manual de ejemplo ya existe:', ya.id); await sql.end(); process.exit(0); }

const [job] = await sql`
  INSERT INTO research_jobs (client_id, tipo, estado, etapas, finished_at)
  VALUES (${clientId}, 'growth', 'completado', ${sql.json({
    estructura: 'ok', creativos: 'ok', google: 'ok', prompts: 'ok', segmentacion: 'ok',
  })}, now())
  RETURNING id`;

const [res] = await sql`
  INSERT INTO growth_results (job_id, client_id, datos)
  VALUES (${job.id}, ${clientId}, ${sql.json(datos)})
  RETURNING id`;

console.log('[seed] manual de ejemplo sembrado en /growth/' + res.id);
await sql.end();
