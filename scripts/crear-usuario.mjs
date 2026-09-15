import postgres from 'postgres';
import { hash } from '@node-rs/argon2';
import { pathToFileURL } from 'node:url';

// Mismo mínimo que la invitación y que ADMIN_PASSWORD (M2 punto 5): este
// script es la puerta trasera para crear un admin, no debe aceptar menos.
const MINIMO_PASSWORD = 12;

/** Valida `[correo, contraseña, rol?, nombre?, apellido?]` de la línea de comandos. Pura: la usan las pruebas. */
export function validarArgumentos(argv) {
  const [email, password, rolArg, nombreArg, apellidoArg] = argv;
  if (!email || !password) {
    return { ok: false, error: 'Uso: node scripts/crear-usuario.mjs correo@dominio.com contraseña [admin|operador] [nombre] [apellido]' };
  }
  if (password.length < MINIMO_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres` };
  }
  if (rolArg && rolArg !== 'admin' && rolArg !== 'operador') {
    return { ok: false, error: 'El rol debe ser admin u operador (los clientes entran por invitación)' };
  }
  // `null` cuando no se pasó (o venía en blanco): la sentencia lo distingue de
  // una cadena vacía para no pisar el nombre que la fila ya tuviera.
  const limpio = (v) => (v ?? '').trim() || null;
  return {
    ok: true, email: email.toLowerCase(), password, rol: rolArg,
    nombre: limpio(nombreArg), apellido: limpio(apellidoArg),
  };
}

/**
 * La sentencia de alta. Con rol explícito, un correo existente cambia de rol
 * y además queda con `client_id = NULL` (M2 punto 5): si el usuario era de un
 * cliente, al promoverlo a admin/operador ya no pertenece a ningún cliente, y
 * el CHECK de la migración 0005 rechazaría la fila si lo conservara. Sin rol
 * explícito solo se cambia la contraseña, así que no hay promoción que limpiar.
 *
 * Nombre y apellido se actualizan con `COALESCE($4, users.nombre)`: sin pasarlos
 * el parámetro llega NULL y la fila conserva lo que ya tenía, para que cambiarle
 * la contraseña a alguien no le borre el nombre.
 * Parámetros: $1 correo, $2 hash, $3 rol, $4 nombre, $5 apellido.
 */
export function sentenciaCrearUsuario(conRol) {
  const alta = `INSERT INTO users (email, password_hash, rol, client_id, nombre, apellido) VALUES ($1, $2, $3, NULL, $4, $5)`;
  const datos = `nombre = COALESCE($4, users.nombre), apellido = COALESCE($5, users.apellido)`;
  return conRol
    ? `${alta}
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = $3, client_id = NULL, ${datos}`
    : `${alta}
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, ${datos}`;
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
    // Mismo orden que los `$n` de la sentencia: correo, hash, rol, nombre, apellido.
    await sql.unsafe(sentenciaCrearUsuario(Boolean(args.rol)), [args.email, h, rolNuevo, args.nombre, args.apellido]);
  } finally {
    await sql.end();
  }
  console.log('Usuario listo:', args.email);
}

// Solo corre al invocarlo como script; importarlo (pruebas) no toca la base.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
