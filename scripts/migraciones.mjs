// Aplicador de migraciones: el mismo contrato que el migrador de
// drizzle-orm (`drizzle-orm/postgres-js/migrator`), con una sola diferencia:
// cada migración va en SU PROPIA transacción.
//
// Por qué no el de drizzle: en drizzle-orm 0.45 `PgDialect.migrate` mete
// todas las migraciones pendientes en una única transacción. Postgres no
// deja usar un valor de enum añadido con `ALTER TYPE ... ADD VALUE` hasta
// que esa transacción hace COMMIT («unsafe use of new value», 55P04). Una
// base en 0001 (producción) que aplica de golpe 0002 (añade 'pilares' a
// documento_tipo) y 0004 (lo usa en un UPDATE) revienta y el Studio no
// arranca. Con una transacción por migración, 0002 ya está confirmada cuando
// corre 0004.
//
// Compatibilidad con lo ya aplicado: se lee la carpeta con
// `readMigrationFiles` de drizzle (mismo journal, mismo corte por
// `--> statement-breakpoint`, mismo hash sha256) y se escribe en la misma
// tabla `drizzle.__drizzle_migrations` con el mismo criterio para decidir qué
// falta: se aplican las migraciones cuyo `when` del journal es posterior al
// `created_at` de la última fila registrada. Una base que ya tiene 0004 (la
// local) no repite nada, y si algún día se vuelve al migrador de drizzle la
// tabla sigue siendo la suya.

import fs from 'node:fs';
import path from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';

export const ESQUEMA_MIGRACIONES = 'drizzle';
export const TABLA_MIGRACIONES = '__drizzle_migrations';

/**
 * Lee la carpeta de migraciones con el lector de drizzle (hash y trozos
 * idénticos a los que ya están registrados) y le añade a cada una su `tag`
 * del journal, solo para poder decir en el log cuál se está aplicando.
 * `readMigrationFiles` devuelve las migraciones en el orden del journal.
 */
export function leerMigraciones(carpeta) {
  const migraciones = readMigrationFiles({ migrationsFolder: carpeta });
  const journal = JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '_journal.json'), 'utf8'));
  return migraciones.map((m, i) => ({ ...m, tag: journal.entries[i]?.tag }));
}

/**
 * Las migraciones que faltan, en el orden del journal: las posteriores a la
 * última registrada. `ultimaCreatedAt` es null si la tabla está vacía.
 * Es la misma comparación que hace drizzle (`created_at < folderMillis`).
 */
export function migracionesPendientes(migraciones, ultimaCreatedAt) {
  if (ultimaCreatedAt === null || ultimaCreatedAt === undefined) return [...migraciones];
  const ultima = Number(ultimaCreatedAt);
  return migraciones.filter((m) => ultima < m.folderMillis);
}

/**
 * Aplica las migraciones pendientes con un cliente de postgres.js (`sql`).
 * Solo usa `sql.unsafe` y `sql.begin`, así que se puede probar con un doble.
 * Si una migración falla, su transacción se deshace y se relanza el error;
 * las anteriores ya quedaron confirmadas y registradas, de modo que el
 * siguiente arranque continúa desde la que falló.
 *
 * @returns las etiquetas (o `folderMillis`) de las migraciones aplicadas.
 */
export async function aplicarMigraciones(sql, migraciones, { log = () => {} } = {}) {
  const tabla = `"${ESQUEMA_MIGRACIONES}"."${TABLA_MIGRACIONES}"`;
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${ESQUEMA_MIGRACIONES}"`);
  await sql.unsafe(`CREATE TABLE IF NOT EXISTS ${tabla} (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )`);

  const filas = await sql.unsafe(`SELECT created_at FROM ${tabla} ORDER BY created_at DESC LIMIT 1`);
  const pendientes = migracionesPendientes(migraciones, filas[0]?.created_at ?? null);

  const aplicadas = [];
  for (const migracion of pendientes) {
    const nombre = migracion.tag ?? String(migracion.folderMillis);
    log(`Aplicando ${nombre}`);
    await sql.begin(async (tx) => {
      for (const sentencia of migracion.sql) {
        // drizzle manda también los trozos vacíos que deja un breakpoint al
        // final; aquí se omiten para no enviar consultas en blanco.
        if (!sentencia.trim()) continue;
        await tx.unsafe(sentencia);
      }
      await tx.unsafe(
        `INSERT INTO ${tabla} ("hash", "created_at") VALUES ($1, $2)`,
        [migracion.hash, migracion.folderMillis],
      );
    });
    aplicadas.push(nombre);
  }
  return aplicadas;
}
