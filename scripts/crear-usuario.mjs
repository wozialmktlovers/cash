import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { pathToFileURL } from 'node:url';

// Mismo mínimo que la invitación y que ADMIN_PASSWORD (M2 punto 5): este
// script es la puerta trasera para crear un admin, no debe aceptar menos.
const MINIMO_PASSWORD = 12;

/** Valida `[correo, contraseña, rol?]` de la línea de comandos. Pura: la usan las pruebas. */
export function validarArgumentos(argv) {
  const [email, password, rolArg] = argv;
  if (!email || !password) {
    return { ok: false, error: 'Uso: node scripts/crear-usuario.mjs correo@dominio.com contraseña [admin|operador]' };
  }
  if (password.length < MINIMO_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres` };
  }
  if (rolArg && rolArg !== 'admin' && rolArg !== 'operador') {
    return { ok: false, error: 'El rol debe ser admin u operador (los clientes entran por invitación)' };
  }
  return { ok: true, email: email.toLowerCase(), password, rol: rolArg };
}

/**
 * La sentencia de alta. Con rol explícito, un correo existente cambia de rol
 * y además queda con `client_id = NULL` (M2 punto 5): si el usuario era de un
 * cliente, al promoverlo a admin/operador ya no pertenece a ningún cliente, y
 * el CHECK de la migración 0005 rechazaría la fila si lo conservara. Sin rol
 * explícito solo se cambia la contraseña, así que no hay promoción que limpiar.
 * Parámetros: $1 correo, $2 hash, $3 rol.
 */
export function sentenciaCrearUsuario(conRol) {
  return conRol
    ? `INSERT INTO users (email, password_hash, rol, client_id) VALUES ($1, $2, $3, NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = $3, client_id = NULL`
    : `INSERT INTO users (email, password_hash, rol, client_id) VALUES ($1, $2, $3, NULL)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`;
}

async function main() {
  const args = validarArgumentos(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }

  // Sin rol explícito, un usuario nuevo nace admin (es el respaldo de bootstrap-admin)
  // y uno existente conserva el suyo.
  const rolNuevo = args.rol ?? 'admin';
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const h = await hash(args.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
    await sql.unsafe(sentenciaCrearUsuario(Boolean(args.rol)), [args.email, h, rolNuevo]);
  } finally {
    await sql.end();
  }
  console.log('Usuario listo:', args.email);
}

// Solo corre al invocarlo como script; importarlo (pruebas) no toca la base.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
