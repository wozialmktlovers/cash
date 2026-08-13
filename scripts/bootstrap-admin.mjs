import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

/**
 * Crea o actualiza el usuario administrador a partir de ADMIN_EMAIL y
 * ADMIN_PASSWORD. Existe porque en un servicio administrado no siempre hay
 * shell para correr scripts/crear-usuario.mjs a mano.
 *
 * La contraseña vive solo en las variables del servicio: nunca en el repositorio.
 * Una vez creado el usuario, conviene borrar ambas variables.
 */
export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) return;

  if (password.length < 12) {
    console.error('[admin] ADMIN_PASSWORD debe tener al menos 12 caracteres. No se creó el usuario.');
    return;
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await sql`INSERT INTO users (email, password_hash) VALUES (${email}, ${h})
              ON CONFLICT (email) DO UPDATE SET password_hash = ${h}`;
    console.log(`[admin] usuario listo: ${email} — borra ADMIN_EMAIL y ADMIN_PASSWORD de las variables`);
  } catch (e) {
    console.error('[admin] no se pudo crear el usuario:', e instanceof Error ? e.message : e);
  } finally {
    await sql.end();
  }
}
