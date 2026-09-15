import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

/**
 * Prepara el acceso del administrador a partir de ADMIN_EMAIL y ADMIN_PASSWORD.
 * Existe porque en un servicio administrado no siempre hay shell para correr
 * scripts/crear-usuario.mjs a mano.
 *
 * Ya no es un upsert incondicional: con roles, una vez que hay un admin
 * activo, esta función no debe deshacer lo que alguien cambió desde la
 * interfaz (democión a operador, desactivación). Por eso:
 *   - Correo nuevo → se crea como admin activo.
 *   - Correo existente y YA hay un admin activo en la base → no se toca nada
 *     (se registra en el log y se sigue de largo).
 *   - Correo existente y NO hay ningún admin activo → ruta de recuperación:
 *     este usuario recupera rol=admin, activo=true y la contraseña de las
 *     variables de entorno.
 * Todo corre en una sola transacción para que la lectura del estado (¿hay
 * admin activo?) y la escritura no puedan pisarse con un boot concurrente.
 *
 * La contraseña vive solo en las variables del servicio: nunca en el repositorio.
 * Una vez creado o recuperado el usuario, conviene borrar ambas variables.
 *
 * `ADMIN_NOMBRE` y `ADMIN_APELLIDO` son opcionales: si vienen, el admin nace
 * (o se recupera) con ellos; si no, la fila conserva el nombre que ya tuviera.
 *
 * `opciones.sql` permite pasar un cliente de postgres.js (o un doble, en las
 * pruebas); sin él, abre y cierra su propia conexión con DATABASE_URL.
 */
export async function bootstrapAdmin(opciones = {}) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  // Vacío cuenta como «no se pasó»: NULL, para que el COALESCE de abajo respete
  // lo que ya hubiera en la fila.
  const nombre = process.env.ADMIN_NOMBRE?.trim() || null;
  const apellido = process.env.ADMIN_APELLIDO?.trim() || null;

  if (!email || !password) return;

  if (password.length < 12) {
    console.error('[admin] ADMIN_PASSWORD debe tener al menos 12 caracteres. No se creó el usuario.');
    return;
  }

  const sql = opciones.sql ?? postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });

    await sql.begin(async (tx) => {
      const [existente] = await tx`SELECT id FROM users WHERE email = ${email} LIMIT 1`;

      if (!existente) {
        // Con roles, un usuario nuevo nace operador; este es el único punto
        // que crea un admin directamente.
        await tx`INSERT INTO users (email, password_hash, rol, activo, client_id, nombre, apellido) VALUES (${email}, ${h}, 'admin', true, NULL, ${nombre}, ${apellido})`;
        console.log(`[admin] usuario creado: ${email} — borra ADMIN_EMAIL y ADMIN_PASSWORD de las variables`);
        return;
      }

      const [{ hayAdminActivo }] = await tx`
        SELECT EXISTS(SELECT 1 FROM users WHERE rol = 'admin' AND activo = true) AS "hayAdminActivo"
      `;
      if (hayAdminActivo) {
        console.log(`[admin] ya hay un administrador activo; no se modificó ${email}`);
        return;
      }

      // Ruta de recuperación: nadie con acceso de admin en este momento.
      // `client_id = NULL` (M2 punto 5): si el correo era de un usuario de
      // cliente, al volverlo admin deja de pertenecer a ese cliente; conservarlo
      // le daría acceso de admin «atado» a un cliente y viola el CHECK de 0005.
      // `COALESCE(param, columna)`: sin ADMIN_NOMBRE/ADMIN_APELLIDO la fila se
      // queda con el nombre que ya tenía; recuperar el acceso no lo borra.
      await tx`UPDATE users SET rol = 'admin', activo = true, password_hash = ${h}, client_id = NULL, nombre = COALESCE(${nombre}, nombre), apellido = COALESCE(${apellido}, apellido) WHERE id = ${existente.id}`;
      console.log(`[admin] acceso de administrador recuperado: ${email} — borra ADMIN_EMAIL y ADMIN_PASSWORD de las variables`);
    });
  } catch (e) {
    console.error('[admin] no se pudo preparar el usuario:', e instanceof Error ? e.message : e);
  } finally {
    // Solo cierra la conexión que abrió aquí; una prestada la cierra su dueño.
    if (!opciones.sql) await sql.end();
  }
}
