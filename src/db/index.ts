import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

let instancia: Db | null = null;

/**
 * Abre la conexión en el primer uso, no al importar el módulo.
 * Sin esto, `astro build` y los tests fallarían solo por importar este archivo
 * en entornos donde DATABASE_URL no existe todavía.
 */
export function obtenerDb(): Db {
  if (!instancia) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL');
    instancia = drizzle(postgres(url, { max: 5 }), { schema });
  }
  return instancia;
}

export const db = new Proxy({} as Db, {
  get(_destino, prop) {
    const real = obtenerDb() as unknown as Record<string | symbol, unknown>;
    const valor = real[prop];
    return typeof valor === 'function' ? valor.bind(real) : valor;
  },
});

export * from './schema';
