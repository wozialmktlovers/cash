import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/crear-usuario.mjs correo@dominio.com contraseña');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
await sql`INSERT INTO users (email, password_hash) VALUES (${email.toLowerCase()}, ${h})
          ON CONFLICT (email) DO UPDATE SET password_hash = ${h}`;
await sql.end();
console.log('Usuario listo:', email);
