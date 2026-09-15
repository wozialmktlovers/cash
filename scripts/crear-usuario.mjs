import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const [email, password, rolArg] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/crear-usuario.mjs correo@dominio.com contraseña [admin|operador]');
  process.exit(1);
}
if (rolArg && rolArg !== 'admin' && rolArg !== 'operador') {
  console.error('El rol debe ser admin u operador (los clientes entran por invitación)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL');
  process.exit(1);
}

// Sin rol explícito, un usuario nuevo nace admin (es el respaldo de bootstrap-admin)
// y uno existente conserva el suyo.
const rolNuevo = rolArg ?? 'admin';
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
if (rolArg) {
  await sql`INSERT INTO users (email, password_hash, rol) VALUES (${email.toLowerCase()}, ${h}, ${rolNuevo})
            ON CONFLICT (email) DO UPDATE SET password_hash = ${h}, rol = ${rolNuevo}`;
} else {
  await sql`INSERT INTO users (email, password_hash, rol) VALUES (${email.toLowerCase()}, ${h}, ${rolNuevo})
            ON CONFLICT (email) DO UPDATE SET password_hash = ${h}`;
}
await sql.end();
console.log('Usuario listo:', email);
