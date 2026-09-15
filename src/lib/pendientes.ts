import { and, eq, sql } from 'drizzle-orm';
import { db, clienteEtapas, clients } from '@/db';
import { condicionClientes } from './visibilidad';
import type { UsuarioSesion } from './permisos';

/**
 * Conteo barato para el contador de «Pendientes» en la barra de navegación:
 * una sola consulta de `count`, sin listar filas — se corre en `Base.astro`,
 * o sea en cada página, así que no puede ser una consulta cara ni disparar
 * varias.
 *
 * Admin cuenta etapas `en_revision` de todos (le toca decidir); operador
 * cuenta `con_cambios` de sus clientes (le toca resolver los cambios
 * pedidos); el cliente nunca ve esta página, así que da 0.
 */
export async function contarPendientes(usuario: UsuarioSesion): Promise<number> {
  if (usuario.rol === 'admin') {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(clienteEtapas).where(eq(clienteEtapas.estado, 'en_revision'));
    return n;
  }

  if (usuario.rol === 'operador') {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(clienteEtapas)
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .where(and(eq(clienteEtapas.estado, 'con_cambios'), condicionClientes(usuario)));
    return n;
  }

  return 0;
}
