import { describe, it, expect, afterEach } from 'vitest';
import { bootstrapAdmin } from '../../scripts/bootstrap-admin.mjs';
import { validarArgumentos, sentenciaCrearUsuario } from '../../scripts/crear-usuario.mjs';

/**
 * M2 punto 5: los scripts que dan de alta o promueven a admin/operador
 * dejan `client_id` en NULL (un usuario interno nunca pertenece a un
 * cliente, y el CHECK de la migración 0005 lo exige), y `crear-usuario.mjs`
 * pide una contraseña de 12 caracteres o más, igual que la invitación.
 */

/** Doble de postgres.js: anota el texto de cada consulta y responde en orden. */
function sqlFalso(respuestas: unknown[][]) {
  const consultas: string[] = [];
  const tx = (partes: TemplateStringsArray) => {
    consultas.push(partes.join('$'));
    return Promise.resolve(respuestas.shift() ?? []);
  };
  const sql = Object.assign(tx, {
    begin: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
    end: async () => {},
  });
  return { sql, consultas };
}

const entorno = { ...process.env };
afterEach(() => { process.env = { ...entorno }; });

describe('bootstrapAdmin', () => {
  it('ruta de recuperación (sin admin activo): promueve a admin y limpia client_id', async () => {
    process.env.ADMIN_EMAIL = 'dueno@wozial.mx';
    process.env.ADMIN_PASSWORD = 'una-clave-larga-123';
    const f = sqlFalso([[{ id: 'u1' }], [{ hayAdminActivo: false }], []]);
    await bootstrapAdmin({ sql: f.sql });
    const update = f.consultas.find((c) => c.startsWith('UPDATE users'))!;
    expect(update).toContain("rol = 'admin'");
    expect(update).toContain('client_id = NULL');
  });

  it('correo nuevo: lo crea como admin con client_id NULL explícito', async () => {
    process.env.ADMIN_EMAIL = 'dueno@wozial.mx';
    process.env.ADMIN_PASSWORD = 'una-clave-larga-123';
    const f = sqlFalso([[], []]);
    await bootstrapAdmin({ sql: f.sql });
    const insert = f.consultas.find((c) => c.startsWith('INSERT INTO users'))!;
    expect(insert).toContain('client_id');
    expect(insert).toContain('NULL');
  });
});

describe('crear-usuario: argumentos', () => {
  it('exige correo y contraseña', () => {
    expect(validarArgumentos([]).ok).toBe(false);
    expect(validarArgumentos(['a@b.mx']).ok).toBe(false);
  });

  it('exige una contraseña de al menos 12 caracteres', () => {
    const r = validarArgumentos(['a@b.mx', 'corta12345']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('12');
    expect(validarArgumentos(['a@b.mx', '123456789012']).ok).toBe(true);
  });

  it('el rol solo puede ser admin u operador', () => {
    expect(validarArgumentos(['a@b.mx', '123456789012', 'cliente']).ok).toBe(false);
    expect(validarArgumentos(['a@b.mx', '123456789012', 'operador'])).toEqual({ ok: true, email: 'a@b.mx', password: '123456789012', rol: 'operador' });
  });
});

describe('crear-usuario: sentencia', () => {
  it('con rol explícito, el ON CONFLICT que cambia el rol también limpia client_id', () => {
    const s = sentenciaCrearUsuario(true);
    expect(s).toMatch(/DO UPDATE SET[^;]*rol = \$[^;]*client_id = NULL/);
  });

  it('sin rol explícito solo cambia la contraseña: no promueve a nadie', () => {
    const s = sentenciaCrearUsuario(false);
    expect(s).not.toMatch(/DO UPDATE SET[^;]*rol/);
  });
});
