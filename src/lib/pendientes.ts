import { eq, sql } from 'drizzle-orm';
import { db, clienteEtapas, clients, comentarios } from '@/db';
import { condicionClientes } from './visibilidad';
import type { UsuarioSesion } from './permisos';

/**
 * Conteo barato para el contador de «Pendientes» en la barra de navegación:
 * una sola consulta, sin listar filas — se corre en `Base.astro`, o sea en
 * cada página, así que no puede ser una consulta cara ni disparar varias.
 *
 * Admin cuenta etapas `en_revision` de todos (le toca decidir). Operador
 * cuenta exactamente lo que `/pendientes` le lista (spec §3, tabla
 * «Pendientes»): sus etapas `con_cambios`, sus etapas `en_proceso` (que
 * todavía no se solicitaron) y los comentarios abiertos de primer nivel en
 * sus clientes — antes esto solo contaba `con_cambios`, así que el número de
 * la barra lateral se quedaba corto contra lo que la página realmente
 * mostraba (fix wave, punto 6). Las dos partes van en una sola consulta, con
 * dos subconsultas de `count` sumadas, para no disparar varias por página.
 * El cliente nunca ve esta página, así que da 0.
 */
export async function contarPendientes(usuario: UsuarioSesion): Promise<number> {
  if (usuario.rol === 'admin') {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(clienteEtapas).where(eq(clienteEtapas.estado, 'en_revision'));
    return n;
  }

  if (usuario.rol === 'operador') {
    // `cond` filtra por `clients.operadorId`, sin alias: las dos subconsultas
    // de abajo se apoyan en eso, cada una con su propio JOIN a `clients` sin
    // renombrarla, para que la condición siga apuntando a la tabla correcta
    // en ambas. Un SELECT escalar (sin FROM propio, solo las dos subconsultas
    // sumadas) — `db.execute`, no `db.select().from(...)`, porque no hay una
    // sola tabla que encabece la consulta.
    const cond = condicionClientes(usuario);
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM ${clienteEtapas}
           INNER JOIN ${clients} ON ${clients.id} = ${clienteEtapas.clientId}
          WHERE ${clienteEtapas.estado} IN ('con_cambios', 'en_proceso') AND (${cond}))
        +
        (SELECT count(*)::int FROM ${comentarios}
           INNER JOIN ${clienteEtapas} ON ${clienteEtapas.id} = ${comentarios.etapaId}
           INNER JOIN ${clients} ON ${clients.id} = ${clienteEtapas.clientId}
          WHERE ${comentarios.estado} = 'abierto' AND ${comentarios.respuestaDe} IS NULL AND (${cond}))
        AS n
    `);
    return n;
  }

  return 0;
}
