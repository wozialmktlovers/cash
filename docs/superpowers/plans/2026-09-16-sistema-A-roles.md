# Sistema de trabajo · A · Usuarios, roles y asignación · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Roles Admin/Operador/Cliente, asignación de clientes a operadores, visibilidad por rol en todo el Studio, invitaciones con enlace (y correo cuando esté configurado) y administración de usuarios.

**Architecture:**
- **Reglas en funciones puras:** las de acceso viven en `src/lib/permisos.ts`, con pruebas.
- **Sesión y middleware:** la sesión devuelve el usuario completo y el middleware aplica las reglas de ruta.
- **Visibilidad por cliente:** cada página y API que toca clientes resuelve el cliente con `clienteVisible()`, que responde 404 si no hay permiso.
- **Invitaciones:** se guardan con el token en hash sha256.
- **Correo:** pasa por `src/lib/correo.ts` (Resend por HTTP) y se omite sin llave.

**Tech Stack:** Astro 7.2.1 SSR, Drizzle 0.45.2 + drizzle-kit, Postgres, Zod 4, Vitest, @node-rs/argon2.

**Spec:** `docs/superpowers/specs/2026-09-16-sistema-trabajo-design.md` (§1, §2, §6, §7)

## Global Constraints

- **Git y despliegue:** rama `feat/rediseno`. Nunca `git push` ni despliegue.
- **Dependencias:** `node_modules` es un enlace a `node_modules.nosync/`; nunca `npm ci` ni `npm install`.
- **Servidor del usuario:** tiene `astro dev` en 4321; no se detiene.
- **Secretos y costos:** nunca llamar a Anthropic ni a Resend reales; nunca imprimir ni editar `.env`.
- **Migraciones:** solo en la base local (`node --env-file=.env scripts/migrate.mjs`).
- **Estilo del código:** comentarios en español; commits con línea en blanco y `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; `npm test` y `npm run build` en verde al final de cada tarea.
- **Acceso sin permiso:** 404 en páginas y API, sin distinguir de «no existe». Las rutas internas pedidas por un usuario `cliente` redirigen a `/portal` (páginas) o responden 403 (API).
- **Diseño:**
  - tokens y clases del Studio (`global.css`), sin `.a + .a {margin}`;
  - 44 px, foco visible, claro y oscuro;
  - textos de usuario siempre escapados; Astro los escapa por omisión, así que nunca usar `set:html` con datos de usuario.
- **Roles:** `admin | operador | cliente`. Contraseñas: mínimo 12 caracteres. Invitaciones: vencen a los 7 días.

---

### Task A1: Esquema y migración de roles

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0003_*.sql` (generado) y añadir al final el SQL de datos.
- Test: `tests/db/schema.test.ts`

**Interfaces — Produces:**
- `usuarioRol` pgEnum `['admin','operador','cliente']`.
- `users.rol`, `users.nombre`, `users.clientId`, `users.activo`.
- `clients.operadorId`.
- `researchJobs.creadoPor`.
- Tabla `invitaciones`: `id`, `tokenHash` (único), `email`, `rol`, `clientId`, `creadoPor`, `expiraEn`, `usadaEn`, `creadoEn`.

- [ ] **Step 1: Prueba**

Añadir a `tests/db/schema.test.ts`:
```ts
describe('esquema de roles', () => {
  it('usuarios con rol, nombre, cliente y activo', async () => {
    const s = await import('@/db/schema');
    expect(s.usuarioRol.enumValues).toEqual(['admin', 'operador', 'cliente']);
    for (const c of ['rol', 'nombre', 'clientId', 'activo']) expect((s.users as any)[c]).toBeDefined();
  });
  it('clientes con operador y jobs con autor', async () => {
    const s = await import('@/db/schema');
    expect(s.clients.operadorId).toBeDefined();
    expect(s.researchJobs.creadoPor).toBeDefined();
  });
  it('invitaciones', async () => {
    const s = await import('@/db/schema');
    for (const c of ['tokenHash', 'email', 'rol', 'clientId', 'creadoPor', 'expiraEn', 'usadaEn']) expect((s.invitaciones as any)[c]).toBeDefined();
  });
});
```

- [ ] **Step 2: Esquema**

En `src/db/schema.ts`:
- `export const usuarioRol = pgEnum('usuario_rol', ['admin', 'operador', 'cliente']);`
- En `users`, añadir:
  - `rol: usuarioRol('rol').notNull().default('operador')`
  - `nombre: text('nombre')`
  - `clientId: uuid('client_id')`, sin `.references` en la definición: `clients` se declara después en el archivo. Si drizzle permite la referencia perezosa `() => clients.id`, usarla con `onDelete: 'cascade'`; si no, añadir la FK en la migración a mano.
  - `activo: boolean('activo').notNull().default(true)`
- En `clients`: `operadorId: uuid('operador_id').references(() => users.id, { onDelete: 'set null' })`.
- En `researchJobs`: `creadoPor: uuid('creado_por').references(() => users.id, { onDelete: 'set null' })`.
- Tabla nueva:
```ts
/** El token viaja solo en el enlace; en la base queda su hash, como una contraseña. */
export const invitaciones = pgTable('invitaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  rol: usuarioRol('rol').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  creadoPor: uuid('creado_por').references(() => users.id, { onDelete: 'set null' }),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  usadaEn: timestamp('usada_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 3: Migración**

Correr `npx drizzle-kit generate --name roles`. Si pide confirmación interactiva, detenerse con BLOCKED.

Añadir al final del `.sql` generado, tras un `--> statement-breakpoint`:
```sql
-- Roles de los usuarios que ya existían: el más antiguo administra, los demás operan.
UPDATE "users" SET "rol" = 'admin' WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);--> statement-breakpoint
UPDATE "users" SET "rol" = 'operador' WHERE "id" <> (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);--> statement-breakpoint
-- Los clientes existentes quedan a cargo de ese administrador hasta que se reasignen.
UPDATE "clients" SET "operador_id" = (SELECT "id" FROM "users" WHERE "rol" = 'admin' ORDER BY "created_at" ASC LIMIT 1) WHERE "operador_id" IS NULL;
```

Si la FK de `users.client_id` no la generó drizzle, añadirla también:
```sql
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade;
```

Aplicar en local con `node --env-file=.env scripts/migrate.mjs`. Verificar:
```bash
docker exec wozial-pg psql -U wozial -d wozial_studio -Atc "select email, rol from users order by created_at"
docker exec wozial-pg psql -U wozial -d wozial_studio -Atc "select count(*) from clients where operador_id is null"
```
Resultado esperado: el primer usuario es admin y la segunda consulta devuelve 0.

- [ ] **Step 4: Verde y commit**

`npm test`, `npm run build`.
```bash
git add src/db/schema.ts drizzle tests/db/schema.test.ts
git commit -m "feat(roles): roles, asignación de clientes, autor de jobs e invitaciones

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A2: Permisos, sesión y middleware

**Files:**
- Create: `src/lib/permisos.ts`
- Modify: `src/lib/auth.ts`, `src/middleware.ts`, `src/env.d.ts`, `src/pages/api/login.ts`
- Test: `tests/lib/permisos.test.ts`, `tests/lib/auth.test.ts` (añadir)

**Interfaces — Produces:**
- `type Rol = 'admin' | 'operador' | 'cliente'`
- `type UsuarioSesion = { id: string; email: string; nombre: string | null; rol: Rol; clientId: string | null; activo: boolean }`
- `rutaPermitida(rol: Rol, ruta: string): 'ok' | 'redirigir-portal' | 'prohibido'`
- `puedeVerCliente(u: UsuarioSesion, c: { id: string; operadorId: string | null }): boolean`
- `puedeOperarCliente(u, c): boolean`: admin, u operador asignado; nunca cliente.
- `destinoTrasLogin(rol: Rol): string`
- `validarSesion(token): Promise<UsuarioSesion | null>`: `null` si el usuario está inactivo.
- `locals.usuario: UsuarioSesion`, sin quitar `locals.userId`.

- [ ] **Step 1: Pruebas**

`tests/lib/permisos.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { rutaPermitida, puedeVerCliente, puedeOperarCliente, destinoTrasLogin, type UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, rol, clientId: null, activo: true, ...extra });

describe('rutaPermitida', () => {
  it('admin entra a todo', () => {
    for (const r of ['/', '/admin/usuarios', '/api/admin/usuarios', '/portal', '/clientes/x']) expect(rutaPermitida('admin', r)).toBe('ok');
  });
  it('operador todo menos admin', () => {
    expect(rutaPermitida('operador', '/clientes/x')).toBe('ok');
    expect(rutaPermitida('operador', '/admin/usuarios')).toBe('prohibido');
    expect(rutaPermitida('operador', '/api/admin/usuarios')).toBe('prohibido');
  });
  it('cliente solo portal, comentarios, avisos, logout y links públicos', () => {
    for (const r of ['/portal', '/portal/documentos/1', '/api/portal/x', '/api/comentarios', '/api/comentarios/1', '/api/notificaciones', '/api/logout', '/p/a/b']) {
      expect(rutaPermitida('cliente', r), r).toBe('ok');
    }
    expect(rutaPermitida('cliente', '/')).toBe('redirigir-portal');
    expect(rutaPermitida('cliente', '/clientes')).toBe('redirigir-portal');
    expect(rutaPermitida('cliente', '/api/clientes')).toBe('prohibido');
    expect(rutaPermitida('cliente', '/portalx')).toBe('redirigir-portal');
  });
});

describe('visibilidad', () => {
  const cliente = { id: 'c1', operadorId: 'op1' };
  it('admin ve y opera todo', () => {
    expect(puedeVerCliente(u('admin'), cliente)).toBe(true);
    expect(puedeOperarCliente(u('admin'), cliente)).toBe(true);
  });
  it('operador solo lo asignado', () => {
    expect(puedeVerCliente(u('operador', { id: 'op1' }), cliente)).toBe(true);
    expect(puedeVerCliente(u('operador', { id: 'op2' }), cliente)).toBe(false);
    expect(puedeOperarCliente(u('operador', { id: 'op1' }), cliente)).toBe(true);
  });
  it('cliente ve su empresa pero nunca opera', () => {
    expect(puedeVerCliente(u('cliente', { clientId: 'c1' }), cliente)).toBe(true);
    expect(puedeVerCliente(u('cliente', { clientId: 'c2' }), cliente)).toBe(false);
    expect(puedeOperarCliente(u('cliente', { clientId: 'c1' }), cliente)).toBe(false);
  });
  it('usuario inactivo no ve nada', () => {
    expect(puedeVerCliente(u('admin', { activo: false }), cliente)).toBe(false);
  });
  it('destino tras login', () => {
    expect(destinoTrasLogin('cliente')).toBe('/portal');
    expect(destinoTrasLogin('operador')).toBe('/');
  });
});
```

- [ ] **Step 2: `permisos.ts`**

```ts
export type Rol = 'admin' | 'operador' | 'cliente';
export type UsuarioSesion = { id: string; email: string; nombre: string | null; rol: Rol; clientId: string | null; activo: boolean };

const RUTAS_CLIENTE = [/^\/portal(\/|$)/, /^\/api\/portal(\/|$)/, /^\/api\/comentarios(\/|$)/, /^\/api\/notificaciones(\/|$)/, /^\/api\/logout$/, /^\/p\//];
const RUTAS_ADMIN = [/^\/admin(\/|$)/, /^\/api\/admin(\/|$)/];

/** Reglas de ruta por rol. La visibilidad por cliente se decide después, en cada página. */
export function rutaPermitida(rol: Rol, ruta: string): 'ok' | 'redirigir-portal' | 'prohibido' {
  if (rol === 'admin') return 'ok';
  if (rol === 'operador') return RUTAS_ADMIN.some((r) => r.test(ruta)) ? 'prohibido' : 'ok';
  if (RUTAS_CLIENTE.some((r) => r.test(ruta))) return 'ok';
  return ruta.startsWith('/api/') ? 'prohibido' : 'redirigir-portal';
}

export function puedeVerCliente(u: UsuarioSesion, c: { id: string; operadorId: string | null }): boolean {
  if (!u.activo) return false;
  if (u.rol === 'admin') return true;
  if (u.rol === 'operador') return c.operadorId === u.id;
  return u.clientId === c.id;
}

export function puedeOperarCliente(u: UsuarioSesion, c: { id: string; operadorId: string | null }): boolean {
  return u.rol !== 'cliente' && puedeVerCliente(u, c);
}

export function destinoTrasLogin(rol: Rol): string {
  return rol === 'cliente' ? '/portal' : '/';
}
```

- [ ] **Step 3: Sesión, middleware y login**

`src/lib/auth.ts`, en `validarSesion`: tras validar la sesión, leer el usuario (`id, email, nombre, rol, clientId, activo`). Si no existe o `!activo`, borrar la sesión y devolver `null`. Si existe, devolver `UsuarioSesion`. Actualizar las pruebas de `tests/lib/auth.test.ts` si dependen de la forma `{ userId }`, sin hacer llamadas a la base: esas pruebas cubren funciones puras.

`src/env.d.ts`: `interface Locals { userId: string; usuario: import('@/lib/permisos').UsuarioSesion }`.

`src/middleware.ts`:
- Añadir `/^\/invitacion\//` y `/^\/api\/invitacion\//` a `PUBLICAS`.
- Tras obtener el usuario:
```ts
  ctx.locals.userId = sesion.id;
  ctx.locals.usuario = sesion;
  const acceso = rutaPermitida(sesion.rol, ruta);
  if (acceso === 'prohibido') {
    return ruta.startsWith('/api/')
      ? new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      : ctx.redirect('/');
  }
  if (acceso === 'redirigir-portal') return ctx.redirect('/portal');
```

`src/pages/api/login.ts`:
- Rechazar a los usuarios con `activo = false` igual que una contraseña incorrecta.
- Redirigir a `destinoTrasLogin(u.rol)`.

- [ ] **Step 4: Verde y commit**

`npx vitest run tests/lib`, `npm test`, `npm run build`.
```bash
git add src/lib/permisos.ts src/lib/auth.ts src/middleware.ts src/env.d.ts src/pages/api/login.ts tests/lib
git commit -m "feat(roles): reglas de acceso por rol en sesión y middleware

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A3: Visibilidad en todo el Studio

**Files:**
- Create: `src/lib/visibilidad.ts`
- Modify: todas las páginas y API que tocan clientes o documentos, listadas abajo.
- Test: `tests/lib/visibilidad.test.ts`

**Interfaces — Produces:**
- `condicionClientes(u: UsuarioSesion): SQL | undefined`: `undefined` para admin; `eq(clients.operadorId, u.id)` para operador; `eq(clients.id, u.clientId)` para cliente.
- `clienteVisible(u, clientId): Promise<Cliente | null>`: aplica `puedeVerCliente`.
- `clienteOperable(u, clientId): Promise<Cliente | null>`: aplica `puedeOperarCliente`.
- `documentoVisible(u, tipo: 'research' | 'growth' | 'pilares', documentoId): Promise<{ resultado; cliente } | null>`.
- `jobVisible(u, jobId): Promise<{ job; cliente } | null>`.

- [ ] **Step 1: Prueba de la condición**

`tests/lib/visibilidad.test.ts`: con un usuario admin, `condicionClientes` devuelve `undefined`. Con operador y con cliente devuelve un objeto SQL definido. Si hace falta, se comprueba con `new PgDialect().sqlToQuery(cond).params` que contenga el id del usuario o del cliente. Importar `PgDialect` de `drizzle-orm/pg-core`.

- [ ] **Step 2: Implementar `visibilidad.ts`**

Usa las tablas de `@/db` y las funciones de `permisos.ts`. Una consulta por llamada. Sin permiso devuelve `null`.

- [ ] **Step 3: Barrido**

Sustituir las lecturas directas por los helpers y responder **404** cuando devuelvan `null`:

| Archivo | Cambio |
|---|---|
| `src/pages/index.astro` | Listas y conteos filtrados con `condicionClientes`; jobs y entregables solo de clientes visibles (join o `inArray` con los ids visibles) |
| `src/pages/clientes/index.astro` | Lista filtrada; el admin tiene un select «Operador» (todos o uno) que filtra por `?operador=` |
| `src/pages/clientes/[id].astro`, `src/pages/clientes/[id]/investigar.astro`, `src/pages/clientes/[id]/pilares.astro` (si existe) | `clienteVisible`; las acciones de generar y editar solo si `clienteOperable` |
| `src/pages/clientes/nuevo.astro` | Sin cambio de página |
| `src/pages/api/clientes/index.ts` | `GET` filtrado; `POST` pone `operadorId = locals.usuario.id` si es operador y el id del admin si es admin |
| `src/pages/api/clientes/[id].ts`, `[id]/links.ts`, `[id]/files.ts` | `clienteOperable` o 404 |
| `src/pages/api/jobs/index.ts` | `clienteOperable`; guarda `creadoPor: locals.usuario.id` |
| `src/pages/api/jobs/[id].ts`, `src/pages/jobs/[id].astro` | `jobVisible` |
| `src/pages/resultados/[id].astro`, `src/pages/growth/[id].astro`, `src/pages/pilares/[id].astro` (si existe) | `documentoVisible`; el panel Compartir o la barra de operador solo si `clienteOperable` |
| `src/pages/api/resultados/[id].ts`, `src/pages/api/share.ts` (POST y DELETE), `src/pages/api/pilares/[id]/temas/[temaId].ts` | `documentoVisible` + operable; en DELETE, buscar el link por token y verificar su documento |
| `src/pages/entregables.astro` | Solo documentos de clientes visibles |

Si un archivo de la lista no existe todavía (pilares), omitirlo y anotarlo en el reporte.

- [ ] **Step 4: Verificación en vivo**

Crear en la base local, con un script en el scratchpad (no en el repo) que use `hashPassword` o argon2 como `scripts/crear-usuario.mjs`, estos usuarios: `admin.local@test`, `operador1.local@test`, `operador2.local@test` y `cliente.local@test`, con contraseña `local-solo-para-probar-2026`. Asignar un cliente a `operador1` y ligar `cliente.local` a ese cliente.

Con build y `PORT=4399 node --env-file=.env ./dist/server/entry.mjs` en segundo plano, hacer login por curl con cada usuario y comprobar:
- operador2 recibe 404 en la ficha del cliente de operador1 y no lo ve en `/clientes`;
- el cliente es redirigido a `/portal` desde `/` (302), y `/api/clientes` le da 403;
- el admin ve todo.

Matar solo ese PID.

- [ ] **Step 5: Verde y commit**

`npm test` y `npm run build`.
```bash
git add src tests
git commit -m "feat(roles): cada usuario ve solo los clientes que le corresponden

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A4: Correo e invitaciones

**Files:**
- Create: `src/lib/correo.ts`, `src/lib/invitaciones.ts`, `src/pages/api/invitaciones.ts`, `src/pages/invitacion/[token].astro`, `src/pages/api/invitacion/aceptar.ts`
- Test: `tests/lib/correo.test.ts`, `tests/lib/invitaciones.test.ts`

**Interfaces — Produces:**
- `plantillaCorreo(o: { titulo: string; texto: string; boton?: { texto: string; url: string } }): { html: string; texto: string }`
- `enviarCorreo(o: { para: string | string[]; asunto: string; titulo: string; texto: string; boton?: {...} }, fetchImpl = fetch): Promise<{ enviado: boolean; motivo?: string }>`
- `generarInvitacion(): { token: string; tokenHash: string }`, `hashToken(token): string` y `vencimiento(desde: Date): Date` (+7 días)
- `validarAceptacion(o: { nombre: string; password: string; confirmacion: string }): { ok: true } | { ok: false; errores: string[] }`
- `estadoInvitacion(inv: { expiraEn: Date; usadaEn: Date | null } | null, ahora: Date): 'valida' | 'vencida' | 'usada' | 'inexistente'`
- `puedeInvitar(u: UsuarioSesion, rol: Rol, cliente: { id; operadorId } | null): boolean`: admin invita cualquier rol; operador solo `cliente` de un cliente que tenga asignado.

- [ ] **Step 1: Pruebas**

`tests/lib/correo.test.ts`:
- `plantillaCorreo` escapa el título y el texto (`<b>` sale como `&lt;b&gt;`) e incluye la URL del botón.
- `enviarCorreo` sin `process.env.RESEND_API_KEY` devuelve `{ enviado: false, motivo: 'sin-configurar' }` y no llama al `fetch` inyectado. Usar `vi.stubEnv`.
- Con `RESEND_API_KEY='k'` y `CORREO_REMITENTE='Wozial <hola@x.mx>'`, llama al fetch falso con `https://api.resend.com/emails`, cabecera `Authorization: Bearer k` y cuerpo con `from`, `to`, `subject`, `html` y `text`, y devuelve `{ enviado: true }`.
- Si el fetch falso lanza o responde 500, devuelve `{ enviado: false, motivo: 'error' }` sin lanzar.

`tests/lib/invitaciones.test.ts`:
- `generarInvitacion` da un token de al menos 32 caracteres y `hashToken(token) === tokenHash`.
- `vencimiento` suma 7 días.
- `estadoInvitacion` cubre los 4 casos.
- `validarAceptacion` exige nombre, contraseña de 12 caracteres o más y confirmación igual.
- `puedeInvitar` cubre la tabla de roles.

- [ ] **Step 2: Implementar**

`correo.ts`:
- `plantillaCorreo` arma un HTML simple en línea, con la marca «Wozial Studio», el título y el texto escapados (usar `escapar` de `@/render/escapar`) y un botón rosa `#B8446B`.
- `enviarCorreo`:
  - Lee `RESEND_API_KEY` y `CORREO_REMITENTE`. Si falta alguna, hace `console.info('[correo] omitido: sin configurar')` y devuelve `sin-configurar`.
  - Si están, hace `POST` con JSON.
  - Nunca lanza.

`invitaciones.ts`: `randomBytes(32).toString('base64url')`; hash con `createHash('sha256')`.

`POST /api/invitaciones` `{ email, rol, clientId? }`:
- Valida el correo con regex simple y en minúsculas, y exige `clientId` para el rol cliente.
- Verifica `puedeInvitar` con el cliente leído de la base.
- Crea la invitación y arma la URL: `(PUBLIC_BASE_URL || origin) + '/invitacion/' + token`.
- Llama a `enviarCorreo` con asunto «Te invitaron a Wozial Studio» y botón «Crear mi acceso».
- Responde `{ ok: true, enlace, correoEnviado }`.

`/invitacion/[token].astro` (pública, estilo del login con `SCRIPT_TEMA`):
- Calcula `estadoInvitacion`. Si es `valida`, muestra un formulario con nombre, contraseña y confirmación. Si no, un mensaje: «Esta invitación venció», «ya se usó» o «no existe».

`POST /api/invitacion/aceptar` (form):
- Revalida el token y los datos.
- Hace upsert del usuario por email (rol, nombre, `clientId`, `activo: true`, `passwordHash`) y marca `usadaEn`.
- Crea la sesión (cookie como en login) y redirige a `destinoTrasLogin(rol)`.
- Los errores vuelven a la página con `?error=<código>`.

- [ ] **Step 3: Verde y commit**

`npx vitest run tests/lib`, `npm test`, `npm run build`.
```bash
git add src/lib/correo.ts src/lib/invitaciones.ts src/pages/api/invitaciones.ts src/pages/invitacion src/pages/api/invitacion tests/lib
git commit -m "feat(roles): invitaciones con enlace y correo listo para Resend

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task A5: Administración de usuarios y asignación

**Files:**
- Create: `src/pages/admin/usuarios.astro`, `src/pages/api/admin/usuarios/[id].ts`, `src/pages/api/clientes/[id]/operador.ts`
- Modify: `src/layouts/Base.astro` (navegación por rol), `src/pages/clientes/[id].astro` (Responsable y usuarios del cliente)
- Create: `src/lib/usuarios.ts`
- Test: `tests/lib/usuarios.test.ts`

**Interfaces — Produces:**
- `validarCambioUsuario(actor: UsuarioSesion, objetivo: { id; rol; activo }, cambio: { rol?: Rol; activo?: boolean }, adminsActivos: number): { ok: true } | { ok: false; error: string }`. Reglas:
  - solo un admin cambia usuarios;
  - un rol solo cambia entre admin y operador (nunca hacia o desde cliente);
  - nadie se desactiva ni se quita el rol de admin a sí mismo;
  - no se desactiva ni se degrada al último admin activo.

- [ ] **Step 1: Pruebas** de `validarCambioUsuario`, con un caso por regla.

- [ ] **Step 2: API**

- `PATCH /api/admin/usuarios/[id]` `{ rol?, activo? }`:
  - Valida con `validarCambioUsuario` contando admins activos.
  - Al desactivar, borra las sesiones del usuario.
  - Responde `{ ok, usuario }`.
- `PATCH /api/clientes/[id]/operador` `{ operadorId }` (solo admin):
  - El operador debe existir, estar activo y tener rol `operador` o `admin`.
  - Actualiza `clients.operadorId`.
  - Responde `{ ok }`. El aviso al operador nuevo llegará en el plan B.

- [ ] **Step 3: Páginas**

`/admin/usuarios` usa `Base` con `activo="usuarios"`.
- **Encabezado:** «Usuarios» y botón «Invitar».
- **Invitar:** `<dialog>` con correo, rol (Admin, Operador o Usuario de cliente) y select de cliente si el rol es cliente. Llama a `POST /api/invitaciones` y muestra el enlace con «Copiar» (usar `copiar` de `@/scripts/copiar`) y si se envió el correo.
- **Dos listas en tarjetas:**
  - «Equipo» (admin y operador): nombre, correo, rol en un select (con `PATCH`), activo en un switch (con `PATCH`) y clientes asignados.
  - «Usuarios de clientes»: nombre, correo, cliente y activo.
- **Estados:** vacíos y toasts en errores.

`Base.astro`:
- La navegación admite `usuarios` y `desempeno` en `Seccion`.
- El admin ve «Usuarios» y «Desempeño»; el operador ve «Desempeño». Añadir los iconos a `Icono.astro` si faltan (`usuarios`, `grafica`).
- Barra inferior móvil: sin cambios (4 pestañas).
- Mostrar el nombre o correo y el rol del usuario junto a «Salir».

Ficha del cliente:
- **Bloque «Responsable»:** para el admin, un select de operadores activos con guardado por `PATCH` y toast; para el operador, solo texto.
- **Bloque «Usuarios del cliente»** (si `clienteOperable`): lista de usuarios con rol cliente de ese cliente e «Invitar usuario» (`dialog` con correo → `POST /api/invitaciones` con `rol: 'cliente'`, mostrando el enlace).

- [ ] **Step 4: Verificación en vivo**

Con los usuarios locales de A3:
- el admin cambia a operador2 a admin y lo regresa;
- el admin reasigna el cliente de operador1 a operador2, y operador1 deja de verlo (404);
- un operador intenta `PATCH /api/admin/usuarios/...` y recibe 403;
- se genera una invitación de cliente y se acepta por curl (GET de la página + POST del form), con redirección a `/portal`.

- [ ] **Step 5: Verde y commit**

```bash
git add src tests
git commit -m "feat(roles): administración de usuarios, responsable del cliente e invitaciones desde la ficha

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
