import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');

const queryClient = postgres(url, { max: 5 });
export const db = drizzle(queryClient, { schema });
export * from './schema';
