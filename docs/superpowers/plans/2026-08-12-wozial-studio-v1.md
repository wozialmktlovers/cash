# Wozial Studio v1 — Plan de implementación

> **Para trabajadores agénticos:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Aplicación web privada que toma los datos de un cliente, ejecuta una investigación automatizada con la API de Claude y entrega el resultado como una presentación de 17 paneles con link compartible.

**Arquitectura:** Astro con SSR sirve las páginas y las rutas de API. Un worker dentro del mismo proceso toma trabajos de una tabla de PostgreSQL y los ejecuta contra la API de Claude. Cada agente devuelve JSON validado con Zod, que se guarda en la base y se renderiza en una plantilla HTML fija. El diseño de la presentación nunca depende del modelo.

**Stack:** Astro 7.2.1 · React 19 · TypeScript · PostgreSQL · Drizzle 0.45.2 · Zod 4.4.3 · @anthropic-ai/sdk 0.116.0 · Vitest 4.1.10 · Railway

## Restricciones globales

- Node 22 o superior. El proyecto usa `"type": "module"`.
- Todo el texto de interfaz va en español de México, sin voseo.
- Ningún test automatizado llama a la API real de Anthropic. Siempre simulada.
- Toda cifra que aparezca en una presentación debe traer fuente. Sin fuente, no se incluye.
- Los paneles sin datos se declaran vacíos con la razón. Nunca se rellenan con contenido inventado.
- Tope de costo por investigación: 15 USD, configurable con `COST_LIMIT_USD`.
- Modelos: `claude-sonnet-5` para los cuatro agentes de investigación, `claude-opus-5` para la síntesis.
- Límite de texto por archivo enviado al pipeline: 40,000 caracteres.
- Las contraseñas se guardan con Argon2id. Nunca en texto plano, nunca con bcrypt.
- Los tokens de compartir son de 32 bytes de `crypto.randomBytes`, codificados base64url.
- Repositorio: `wozialmktlovers/cash`. Proyecto Railway: Wozial Ads Manager · `e616a8d0-df41-448e-aaf4-206706bc7c8c`.
- El repositorio es público: ningún secreto, llave ni credencial puede entrar al historial de git.

## Estructura de archivos

```
src/
  db/
    schema.ts          Definición de las 7 tablas con Drizzle
    index.ts           Conexión y export del cliente
  lib/
    auth.ts            Hash, verificación, creación y validación de sesión
    files.ts           Guardado en volumen, validación de MIME, rutas seguras
    extract.ts         Extracción de texto de PDF, DOCX y TXT
    cost.ts            Cálculo de costo desde tokens
  research/
    schemas.ts         Esquemas Zod de los 17 paneles
    claude.ts          Wrapper del SDK con búsqueda web y conteo de tokens
    agents/
      competencia.ts   Agente 1
      audiencia.ts     Agente 2
      canales.ts       Agente 3
      mercado.ts       Agente 4
      sintesis.ts      Agente 5
    pipeline.ts        Orquestación de las cinco etapas
    worker.ts          Bucle que toma trabajos de la tabla
  render/
    presentation.ts    JSON → HTML de 17 paneles
    panels/            Un módulo por panel
  pages/
    login.astro
    index.astro
    clientes/nuevo.astro
    clientes/[id].astro
    clientes/[id]/investigar.astro
    jobs/[id].astro
    resultados/[id].astro
    p/[token].astro
    api/               Endpoints de acción
  components/          Islas de React
  middleware.ts        Guardia de sesión
tests/
```

---

## Tarea 1: Scaffold del proyecto

**Archivos:**
- Crear: `package.json`, `tsconfig.json`, `astro.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Crear: `src/pages/index.astro`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produce: proyecto Astro que compila y corre tests. Todas las tareas siguientes dependen de esto.

- [ ] **Paso 1: Crear el proyecto**

```bash
cd "/Users/michelangelgonzalezhernandez/Desktop/Claude/Wozial Studio"
npm init -y
npm pkg set type=module name=wozial-studio version=1.0.0
npm i astro@7.2.1 @astrojs/node@latest @astrojs/react@latest react@19 react-dom@19
npm i drizzle-orm@0.45.2 postgres zod@4.4.3 @anthropic-ai/sdk@0.116.0 @node-rs/argon2
npm i -D typescript @types/react @types/react-dom vitest@4.1.10 drizzle-kit
```

- [ ] **Paso 2: Escribir `astro.config.mjs`**

```javascript
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: { port: Number(process.env.PORT) || 4321, host: true },
});
```

- [ ] **Paso 3: Escribir `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

- [ ] **Paso 4: Escribir `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

- [ ] **Paso 5: Escribir `.gitignore` y `.env.example`**

`.gitignore`:
```
node_modules/
dist/
.astro/
.env
data/
```

`.env.example`:
```
DATABASE_URL=postgres://usuario:clave@localhost:5432/wozial_studio
ANTHROPIC_API_KEY=
SESSION_SECRET=
DATA_DIR=./data
COST_LIMIT_USD=15
COST_ESTIMATE_USD=8
MODEL_RESEARCH=claude-sonnet-5
MODEL_SYNTHESIS=claude-opus-5
PUBLIC_BASE_URL=http://localhost:4321
```

- [ ] **Paso 6: Escribir el test de humo**

`tests/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('carga variables de entorno de ejemplo', () => {
    expect(typeof process.env.NODE_ENV).toBe('string');
  });
});
```

- [ ] **Paso 7: Agregar scripts a `package.json`**

```bash
npm pkg set scripts.dev="astro dev"
npm pkg set scripts.build="astro build"
npm pkg set scripts.start="node ./dist/server/entry.mjs"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.db:generate="drizzle-kit generate"
npm pkg set scripts.db:migrate="node scripts/migrate.mjs"
```

- [ ] **Paso 8: Verificar que corre**

Ejecuta: `npm test`
Esperado: 1 test pasa.

Ejecuta: `npm run build`
Esperado: build exitoso, se crea `dist/`.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold de Astro con React, Drizzle y Vitest"
```

---

## Tarea 2: Esquema de base de datos

**Archivos:**
- Crear: `src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `scripts/migrate.mjs`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produce: `db` (cliente Drizzle), y las tablas `users`, `sessions`, `clients`, `clientLinks`, `clientFiles`, `researchJobs`, `researchResults`, `shareLinks`. Todas las tareas siguientes importan de aquí.

- [ ] **Paso 1: Escribir el test del esquema**

`tests/db/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';

describe('esquema', () => {
  it('define las ocho tablas', () => {
    const tablas = ['users','sessions','clients','clientLinks','clientFiles','researchJobs','researchResults','shareLinks'];
    for (const t of tablas) expect(schema).toHaveProperty(t);
  });

  it('los estados de trabajo incluyen los cinco valores', () => {
    expect(schema.jobEstado.enumValues).toEqual(
      ['encolado','corriendo','completado','fallido','cancelado']
    );
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/db/schema.test.ts`
Esperado: FALLA con "Cannot find module '@/db/schema'".

- [ ] **Paso 3: Escribir `src/db/schema.ts`**

```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric, pgEnum } from 'drizzle-orm/pg-core';

export const jobEstado = pgEnum('job_estado', ['encolado','corriendo','completado','fallido','cancelado']);
export const linkTipo = pgEnum('link_tipo', ['sitio','instagram','facebook','tiktok','youtube','ventas','otro']);
export const extraccionEstado = pgEnum('extraccion_estado', ['pendiente','ok','fallo','no_aplica']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  giro: text('giro').notNull(),
  producto: text('producto').notNull(),
  ciudad: text('ciudad'),
  ticket: text('ticket'),
  contacto: text('contacto'),
  notas: text('notas'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clientLinks = pgTable('client_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  tipo: linkTipo('tipo').notNull(),
  url: text('url').notNull(),
});

export const clientFiles = pgTable('client_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  nombreOriginal: text('nombre_original').notNull(),
  ruta: text('ruta').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  textoExtraido: text('texto_extraido'),
  estadoExtraccion: extraccionEstado('estado_extraccion').notNull().default('pendiente'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const researchJobs = pgTable('research_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  estado: jobEstado('estado').notNull().default('encolado'),
  etapaActual: text('etapa_actual'),
  etapas: jsonb('etapas').notNull().default({}),
  tokensEntrada: integer('tokens_entrada').notNull().default(0),
  tokensSalida: integer('tokens_salida').notNull().default(0),
  costoUsd: numeric('costo_usd', { precision: 10, scale: 4 }).notNull().default('0'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const researchResults = pgTable('research_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable('share_links', {
  token: text('token').primaryKey(),
  resultId: uuid('result_id').notNull().references(() => researchResults.id, { onDelete: 'cascade' }),
  revocado: boolean('revocado').notNull().default(false),
  visitas: integer('visitas').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Paso 4: Escribir `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Falta DATABASE_URL');

const queryClient = postgres(url, { max: 5 });
export const db = drizzle(queryClient, { schema });
export * from './schema';
```

- [ ] **Paso 5: Escribir `drizzle.config.ts`**

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

- [ ] **Paso 6: Escribir `scripts/migrate.mjs`**

```javascript
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL'); process.exit(1); }

const sql = postgres(url, { max: 1 });
await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
await sql.end();
console.log('Migraciones aplicadas');
```

- [ ] **Paso 7: Generar migraciones y correr el test**

```bash
npx drizzle-kit generate
npx vitest run tests/db/schema.test.ts
```
Esperado: se crea `drizzle/0000_*.sql` y el test pasa.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat(db): esquema de ocho tablas con Drizzle y migraciones"
```

---

## Tarea 3: Autenticación

**Archivos:**
- Crear: `src/lib/auth.ts`, `src/middleware.ts`, `src/pages/login.astro`, `src/pages/api/login.ts`, `src/pages/api/logout.ts`, `scripts/crear-usuario.mjs`
- Test: `tests/lib/auth.test.ts`

**Interfaces:**
- Consume: `db`, `users`, `sessions` de la Tarea 2.
- Produce: `hashPassword(plano: string): Promise<string>`, `verifyPassword(hash: string, plano: string): Promise<boolean>`, `crearSesion(userId: string): Promise<string>`, `validarSesion(token: string): Promise<{userId: string} | null>`, `cerrarSesion(token: string): Promise<void>`. El middleware expone `Astro.locals.userId`.

- [ ] **Paso 1: Escribir el test**

`tests/lib/auth.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generarToken } from '@/lib/auth';

describe('auth', () => {
  it('el hash no es la contraseña en texto plano', async () => {
    const h = await hashPassword('Secreta123!');
    expect(h).not.toBe('Secreta123!');
    expect(h.startsWith('$argon2id$')).toBe(true);
  });

  it('verifica una contraseña correcta', async () => {
    const h = await hashPassword('Secreta123!');
    expect(await verifyPassword(h, 'Secreta123!')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const h = await hashPassword('Secreta123!');
    expect(await verifyPassword(h, 'otra')).toBe(false);
  });

  it('genera tokens únicos y suficientemente largos', () => {
    const a = generarToken(), b = generarToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/auth.test.ts`
Esperado: FALLA con "Cannot find module '@/lib/auth'".

- [ ] **Paso 3: Escribir `src/lib/auth.ts`**

```typescript
import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db, sessions } from '@/db';

const DIAS_SESION = 30;

export async function hashPassword(plano: string): Promise<string> {
  return hash(plano, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashGuardado: string, plano: string): Promise<boolean> {
  try { return await verify(hashGuardado, plano); } catch { return false; }
}

export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function crearSesion(userId: string): Promise<string> {
  const id = generarToken();
  const expiresAt = new Date(Date.now() + DIAS_SESION * 86400_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function validarSesion(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  const [s] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  return { userId: s.userId };
}

export async function cerrarSesion(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function limpiarSesionesVencidas(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/auth.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 5: Escribir `src/middleware.ts`**

```typescript
import { defineMiddleware } from 'astro:middleware';
import { validarSesion } from '@/lib/auth';

const PUBLICAS = [/^\/login$/, /^\/api\/login$/, /^\/p\//];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const ruta = ctx.url.pathname;
  if (PUBLICAS.some((r) => r.test(ruta))) return next();

  const token = ctx.cookies.get('sesion')?.value ?? '';
  const sesion = await validarSesion(token);

  if (!sesion) {
    if (ruta.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return ctx.redirect('/login');
  }

  ctx.locals.userId = sesion.userId;
  return next();
});
```

- [ ] **Paso 6: Declarar el tipo de `locals` en `src/env.d.ts`**

```typescript
declare namespace App {
  interface Locals {
    userId: string;
  }
}
```

- [ ] **Paso 7: Escribir `src/pages/api/login.ts` con bloqueo por intentos**

```typescript
import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';
import { verifyPassword, crearSesion } from '@/lib/auth';

const intentos = new Map<string, { n: number; hasta: number }>();
const MAX = 3, VENTANA = 5 * 60_000, BLOQUEO = 15 * 60_000;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const ahora = Date.now();
  const reg = intentos.get(email);
  if (reg && reg.hasta > ahora) {
    return new Response('Demasiados intentos. Espera 15 minutos.', { status: 429 });
  }

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = u ? await verifyPassword(u.passwordHash, password) : false;

  if (!ok) {
    const n = (reg && reg.hasta > ahora - VENTANA ? reg.n : 0) + 1;
    intentos.set(email, { n, hasta: n >= MAX ? ahora + BLOQUEO : ahora + VENTANA });
    return new Response('Credenciales incorrectas', { status: 401 });
  }

  intentos.delete(email);
  const token = await crearSesion(u!.id);
  cookies.set('sesion', token, {
    httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax',
    path: '/', maxAge: 30 * 86400,
  });
  return redirect('/');
};
```

- [ ] **Paso 8: Escribir `src/pages/api/logout.ts`**

```typescript
import type { APIRoute } from 'astro';
import { cerrarSesion } from '@/lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get('sesion')?.value;
  if (token) await cerrarSesion(token);
  cookies.delete('sesion', { path: '/' });
  return redirect('/login');
};
```

- [ ] **Paso 9: Escribir `scripts/crear-usuario.mjs`**

```javascript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hash } from '@node-rs/argon2';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/crear-usuario.mjs correo@dominio.com contraseña');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });
const h = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
await sql`INSERT INTO users (email, password_hash) VALUES (${email.toLowerCase()}, ${h})
          ON CONFLICT (email) DO UPDATE SET password_hash = ${h}`;
await sql.end();
console.log('Usuario listo:', email);
```

- [ ] **Paso 10: Escribir `src/pages/login.astro`**

Página con formulario que hace POST a `/api/login`, con campos `email` y `password`, y muestra el mensaje de error si la URL trae `?error=1`. Usa la identidad visual de Wozial: fondo `#08080b`, tipografía Poppins, acento `#d4688a`.

- [ ] **Paso 11: Commit**

```bash
git add -A
git commit -m "feat(auth): sesiones con Argon2id, middleware y bloqueo por intentos"
```

---

## Tarea 4: CRUD de clientes

**Archivos:**
- Crear: `src/pages/index.astro`, `src/pages/clientes/nuevo.astro`, `src/pages/clientes/[id].astro`, `src/pages/api/clientes/index.ts`, `src/pages/api/clientes/[id].ts`
- Crear: `src/lib/clientes.ts`
- Test: `tests/lib/clientes.test.ts`

**Interfaces:**
- Consume: `db`, `clients` de la Tarea 2.
- Produce: `validarCliente(datos: unknown): {ok: true, datos: ClienteInput} | {ok: false, errores: string[]}`, y el tipo `ClienteInput = {nombre: string, giro: string, producto: string, ciudad?: string, ticket?: string, contacto?: string, notas?: string}`.

- [ ] **Paso 1: Escribir el test**

`tests/lib/clientes.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validarCliente } from '@/lib/clientes';

describe('validarCliente', () => {
  it('acepta los tres campos obligatorios', () => {
    const r = validarCliente({ nombre: 'Ana Villa', giro: 'Cosmetología', producto: 'Diplomado' });
    expect(r.ok).toBe(true);
  });

  it('rechaza si falta el giro', () => {
    const r = validarCliente({ nombre: 'Ana Villa', producto: 'Diplomado' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(' ')).toContain('giro');
  });

  it('recorta espacios de los campos de texto', () => {
    const r = validarCliente({ nombre: '  Ana  ', giro: 'X', producto: 'Y' });
    if (r.ok) expect(r.datos.nombre).toBe('Ana');
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/clientes.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/lib/clientes.ts`**

```typescript
import { z } from 'zod';

export const clienteSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  giro: z.string().trim().min(1, 'El giro es obligatorio'),
  producto: z.string().trim().min(1, 'El producto es obligatorio'),
  ciudad: z.string().trim().optional(),
  ticket: z.string().trim().optional(),
  contacto: z.string().trim().optional(),
  notas: z.string().trim().optional(),
});

export type ClienteInput = z.infer<typeof clienteSchema>;

export function validarCliente(datos: unknown):
  | { ok: true; datos: ClienteInput }
  | { ok: false; errores: string[] } {
  const r = clienteSchema.safeParse(datos);
  if (r.success) return { ok: true, datos: r.data };
  return { ok: false, errores: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/clientes.test.ts`
Esperado: los 3 tests pasan.

- [ ] **Paso 5: Escribir los endpoints de API**

`src/pages/api/clientes/index.ts` con POST que valida y crea.
`src/pages/api/clientes/[id].ts` con PATCH que valida y actualiza, y DELETE que borra.
Ambos devuelven JSON con `{ok: true, id}` o `{ok: false, errores}` y código 400 en error de validación.

- [ ] **Paso 6: Escribir las páginas**

`src/pages/index.astro`: consulta clientes con su último job y costo acumulado, los lista en tabla.
`src/pages/clientes/nuevo.astro`: formulario con los siete campos.
`src/pages/clientes/[id].astro`: ficha con los cuatro bloques del spec.

Todas con la identidad visual de Wozial.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(clientes): alta, edición, listado y borrado"
```

---

## Tarea 5: Enlaces del cliente

**Archivos:**
- Crear: `src/pages/api/clientes/[id]/links.ts`, `src/components/LinksEditor.tsx`
- Modificar: `src/pages/clientes/[id].astro` (montar la isla)
- Test: `tests/lib/links.test.ts`
- Crear: `src/lib/links.ts`

**Interfaces:**
- Consume: `db`, `clientLinks`, `linkTipo` de la Tarea 2.
- Produce: `validarUrl(url: string): boolean`, `normalizarUrl(url: string): string`.

- [ ] **Paso 1: Escribir el test**

`tests/lib/links.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validarUrl, normalizarUrl } from '@/lib/links';

describe('links', () => {
  it('acepta una URL con protocolo', () => {
    expect(validarUrl('https://ejemplo.com')).toBe(true);
  });

  it('rechaza texto que no es URL', () => {
    expect(validarUrl('no soy una url')).toBe(false);
  });

  it('rechaza protocolos que no son http o https', () => {
    expect(validarUrl('javascript:alert(1)')).toBe(false);
  });

  it('agrega https a una URL sin protocolo', () => {
    expect(normalizarUrl('ejemplo.com')).toBe('https://ejemplo.com');
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/links.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/lib/links.ts`**

```typescript
export function normalizarUrl(entrada: string): string {
  const t = entrada.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function validarUrl(entrada: string): boolean {
  try {
    const u = new URL(normalizarUrl(entrada));
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/links.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 5: Escribir el endpoint y la isla de React**

`src/pages/api/clientes/[id]/links.ts`: POST agrega un enlace validando tipo y URL; DELETE con `?linkId=` lo quita.
`src/components/LinksEditor.tsx`: lista los enlaces, selector de tipo, campo de URL, botón agregar y botón quitar por fila.

- [ ] **Paso 6: Commit**

```bash
git add -A
git commit -m "feat(clientes): enlaces con validación de URL"
```

---

## Tarea 6: Carga de archivos y extracción de texto

**Archivos:**
- Crear: `src/lib/files.ts`, `src/lib/extract.ts`, `src/pages/api/clientes/[id]/files.ts`, `src/components/FilesUploader.tsx`
- Test: `tests/lib/files.test.ts`, `tests/lib/extract.test.ts`
- Crear: `tests/fixtures/ejemplo.txt`

**Interfaces:**
- Consume: `db`, `clientFiles` de la Tarea 2.
- Produce: `mimePermitido(mime: string): boolean`, `rutaSegura(dataDir: string, relativa: string): string`, `guardarArchivo(clientId: string, nombre: string, buf: Buffer, mime: string): Promise<{ruta: string}>`, `extraerTexto(buf: Buffer, mime: string): Promise<{texto: string | null, estado: 'ok'|'fallo'|'no_aplica'}>`, `recortarTexto(texto: string, limite?: number): string`.

- [ ] **Paso 1: Escribir el test de archivos**

`tests/lib/files.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { mimePermitido, rutaSegura } from '@/lib/files';

describe('files', () => {
  it('permite PDF, DOCX, TXT, PNG y JPEG', () => {
    for (const m of ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','image/png','image/jpeg']) {
      expect(mimePermitido(m)).toBe(true);
    }
  });

  it('rechaza ejecutables y HTML', () => {
    expect(mimePermitido('application/x-msdownload')).toBe(false);
    expect(mimePermitido('text/html')).toBe(false);
  });

  it('bloquea escape de directorio', () => {
    expect(() => rutaSegura('/data', '../../etc/passwd')).toThrow();
  });

  it('resuelve una ruta legítima dentro del directorio', () => {
    expect(rutaSegura('/data', 'abc/archivo.pdf')).toBe('/data/abc/archivo.pdf');
  });
});
```

- [ ] **Paso 2: Escribir el test de extracción**

`tests/lib/extract.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { extraerTexto, recortarTexto } from '@/lib/extract';

describe('extract', () => {
  it('lee texto plano', async () => {
    const r = await extraerTexto(Buffer.from('Hola mundo'), 'text/plain');
    expect(r.estado).toBe('ok');
    expect(r.texto).toBe('Hola mundo');
  });

  it('marca las imágenes como no aplica', async () => {
    const r = await extraerTexto(Buffer.from([0x89, 0x50]), 'image/png');
    expect(r.estado).toBe('no_aplica');
    expect(r.texto).toBeNull();
  });

  it('conserva inicio y final al recortar', () => {
    const largo = 'A'.repeat(50_000) + 'FINAL';
    const r = recortarTexto(largo, 40_000);
    expect(r.length).toBeLessThanOrEqual(40_100);
    expect(r).toContain('FINAL');
    expect(r).toContain('[recorte]');
  });

  it('no toca un texto corto', () => {
    expect(recortarTexto('corto', 40_000)).toBe('corto');
  });
});
```

- [ ] **Paso 3: Correr ambos tests para verificar que fallan**

Ejecuta: `npx vitest run tests/lib/files.test.ts tests/lib/extract.test.ts`
Esperado: FALLAN con módulos no encontrados.

- [ ] **Paso 4: Instalar dependencias de extracción**

```bash
npm i unpdf mammoth
```

- [ ] **Paso 5: Escribir `src/lib/files.ts`**

```typescript
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const PERMITIDOS = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
]);

export const MAX_BYTES = 25 * 1024 * 1024;

export function mimePermitido(mime: string): boolean {
  return PERMITIDOS.has(mime);
}

export function rutaSegura(dataDir: string, relativa: string): string {
  const base = resolve(dataDir);
  const destino = resolve(base, relativa);
  if (destino !== base && !destino.startsWith(base + '/')) {
    throw new Error('Ruta fuera del directorio permitido');
  }
  return destino;
}

export async function guardarArchivo(
  clientId: string, nombreOriginal: string, buf: Buffer, mime: string
): Promise<{ ruta: string }> {
  if (!mimePermitido(mime)) throw new Error(`Tipo no permitido: ${mime}`);
  if (buf.byteLength > MAX_BYTES) throw new Error('El archivo supera 25 MB');

  const ext = nombreOriginal.includes('.') ? nombreOriginal.split('.').pop()! : 'bin';
  const relativa = join(clientId, `${randomUUID()}.${ext}`);
  const dataDir = process.env.DATA_DIR || './data';
  const absoluta = rutaSegura(dataDir, relativa);

  await mkdir(dirname(absoluta), { recursive: true });
  await writeFile(absoluta, buf);
  return { ruta: relativa };
}
```

- [ ] **Paso 6: Escribir `src/lib/extract.ts`**

```typescript
export const LIMITE_TEXTO = 40_000;

export function recortarTexto(texto: string, limite = LIMITE_TEXTO): string {
  if (texto.length <= limite) return texto;
  const inicio = texto.slice(0, 30_000);
  const final = texto.slice(-10_000);
  return `${inicio}\n\n[recorte: se omitieron ${texto.length - 40_000} caracteres del centro]\n\n${final}`;
}

export async function extraerTexto(
  buf: Buffer, mime: string
): Promise<{ texto: string | null; estado: 'ok' | 'fallo' | 'no_aplica' }> {
  try {
    if (mime === 'text/plain') {
      return { texto: buf.toString('utf8'), estado: 'ok' };
    }
    if (mime === 'application/pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const doc = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(doc, { mergePages: true });
      return { texto: text, estado: 'ok' };
    }
    if (mime.includes('wordprocessingml')) {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { texto: value, estado: 'ok' };
    }
    if (mime.startsWith('image/')) {
      return { texto: null, estado: 'no_aplica' };
    }
    return { texto: null, estado: 'fallo' };
  } catch {
    return { texto: null, estado: 'fallo' };
  }
}
```

- [ ] **Paso 7: Correr los tests para verificar que pasan**

Ejecuta: `npx vitest run tests/lib/files.test.ts tests/lib/extract.test.ts`
Esperado: los 8 tests pasan.

- [ ] **Paso 8: Escribir el endpoint y la isla**

`src/pages/api/clientes/[id]/files.ts`: POST recibe `multipart/form-data`, valida MIME y tamaño, guarda, extrae texto y registra en la base. DELETE con `?fileId=` borra registro y archivo.
`src/components/FilesUploader.tsx`: zona de arrastre, lista de archivos con su estado de extracción, botón de eliminar.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "feat(archivos): carga con validación y extracción de texto de PDF y DOCX"
```

---

## Tarea 7: Esquemas de los 17 paneles

**Archivos:**
- Crear: `src/research/schemas.ts`
- Test: `tests/research/schemas.test.ts`

**Interfaces:**
- Produce: `competenciaSchema`, `audienciaSchema`, `canalesSchema`, `mercadoSchema`, `sintesisSchema`, `investigacionSchema`, y los tipos inferidos. La Tarea 9 los usa como contrato de salida de cada agente; la Tarea 12 los consume para renderizar.

- [ ] **Paso 1: Escribir el test**

`tests/research/schemas.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { competenciaSchema, fuenteSchema, investigacionSchema } from '@/research/schemas';

describe('esquemas', () => {
  it('exige fuente en cada competidor', () => {
    const r = competenciaSchema.safeParse({
      directos: [{ nombre: 'X', producto: 'Y', precio: '100', duracion: '', modalidad: '', aval: '' }],
      indirectos: [], referentes: [], hallazgos: [],
    });
    expect(r.success).toBe(false);
  });

  it('acepta un competidor con fuente', () => {
    const r = competenciaSchema.safeParse({
      directos: [{ nombre: 'X', producto: 'Y', precio: '100', duracion: '6 meses',
        modalidad: 'online', aval: 'SEP', fuente: { url: 'https://x.com', consultado: '2026-08-12' } }],
      indirectos: [], referentes: [], hallazgos: ['algo'],
    });
    expect(r.success).toBe(true);
  });

  it('una fuente exige URL válida', () => {
    expect(fuenteSchema.safeParse({ url: 'no-url', consultado: '2026-08-12' }).success).toBe(false);
  });

  it('la investigación completa admite etapas vacías con razón', () => {
    const r = investigacionSchema.safeParse({
      competencia: { estado: 'vacio', razon: 'No se encontraron datos públicos' },
      audiencia: { estado: 'vacio', razon: 'x' },
      canales: { estado: 'vacio', razon: 'x' },
      mercado: { estado: 'vacio', razon: 'x' },
      sintesis: { estado: 'vacio', razon: 'x' },
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/research/schemas.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/research/schemas.ts`**

```typescript
import { z } from 'zod';

export const fuenteSchema = z.object({
  url: z.string().url(),
  consultado: z.string(),
  nota: z.string().optional(),
});

const conFuente = <T extends z.ZodRawShape>(shape: T) =>
  z.object({ ...shape, fuente: fuenteSchema });

export const competidorSchema = conFuente({
  nombre: z.string(),
  producto: z.string(),
  precio: z.string(),
  duracion: z.string(),
  modalidad: z.string(),
  aval: z.string(),
});

export const referenteSchema = conFuente({
  cuenta: z.string(),
  seguidores: z.number().int().nonnegative(),
  pais: z.string(),
});

export const citaSchema = conFuente({
  texto: z.string(),
  contexto: z.string(),
  anonimizada: z.boolean(),
});

export const personaSchema = z.object({
  nombre: z.string(),
  edad: z.string(),
  ciudad: z.string(),
  situacion: z.string(),
  demografia: z.array(z.string()),
  comportamiento: z.array(z.string()),
  dolor: z.array(z.string()),
  objeciones: z.array(z.string()),
  comoSeGana: z.string(),
  riesgo: z.string(),
});

export const competenciaSchema = z.object({
  directos: z.array(competidorSchema),
  indirectos: z.array(competidorSchema),
  referentes: z.array(referenteSchema),
  hallazgos: z.array(z.string()),
});

export const audienciaSchema = z.object({
  escalera: z.array(z.object({ termino: z.string(), connotacion: z.string() })),
  jerga: z.array(z.string()),
  jergaNegocio: z.array(z.string()),
  tono: z.array(z.string()),
  dolores: z.array(citaSchema),
  aspiraciones: z.array(citaSchema),
  miedoPrincipal: z.object({ nombre: z.string(), evidencia: z.string(), fuente: fuenteSchema }),
  unidadDeCompra: z.string(),
  personas: z.array(personaSchema).length(2),
});

export const canalesSchema = z.object({
  plataformas: z.array(conFuente({ nombre: z.string(), alcance: z.string(), notas: z.string() })),
  formatos: z.array(z.string()),
  horarios: z.string(),
  tendencias: z.array(z.string()),
  advertenciaRegulatoria: z.string().nullable(),
});

export const mercadoSchema = z.object({
  datos: z.array(conFuente({ etiqueta: z.string(), valor: z.string() })),
  salarios: z.array(conFuente({ puesto: z.string(), rango: z.string() })),
  regulacion: z.array(conFuente({ norma: z.string(), implicacion: z.string() })),
  crecimiento: z.string().nullable(),
});

export const sintesisSchema = z.object({
  hallazgos: z.array(z.object({
    tipo: z.enum(['problema','salida','bloqueante','oportunidad']),
    titulo: z.string(),
    texto: z.string(),
  })).length(4),
  posicionamiento: z.object({ frase: z.string(), sustento: z.string() }),
  focos: z.array(z.object({ nombre: z.string(), tipo: z.enum(['prioritario','expansion','descartado']), razon: z.string() })).length(3),
  oferta: z.object({
    problemaReal: z.string(),
    activosSinExplotar: z.array(z.string()),
    faltaConstruir: z.array(z.string()),
    traduccion: z.array(z.object({ antes: z.string(), despues: z.string(), porQue: z.string() })),
    titularFinal: z.string(),
  }),
  precios: z.object({
    diagnostico: z.string(),
    riesgos: z.array(z.string()),
    propuesta: z.array(z.object({ plan: z.string(), monto: z.string(), total: z.string() })),
  }).nullable(),
  ciclo: z.object({
    tipo: z.string(),
    etapas: z.array(z.object({ nombre: z.string(), quePiensa: z.string(), fraseTipo: z.string() })).length(4),
    fricciones: z.array(z.string()),
    aceleradores: z.array(z.string()),
  }),
  pendientes: z.array(z.string()),
});

const etapa = <T extends z.ZodTypeAny>(datos: T) =>
  z.discriminatedUnion('estado', [
    z.object({ estado: z.literal('ok'), datos }),
    z.object({ estado: z.literal('vacio'), razon: z.string() }),
  ]);

export const investigacionSchema = z.object({
  competencia: etapa(competenciaSchema),
  audiencia: etapa(audienciaSchema),
  canales: etapa(canalesSchema),
  mercado: etapa(mercadoSchema),
  sintesis: etapa(sintesisSchema),
});

export type Investigacion = z.infer<typeof investigacionSchema>;
export type Competencia = z.infer<typeof competenciaSchema>;
export type Audiencia = z.infer<typeof audienciaSchema>;
export type Canales = z.infer<typeof canalesSchema>;
export type Mercado = z.infer<typeof mercadoSchema>;
export type Sintesis = z.infer<typeof sintesisSchema>;
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/research/schemas.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 5: Commit**

```bash
git add -A
git commit -m "feat(research): esquemas Zod con fuente obligatoria y etapas vacías declarables"
```

---

## Tarea 8: Cliente de la API de Claude

**Archivos:**
- Crear: `src/research/claude.ts`, `src/lib/cost.ts`
- Test: `tests/lib/cost.test.ts`, `tests/research/claude.test.ts`

**Interfaces:**
- Produce: `calcularCosto(modelo: string, entrada: number, salida: number): number`, y `pedirJson<T>(opts: {modelo: string, sistema: string, usuario: string, schema: ZodType<T>, buscarWeb?: boolean, maxReintentos?: number}): Promise<{datos: T, tokensEntrada: number, tokensSalida: number}>`. La Tarea 9 la usa para cada agente.

- [ ] **Paso 1: Escribir el test de costo**

`tests/lib/cost.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calcularCosto } from '@/lib/cost';

describe('calcularCosto', () => {
  it('cobra más por los tokens de salida que de entrada', () => {
    const entrada = calcularCosto('claude-sonnet-5', 1_000_000, 0);
    const salida = calcularCosto('claude-sonnet-5', 0, 1_000_000);
    expect(salida).toBeGreaterThan(entrada);
  });

  it('Opus cuesta más que Sonnet con el mismo consumo', () => {
    expect(calcularCosto('claude-opus-5', 100_000, 10_000))
      .toBeGreaterThan(calcularCosto('claude-sonnet-5', 100_000, 10_000));
  });

  it('devuelve cero sin consumo', () => {
    expect(calcularCosto('claude-sonnet-5', 0, 0)).toBe(0);
  });

  it('usa la tarifa por defecto ante un modelo desconocido', () => {
    expect(calcularCosto('modelo-inexistente', 1_000_000, 0)).toBeGreaterThan(0);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/cost.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/lib/cost.ts`**

```typescript
type Tarifa = { entrada: number; salida: number };

const TARIFAS: Record<string, Tarifa> = {
  'claude-opus-5':   { entrada: 15, salida: 75 },
  'claude-sonnet-5': { entrada: 3,  salida: 15 },
  'claude-haiku-4-5-20251001': { entrada: 1, salida: 5 },
};

const POR_DEFECTO: Tarifa = { entrada: 3, salida: 15 };

export function calcularCosto(modelo: string, entrada: number, salida: number): number {
  const t = TARIFAS[modelo] ?? POR_DEFECTO;
  const usd = (entrada / 1_000_000) * t.entrada + (salida / 1_000_000) * t.salida;
  return Math.round(usd * 10_000) / 10_000;
}
```

Las tarifas están en dólares por millón de tokens y deben revisarse contra la lista de precios vigente antes de desplegar.

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/cost.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 5: Escribir el test del cliente con API simulada**

`tests/research/claude.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const crear = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: crear }; },
}));

const esquema = z.object({ valor: z.string() });

function respuesta(texto: string, entrada = 100, salida = 50) {
  return { content: [{ type: 'text', text: texto }], usage: { input_tokens: entrada, output_tokens: salida } };
}

beforeEach(() => { crear.mockReset(); process.env.ANTHROPIC_API_KEY = 'test'; });

describe('pedirJson', () => {
  it('devuelve datos validados y el consumo', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"valor":"hola"}'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('hola');
    expect(r.tokensEntrada).toBe(100);
  });

  it('reintenta una vez si el JSON no valida', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('{"otra":"cosa"}'))
         .mockResolvedValueOnce(respuesta('{"valor":"ok"}'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('ok');
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('lanza error si falla dos veces', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('{"malo":true}'));
    await expect(pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema }))
      .rejects.toThrow();
  });

  it('extrae JSON aunque venga envuelto en texto', async () => {
    const { pedirJson } = await import('@/research/claude');
    crear.mockResolvedValueOnce(respuesta('Claro:\n```json\n{"valor":"x"}\n```\nListo.'));
    const r = await pedirJson({ modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema });
    expect(r.datos.valor).toBe('x');
  });
});
```

- [ ] **Paso 6: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/research/claude.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 7: Escribir `src/research/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';

let cliente: Anthropic | null = null;
function obtenerCliente(): Anthropic {
  if (!cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Falta ANTHROPIC_API_KEY');
    cliente = new Anthropic({ apiKey });
  }
  return cliente;
}

export function extraerJson(texto: string): unknown {
  const enBloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidato = enBloque ? enBloque[1] : texto;
  const inicio = candidato.indexOf('{');
  const fin = candidato.lastIndexOf('}');
  if (inicio === -1 || fin === -1) throw new Error('La respuesta no contiene JSON');
  return JSON.parse(candidato.slice(inicio, fin + 1));
}

export async function pedirJson<T>(opts: {
  modelo: string;
  sistema: string;
  usuario: string;
  schema: ZodType<T>;
  buscarWeb?: boolean;
  maxTokens?: number;
}): Promise<{ datos: T; tokensEntrada: number; tokensSalida: number }> {
  const { modelo, sistema, usuario, schema, buscarWeb = false, maxTokens = 16_000 } = opts;
  const api = obtenerCliente();

  let entrada = 0, salida = 0, ultimoError = '';

  for (let intento = 0; intento < 2; intento++) {
    const mensaje = intento === 0
      ? usuario
      : `${usuario}\n\nTu respuesta anterior no cumplió el esquema. Error: ${ultimoError}\nDevuelve únicamente JSON válido.`;

    const res: any = await api.messages.create({
      model: modelo,
      max_tokens: maxTokens,
      system: sistema,
      messages: [{ role: 'user', content: mensaje }],
      ...(buscarWeb ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }] } : {}),
    });

    entrada += res.usage?.input_tokens ?? 0;
    salida += res.usage?.output_tokens ?? 0;

    const texto = (res.content ?? [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');

    try {
      const crudo = extraerJson(texto);
      const parsed = schema.safeParse(crudo);
      if (parsed.success) {
        return { datos: parsed.data, tokensEntrada: entrada, tokensSalida: salida };
      }
      ultimoError = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    } catch (e) {
      ultimoError = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(`El modelo no devolvió JSON válido tras dos intentos. Último error: ${ultimoError}`);
}
```

- [ ] **Paso 8: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/research/claude.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "feat(research): cliente de Claude con validación, reintento y conteo de costo"
```

---

## Tarea 9: Los cinco agentes

**Archivos:**
- Crear: `src/research/agents/competencia.ts`, `audiencia.ts`, `canales.ts`, `mercado.ts`, `sintesis.ts`, `src/research/contexto.ts`
- Test: `tests/research/agents.test.ts`

**Interfaces:**
- Consume: `pedirJson` de la Tarea 8, esquemas de la Tarea 7.
- Produce: `armarContexto(cliente, links, archivos): string`, y cinco funciones con firma `(ctx: string) => Promise<{datos: X, tokensEntrada: number, tokensSalida: number}>`. Para síntesis: `correrSintesis(ctx: string, previos: {competencia, audiencia, canales, mercado})`.

- [ ] **Paso 1: Escribir el test**

`tests/research/agents.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { armarContexto } from '@/research/contexto';
import { SISTEMA_COMUN } from '@/research/agents/competencia';

describe('contexto', () => {
  it('incluye los datos del cliente y sus enlaces', () => {
    const ctx = armarContexto(
      { nombre: 'Ana', giro: 'Cosmetología', producto: 'Diplomado', ciudad: 'Guadalajara', ticket: '$36,792', notas: null, contacto: null },
      [{ tipo: 'sitio', url: 'https://x.com' }],
      [{ nombreOriginal: 'temario.pdf', textoExtraido: 'Contenido del temario' }]
    );
    expect(ctx).toContain('Ana');
    expect(ctx).toContain('https://x.com');
    expect(ctx).toContain('Contenido del temario');
  });

  it('avisa cuando no hay archivos ni enlaces', () => {
    const ctx = armarContexto(
      { nombre: 'X', giro: 'Y', producto: 'Z', ciudad: null, ticket: null, notas: null, contacto: null }, [], []
    );
    expect(ctx).toContain('Sin enlaces');
    expect(ctx).toContain('Sin archivos');
  });
});

describe('reglas del sistema', () => {
  it('prohíbe inventar datos y exige fuente', () => {
    expect(SISTEMA_COMUN).toContain('fuente');
    expect(SISTEMA_COMUN.toLowerCase()).toContain('no inventes');
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/research/agents.test.ts`
Esperado: FALLA con módulos no encontrados.

- [ ] **Paso 3: Escribir `src/research/contexto.ts`**

```typescript
import { recortarTexto } from '@/lib/extract';

type ClienteCtx = {
  nombre: string; giro: string; producto: string;
  ciudad: string | null; ticket: string | null;
  contacto: string | null; notas: string | null;
};

export function armarContexto(
  c: ClienteCtx,
  links: { tipo: string; url: string }[],
  archivos: { nombreOriginal: string; textoExtraido: string | null }[]
): string {
  const enlaces = links.length
    ? links.map((l) => `- ${l.tipo}: ${l.url}`).join('\n')
    : 'Sin enlaces registrados.';

  const conTexto = archivos.filter((a) => a.textoExtraido);
  const docs = conTexto.length
    ? conTexto.map((a) => `### ${a.nombreOriginal}\n${recortarTexto(a.textoExtraido!)}`).join('\n\n')
    : 'Sin archivos con texto extraído.';

  return `## Cliente
Nombre: ${c.nombre}
Giro: ${c.giro}
Producto o servicio: ${c.producto}
Ciudad: ${c.ciudad ?? 'no especificada'}
Ticket: ${c.ticket ?? 'no especificado'}
Notas del operador: ${c.notas ?? 'ninguna'}

## Enlaces
${enlaces}

## Documentos del cliente
${docs}`;
}
```

- [ ] **Paso 4: Escribir `src/research/agents/competencia.ts`**

```typescript
import { competenciaSchema, type Competencia } from '@/research/schemas';
import { pedirJson } from '@/research/claude';

export const SISTEMA_COMUN = `Eres analista de mercado para una agencia mexicana. Investigas con búsqueda web y devuelves JSON.

Reglas que no se rompen:
- Toda cifra lleva fuente con URL y fecha de consulta. Sin fuente verificable, se omite el dato.
- No inventes precios, cifras, citas ni testimonios. Si no lo encuentras, deja el arreglo vacío.
- Las citas textuales de personas privadas van anonimizadas: describe quién es, nunca su nombre de usuario.
- Prioriza fuentes primarias: sitios oficiales, institutos de estadística, registros públicos.
- Marca claramente lo que es estimación tuya frente a lo verificado.
- Responde solo con JSON válido, sin texto antes ni después.`;

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: mapear la competencia del cliente.
- Directos: mismo producto y mismo mercado. Busca precios reales en sus sitios.
- Indirectos: alternativas más baratas o fraccionadas que compiten por el mismo presupuesto.
- Referentes: las cuentas más grandes del nicho, con su número de seguidores y país.
- Hallazgos: qué revela el mapa de precios. Si hay una franja desatendida, dilo.`;

export async function correrCompetencia(ctx: string) {
  return pedirJson<Competencia>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\nInvestiga la competencia y devuelve el JSON del esquema.`,
    schema: competenciaSchema,
    buscarWeb: true,
  });
}
```

- [ ] **Paso 5: Escribir los otros tres agentes de investigación**

`audiencia.ts`, `canales.ts` y `mercado.ts` con la misma forma: importan `SISTEMA_COMUN`, definen su instrucción específica y llaman a `pedirJson` con su esquema y `buscarWeb: true`.

- Audiencia: escalera de términos, jerga, dolores con citas anonimizadas, aspiraciones, miedo principal, unidad mental de compra, dos personas contrastantes.
- Canales: plataformas con alcance, formatos que rinden, horarios, tendencias, y advertencia regulatoria si el giro la tiene.
- Mercado: datos oficiales del sector, salarios, regulación aplicable, crecimiento.

- [ ] **Paso 6: Escribir `src/research/agents/sintesis.ts`**

```typescript
import { sintesisSchema, type Sintesis, type Competencia, type Audiencia, type Canales, type Mercado } from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { SISTEMA_COMUN } from './competencia';

const SISTEMA = `${SISTEMA_COMUN}

Tu tarea: sintetizar cuatro investigaciones en decisiones estratégicas.

Criterios:
- De los cuatro hallazgos, al menos uno debe ser incómodo para el cliente. Si todos son buenas noticias, la investigación fue superficial.
- Si el diferenciador que el cliente declara lo tiene también un competidor más barato, dilo con la comparación de precios.
- El posicionamiento debe conectar el diferenciador real con el hueco del mercado.
- Descarta un foco explícitamente y explica por qué.
- En pendientes, declara lo que la investigación no pudo responder. No lo dejes vacío por quedar bien.`;

export async function correrSintesis(
  ctx: string,
  previos: { competencia?: Competencia; audiencia?: Audiencia; canales?: Canales; mercado?: Mercado }
) {
  const bloques = Object.entries(previos)
    .filter(([, v]) => v)
    .map(([k, v]) => `### ${k}\n${JSON.stringify(v, null, 2)}`)
    .join('\n\n');

  const faltantes = ['competencia','audiencia','canales','mercado']
    .filter((k) => !(previos as any)[k]);

  const aviso = faltantes.length
    ? `\n\nEstas etapas no produjeron datos: ${faltantes.join(', ')}. No inventes su contenido; ajusta tus conclusiones a lo que sí tienes y menciónalo en pendientes.`
    : '';

  return pedirJson<Sintesis>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA,
    usuario: `${ctx}\n\n## Investigaciones previas\n${bloques}${aviso}\n\nDevuelve el JSON del esquema de síntesis.`,
    schema: sintesisSchema,
    buscarWeb: false,
    maxTokens: 20_000,
  });
}
```

- [ ] **Paso 7: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/research/agents.test.ts`
Esperado: los 3 tests pasan.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat(research): cinco agentes con reglas editoriales en el prompt de sistema"
```

---

## Tarea 10: Pipeline y worker

**Archivos:**
- Crear: `src/research/pipeline.ts`, `src/research/worker.ts`
- Modificar: `src/middleware.ts` (arrancar el worker una sola vez)
- Test: `tests/research/pipeline.test.ts`

**Interfaces:**
- Consume: los cinco agentes de la Tarea 9, `calcularCosto` de la Tarea 8, tablas de la Tarea 2.
- Produce: `ejecutarJob(jobId: string): Promise<void>`, `arrancarWorker(): void`.

- [ ] **Paso 1: Escribir el test**

`tests/research/pipeline.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { decidirEtapasPendientes, superaTope } from '@/research/pipeline';

describe('reanudación', () => {
  it('omite las etapas ya completadas', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'ok' });
    expect(p).toEqual(['canales','mercado','sintesis']);
  });

  it('reintenta las etapas que fallaron', () => {
    const p = decidirEtapasPendientes({ competencia: 'ok', audiencia: 'fallo' });
    expect(p).toContain('audiencia');
  });

  it('con estado vacío corre las cinco', () => {
    expect(decidirEtapasPendientes({})).toHaveLength(5);
  });
});

describe('tope de costo', () => {
  it('detiene al superar el límite', () => {
    expect(superaTope(16, 15)).toBe(true);
  });

  it('permite continuar por debajo', () => {
    expect(superaTope(9.5, 15)).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/research/pipeline.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/research/pipeline.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { db, researchJobs, researchResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from './contexto';
import { correrCompetencia } from './agents/competencia';
import { correrAudiencia } from './agents/audiencia';
import { correrCanales } from './agents/canales';
import { correrMercado } from './agents/mercado';
import { correrSintesis } from './agents/sintesis';
import { calcularCosto } from '@/lib/cost';

export const ETAPAS = ['competencia','audiencia','canales','mercado','sintesis'] as const;
export type Etapa = typeof ETAPAS[number];

export function decidirEtapasPendientes(estado: Record<string, string>): Etapa[] {
  return ETAPAS.filter((e) => estado[e] !== 'ok');
}

export function superaTope(costoAcumulado: number, tope: number): boolean {
  return costoAcumulado >= tope;
}

export async function ejecutarJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;

  const tope = Number(process.env.COST_LIMIT_USD || 15);
  const modeloInv = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const modeloSin = process.env.MODEL_SYNTHESIS || 'claude-opus-5';

  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, job.clientId));
  const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, job.clientId));
  const ctx = armarContexto(cliente, links, archivos);

  const estado = { ...(job.etapas as Record<string, string>) };
  const resultados: Record<string, any> = {};
  let costo = Number(job.costoUsd), tIn = job.tokensEntrada, tOut = job.tokensSalida;

  await db.update(researchJobs)
    .set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() })
    .where(eq(researchJobs.id, jobId));

  const corredores: Record<Etapa, () => Promise<any>> = {
    competencia: () => correrCompetencia(ctx),
    audiencia:   () => correrAudiencia(ctx),
    canales:     () => correrCanales(ctx),
    mercado:     () => correrMercado(ctx),
    sintesis:    () => correrSintesis(ctx, resultados as any),
  };

  const pendientes = decidirEtapasPendientes(estado);
  const paralelas = pendientes.filter((e) => e !== 'sintesis');

  const guardarProgreso = async () => {
    await db.update(researchJobs).set({
      etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(costo),
    }).where(eq(researchJobs.id, jobId));
  };

  // Las cuatro de investigación corren en paralelo
  await Promise.all(paralelas.map(async (etapa) => {
    if (superaTope(costo, tope)) { estado[etapa] = 'omitido_por_costo'; return; }
    estado[etapa] = 'corriendo';
    try {
      const r = await corredores[etapa]();
      resultados[etapa] = r.datos;
      tIn += r.tokensEntrada; tOut += r.tokensSalida;
      costo += calcularCosto(modeloInv, r.tokensEntrada, r.tokensSalida);
      estado[etapa] = 'ok';
    } catch (e) {
      estado[etapa] = 'fallo';
      console.error(`[${jobId}] etapa ${etapa}:`, e);
    }
  }));
  await guardarProgreso();

  // La síntesis espera a las demás
  if (pendientes.includes('sintesis')) {
    if (superaTope(costo, tope)) {
      estado.sintesis = 'omitido_por_costo';
    } else {
      estado.sintesis = 'corriendo';
      await db.update(researchJobs).set({ etapaActual: 'sintesis', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.sintesis();
        resultados.sintesis = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        costo += calcularCosto(modeloSin, r.tokensEntrada, r.tokensSalida);
        estado.sintesis = 'ok';
      } catch (e) {
        estado.sintesis = 'fallo';
        console.error(`[${jobId}] síntesis:`, e);
      }
    }
  }

  // Se arma el resultado marcando como vacías las etapas sin datos
  const datos = Object.fromEntries(ETAPAS.map((e) => [
    e,
    resultados[e]
      ? { estado: 'ok', datos: resultados[e] }
      : { estado: 'vacio', razon: razonDeVacio(estado[e]) },
  ]));

  const previas = await db.select().from(researchResults).where(eq(researchResults.clientId, job.clientId));
  await db.insert(researchResults).values({
    jobId, clientId: job.clientId, datos, version: previas.length + 1,
  });

  const todasFallaron = ETAPAS.every((e) => estado[e] !== 'ok');
  await db.update(researchJobs).set({
    estado: todasFallaron ? 'fallido' : 'completado',
    etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(costo),
    error: todasFallaron ? 'Ninguna etapa produjo datos' : null,
  }).where(eq(researchJobs.id, jobId));
}

function razonDeVacio(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar esta etapa.';
  return 'Esta etapa no se ejecutó.';
}
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/research/pipeline.test.ts`
Esperado: los 5 tests pasan.

- [ ] **Paso 5: Escribir `src/research/worker.ts`**

```typescript
import { eq, or, asc } from 'drizzle-orm';
import { db, researchJobs } from '@/db';
import { ejecutarJob } from './pipeline';

let corriendo = false;
let arrancado = false;

async function tick() {
  if (corriendo) return;
  const [siguiente] = await db.select().from(researchJobs)
    .where(or(eq(researchJobs.estado, 'encolado'), eq(researchJobs.estado, 'corriendo')))
    .orderBy(asc(researchJobs.createdAt)).limit(1);
  if (!siguiente) return;

  corriendo = true;
  try {
    await ejecutarJob(siguiente.id);
  } catch (e) {
    console.error('[worker] fallo no capturado:', e);
    await db.update(researchJobs)
      .set({ estado: 'fallido', error: e instanceof Error ? e.message : String(e), finishedAt: new Date() })
      .where(eq(researchJobs.id, siguiente.id));
  } finally {
    corriendo = false;
  }
}

export function arrancarWorker(): void {
  if (arrancado) return;
  arrancado = true;
  setInterval(() => { void tick(); }, 5000);
  console.log('[worker] iniciado');
}
```

Los trabajos en estado `corriendo` se recogen igual que los `encolado`: así un reinicio del servicio los retoma en lugar de dejarlos colgados.

- [ ] **Paso 6: Arrancar el worker desde el middleware**

Agregar al inicio de `src/middleware.ts`:
```typescript
import { arrancarWorker } from '@/research/worker';
arrancarWorker();
```

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(research): pipeline con etapas paralelas, tope de costo y reanudación"
```

---

## Tarea 11: Lanzar y seguir investigaciones

**Archivos:**
- Crear: `src/pages/clientes/[id]/investigar.astro`, `src/pages/api/jobs/index.ts`, `src/pages/api/jobs/[id].ts`, `src/pages/jobs/[id].astro`, `src/components/ProgresoJob.tsx`
- Test: `tests/lib/precheck.test.ts`
- Crear: `src/lib/precheck.ts`

**Interfaces:**
- Consume: tablas de la Tarea 2.
- Produce: `revisarAntesDeInvestigar(datos): {advertencias: string[], listo: boolean}`.

- [ ] **Paso 1: Escribir el test**

`tests/lib/precheck.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { revisarAntesDeInvestigar } from '@/lib/precheck';

describe('revisión previa', () => {
  it('avisa cuando no hay enlaces ni archivos', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 0, archivosConTexto: 0, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('enlaces');
    expect(r.listo).toBe(true);
  });

  it('avisa cuando falta el ticket', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 2, archivosConTexto: 1, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('ticket');
  });

  it('sin advertencias cuando está todo', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 3, archivosConTexto: 2, ticket: '$30,000', ciudad: 'GDL' });
    expect(r.advertencias).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/precheck.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/lib/precheck.ts`**

```typescript
export function revisarAntesDeInvestigar(d: {
  enlaces: number; archivosConTexto: number; ticket: string | null; ciudad: string | null;
}): { advertencias: string[]; listo: boolean } {
  const advertencias: string[] = [];
  if (d.enlaces === 0) advertencias.push('No hay enlaces registrados. La investigación no podrá revisar los activos del cliente.');
  if (d.archivosConTexto === 0) advertencias.push('No hay archivos con texto extraído. Se perderá el detalle del producto.');
  if (!d.ticket) advertencias.push('Falta el ticket. Sin él no se puede determinar si el ciclo de compra es largo.');
  if (!d.ciudad) advertencias.push('Falta la ciudad. El foco geográfico será nacional por defecto.');
  return { advertencias, listo: true };
}
```

La investigación nunca se bloquea por falta de datos: se advierte y se deja decidir al operador.

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/precheck.test.ts`
Esperado: los 3 tests pasan.

- [ ] **Paso 5: Escribir los endpoints**

`src/pages/api/jobs/index.ts`: POST con `{clientId}` crea el job en estado `encolado`. Devuelve 409 si ya hay uno `encolado` o `corriendo` para ese cliente.
`src/pages/api/jobs/[id].ts`: GET devuelve estado, etapas, costo y `resultId` si terminó.

- [ ] **Paso 6: Escribir las páginas y la isla**

`investigar.astro`: muestra el resumen de datos, las advertencias de `revisarAntesDeInvestigar`, la estimación de costo de `COST_ESTIMATE_USD` y el botón de confirmación.
`jobs/[id].astro` con `ProgresoJob.tsx`: consulta `/api/jobs/[id]` cada 3 segundos y muestra las cinco etapas con su estado. Al completarse, enlaza al resultado.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(jobs): lanzamiento con revisión previa y seguimiento en vivo"
```

---

## Tarea 12: Renderizado de la presentación

**Archivos:**
- Crear: `src/render/presentation.ts`, `src/render/estilos.ts`, `src/render/panels/*.ts`
- Crear: `src/pages/resultados/[id].astro`
- Test: `tests/render/presentation.test.ts`
- Crear: `tests/fixtures/investigacion-completa.json`, `tests/fixtures/investigacion-parcial.json`

**Interfaces:**
- Consume: tipos de la Tarea 7.
- Produce: `renderizarPresentacion(datos: Investigacion, meta: {cliente: string, giro: string, fecha: string}): string` que devuelve el HTML completo.

- [ ] **Paso 1: Escribir el test**

`tests/render/presentation.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { renderizarPresentacion } from '@/render/presentation';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };

describe('renderizado', () => {
  it('produce 17 paneles con datos completos', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect((html.match(/class="panel"/g) ?? []).length).toBe(17);
  });

  it('incluye el nombre del cliente y el título', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect(html).toContain('Ana Villa');
    expect(html).toContain('<title>');
  });

  it('marca los paneles vacíos con su razón, sin inventar contenido', () => {
    const html = renderizarPresentacion(parcial as any, meta);
    expect(html).toContain('Sin datos');
    expect((html.match(/class="panel"/g) ?? []).length).toBe(17);
  });

  it('escapa el HTML de los datos para evitar inyección', () => {
    const conScript = JSON.parse(JSON.stringify(completa));
    conScript.competencia.datos.hallazgos = ['<script>alert(1)</script>'];
    const html = renderizarPresentacion(conScript, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
```

- [ ] **Paso 2: Crear los fixtures**

`tests/fixtures/investigacion-completa.json`: un objeto que valide contra `investigacionSchema` con las cinco etapas en `ok` y datos realistas.
`tests/fixtures/investigacion-parcial.json`: con `competencia` en `ok` y las otras cuatro en `vacio` con su razón.

- [ ] **Paso 3: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/render/presentation.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 4: Escribir `src/render/estilos.ts`**

Exporta una constante con el CSS completo del machote de Social Research: superficies en capas, scroll horizontal con `scroll-snap-type: x mandatory`, paneles de `100vw`, tarjetas con sombra y barra de acento, tablas con encabezado sólido, y los media queries.

Se copia del archivo `machote-social-research-wozial.html` del proyecto Wozial.

- [ ] **Paso 5: Escribir `src/render/presentation.ts`**

```typescript
import type { Investigacion } from '@/research/schemas';
import { ESTILOS } from './estilos';
import { panelPortada } from './panels/portada';
// ... los 17 módulos de panel

export function escapar(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function panelVacio(numero: string, titulo: string, razon: string): string {
  return `<section class="panel"><div class="wrap">
    <div class="pnum">${escapar(numero)}</div>
    <h2>${escapar(titulo)}</h2>
    <div class="alert alert-yellow" style="margin-top:22px;">
      <strong>Sin datos.</strong> ${escapar(razon)}
    </div>
  </div></section>`;
}

export function renderizarPresentacion(
  datos: Investigacion,
  meta: { cliente: string; giro: string; fecha: string }
): string {
  const paneles = [
    panelPortada(meta),
    // ... los 16 restantes, cada uno recibiendo su etapa y decidiendo
    //     entre renderizar o llamar a panelVacio con la razón
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Social Research Wozial | ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="robots" content="noindex,nofollow">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${ESTILOS}</style>
</head><body>
<div class="deck" id="deck">${paneles}</div>
<script>${NAVEGACION}</script>
</body></html>`;
}
```

Cada módulo de panel recibe su etapa y decide: si `estado === 'vacio'`, llama a `panelVacio` con la razón; si es `ok`, renderiza sus datos con `escapar` en todo valor de texto.

- [ ] **Paso 6: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/render/presentation.test.ts`
Esperado: los 4 tests pasan.

- [ ] **Paso 7: Escribir `src/pages/resultados/[id].astro`**

Consulta el resultado, llama a `renderizarPresentacion` y devuelve el HTML. Barra superior con: regenerar, crear o revocar link público, ver JSON crudo.

- [ ] **Paso 8: Commit**

```bash
git add -A
git commit -m "feat(render): presentación de 17 paneles con escape y paneles vacíos declarados"
```

---

## Tarea 13: Links públicos

**Archivos:**
- Crear: `src/pages/api/share.ts`, `src/pages/p/[token].astro`, `src/lib/share.ts`
- Test: `tests/lib/share.test.ts`

**Interfaces:**
- Consume: `shareLinks`, `researchResults` de la Tarea 2, `renderizarPresentacion` de la Tarea 12.
- Produce: `crearShareLink(resultId: string): Promise<string>`, `resolverShareLink(token: string): Promise<{resultId: string} | null>`, `revocarShareLink(token: string): Promise<void>`.

- [ ] **Paso 1: Escribir el test**

`tests/lib/share.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generarTokenShare } from '@/lib/share';

describe('token de compartir', () => {
  it('genera tokens distintos en cada llamada', () => {
    const vistos = new Set(Array.from({ length: 100 }, () => generarTokenShare()));
    expect(vistos.size).toBe(100);
  });

  it('usa al menos 32 bytes de entropía', () => {
    expect(generarTokenShare().length).toBeGreaterThanOrEqual(43);
  });

  it('solo usa caracteres seguros para URL', () => {
    expect(generarTokenShare()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
```

- [ ] **Paso 2: Correr el test para verificar que falla**

Ejecuta: `npx vitest run tests/lib/share.test.ts`
Esperado: FALLA con módulo no encontrado.

- [ ] **Paso 3: Escribir `src/lib/share.ts`**

```typescript
import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, shareLinks } from '@/db';

export function generarTokenShare(): string {
  return randomBytes(32).toString('base64url');
}

export async function crearShareLink(resultId: string): Promise<string> {
  const token = generarTokenShare();
  await db.insert(shareLinks).values({ token, resultId });
  return token;
}

export async function resolverShareLink(token: string): Promise<{ resultId: string } | null> {
  const [l] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!l || l.revocado) return null;
  await db.update(shareLinks)
    .set({ visitas: sql`${shareLinks.visitas} + 1` })
    .where(eq(shareLinks.token, token));
  return { resultId: l.resultId };
}

export async function revocarShareLink(token: string): Promise<void> {
  await db.update(shareLinks).set({ revocado: true }).where(eq(shareLinks.token, token));
}
```

- [ ] **Paso 4: Correr el test para verificar que pasa**

Ejecuta: `npx vitest run tests/lib/share.test.ts`
Esperado: los 3 tests pasan.

- [ ] **Paso 5: Escribir `src/pages/p/[token].astro`**

```astro
---
import { eq } from 'drizzle-orm';
import { db, researchResults, clients } from '@/db';
import { resolverShareLink } from '@/lib/share';
import { renderizarPresentacion } from '@/render/presentation';

const { token } = Astro.params;
const link = await resolverShareLink(token!);
if (!link) return new Response('No encontrado', { status: 404 });

const [r] = await db.select().from(researchResults).where(eq(researchResults.id, link.resultId)).limit(1);
if (!r) return new Response('No encontrado', { status: 404 });

const [c] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
const html = renderizarPresentacion(r.datos as any, {
  cliente: c.nombre, giro: c.giro,
  fecha: r.createdAt.toISOString().slice(0, 10),
});
---
<Fragment set:html={html} />
```

Un token revocado devuelve 404, no un mensaje de "revocado": confirmar que existió filtraría información.

- [ ] **Paso 6: Escribir `src/pages/api/share.ts`**

POST con `{resultId}` crea el link y devuelve la URL completa usando `PUBLIC_BASE_URL`.
DELETE con `{token}` lo revoca.

- [ ] **Paso 7: Commit**

```bash
git add -A
git commit -m "feat(share): links públicos con token revocable y contador de visitas"
```

---

## Tarea 14: Despliegue vía GitHub a Railway

**Repositorio:** `https://github.com/wozialmktlovers/cash`
**Proyecto Railway:** Wozial Ads Manager · `e616a8d0-df41-448e-aaf4-206706bc7c8c`

**Archivos:**
- Crear: `railway.json`, `Dockerfile`, `scripts/arranque.mjs`, `README.md`
- Modificar: `.gitignore` (verificar que `.env` y `data/` estén excluidos)

**Interfaces:**
- Consume: todo lo anterior.
- Produce: aplicación desplegada, con despliegue automático en cada push a `main`.

- [ ] **Paso 1: Confirmar que ningún secreto se va al repo**

```bash
cat .gitignore | grep -E "^\.env$|^data/$"
git status --porcelain | grep -E "\.env|data/" && echo "PELIGRO: hay secretos por subir" || echo "Limpio"
```

Esperado: `.env` y `data/` aparecen en `.gitignore`, y `git status` no los lista.

**Esto se verifica antes de cualquier push.** Una llave de API en el historial de un repo público sigue siendo visible aunque se borre después: hay que rotarla.

- [ ] **Paso 2: Escribir `scripts/arranque.mjs`**

```javascript
import { execSync } from 'node:child_process';

console.log('Aplicando migraciones...');
execSync('node scripts/migrate.mjs', { stdio: 'inherit' });

console.log('Iniciando servidor...');
await import('../dist/server/entry.mjs');
```

Las migraciones corren antes de levantar el servidor. Drizzle las aplica de forma idempotente, así que reintentar un despliegue es seguro.

- [ ] **Paso 3: Escribir `Dockerfile`**

```dockerfile
FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 4321

CMD ["node", "scripts/arranque.mjs"]
```

- [ ] **Paso 4: Escribir `railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" },
  "deploy": { "restartPolicyType": "ON_FAILURE", "restartPolicyMaxRetries": 3 }
}
```

- [ ] **Paso 5: Publicar el código en GitHub**

El repo está vacío, así que este es el primer push:

```bash
git remote add origin https://github.com/wozialmktlovers/cash.git
git branch -M main
git push -u origin main
```

- [ ] **Paso 6: Vincular la carpeta al proyecto de Railway**

```bash
railway link --project e616a8d0-df41-448e-aaf4-206706bc7c8c
railway status
```

Esperado: `railway status` muestra "Wozial Ads Manager".

- [ ] **Paso 7: Agregar PostgreSQL y el volumen**

```bash
railway add --database postgres
railway volume add --mount-path /data
```

`DATABASE_URL` queda inyectada automáticamente en el servicio.

- [ ] **Paso 8: Configurar las variables de entorno**

```bash
railway variables --set "ANTHROPIC_API_KEY=<la llave real>"
railway variables --set "SESSION_SECRET=$(openssl rand -base64 32)"
railway variables --set "DATA_DIR=/data"
railway variables --set "COST_LIMIT_USD=15"
railway variables --set "COST_ESTIMATE_USD=8"
railway variables --set "MODEL_RESEARCH=claude-sonnet-5"
railway variables --set "MODEL_SYNTHESIS=claude-opus-5"
```

- [ ] **Paso 9: Conectar el repo para despliegue automático**

En el panel de Railway, dentro del servicio: **Settings → Source → Connect Repo** y elegir `wozialmktlovers/cash`, rama `main`.

Desde ese momento, cada push a `main` dispara un despliegue. No hace falta `railway up`.

- [ ] **Paso 10: Generar el dominio y fijar la URL pública**

```bash
railway domain
```

Copiar el dominio asignado y configurarlo:

```bash
railway variables --set "PUBLIC_BASE_URL=https://<dominio-asignado>"
```

Este valor se usa para construir los links públicos que se comparten con el cliente. Si queda mal, los links apuntarán a un sitio inexistente.

- [ ] **Paso 11: Verificar el despliegue**

```bash
railway logs
```

Esperado en el registro: "Migraciones aplicadas", "[worker] iniciado", y el servidor escuchando.

- [ ] **Paso 12: Crear el usuario administrador**

```bash
railway run node scripts/crear-usuario.mjs tu@correo.com "contraseña-larga-y-única"
```

- [ ] **Paso 13: Verificación manual de punta a punta**

1. Abrir el dominio e iniciar sesión
2. Crear un cliente de prueba con giro, producto, un enlace y un PDF
3. Lanzar la investigación y observar el progreso
4. Al terminar, abrir el resultado y revisar los 17 paneles
5. Generar el link público y abrirlo en una ventana privada
6. Revocarlo y confirmar que devuelve 404

Esta es la única prueba que consume API real. Anotar el costo que reporta el sistema y compararlo con el consumo real en la consola de Anthropic: si difieren mucho, las tarifas de `src/lib/cost.ts` están desactualizadas.

- [ ] **Paso 14: Escribir `README.md`**

Con: qué hace el sistema, cómo correrlo en local, las variables de entorno con su significado, cómo crear usuarios, cómo desplegar y la advertencia de que cada investigación cuesta dinero real de la cuenta de Anthropic.

- [ ] **Paso 15: Commit y push**

```bash
git add -A
git commit -m "chore: despliegue en Railway desde GitHub con migraciones al arranque"
git push
```

El push dispara el despliegue automático.

---

## Verificación final

- [ ] `npm test` — todos los tests pasan
- [ ] `npm run build` — compila sin errores
- [ ] Sesión: login, navegación, cierre de sesión
- [ ] Cliente: alta, edición, enlaces, archivos, borrado en cascada
- [ ] Investigación: lanzar, seguir progreso, ver resultado
- [ ] Paneles vacíos: forzar el fallo de un agente y confirmar que se declara el vacío en lugar de inventar
- [ ] Link público: crear, abrir sin sesión, revocar, confirmar 404
- [ ] Reanudación: reiniciar el servicio a media investigación y confirmar que retoma
- [ ] Tope de costo: bajar `COST_LIMIT_USD` a 0.01 y confirmar que detiene el trabajo
