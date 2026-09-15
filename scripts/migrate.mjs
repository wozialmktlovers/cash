import postgres from 'postgres';
import { aplicarMigraciones, leerMigraciones } from './migraciones.mjs';

// No se usa `migrate` de drizzle-orm: aplica todas las pendientes en una sola
// transacción y eso rompe con `ALTER TYPE ... ADD VALUE` (ver migraciones.mjs).

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }

// onnotice mudo: los CREATE ... IF NOT EXISTS de cada arranque solo avisan
// de que la tabla de control ya existe.
const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  const aplicadas = await aplicarMigraciones(sql, leerMigraciones('./drizzle'), { log: (m) => console.log(m) });
  console.log(aplicadas.length ? `Migraciones aplicadas: ${aplicadas.length}` : 'Migraciones al día');
} finally {
  await sql.end();
}
