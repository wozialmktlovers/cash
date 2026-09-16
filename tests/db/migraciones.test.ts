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

describe('0007: lotes y piezas del desarrollo mensual', () => {
  const carpeta = path.resolve(__dirname, '../../drizzle');
  const m0007 = () => leerMigraciones(carpeta).find((x: { tag: string }) => x.tag === '0007_desarrollo_mensual')!;
  const snapshot = () => JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '0007_snapshot.json'), 'utf8'));
  const trozos = (): string[] => m0007().sql.map((t: string) => t.trim()).filter(Boolean);

  it('solo añade: dos tablas nuevas y dos columnas de clients, sin tocar datos existentes', () => {
    // La etapa 3 no reinterpreta nada de lo que ya hay, así que la migración
    // no lleva UPDATE ni DELETE (a diferencia del saneo de 0005).
    const texto = trozos().join('\n');
    expect(texto).toContain('CREATE TABLE "contenido_lotes"');
    expect(texto).toContain('CREATE TABLE "contenido_piezas"');
    expect(texto).toContain('ALTER TABLE "clients" ADD COLUMN "paquete" jsonb;');
    expect(texto).toContain('ALTER TABLE "clients" ADD COLUMN "dias_revision" integer;');
    expect(texto).not.toMatch(/^(UPDATE|DELETE)\b/mi);
    expect(texto).not.toContain('DROP');
  });

  it('no añade valores a un enum existente: el lote reusa `estado_etapa`', () => {
    // Importa por el migrador (scripts/migraciones.mjs): un valor añadido con
    // `ALTER TYPE ... ADD VALUE` no se puede usar hasta que su transacción
    // confirma. Aquí no hay ninguno —los tres enums son nuevos, y un tipo
    // creado en la transacción sí se puede usar en ella—, así que 0007 entra
    // entera aunque se aplique de golpe sobre una base atrasada.
    expect(trozos().join('\n')).not.toContain('ADD VALUE');
    // Reusarlo no es ahorro: la etapa muestra el estado de su lote activo, y
    // `sincronizarEtapa` (tarea A3) lo copia sin traducir.
    expect(snapshot().tables['public.contenido_lotes'].columns.estado).toMatchObject({
      name: 'estado', type: 'estado_etapa', notNull: true, default: "'en_proceso'",
    });
  });

  it('los tres enums nuevos se crean antes de la tabla que los usa', () => {
    const t = trozos();
    const indice = (fragmento: string) => t.findIndex((x) => x.includes(fragmento));
    for (const tipo of ['formato_pieza', 'plataforma_pieza', 'estado_revision_pieza']) {
      const creacion = indice(`CREATE TYPE "public"."${tipo}"`);
      expect(creacion).toBeGreaterThanOrEqual(0);
      expect(creacion).toBeLessThan(indice('CREATE TABLE "contenido_piezas"'));
    }
    const enums = snapshot().enums;
    expect(enums['public.formato_pieza'].values).toEqual(['post', 'carrusel', 'reel', 'historia']);
    expect(enums['public.plataforma_pieza'].values).toEqual(['facebook', 'instagram', 'ambas']);
    expect(enums['public.estado_revision_pieza'].values).toEqual(['pendiente', 'aprobada', 'cambios']);
  });

  it('un solo lote por cliente y mes: la restricción vive en la base, no solo en el código', () => {
    // Es lo que sostiene el diseño §2 (el lote activo). Si solo lo cuidara la
    // API, dos operadores creando septiembre a la vez dejarían al cliente con
    // dos «meses en curso» y un lote activo ambiguo.
    expect(trozos().join('\n')).toContain('CONSTRAINT "contenido_lotes_client_id_periodo" UNIQUE("client_id","periodo")');
    expect(snapshot().tables['public.contenido_lotes'].uniqueConstraints.contenido_lotes_client_id_periodo)
      .toMatchObject({ columns: ['client_id', 'periodo'] });
  });

  it('`periodo` se valida con un CHECK, como el `client_id` por rol de 0005', () => {
    const valor: string = snapshot().tables['public.contenido_lotes'].checkConstraints.contenido_lotes_periodo_formato.value;
    expect(trozos().join('\n')).toContain(`CHECK (${valor})`);
    // Se prueba la expresión tal como quedó en la base, no una copia: es el
    // mismo formato que comprobará `periodoValido` (tarea A2).
    const patron = new RegExp(valor.match(/'(\^.*\$)'/)![1]);
    for (const bueno of ['2026-01', '2026-09', '2026-12', '1999-11']) expect(patron.test(bueno)).toBe(true);
    for (const malo of ['2026-9', '2026-00', '2026-13', '26-09', '2026-09-01', 'septiembre', '']) expect(patron.test(malo)).toBe(false);
  });

  it('el número identifica a la pieza dentro de su lote', () => {
    // «La pieza 7 de septiembre» es como se habla de ella con el cliente.
    expect(trozos().join('\n')).toContain('CONSTRAINT "contenido_piezas_lote_id_numero" UNIQUE("lote_id","numero")');
  });

  it('borrar el cliente se lleva sus lotes y el lote sus piezas; al autor solo lo desliga', () => {
    const texto = trozos().join('\n');
    expect(texto).toMatch(/"contenido_lotes_client_id_clients_id_fk".*REFERENCES "public"\."clients".*ON DELETE cascade/);
    expect(texto).toMatch(/"contenido_piezas_lote_id_contenido_lotes_id_fk".*REFERENCES "public"\."contenido_lotes".*ON DELETE cascade/);
    // El lote sobrevive a que se dé de baja al operador que lo creó.
    expect(texto).toMatch(/"contenido_lotes_creado_por_users_id_fk".*REFERENCES "public"\."users".*ON DELETE set null/);
  });

  it('`arte` es jsonb con lista vacía por omisión, y el copy nunca es nulo', () => {
    const cols = snapshot().tables['public.contenido_piezas'].columns;
    expect(cols.arte).toMatchObject({ type: 'jsonb', notNull: true, default: "'[]'::jsonb" });
    // Texto vacío y no nulo: la pieza nace al planear el mes y el copy llega
    // después, pero leerlo no debería obligar a pensar en null.
    for (const c of ['copy', 'cta', 'hashtags']) expect(cols[c]).toMatchObject({ type: 'text', notNull: true, default: "''" });
    expect(cols.estado_cliente).toMatchObject({ type: 'estado_revision_pieza', notNull: true, default: "'pendiente'" });
    // La fecha de publicación es un día, sin hora ni zona, y puede faltar.
    expect(cols.fecha_publicacion).toMatchObject({ type: 'date', notNull: false });
  });

  it('el paquete y el plazo de revisión viven en el cliente, nulos y sin relleno', () => {
    // Diseño §3: el paquete se guarda en el cliente y cada lote lo hereda.
    // Nulos porque los clientes de hoy no tienen contratada la etapa 3; los
    // días de revisión nulos significan «los 2 de por omisión», constante del
    // código, para no migrar si ese valor por omisión cambia.
    const cols = snapshot().tables['public.clients'].columns;
    expect(cols.paquete).toMatchObject({ name: 'paquete', type: 'jsonb', notNull: false });
    expect(cols.dias_revision).toMatchObject({ name: 'dias_revision', type: 'integer', notNull: false });
    for (const c of ['paquete', 'dias_revision']) expect(cols[c].default).toBeUndefined();
  });
});

describe('0008: el brief visual de la pieza', () => {
  const carpeta = path.resolve(__dirname, '../../drizzle');
  const m0008 = () => leerMigraciones(carpeta).find((x: { tag: string }) => x.tag === '0008_brief_visual_pieza')!;

  it('solo añade la columna, con cadena vacía por omisión y sin tocar datos', () => {
    // Las piezas de hoy no tienen brief porque no había dónde guardarlo, y
    // vacío es exactamente lo que son: no hay nada que rellenar.
    const trozos: string[] = m0008().sql.map((t: string) => t.trim()).filter(Boolean);
    expect(trozos).toEqual(['ALTER TABLE "contenido_piezas" ADD COLUMN "brief_visual" text DEFAULT \'\' NOT NULL;']);
  });

  it('la columna de la migración es la que declara el esquema (sin deriva con drizzle-kit)', () => {
    const snapshot = JSON.parse(fs.readFileSync(path.join(carpeta, 'meta', '0008_snapshot.json'), 'utf8'));
    const cols = snapshot.tables['public.contenido_piezas'].columns;
    // Mismo trato que `copy`, `cta` y `hashtags`: texto no nulo con vacío por
    // omisión, para que leer el brief no obligue a pensar en null.
    for (const c of ['copy', 'cta', 'hashtags', 'brief_visual']) {
      expect(cols[c]).toMatchObject({ type: 'text', notNull: true, default: "''" });
    }
  });
});
