# Nombre, apellido y correo de cada usuario · Diseño

**Fecha:** 2026-09-15
**Estado:** aprobado en conversación
**Alcance:** que cada usuario del Studio tenga nombre, apellido y correo, editables desde la app, y que las pantallas muestren personas en lugar de correos.

---

## 1. El problema

`users` tiene un solo campo `nombre`, nulo, que se llena únicamente al aceptar una
invitación. Los usuarios creados con `scripts/crear-usuario.mjs` o
`bootstrap-admin.mjs` —incluido el admin de producción— lo tienen vacío, así que
toda la app los muestra por correo (`u.nombre ?? u.email`). No hay ninguna pantalla
donde corregirlo.

## 2. Decisiones

| Tema | Decisión |
|---|---|
| Campos | `nombre` y `apellido`, dos columnas separadas, ambas nulas |
| Quién edita nombre y apellido | El admin, a cualquiera; cada quien, el suyo |
| Quién edita el correo | Solo el admin, a cualquiera (incluido él mismo) |
| Dónde se edita | Ficha del usuario en `/admin/usuarios`; `/perfil` para uno mismo |
| Al invitar | La forma de aceptación pide nombre **y** apellido, los dos obligatorios |
| Al mostrar | `nombre apellido`, y el correo como respaldo mientras estén vacíos |
| Orden de las listas | Apellido, luego nombre; los que no tengan, al final por correo |

## 3. Datos

Migración `0006_usuarios_apellido.sql`:

```sql
ALTER TABLE "users" ADD COLUMN "apellido" text;
```

Nada más: no hay relleno automático ni valores por omisión. `nombre` sigue nulo,
y una fila con ambos vacíos es válida (es el estado de los usuarios de hoy).

`UsuarioSesion` (`src/lib/permisos.ts`) gana `apellido: string | null`, y
`cargarSesion` en `src/lib/auth.ts` lo selecciona.

## 4. Reglas (`src/lib/usuarios.ts`, puras)

### `nombreVisible(u): string`

Recibe `{ nombre, apellido, email }`. Devuelve `"Ana Pau"` si hay algo; si los dos
están vacíos, el correo. Junta con un espacio y descarta espacios sobrantes, de modo
que alguien con solo nombre sale como `"Ana"`.

### `ordenUsuarios(a, b): number`

Compara por apellido, luego nombre, con `localeCompare` en `es` e
`{ sensitivity: 'base' }` (así «Álvarez» no se va al final). Quien no tenga ni
nombre ni apellido va al final, ordenado por correo. Las páginas ordenan en
memoria con esta función; las consultas ya traen la lista completa.

### `validarDatosUsuario(actor, objetivoId, datos)`

`datos` es `{ nombre?: string | null; apellido?: string | null; email?: string }`.

- Nombre y apellido: se recortan; vacío cuenta como `null`; máximo 60 caracteres
  cada uno. Más largo → `nombre-largo` / `apellido-largo`.
- Correo: se recorta y se pasa a minúsculas; 200 caracteres como máximo y debe
  tener la forma `algo@algo.algo`. Si no → `correo-invalido`.
- Un actor que no es admin solo se edita a sí mismo → si no, `solo-admin`.
- Un actor que no es admin nunca cambia un correo → `solo-admin-correo`.
- Sin ningún campo → `sin-cambios`.

Devuelve `{ ok: true, datos }` con los valores ya normalizados, o
`{ ok: false, error }`. Es pura: la unicidad del correo la decide la base.

## 5. API

### `PATCH /api/admin/usuarios/[id]` (ya existe, se extiende)

Además de `rol` y `activo`, acepta `nombre`, `apellido` y `email`. Los datos pasan
por `validarDatosUsuario` y el rol/activo por `validarCambioUsuario`, como hoy;
un cuerpo puede traer de los dos grupos y se aplican en una sola escritura.

Si el correo ya es de otra cuenta, la restricción única lo rechaza y la respuesta es
`409 { ok: false, error: 'correo-ocupado' }`. No se detecta con un `SELECT` previo:
se captura el error de Postgres, que es la única comprobación libre de carreras.

Cambiar el correo **no** cierra sesiones: la sesión va por `user_id` y la persona
sigue dentro. A partir de ese momento inicia sesión con el correo nuevo, y la
pantalla lo advierte antes de guardar.

### `PATCH /api/perfil` (nueva)

Acepta `nombre` y `apellido` del usuario de la sesión; ignora cualquier `id` o
`email` del cuerpo. Sirve a los tres roles, así que `/api/perfil` se agrega a
`RUTAS_CLIENTE` en `rutaPermitida`. Responde
`{ ok, usuario: { nombre, apellido, email } }`.

## 6. Pantallas

### `/admin/usuarios`

Cada renglón, de equipo y de clientes, gana un botón **Editar** que abre un diálogo
con Nombre, Apellido y Correo. Debajo del correo, una nota: «Con este correo inicia
sesión. Si lo cambias, avísale.» Guarda con el `PATCH` de arriba y actualiza el
renglón sin recargar. Los errores se traducen igual que los de rol y activo:
`correo-ocupado` → «Ese correo ya es de otra cuenta.»

Las dos listas se ordenan con `ordenUsuarios` y el renglón muestra
`nombreVisible(u)` en el título y el correo debajo, como hoy.

### `/perfil` (nueva)

Una tarjeta con Nombre, Apellido y el correo de solo lectura. Accesible a los tres
roles; usa `Base.astro` para equipo y admin, y el diseño del portal no cambia
—el cliente llega por el mismo enlace del encabezado.

En `Base.astro`, el nombre del encabezado pasa a ser un enlace a `/perfil` y muestra
`nombreVisible(usuario)`.

### `/invitacion/[token]`

Se parte el campo «Nombre» en **Nombre** y **Apellido**, los dos obligatorios.
`validarAceptacion` exige ambos y `POST /api/invitacion/aceptar` los guarda.

### Resto de la app

Donde hoy se lee `u.nombre ?? u.email` se usa `nombreVisible`, y las consultas
traen `apellido` además de `nombre`: `desempeno.astro`, `pendientes.astro`,
`clientes/index.astro`, `clientes/[id].astro`, el historial de versiones
(`api/documentos/[tipo]/[id]/versiones.ts`), `flujo/servicio.ts` y
`flujo/avisos.ts`.

## 7. Scripts

`crear-usuario.mjs` y `bootstrap-admin.mjs` aceptan nombre y apellido opcionales
al final (`node scripts/crear-usuario.mjs correo contraseña rol "Ana" "Pau"`). Sin
ellos se comportan igual que hoy.

## 8. Qué no incluye

- No se cambian contraseñas desde la ficha: eso sigue siendo cosa de la invitación.
- No se avisa por correo del cambio de correo; la pantalla le dice al admin que lo
  comunique.
- No hay foto ni apodo.
