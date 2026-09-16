# Etapa 3 · Desarrollo mensual · Plan

> **Para agentes:** ejecutar con superpowers:subagent-driven-development, tarea por tarea.

**Diseño:** `docs/superpowers/specs/2026-09-16-desarrollo-mensual-design.md` — léelo entero antes de empezar tu tarea.

**Entorno:** el proyecto vive en `/Volumes/TWF/Proyectos 2026/Wozial Studio`. Nunca `npm install`. `npx tsc --noEmit` está roto (unos `.d.cts` de `@jridgewell`): verificar con `npx vitest run` y `npx astro build`. Todo el código y los comentarios en español.

**Tamaño:** se hace en tres fases. Cada fase deja el sistema funcionando y desplegable.

---

# FASE A · Cimientos (datos, reglas y flujo)

Al terminar esta fase la etapa 3 existe en la base y en el flujo, pero todavía no tiene pantallas. Nada visible cambia para el usuario salvo que la etapa deja de decir «Próximamente».

### Tarea A1: tablas de lotes y piezas

**Archivos:** `src/db/schema.ts`, migración nueva en `drizzle/`, prueba en `tests/db/migraciones.test.ts`.

- [ ] **Paso 1:** añadir al esquema:
  - `contenido_lotes`: `id` uuid pk, `client_id` → clients (cascade), `periodo` text (`YYYY-MM`), `estado` (reusar el enum de estados de etapa si encaja; si no, uno propio), `compartido_en` timestamptz null, `limite_revision` timestamptz null, `creado_por` → users (set null), `creado_en`, `actualizado_en`. **Único** (`client_id`, `periodo`).
  - `contenido_piezas`: `id` uuid pk, `lote_id` → contenido_lotes (cascade), `numero` int, `formato` enum (`post|carrusel|reel|historia`), `plataforma` enum (`facebook|instagram|ambas`), `fecha_publicacion` date null, `tema_id` text null (el id `P{n}-S{m}-{nn}` del mapa), `copy` text, `cta` text, `hashtags` text, `arte` jsonb (lista de archivos/enlaces), `estado_cliente` enum (`pendiente|aprobada|cambios`), `nota_cliente` text null, `revisado_en` timestamptz null, `creado_en`, `actualizado_en`. **Único** (`lote_id`, `numero`).
  - En `clients`: `paquete` jsonb null (cuántas piezas por formato) y `dias_revision` int null (por omisión 2).
- [ ] **Paso 2:** generar la migración con `npx drizzle-kit generate --name desarrollo_mensual` (añadir primero al esquema y dejar que la genere por diferencia, como se hizo con `0006`). Comprobar que el journal y el snapshot quedan encadenados.
- [ ] **Paso 3:** prueba en `tests/db/migraciones.test.ts` siguiendo el patrón de los bloques `0005`/`0006`.
- [ ] **Paso 4:** `npx vitest run`; commit `feat(mensual): tablas de lotes y piezas`.

### Tarea A2: reglas puras del lote

**Archivos:** `src/contenido/reglas.ts` (nuevo), prueba `tests/contenido/reglas.test.ts`.

Todo puro, sin base de datos. Con TDD.

- [ ] `limiteRevision(compartidoEn, diasHabiles)` — suma días hábiles saltando sábados y domingos. Pruebas: viernes + 2 → martes; sábado + 1 → lunes; un día exacto a medianoche.
- [ ] `loteAutoAprobado(lote, ahora)` — true si está compartido, no aprobado y `ahora > limiteRevision`.
- [ ] `avanceRevision(piezas)` — `{ aprobadas, total, porcentaje }`.
- [ ] `cuadraConPaquete(piezas, paquete)` — devuelve las diferencias por formato (`{ formato, esperadas, hay, faltan }[]`), vacío si cuadra. **Avisa, no bloquea.**
- [ ] `estadoLoteSegunPiezas(piezas)` — `pendiente` si alguna lo está, `cambios` si alguna pidió cambios, `aprobada` si todas.
- [ ] `periodoValido(texto)` — `YYYY-MM` con mes 01–12.
- [ ] Commit `feat(mensual): reglas del lote y la revisión`.

### Tarea A3: el lote activo y el flujo

**Archivos:** `src/contenido/servicio.ts` (nuevo), `src/flujo/reglas.ts`, `src/lib/precheck.ts` si aplica, pruebas.

- [ ] **Paso 1:** `loteActivo(clientId)` — el más reciente sin aprobar; si todos están aprobados, el último; `null` si no hay ninguno.
- [ ] **Paso 2:** `sincronizarEtapa(clientId)` — pone la fila de `cliente_etapas` de `desarrollo_mensual` en el estado que refleja el lote activo. Se llama al crear, compartir, aprobar o pedir cambios en un lote.
- [ ] **Paso 3:** en `src/flujo/reglas.ts`, quitar el bloqueo «Próximamente» de `dependenciasCumplidas` para `desarrollo_mensual` (queda solo el requisito de investigación con datos, como las demás) y **quitar la exclusión de `desarrollo_mensual` en `etapasParaAvance`**.
- [ ] **Paso 4 (importante):** ese último cambio **modifica el porcentaje de avance de todos los clientes que tengan la etapa contratada**. Buscar todas las pruebas que dependan del porcentaje (`grep -rn "avanceCliente\|resumenAvance\|porcentaje" tests/`) y actualizarlas. Reportar el efecto.
- [ ] **Paso 5:** `npx vitest run`, `npx astro build`; commit `feat(mensual): la etapa 3 entra al flujo`.

---

# FASE B · Trabajo interno (armar el lote)

### Tarea B1: API de lotes y piezas

**Archivos:** `src/pages/api/contenido/...`, pruebas.

- [ ] `POST /api/contenido/lotes` `{ clientId, periodo }` — crea el lote del mes, hereda el paquete del cliente. 409 si ya existe ese periodo.
- [ ] `PATCH|DELETE /api/contenido/piezas/[id]` y `POST /api/contenido/lotes/[id]/piezas` — alta, edición y borrado de piezas.
- [ ] Permisos con `puedeOperarCliente`; un usuario cliente **no** entra aquí.
- [ ] Pruebas con el patrón de `tests/api/usuarios-datos.test.ts` (sin `DATABASE_URL`, simulando `@/db`).
- [ ] Commit `feat(mensual): API de lotes y piezas`.

### Tarea B2: propuestas de copy con el agente

**Archivos:** `src/contenido/agentes.ts`, `src/contenido/schemas.ts`, `POST /api/contenido/piezas/[id]/propuestas`, pruebas.

- [ ] Esquema Zod: 3 opciones, cada una con `gancho ≤ 120`, `copy ≤ 2200`, `cta ≤ 120`, `hashtags` 5–10, `briefVisual ≤ 400`.
- [ ] El agente recibe: contexto del cliente, el tema del mapa (texto, función y formato) y el formato de la pieza. Reusar `armarContexto` y el freno de costo del resto del sistema.
- [ ] **Una pieza por petición.** Tope de gasto propio.
- [ ] Pruebas de esquema y del recorte de costo, sin llamar al modelo de verdad.
- [ ] Commit `feat(mensual): propuestas de copy desde un tema`.

### Tarea B3: pantalla para armar el lote

**Archivos:** `src/pages/clientes/[id]/contenido/[periodo].astro` y sus scripts.

- [ ] Lista de piezas, alta y edición, subida de artes con el sistema de archivos existente, elección de tema del mapa y botón de propuestas.
- [ ] Aviso de cuadre con el paquete (`cuadraConPaquete`), visible pero no bloqueante.
- [ ] Línea del Studio; verificar a 1280 y 375, día y noche.
- [ ] Commit `feat(mensual): armar el lote del mes`.

---

# FASE C · El entregable y la revisión del cliente

### Tarea C1: render del entregable

**Archivos:** `src/render/contenido/*`, siguiendo la estructura de `src/render/pilares/*`.

- [ ] Portada con cifras, plazo y cuenta regresiva; `01` vista del feed (cuadrícula automática, 3 columnas, por fecha); `02` calendario del mes; `03` contenido de feed; `04` historias.
- [ ] Autocontenido, con el CSS en línea y el logo incrustado, como los otros entregables.
- [ ] Commit `feat(mensual): el entregable del mes`.

### Tarea C2: revisión pieza por pieza en el portal

**Archivos:** portal, `POST /api/contenido/piezas/[id]/revision`, avisos.

- [ ] Aprobar / Solicitar cambios con nota, por pieza, **guardado en el servidor**.
- [ ] Solicitar cambios crea un comentario anclado y avisa al operador.
- [ ] El lote pasa a aprobado cuando todas las piezas lo están.
- [ ] Commit `feat(mensual): el cliente revisa pieza por pieza`.

### Tarea C3: auto‑aprobación

- [ ] Al vencer el plazo, el lote se da por aprobado. Decidir **dónde corre**: lo natural es el worker, que ya hace `tick()`. Cuidado: el worker solo arranca con la primera visita al sitio (ver memoria del proyecto), así que un lote podría no auto‑aprobarse si nadie entra. Proponer solución y dejarla escrita.
- [ ] Pruebas de la regla y del efecto.
- [ ] Commit `feat(mensual): auto-aprobación al vencer el plazo`.

### Tarea C4: verificación final

- [ ] `npx vitest run`, `npx astro build`
- [ ] Repasar el diseño sección por sección
- [ ] Revisión de código antes de publicar
