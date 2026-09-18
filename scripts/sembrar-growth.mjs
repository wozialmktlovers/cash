/**
 * Siembra un manual de campaña de demostración con contenido real.
 *
 * NO lo generan los agentes: el contenido viene del entregable que el
 * operador ya tenía hecho a mano. Sirve para enseñar cómo rinde el motor,
 * no para presentarlo como una corrida automática.
 *
 * Se exporta como función y NO llama a process.exit: arranque.mjs lo importa
 * en el mismo proceso, así que salir aquí mataría el servidor antes de que
 * llegue a escuchar. Pasó, y el resultado fue un 502 con la migración ya
 * aplicada y el seed corrido.
 */
import { readFileSync } from 'node:fs';
import postgres from 'postgres';

export async function sembrarGrowth() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const datos = JSON.parse(readFileSync(new URL('./growth-demo.json', import.meta.url), 'utf8'));
    // Se puede apuntar a un cliente que ya existe, para que su manual quede
    // junto a su investigación en vez de crear un cliente aparte.
    const porId = process.env.SEED_GROWTH_CLIENT_ID;
    const nombre = process.env.SEED_GROWTH_CLIENTE ?? 'Yessica Villa';

    const [cliente] = porId
      ? await sql`SELECT id FROM clients WHERE id = ${porId} LIMIT 1`
      : await sql`SELECT id FROM clients WHERE nombre = ${nombre} LIMIT 1`;
    let clientId = cliente?.id;
    if (!clientId && porId) throw new Error('No existe el cliente ' + porId);
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

    // Sin enlace de tipo sitio no hay destino, y sin destino no se construye
    // ninguna URL etiquetada: la trazabilidad sale vacía y las piezas se
    // quedan sin su UTM.
    const [sitio] = await sql`
      SELECT id FROM client_links WHERE client_id = ${clientId} AND tipo = 'sitio' LIMIT 1`;
    if (!sitio) {
      await sql`INSERT INTO client_links (client_id, tipo, url)
                VALUES (${clientId}, 'sitio', ${process.env.SEED_GROWTH_DESTINO ?? 'https://yessicavilla.com'})`;
      console.log('[seed] enlace de sitio añadido: sin él no hay URLs etiquetadas');
    }

    const [ya] = await sql`
      SELECT id FROM growth_results WHERE client_id = ${clientId} ORDER BY version DESC LIMIT 1`;
    if (ya) {
      // Ya existe: no se toca. Antes se reescribían sus datos en cada
      // arranque y cualquier edición hecha en la app se perdía al reiniciar.
      console.log('[seed] el manual de ejemplo ya existe, no se toca: /growth/' + ya.id);
      return;
    }

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
  } finally {
    await sql.end();
  }
}
