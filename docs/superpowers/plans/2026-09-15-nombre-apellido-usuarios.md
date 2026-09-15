# Nombre, apellido y correo de cada usuario · Plan

> **Para agentes:** ejecutar con superpowers:subagent-driven-development, tarea por tarea.

**Objetivo:** que cada usuario del Studio tenga nombre, apellido y correo, editables desde la app, y que las pantallas muestren personas en lugar de correos.

**Diseño:** `docs/superpowers/specs/2026-09-15-nombre-apellido-usuarios-design.md` — léelo antes de empezar tu tarea.

**Arquitectura:** una columna nueva (`users.apellido`), tres funciones puras en `src/lib/usuarios.ts` (`nombreVisible`, `ordenUsuarios`, `validarDatosUsuario`), un `PATCH` extendido para el admin y uno nuevo para uno mismo, y el reemplazo de `u.nombre ?? u.email` por `nombreVisible(u)` en toda la app.

**Stack:** Astro 7 SSR, Drizzle, Postgres 16, Vitest. Todo en español, como el resto del repo.

---

### Tarea 1: columna, esquema y sesión

**Archivos:**
- Crear: `drizzle/0006_usuarios_apellido.sql`
- Modificar: `src/db/schema.ts`, `src/lib/permisos.ts`, `src/lib/auth.ts`
- Modificar (fixtures): los archivos de `tests/` que construyen un `UsuarioSesion` a mano
- Prueba: `tests/db/migraciones.test.ts`

- [ ] **Paso 1: escribir la migración**

`drizzle/0006_usuarios_apellido.sql`:

```sql
ALTER TABLE "users" ADD COLUMN "apellido" text;
```

Registrarla en `drizzle/meta/_journal.json` igual que las anteriores (copia la
forma de la entrada de `0005_usuarios_client_id_rol`, con su `idx`, `when` y
`tag` propios). Si el proyecto genera el journal con drizzle-kit, usa el mismo
procedimiento que se usó para 0005 y no lo escribas a mano.

- [ ] **Paso 2: añadir la columna al esquema**

En `src/db/schema.ts`, dentro de `users`, justo después de `nombre`:

```ts
  apellido: text('apellido'),
```

- [ ] **Paso 3: llevar `apellido` a la sesión**

En `src/lib/permisos.ts`:

```ts
export type UsuarioSesion = { id: string; email: string; nombre: string | null; apellido: string | null; rol: Rol; clientId: string | null; activo: boolean };
```

En `src/lib/auth.ts:37`, agregar `apellido: users.apellido` al `select`.

- [ ] **Paso 4: arreglar los fixtures de las pruebas**

`npx tsc --noEmit` señalará cada objeto `UsuarioSesion` literal al que le falta
`apellido`. Agregar `apellido: null` a todos (son pocos archivos; entre ellos
`tests/api/ids-no-uuid.test.ts` y `tests/lib/permisos.test.ts`).

- [ ] **Paso 5: probar la migración**

Si `tests/db/migraciones.test.ts` ya compara el esquema declarado contra las
migraciones (comprueba cómo lo hace para 0005), añadir el caso de la columna
nueva siguiendo ese mismo patrón. Si no lo hace, salta este paso.

- [ ] **Paso 6: verificar y commit**

```bash
npx tsc --noEmit && npx vitest run
git add -A && git commit -m "feat(usuarios): columna apellido en users"
```

---

### Tarea 2: reglas puras en `src/lib/usuarios.ts`

**Archivos:**
- Modificar: `src/lib/usuarios.ts`
- Prueba: `tests/lib/usuarios.test.ts`

- [ ] **Paso 1: escribir las pruebas que fallan**

Añadir a `tests/lib/usuarios.test.ts`:

```ts
import { nombreVisible, ordenUsuarios, validarDatosUsuario } from '@/lib/usuarios';

describe('nombreVisible', () => {
  it('junta nombre y apellido', () => {
    expect(nombreVisible({ nombre: 'Ana', apellido: 'Pau', email: 'a@x.mx' })).toBe('Ana Pau');
  });
  it('con solo nombre no deja espacios sueltos', () => {
    expect(nombreVisible({ nombre: 'Ana', apellido: null, email: 'a@x.mx' })).toBe('Ana');
    expect(nombreVisible({ nombre: null, apellido: 'Pau', email: 'a@x.mx' })).toBe('Pau');
  });
  it('sin nombre ni apellido, el correo', () => {
    expect(nombreVisible({ nombre: null, apellido: null, email: 'a@x.mx' })).toBe('a@x.mx');
    expect(nombreVisible({ nombre: '  ', apellido: '', email: 'a@x.mx' })).toBe('a@x.mx');
  });
});

describe('ordenUsuarios', () => {
  it('ordena por apellido y luego nombre, sin que los acentos manden al final', () => {
    const lista = [
      { nombre: 'Beto', apellido: 'Zamora', email: 'b@x.mx' },
      { nombre: 'Ana', apellido: 'Álvarez', email: 'a@x.mx' },
      { nombre: 'Ana', apellido: 'Pau', email: 'ap@x.mx' },
      { nombre: 'Zoe', apellido: 'Pau', email: 'z@x.mx' },
    ];
    expect([...lista].sort(ordenUsuarios).map((u) => u.email)).toEqual(['a@x.mx', 'ap@x.mx', 'z@x.mx', 'b@x.mx']);
  });
  it('los que no tienen nombre van al final, por correo', () => {
    const lista = [
      { nombre: null, apellido: null, email: 'zzz@x.mx' },
      { nombre: null, apellido: null, email: 'aaa@x.mx' },
      { nombre: 'Beto', apellido: 'Zamora', email: 'b@x.mx' },
    ];
    expect([...lista].sort(ordenUsuarios).map((u) => u.email)).toEqual(['b@x.mx', 'aaa@x.mx', 'zzz@x.mx']);
  });
});

describe('validarDatosUsuario', () => {
  const admin = { id: 'u1', email: 'a@x.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
  const operador = { ...admin, id: 'u2', rol: 'operador' as const };

  it('recorta y normaliza', () => {
    const r = validarDatosUsuario(admin, 'u9', { nombre: '  Ana ', apellido: 'Pau', email: '  ANA@X.MX ' });
    expect(r).toEqual({ ok: true, datos: { nombre: 'Ana', apellido: 'Pau', email: 'ana@x.mx' } });
  });
  it('vacío borra el dato', () => {
    const r = validarDatosUsuario(admin, 'u9', { nombre: '   ' });
    expect(r).toEqual({ ok: true, datos: { nombre: null } });
  });
  it('rechaza nombres larguísimos', () => {
    expect(validarDatosUsuario(admin, 'u9', { nombre: 'a'.repeat(61) })).toEqual({ ok: false, error: 'nombre-largo' });
    expect(validarDatosUsuario(admin, 'u9', { apellido: 'a'.repeat(61) })).toEqual({ ok: false, error: 'apellido-largo' });
  });
  it('rechaza correos que no lo parecen', () => {
    expect(validarDatosUsuario(admin, 'u9', { email: 'ana' })).toEqual({ ok: false, error: 'correo-invalido' });
    expect(validarDatosUsuario(admin, 'u9', { email: 'ana@x' })).toEqual({ ok: false, error: 'correo-invalido' });
  });
  it('un operador solo se edita a sí mismo', () => {
    expect(validarDatosUsuario(operador, 'u9', { nombre: 'Ana' })).toEqual({ ok: false, error: 'solo-admin' });
    expect(validarDatosUsuario(operador, 'u2', { nombre: 'Ana' })).toEqual({ ok: true, datos: { nombre: 'Ana' } });
  });
  it('un operador nunca cambia un correo, ni el suyo', () => {
    expect(validarDatosUsuario(operador, 'u2', { email: 'otro@x.mx' })).toEqual({ ok: false, error: 'solo-admin-correo' });
  });
  it('sin campos, sin cambios', () => {
    expect(validarDatosUsuario(admin, 'u9', {})).toEqual({ ok: false, error: 'sin-cambios' });
  });
});
```

- [ ] **Paso 2: correrlas y ver que fallan**

```bash
npx vitest run tests/lib/usuarios.test.ts
```
Esperado: fallan porque las funciones no existen.

- [ ] **Paso 3: implementar**

En `src/lib/usuarios.ts`:

```ts
/** Lo mínimo para mostrar a una persona: si aún no tiene nombre, su correo. */
export type UsuarioMostrable = { nombre: string | null; apellido: string | null; email: string };

const MAXIMO_NOMBRE = 60;
const MAXIMO_CORREO = 200;
// Deliberadamente laxa: solo descarta lo que claramente no es un correo. La
// verdad la tiene el buzón de la persona, no una expresión regular.
const CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function nombreVisible(u: UsuarioMostrable): string {
  const completo = [u.nombre, u.apellido].map((p) => p?.trim() ?? '').filter(Boolean).join(' ');
  return completo || u.email;
}

/** Comparador para `sort`: apellido, nombre, y al final quien no tenga ninguno. */
export function ordenUsuarios(a: UsuarioMostrable, b: UsuarioMostrable): number {
  const cmp = (x: string, y: string) => x.localeCompare(y, 'es', { sensitivity: 'base' });
  const conNombre = (u: UsuarioMostrable) => Boolean(u.nombre?.trim() || u.apellido?.trim());
  if (conNombre(a) !== conNombre(b)) return conNombre(a) ? -1 : 1;
  if (!conNombre(a)) return cmp(a.email, b.email);
  const porApellido = cmp(a.apellido?.trim() ?? '', b.apellido?.trim() ?? '');
  return porApellido !== 0 ? porApellido : cmp(a.nombre?.trim() ?? '', b.nombre?.trim() ?? '');
}

export type DatosUsuario = { nombre?: string | null; apellido?: string | null; email?: string };

/**
 * Reglas para editar los datos de identidad de alguien. Pura: la unicidad del
 * correo la decide la restricción única de la base, no esta función.
 */
export function validarDatosUsuario(
  actor: UsuarioSesion,
  objetivoId: string,
  datos: DatosUsuario,
): { ok: true; datos: DatosUsuario } | { ok: false; error: string } {
  const pide = (c: keyof DatosUsuario) => datos[c] !== undefined;
  if (!pide('nombre') && !pide('apellido') && !pide('email')) return { ok: false, error: 'sin-cambios' };
  if (actor.rol !== 'admin' && actor.id !== objetivoId) return { ok: false, error: 'solo-admin' };
  if (pide('email') && actor.rol !== 'admin') return { ok: false, error: 'solo-admin-correo' };

  const limpios: DatosUsuario = {};
  for (const campo of ['nombre', 'apellido'] as const) {
    if (!pide(campo)) continue;
    const valor = (datos[campo] ?? '').trim();
    if (valor.length > MAXIMO_NOMBRE) return { ok: false, error: `${campo}-largo` };
    limpios[campo] = valor || null;
  }
  if (pide('email')) {
    const valor = (datos.email ?? '').trim().toLowerCase();
    if (!valor || valor.length > MAXIMO_CORREO || !CORREO.test(valor)) return { ok: false, error: 'correo-invalido' };
    limpios.email = valor;
  }
  return { ok: true, datos: limpios };
}
```

- [ ] **Paso 4: correr y ver que pasan**

```bash
npx vitest run tests/lib/usuarios.test.ts
```

- [ ] **Paso 5: commit**

```bash
git add -A && git commit -m "feat(usuarios): nombreVisible, ordenUsuarios y validarDatosUsuario"
```

---

### Tarea 3: `PATCH /api/admin/usuarios/[id]` acepta nombre, apellido y correo

**Archivos:**
- Modificar: `src/pages/api/admin/usuarios/[id].ts`
- Prueba: `tests/api/usuarios-datos.test.ts` (crear)

**Depende de:** tareas 1 y 2.

- [ ] **Paso 1: escribir las pruebas que fallan**

`tests/api/usuarios-datos.test.ts`, con el patrón de `tests/api/ids-no-uuid.test.ts`
(sin `DATABASE_URL`, para que cualquier consulta a la base reviente y se note):

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PATCH } from '@/pages/api/admin/usuarios/[id]';

const admin = { id: '00000000-0000-4000-8000-000000000001', email: 'a@x.mx', nombre: null, apellido: null, rol: 'admin' as const, clientId: null, activo: true };
const OTRO = '00000000-0000-4000-8000-0000000000bb';

let urlPrevia: string | undefined;
beforeEach(() => { urlPrevia = process.env.DATABASE_URL; delete process.env.DATABASE_URL; });
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

const llamar = (cuerpo: unknown) => PATCH({
  params: { id: OTRO },
  request: new Request(`http://x/api/admin/usuarios/${OTRO}`, { method: 'PATCH', body: JSON.stringify(cuerpo) }),
  locals: { usuario: admin },
} as any);

describe('PATCH usuarios: datos de identidad', () => {
  it('un nombre larguísimo se rechaza antes de tocar la base', async () => {
    const res = await llamar({ nombre: 'a'.repeat(61) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('nombre-largo');
  });
  it('un correo mal formado se rechaza antes de tocar la base', async () => {
    const res = await llamar({ email: 'ana' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('correo-invalido');
  });
  it('un cuerpo vacío sigue siendo sin-cambios', async () => {
    const res = await llamar({});
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('sin-cambios');
  });
  it('tipos equivocados se rechazan', async () => {
    const res = await llamar({ nombre: 7 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('nombre-invalido');
  });
});
```

- [ ] **Paso 2: correr y ver que fallan**

```bash
npx vitest run tests/api/usuarios-datos.test.ts
```

- [ ] **Paso 3: implementar**

En `src/pages/api/admin/usuarios/[id].ts`:

1. Importar `validarDatosUsuario` junto a `validarCambioUsuario`.
2. Leer también `nombre`, `apellido` y `email` del cuerpo. Comprobar el **tipo**
   antes de validar: `nombre` y `apellido` aceptan `string` o `null`
   (`nombre-invalido` / `apellido-invalido` si no); `email` solo `string`
   (`email-invalido`).
3. Armar `datos` solo con los campos presentes y, si hay alguno, pasarlos por
   `validarDatosUsuario(actor, id, datos)`; si falla, responder 400 con su error.
4. La regla de «sin cambios» pasa a ser: ni rol, ni activo, ni ningún dato →
   `sin-cambios`. Si solo vienen datos, **no** se consulta `adminsActivos` ni se
   llama a `validarCambioUsuario` (esa validación es para rol y activo).
5. El `update` escribe `{ ...cambio, ...datosValidados }` y el `returning` incluye
   `apellido: users.apellido`.
6. Envolver el `update` en `try/catch`: si el error de Postgres es de unicidad
   (`code === '23505'` o el mensaje menciona `users_email_unique`), responder
   `409 { ok: false, error: 'correo-ocupado' }`; cualquier otro error se relanza.

Comentar en el código por qué el 409 se detecta por el error de la base y no con
un `SELECT` previo: es la única comprobación libre de carreras.

- [ ] **Paso 4: correr y ver que pasan**

```bash
npx vitest run tests/api/usuarios-datos.test.ts && npx tsc --noEmit
```

- [ ] **Paso 5: commit**

```bash
git add -A && git commit -m "feat(usuarios): el admin edita nombre, apellido y correo"
```

---

### Tarea 4: `PATCH /api/perfil` para editar lo propio

**Archivos:**
- Crear: `src/pages/api/perfil.ts`
- Modificar: `src/lib/permisos.ts`
- Prueba: `tests/lib/permisos.test.ts`, `tests/api/perfil.test.ts` (crear)

**Depende de:** tareas 1 y 2.

- [ ] **Paso 1: prueba de la ruta**

En `tests/lib/permisos.test.ts`, añadir al bloque de `rutaPermitida`:

```ts
it('/api/perfil lo abren los tres roles', () => {
  expect(rutaPermitida('admin', '/api/perfil')).toBe('ok');
  expect(rutaPermitida('operador', '/api/perfil')).toBe('ok');
  expect(rutaPermitida('cliente', '/api/perfil')).toBe('ok');
});
```

Y en `tests/api/perfil.test.ts`, con el mismo patrón sin `DATABASE_URL`:

```ts
it('ignora el correo aunque venga en el cuerpo', async () => {
  // con nombre válido llegaría a la base; se comprueba con un nombre inválido
  // que el correo no cambia la decisión
  const res = await PATCH({
    request: new Request('http://x/api/perfil', { method: 'PATCH', body: JSON.stringify({ email: 'otro@x.mx', nombre: 'a'.repeat(61) }) }),
    locals: { usuario: operador },
  } as any);
  expect((await res.json()).error).toBe('nombre-largo');
});

it('un cuerpo solo con correo es sin-cambios', async () => {
  const res = await PATCH({
    request: new Request('http://x/api/perfil', { method: 'PATCH', body: JSON.stringify({ email: 'otro@x.mx' }) }),
    locals: { usuario: operador },
  } as any);
  expect(res.status).toBe(400);
  expect((await res.json()).error).toBe('sin-cambios');
});
```

- [ ] **Paso 2: correrlas y ver que fallan**

- [ ] **Paso 3: implementar**

En `src/lib/permisos.ts`, agregar `/^\/api\/perfil$/` a `RUTAS_CLIENTE`.

`src/pages/api/perfil.ts`: lee `nombre` y `apellido` del cuerpo —y **solo** esos,
descartando cualquier `email` o `id`, con un comentario que diga por qué—, valida
tipos igual que en la tarea 3, llama a
`validarDatosUsuario(usuario, usuario.id, datos)`, actualiza y responde
`{ ok: true, usuario: { nombre, apellido, email } }`.

- [ ] **Paso 4: verificar y commit**

```bash
npx vitest run && npx tsc --noEmit
git add -A && git commit -m "feat(usuarios): cada quien edita su nombre y apellido"
```

---

### Tarea 5: `/admin/usuarios` edita y ordena

**Archivos:**
- Modificar: `src/pages/admin/usuarios.astro`

**Depende de:** tareas 1, 2 y 3.

- [ ] **Paso 1: traer y ordenar**

Añadir `apellido: users.apellido` a los dos `select` (equipo y usuarios de
cliente). Quitar el `.orderBy(asc(users.nombre))` y ordenar en memoria con
`ordenUsuarios` (`equipo.sort(ordenUsuarios)`), importándolo de `@/lib/usuarios`.

- [ ] **Paso 2: mostrar a la persona**

Reemplazar cada `u.nombre ?? u.email` por `nombreVisible(u)` (título del renglón y
los tres `aria-label`).

- [ ] **Paso 3: botón y diálogo de edición**

En los dos tipos de renglón, antes del switch de activo:

```astro
<button type="button" class="btn fantasma chico" data-editar={u.id} aria-label={`Editar a ${nombreVisible(u)}`}>Editar</button>
```

Y un `<dialog id="dialogo-editar">` junto al de invitar, con campos Nombre,
Apellido y Correo, la nota «Con este correo inicia sesión. Si lo cambias, avísale.»
debajo del correo, un `<p class="aviso rosa">` para errores y los botones Guardar y
Cancelar. Los datos de cada usuario viajan al script en `data-` del `<li>`
(`data-nombre`, `data-apellido`, `data-email`), como ya se hace con `data-usuario-id`.

- [ ] **Paso 4: guardar desde el script**

Añadir al `<script>`:
- Abrir el diálogo con los valores del renglón.
- Al enviar: `PATCH /api/admin/usuarios/{id}` con `{ nombre, apellido, email }`,
  reutilizando `patchUsuario`.
- Con éxito: `toast('Datos actualizados')`, actualizar el `<strong>`, el correo del
  renglón y los `data-` del `<li>`, y cerrar. **Sin recargar.**
- Con error: mostrarlo en el aviso del diálogo usando `MENSAJES_CAMBIO`, al que se
  le agregan:

```ts
'correo-ocupado': 'Ese correo ya es de otra cuenta.',
'correo-invalido': 'Ese correo no parece válido.',
'nombre-largo': 'El nombre es demasiado largo (máximo 60 caracteres).',
'apellido-largo': 'El apellido es demasiado largo (máximo 60 caracteres).',
```

Ojo con el selector: los botones de acción del diálogo no deben quedar dentro de
`document.querySelectorAll('[data-editar]')`.

- [ ] **Paso 5: verificar y commit**

```bash
npx tsc --noEmit && npx vitest run && npx astro build
git add -A && git commit -m "feat(usuarios): editar nombre, apellido y correo desde Usuarios"
```

---

### Tarea 6: página `/perfil` y encabezado

**Archivos:**
- Crear: `src/pages/perfil.astro`
- Modificar: `src/layouts/Base.astro`

**Depende de:** tareas 1, 2 y 4.

- [ ] **Paso 1: la página**

`src/pages/perfil.astro`, con `Base.astro` y `titulo="Mi perfil"`: una
`<section class="tarjeta">` con un formulario de Nombre y Apellido (valores de
`Astro.locals.usuario`), el correo en un `<input readonly>` con la nota «Con este
correo inicias sesión. Para cambiarlo, pídeselo a un admin.», y un botón Guardar
que hace `PATCH /api/perfil` y avisa con `toast`.

Si el usuario es `cliente`, el diseño del portal no aplica: usa la misma tarjeta,
pero comprueba qué layout usa `src/pages/portal*` y sigue ese patrón para que un
cliente no vea la barra interna. Si el portal tiene su propio layout, la página
elige layout según `usuario.rol`.

- [ ] **Paso 2: el encabezado**

En `src/layouts/Base.astro:93`, cambiar el `<span>` por un enlace a `/perfil` con
`nombreVisible(usuario)` dentro, conservando las clases `usuario-nombre` y
`usuario-rol`. Añadir al `<style>` lo mínimo para que el enlace no se vea como un
enlace azul: hereda color y solo subraya en `:hover`/`:focus-visible`.

Si el portal del cliente tiene su propio encabezado, poner ahí el mismo enlace.

- [ ] **Paso 3: verificar y commit**

```bash
npx tsc --noEmit && npx vitest run && npx astro build
git add -A && git commit -m "feat(usuarios): página de perfil y nombre enlazado en el encabezado"
```

---

### Tarea 7: la invitación pide apellido

**Archivos:**
- Modificar: `src/lib/invitaciones.ts`, `src/pages/api/invitacion/aceptar.ts`, `src/pages/invitacion/[token].astro`
- Prueba: `tests/lib/invitaciones.test.ts`

**Depende de:** tarea 1.

- [ ] **Paso 1: prueba que falla**

En `tests/lib/invitaciones.test.ts`, junto a los casos de `validarAceptacion`:

```ts
it('el apellido es obligatorio', () => {
  const r = validarAceptacion({ nombre: 'Ana', apellido: '  ', password: 'x'.repeat(12), confirmacion: 'x'.repeat(12) });
  expect(r.ok).toBe(false);
});
it('con nombre y apellido pasa', () => {
  expect(validarAceptacion({ nombre: 'Ana', apellido: 'Pau', password: 'x'.repeat(12), confirmacion: 'x'.repeat(12) }).ok).toBe(true);
});
```

Actualizar también los casos existentes de `validarAceptacion` para que pasen
`apellido`.

- [ ] **Paso 2: correr y ver que falla**

- [ ] **Paso 3: implementar**

- `validarAceptacion` recibe `apellido` y añade `'El apellido es obligatorio'` cuando falta.
- `aceptar.ts` lee `apellido` del `FormData`, lo recorta, lo pasa a la validación y
  lo guarda en el `insert` junto a `nombre`.
- `[token].astro`: partir el campo en dos, `Nombre` y `Apellido`, ambos `required`;
  el `autofocus` se queda en Nombre y el apellido usa `autocomplete="family-name"`
  (y el nombre, `given-name`). Ajustar el texto del error `datos` para que
  mencione el apellido.

- [ ] **Paso 4: verificar y commit**

```bash
npx vitest run && npx tsc --noEmit && npx astro build
git add -A && git commit -m "feat(usuarios): la invitación pide nombre y apellido"
```

---

### Tarea 8: el resto de la app y los scripts

**Archivos:**
- Modificar: `src/pages/desempeno.astro`, `src/pages/pendientes.astro`, `src/pages/clientes/index.astro`, `src/pages/clientes/[id].astro`, `src/pages/api/documentos/[tipo]/[id]/versiones.ts`, `src/flujo/servicio.ts`, `src/flujo/avisos.ts`, `scripts/crear-usuario.mjs`, `scripts/bootstrap-admin.mjs`
- Prueba: `tests/db/scripts-usuarios.test.ts`

**Depende de:** tareas 1 y 2.

- [ ] **Paso 1: buscar todo lo que quede**

```bash
grep -rn "nombre ?? .*email\|nombre ?? u.email\|autorNombre\|usuarioNombre" src/
```

- [ ] **Paso 2: cambiar cada uno**

En cada consulta que traiga `nombre: users.nombre`, traer también
`apellido: users.apellido`, y donde se arme el texto usar `nombreVisible`. En los
`orderBy(users.nombre)` de listas de personas, ordenar con `ordenUsuarios` en
memoria. En `src/flujo/avisos.ts`, `CAMPOS_USUARIO` gana `apellido: users.apellido`.
Donde el nombre viaja al navegador (historial de versiones, comentarios), el
servidor manda ya resuelto el texto de `nombreVisible` en lugar de `nombre` suelto,
para no repetir la regla en el cliente.

- [ ] **Paso 3: los scripts**

`crear-usuario.mjs`: `validarArgumentos` acepta `[correo, contraseña, rol?, nombre?, apellido?]`
y los devuelve recortados (vacío → `null`). `sentenciaCrearUsuario` incluye
`nombre` y `apellido` como `$4` y `$5`, y en el `ON CONFLICT` los actualiza **solo
si se pasaron** (`nombre = COALESCE($4, users.nombre)`), para no borrar el nombre de
alguien al cambiarle la contraseña. Actualizar el uso que imprime el script.

`bootstrap-admin.mjs`: aceptar `ADMIN_NOMBRE` y `ADMIN_APELLIDO` opcionales y
guardarlos al crear el admin, con el mismo `COALESCE` al promover.

- [ ] **Paso 4: pruebas de los scripts**

Añadir a `tests/db/scripts-usuarios.test.ts`:

```ts
it('acepta nombre y apellido opcionales', () => {
  const r = validarArgumentos(['a@x.mx', 'x'.repeat(12), 'admin', ' Ana ', 'Pau']);
  expect(r).toMatchObject({ ok: true, nombre: 'Ana', apellido: 'Pau' });
});
it('sin nombre, no pisa el que ya tenía', () => {
  expect(sentenciaCrearUsuario(true)).toContain('COALESCE');
});
```

- [ ] **Paso 5: verificar y commit**

```bash
npx tsc --noEmit && npx vitest run && npx astro build
git add -A && git commit -m "feat(usuarios): mostrar nombre y apellido en toda la app"
```

---

### Tarea 9: verificación final

- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run` — todo en verde
- [ ] `npx astro build`
- [ ] `grep -rn "nombre ?? " src/` no devuelve nada de usuarios
- [ ] Repasar el diseño sección por sección y confirmar que cada punto está
