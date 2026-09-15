import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { aplicarMigraciones, leerMigraciones, migracionesPendientes } from '../../scripts/migraciones.mjs';

/**
 * El aplicador de migraciones (scripts/migraciones.mjs) sin Postgres: un
 * doble de postgres.js que anota cada consulta con el número de transacción
 * en la que corrió. La reproducción real del fallo («unsafe use of new value»
 * al aplicar 0002–0004 de golpe sobre una base en 0001) necesita Postgres y
 * está documentada en .superpowers/sdd/2026-09-15-correcciones-wozial49/
 * task-B-report.md; aquí se fija el contrato que la evita: una transacción
 * por migración, en orden, sin repetir lo ya registrado.
 */
function sqlFalso(ultimaCreatedAt: number | string | null, opciones: { fallaEn?: string } = {}) {
  const consultas: Array<{ texto: string; params?: unknown[]; tx: number | null }> = [];
  let transacciones = 0;
  const confirmadas: number[] = [];

  const ejecutar = (tx: number | null) => async (texto: string, params?: unknown[]) => {
    if (opciones.fallaEn && texto.includes(opciones.fallaEn)) throw new Error(`falla simulada: ${opciones.fallaEn}`);
    consultas.push({ texto, params, tx });
    if (/SELECT created_at FROM/.test(texto)) return ultimaCreatedAt === null ? [] : [{ created_at: ultimaCreatedAt }];
    return [];
  };

  const sql = {
    unsafe: ejecutar(null),
    begin: async (fn: (tx: { unsafe: ReturnType<typeof ejecutar> }) => Promise<void>) => {
      const numero = ++transacciones;
      await fn({ unsafe: ejecutar(numero) });
      confirmadas.push(numero);
    },
  };
  return { sql, consultas, confirmadas, get transacciones() { return transacciones; } };
}

const m = (tag: string, folderMillis: number, sql: string[]) => ({ tag, folderMillis, sql, hash: `hash-${tag}`, bps: true });

const MIGRACIONES = [
  m('0000', 100, ['CREATE TABLE a ();']),
  m('0001', 200, ['CREATE TYPE documento_tipo AS ENUM (\'research\');']),
  m('0002', 300, ["ALTER TYPE documento_tipo ADD VALUE 'pilares';", 'CREATE TABLE p ();']),
  m('0003', 400, ['UPDATE users SET rol = \'admin\';']),
  m('0004', 500, ["UPDATE cliente_etapas SET documento_tipo='pilares';", '\n']),
];

describe('migracionesPendientes', () => {
  it('con la tabla vacía, todas en el orden del journal', () => {
    expect(migracionesPendientes(MIGRACIONES, null).map((x) => x.tag)).toEqual(['0000', '0001', '0002', '0003', '0004']);
  });

  it('solo las posteriores a la última registrada (created_at llega como texto desde bigint)', () => {
    expect(migracionesPendientes(MIGRACIONES, '200').map((x) => x.tag)).toEqual(['0002', '0003', '0004']);
  });

  it('ninguna si ya está registrada la última', () => {
    expect(migracionesPendientes(MIGRACIONES, 500)).toEqual([]);
  });
});

describe('aplicarMigraciones', () => {
  it('cada migración pendiente va en su propia transacción: ADD VALUE (0002) se confirma antes de que 0004 use el valor', async () => {
    const f = sqlFalso('200');
    const aplicadas = await aplicarMigraciones(f.sql, MIGRACIONES);

    expect(aplicadas).toEqual(['0002', '0003', '0004']);
    expect(f.transacciones).toBe(3);
    expect(f.confirmadas).toEqual([1, 2, 3]);

    const txDe = (fragmento: string) => f.consultas.find((c) => c.texto.includes(fragmento))!.tx;
    expect(txDe('ADD VALUE')).toBe(1);
    expect(txDe("documento_tipo='pilares'")).toBe(3);
  });

  it('registra cada una con su hash y su when dentro de la misma transacción que su SQL', async () => {
    const f = sqlFalso('200');
    await aplicarMigraciones(f.sql, MIGRACIONES);

    const inserts = f.consultas.filter((c) => c.texto.includes('INSERT INTO "drizzle"."__drizzle_migrations"'));
    expect(inserts.map((c) => [c.tx, c.params])).toEqual([
      [1, ['hash-0002', 300]],
      [2, ['hash-0003', 400]],
      [3, ['hash-0004', 500]],
    ]);
  });

  it('no manda los trozos en blanco que deja un breakpoint final', async () => {
    const f = sqlFalso('400');
    await aplicarMigraciones(f.sql, MIGRACIONES);
    expect(f.consultas.some((c) => c.tx !== null && !c.texto.trim())).toBe(false);
  });

  it('es idempotente: con todo registrado no abre ninguna transacción', async () => {
    const f = sqlFalso('500');
    expect(await aplicarMigraciones(f.sql, MIGRACIONES)).toEqual([]);
    expect(f.transacciones).toBe(0);
  });

  it('si una migración falla, las anteriores quedan confirmadas y el error sube', async () => {
    const f = sqlFalso('200', { fallaEn: 'UPDATE users' });
    await expect(aplicarMigraciones(f.sql, MIGRACIONES)).rejects.toThrow('falla simulada');
    expect(f.confirmadas).toEqual([1]);
    expect(f.consultas.some((c) => c.texto.includes("documento_tipo='pilares'"))).toBe(false);
  });
});

describe('leerMigraciones con la carpeta real', () => {
  const carpeta = path.resolve(__dirname, '../../drizzle');
  const journal = JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '_journal.json'), 'utf8'));

  it('sigue el orden del journal y conserva tag y when', () => {
    const leidas = leerMigraciones(carpeta);
    expect(leidas.map((x: { tag: string }) => x.tag)).toEqual(journal.entries.map((e: { tag: string }) => e.tag));
    expect(leidas.map((x: { folderMillis: number }) => x.folderMillis)).toEqual(journal.entries.map((e: { when: number }) => e.when));
  });

  it('calcula el mismo hash que drizzle (sha256 del archivo), para no desconocer lo ya registrado', () => {
    for (const leida of leerMigraciones(carpeta)) {
      const archivo = fs.readFileSync(path.join(carpeta, `${leida.tag}.sql`));
      expect(leida.hash).toBe(crypto.createHash('sha256').update(archivo.toString()).digest('hex'));
    }
  });

  it('el when del journal crece estrictamente: el criterio de «pendiente» depende de ello', () => {
    const whens = journal.entries.map((e: { when: number }) => e.when);
    for (let i = 1; i < whens.length; i++) expect(whens[i]).toBeGreaterThan(whens[i - 1]);
  });
});

describe('0005: CHECK de client_id según el rol (M2 punto 6)', () => {
  const carpeta = path.resolve(__dirname, '../../drizzle');
  const m0005 = () => leerMigraciones(carpeta).find((x: { tag: string }) => x.tag === '0005_usuarios_client_id_rol')!;

  it('sanea las filas existentes ANTES de añadir el CHECK', () => {
    const trozos: string[] = m0005().sql.map((t: string) => t.trim()).filter(Boolean);
    const indice = (fragmento: string) => trozos.findIndex((t) => t.includes(fragmento));
    const limpiaInternos = indice(`SET "client_id" = NULL WHERE "rol" <> 'cliente'`);
    const cierraSesiones = indice('DELETE FROM "sessions"');
    const desactiva = indice(`SET "activo" = false WHERE "rol" = 'cliente' AND "client_id" IS NULL`);
    const check = indice('ADD CONSTRAINT "users_client_id_por_rol" CHECK');
    for (const i of [limpiaInternos, cierraSesiones, desactiva, check]) expect(i).toBeGreaterThanOrEqual(0);
    expect(cierraSesiones).toBeLessThan(desactiva);
    expect(Math.max(limpiaInternos, desactiva)).toBeLessThan(check);
  });

  it('el CHECK de la migración es el mismo que declara el esquema (sin deriva con drizzle-kit)', async () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '0005_snapshot.json'), 'utf8'));
    const valor = snapshot.tables['public.users'].checkConstraints.users_client_id_por_rol.value;
    const sqlCheck = m0005().sql.find((t: string) => t.includes('ADD CONSTRAINT'))!;
    expect(sqlCheck).toContain(`CHECK (${valor})`);
  });
});

describe('0006: la columna `apellido` de users', () => {
  const carpeta = path.resolve(__dirname, '../../drizzle');
  const m0006 = () => leerMigraciones(carpeta).find((x: { tag: string }) => x.tag === '0006_usuarios_apellido')!;

  it('solo añade la columna: nula, sin relleno ni valor por omisión', () => {
    // Una fila con nombre y apellido vacíos es válida (es el estado de los
    // usuarios de hoy), así que la migración no toca ningún dato existente.
    const trozos: string[] = m0006().sql.map((t: string) => t.trim()).filter(Boolean);
    expect(trozos).toEqual(['ALTER TABLE "users" ADD COLUMN "apellido" text;']);
  });

  it('la columna de la migración es la que declara el esquema (sin deriva con drizzle-kit)', () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '0006_snapshot.json'), 'utf8'));
    expect(snapshot.tables['public.users'].columns.apellido).toMatchObject({ name: 'apellido', type: 'text', notNull: false });
  });
});
