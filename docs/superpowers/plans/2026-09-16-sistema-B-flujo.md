# Sistema de trabajo · B · Etapas, autorización, avisos, edición y comentarios · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cada cliente tiene sus 4 etapas con estados, transiciones autorizadas por rol, historial, versiones y edición sobre el documento, comentarios anclados y avisos dentro del Studio y por correo.

**Architecture:** Un motor común (`src/flujo/`) sirve a los 4 tipos de etapa:
- Las reglas son funciones puras con pruebas: estados, pesos, transiciones, dependencias, aplicación de cambios y destinatarios de avisos.
- Los servicios de base de datos (`src/flujo/servicio.ts`) aplican esas reglas, insertan eventos y versiones, y notifican.
- Los renders marcan `data-editable` y `data-ancla`.
- Un script ES5 compartido (`src/render/editorial/flujo-cliente.ts`) activa los modos Editar y Comentar en las vistas.

**Tech Stack:** Astro 7 SSR, Drizzle + drizzle-kit, Postgres, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-sistema-trabajo-design.md` §3, §6, §7

**Depende de:** plan A completo (`locals.usuario`, `permisos.ts`, `visibilidad.ts`, `correo.ts`) y plan del Mapa de Pilares completo (render P6, cabecera editorial P5).

## Global Constraints

- **Git y despliegue:** rama `feat/rediseno`; nunca `git push` ni despliegue.
- **Entorno:** `node_modules` es un enlace (no `npm ci`/`install`); el `astro dev` del usuario en 4321 no se toca; no se imprime ni se edita `.env`.
- **Servicios externos:** nunca llamar a Anthropic ni a Resend reales.
- **Base de datos:** migraciones solo en la base local.
- **Código y commits:** comentarios en español; commits con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`; `npm test` y `npm run build` en verde por tarea.
- **Permisos:** sin permiso responde 404; una transición no permitida responde 409 con la razón en español.
- **Diseño:** tokens del Studio, sin `.a + .a {margin}`, 44 px, foco visible, claro y oscuro, datos de usuario escapados.
- **Constantes:**
  - Etapas: `investigacion | pilares | desarrollo_mensual | manual_campana`.
  - Estados: `no_iniciada | en_proceso | en_revision | con_cambios | aprobada`.
  - Acciones: `iniciar | solicitar | aprobar | pedir_cambios | reabrir`.
  - Pesos: 0 / 25 / 50 / 60 / 100.
  - Estado de un comentario: `abierto | atendido | descartado`.

---

### Task B1: Esquema y migración

**Files:** Modify `src/db/schema.ts`; Create `drizzle/0004_*.sql` (generado + datos); Test `tests/db/schema.test.ts`.

**Produces:**
- Enums: `etapaCliente`, `estadoEtapa`, `accionEtapa`, `motivoVersion` (`generado | edicion | aprobada | restaurada`) y `estadoComentario`.
- Tabla `clienteEtapas`:
  - Columnas: `id`, `clientId` (cascade), `etapa`, `contratada` (bool, default true), `interna` (bool, default false), `estado` (default `no_iniciada`), `documentoTipo` (documentoTipo nullable), `documentoId` (uuid nullable), `versionAprobadaId` (uuid nullable), `actualizadoEn`.
  - Único: (`clientId`, `etapa`).
- Tabla `etapaEventos`: `id`, `etapaId` (cascade), `accion` (text: una de las acciones, o `generado` o `comentario_cliente`), `de` (estadoEtapa nullable), `a` (estadoEtapa), `usuarioId` (set null), `comentario` (text), `creadoEn`.
- Tabla `documentoVersiones`:
  - Columnas: `id`, `documentoTipo`, `documentoId`, `numero` (int), `datos` (jsonb), `motivo`, `autorId` (set null), `creadoEn`.
  - Único: (`documentoTipo`, `documentoId`, `numero`).
- Tabla `comentarios`: `id`, `etapaId` (cascade), `documentoTipo`, `documentoId`, `versionNumero` (int), `ancla` (text), `texto` (text), `autorId` (set null), `autorRol` (usuarioRol), `estado` (default `abierto`), `respuestaDe` (uuid nullable), `resueltoPor` (set null), `resueltoEn`, `creadoEn`.
- Tabla `notificaciones`: `id`, `usuarioId` (cascade), `tipo` (text), `titulo`, `texto`, `enlace`, `leidaEn`, `creadoEn`.

- [ ] **Step 1:** Añadir las pruebas de existencia de tablas y enums (mismo estilo que el plan A).
- [ ] **Step 2:** Esquema en `schema.ts`, más `npx drizzle-kit generate --name flujo`. Si pide interacción, BLOCKED.
- [ ] **Step 3:** Añadir al final del SQL los datos para los clientes existentes:
```sql
-- Etapas de los clientes que ya existían: todas contratadas menos el desarrollo mensual, que aún no existe.
INSERT INTO "cliente_etapas" ("client_id","etapa","contratada","interna","estado")
SELECT c."id", e."etapa"::"etapa_cliente", e."etapa" <> 'desarrollo_mensual', false, 'no_iniciada'
FROM "clients" c CROSS JOIN (VALUES ('investigacion'),('pilares'),('desarrollo_mensual'),('manual_campana')) AS e("etapa")
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Si ya había un documento, la etapa arranca en proceso con el más reciente como vigente.
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='research', "documento_id"=r."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "research_results" ORDER BY "client_id","version" DESC) r
WHERE ce."client_id"=r."client_id" AND ce."etapa"='investigacion';--> statement-breakpoint
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='growth', "documento_id"=g."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "growth_results" ORDER BY "client_id","version" DESC) g
WHERE ce."client_id"=g."client_id" AND ce."etapa"='manual_campana';--> statement-breakpoint
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='pilares', "documento_id"=p."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "pilares_results" ORDER BY "client_id","version" DESC) p
WHERE ce."client_id"=p."client_id" AND ce."etapa"='pilares';
```
Aplicar en local y verificar: `select etapa, estado, count(*) from cliente_etapas group by 1,2`.
- [ ] **Step 4:** Tests y build en verde, más commit `feat(flujo): etapas por cliente, eventos, versiones, comentarios y avisos`.

---

### Task B2: Reglas del flujo (puras)

**Files:** Create `src/flujo/reglas.ts`; Test `tests/flujo/reglas.test.ts`.

**Produces:**
```ts
export const ETAPAS = ['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana'] as const;
export const ESTADOS = ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const;
export const PESOS: Record<Estado, number> = { no_iniciada: 0, en_proceso: 25, en_revision: 50, con_cambios: 60, aprobada: 100 };
export const NOMBRE_ETAPA: Record<Etapa, string>; // 'Investigación', 'Mapa de pilares', 'Desarrollo mensual', 'Manual de campaña'
export const ESTADO_CLIENTE: Record<Estado, string>; // 'Por iniciar', 'En preparación', 'En revisión', 'En preparación', 'Listo'
export const ETIQUETA_ESTADO_ETAPA: Record<Estado, string>; // interna: 'No iniciada', 'En proceso', 'En revisión', 'Con cambios', 'Aprobada'
export function tipoDocumentoDe(etapa: Etapa): 'research' | 'pilares' | 'growth' | null;
export function etapaDeTipo(tipo: 'research' | 'pilares' | 'growth'): Etapa;
export type EtapaCliente = { id: string; etapa: Etapa; contratada: boolean; interna: boolean; estado: Estado; documentoId: string | null };
export function avanceCliente(etapas: EtapaCliente[]): number;
export function etapasVisiblesCliente(etapas: EtapaCliente[]): EtapaCliente[]; // contratadas, no internas, en orden de ETAPAS
export function dependenciasCumplidas(etapa: Etapa, etapas: EtapaCliente[], hayInvestigacionConDatos: boolean): { ok: boolean; razon: string };
export function aplicarAccion(o: {
  etapa: EtapaCliente; accion: Accion; rol: 'admin' | 'operador' | 'cliente'; esOperadorAsignado: boolean;
  comentariosAbiertos: number; comentarioGeneral: string; dependencias: { ok: boolean; razon: string };
}): { ok: true; nuevo: Estado } | { ok: false; razon: string };
export function estadoTrasGenerar(actual: Estado): Estado; // no_iniciada→en_proceso; aprobada→con_cambios; resto igual
export function estadoTrasComentarioCliente(etapa: Etapa, actual: Estado): Estado; // manual_campana|desarrollo_mensual y aprobada → con_cambios; si no, igual
export function puedeComentar(rol, esOperadorAsignado: boolean, etapa: Etapa): boolean; // admin sí; operador asignado sí; cliente solo manual_campana/desarrollo_mensual
```

- [ ] **Step 1: Pruebas.** Cubrir como mínimo:
  - `avanceCliente`:
    - `[aprobada, en_revision, no_iniciada]` contratadas visibles da 50;
    - una interna o no contratada no cuenta;
    - una lista vacía da 0;
    - redondea.
  - `etapasVisiblesCliente`: respeta el orden de `ETAPAS` y excluye internas y no contratadas.
  - `dependenciasCumplidas`:
    - `investigacion` siempre ok;
    - `pilares` sin investigación con datos da no-ok con una razón que menciona «investigación»;
    - `pilares` con investigación contratada no aprobada da no-ok;
    - `pilares` con investigación interna y datos da ok;
    - `manual_campana` con pilares contratada no aprobada da no-ok;
    - `desarrollo_mensual` siempre no-ok con «Próximamente».
  - `aplicarAccion`, una prueba por fila de la tabla del spec §3:
    - `iniciar` exige `no_iniciada` y dependencias;
    - `solicitar` exige `en_proceso`/`con_cambios`, `documentoId` y `comentariosAbiertos = 0`, y la razón menciona los comentarios pendientes;
    - `aprobar` solo lo hace un admin desde `en_revision`;
    - `pedir_cambios` solo lo hace un admin, con abiertos > 0 o comentario general no vacío;
    - `reabrir` solo lo hace un admin desde `aprobada`, con comentario;
    - un operador no asignado siempre recibe no-ok;
    - un cliente siempre recibe no-ok.
  - `estadoTrasGenerar`, `estadoTrasComentarioCliente`, `puedeComentar`: todos los casos.
- [ ] **Step 2: Implementar** siguiendo la tabla del spec, con razones en español:
  - «Primero hay que resolver los comentarios pendientes»
  - «Solo un administrador puede aprobar»
  - «Esta etapa aún no tiene documento»
  - «Deja al menos un comentario con los cambios»
  - «No tienes este cliente asignado»
- [ ] **Step 3:** Verde y commit `feat(flujo): reglas de etapas, avance y transiciones`.

---

### Task B3: Servicio de etapas, contratación y enganche con los pipelines

**Files:**
- Create: `src/flujo/servicio.ts`, `src/pages/api/etapas/[id]/transicion.ts`, `src/pages/api/clientes/[id]/etapas.ts`
- Modify: `src/research/pipeline.ts`, `src/growth/pipeline.ts`, `src/pilares/pipeline.ts` (llamar a `registrarEntregable` tras insertar el resultado), `src/pages/api/clientes/index.ts` (crear etapas al dar de alta)
- Test: `tests/flujo/contratacion.test.ts` (pura)

**Produces:**
- `planContratacion(seleccion: Etapa[]): { etapa: Etapa; contratada: boolean; interna: boolean }[]`. Es pura: devuelve las 4 etapas; si `pilares` o `manual_campana` están seleccionadas y `investigacion` no, la investigación queda `contratada: false, interna: true`.
- `etapasDelCliente(clientId): Promise<(EtapaCliente & { versionAprobadaId, actualizadoEn, documentoTipo })[]>`. Crea las filas si faltan.
- `registrarEntregable(clientId, tipo, documentoId, usuarioId | null)`:
  1. Pone el documento como vigente.
  2. Calcula `estadoTrasGenerar`.
  3. Guarda una versión `generado`.
  4. Inserta el evento `generado`.
  5. Notifica al autor. En B3 el aviso es un no-op seguro; B4 conecta `notificar`.
- `ejecutarTransicion({ etapaId, accion, usuario, comentario })`:
  1. Carga la etapa y el cliente, verifica visibilidad y cuenta los comentarios abiertos de la versión vigente.
  2. Aplica `aplicarAccion` y actualiza.
  3. Si aprueba, guarda una versión `aprobada` y enlaza `versionAprobadaId`.
  4. Si hay comentario general en `pedir_cambios` o `reabrir`, crea el comentario con `ancla: 'general'`.
  5. Inserta el evento y devuelve `{ ok, etapa } | { ok: false, status, razon }`.
- `guardarVersion(tipo, documentoId, datos, motivo, autorId)`: el número es el máximo + 1.
- API:
  - `POST /api/etapas/[id]/transicion` `{accion, comentario?}`, con 409 y la razón si no se permite.
  - `PUT /api/clientes/[id]/etapas` `{ etapas: Etapa[] }`: solo quien opera al cliente; aplica `planContratacion`.
- Alta de cliente: el `POST` crea las etapas con la selección recibida en `etapas` (por omisión, las 3 existentes).
- Pipelines: tras insertar el resultado, `await registrarEntregable(job.clientId, tipo, resultado.id, job.creadoPor)` dentro de `try/catch`, que registra el error sin fallar el job. Usar `.returning({ id })` en el insert.

- [ ] Pruebas puras de `planContratacion`, implementación, verificación por curl con usuarios locales (transición no permitida → 409; iniciar → 200) y commit `feat(flujo): transiciones, contratación y registro de entregables`.

---

### Task B4: Avisos y pendientes

**Files:**
- Create: `src/flujo/avisos.ts`, `src/pages/api/notificaciones/index.ts`, `src/pages/api/notificaciones/leer.ts`, `src/pages/pendientes.astro`, `src/components/Campana.tsx`
- Modify: `src/flujo/servicio.ts` (notificar), `src/layouts/Base.astro` (campana y «Pendientes»), `src/research/worker.ts` (job fallido), `src/pages/api/clientes/[id]/operador.ts` (reasignación)
- Test: `tests/flujo/avisos.test.ts`

**Produces:**
- `destinatarios(evento, ctx: { admins: Usuario[]; operador: Usuario | null; autor: Usuario | null; usuariosCliente: Usuario[]; etapaVisibleCliente: boolean }): Usuario[]`. Es pura, sigue la tabla del spec §3 «Avisos», sin duplicados y solo con usuarios activos.
- `textoAviso(evento, datos: { cliente: string; etapa: string; autor?: string }): { titulo; texto }`. Pura, en español. Por ejemplo: «Ana Villa · Mapa de pilares espera tu autorización».
- `notificar(evento, ctx, enlace)`: inserta en `notificaciones` y envía con `enviarCorreo` sin esperar ni fallar.
- API:
  - `GET /api/notificaciones`: `{ noLeidas, items: últimas 20 }`.
  - `POST /api/notificaciones/leer` `{ ids?: string[] }`: sin ids marca todas.
- `Campana.tsx` (isla con `client:load`):
  - Botón con contador y panel desplegable.
  - Consulta al abrir y cada 60 s.
  - Cada aviso enlaza a su `enlace`.
  - Accesible: `aria-expanded` y cierre con Escape.
- `/pendientes`:
  - **Admin:** tabla de etapas `en_revision` de todos (cliente, etapa, desde cuándo, operador), con enlace al documento.
  - **Operador:** sus etapas `con_cambios` (con conteo de comentarios abiertos), `en_proceso` y comentarios abiertos recientes.
- En `Base`: la campana en la barra superior y «Pendientes» en la navegación con contador (conteo en el servidor).

- [ ] Pruebas puras de `destinatarios` y `textoAviso`, implementación, verificación por curl (una transición `solicitar` crea una notificación para el admin local) y commit `feat(flujo): avisos en el Studio y por correo, y bandeja de pendientes`.

---

### Task B5: Línea de etapas en la ficha y contratación

**Files:**
- Modify: `src/pages/clientes/[id].astro`, `src/pages/clientes/nuevo.astro`
- Create: `src/components/LineaEtapas.astro`, `src/scripts/etapas.ts`

**Requisitos:**
- En la ficha, las tarjetas de acción se sustituyen por `LineaEtapas`: 4 tarjetas en fila (2 en tableta, 1 en celular), en el orden de `ETAPAS`. Cada una muestra:
  - Número, `NOMBRE_ETAPA`, chip de estado (`ETIQUETA_ESTADO_ETAPA` con color: gris, azul, amarillo, rosa, verde) y la marca «Interna» o «No contratada».
  - Fecha de actualización y conteo de comentarios abiertos.
  - Botones según rol y estado, calculados en el servidor con `aplicarAccion` en modo prueba (solo se muestra lo permitido):

| Botón | Qué hace |
|---|---|
| **Generar** | Enlace a `/clientes/{id}/investigar`, `/clientes/{id}/pilares` o genera Growth como hoy; solo si las dependencias se cumplen |
| **Iniciar** | `POST` de la transición |
| **Ver documento** | Enlace a la vista interna del documento vigente |
| **Solicitar autorización** | `POST`; si hay comentarios abiertos, aparece deshabilitado con la razón |
| **Aprobar** | `POST` con confirmación en `dialog` |
| **Pedir cambios** / **Reabrir** | `dialog` con textarea de comentario general y `POST` |

  - `desarrollo_mensual`: tarjeta «Próximamente» sin botones.
- **Contratación:** bloque «Etapas contratadas» en la ficha, con casillas y guardado por `PUT`, visible para quien opera al cliente. En la alta, las mismas casillas; `pilares` y `manual_campana` vienen marcadas por omisión junto con `investigacion`.
- **Historial:** la pestaña gana los eventos de etapa (acción, de → a, usuario, comentario y fecha) mezclados con los jobs en orden de fecha.
- Toasts para éxito y error; recarga suave de la línea tras cada acción.

- [ ] Implementación, verificación por curl de cada botón visible por rol (el admin ve «Aprobar» en `en_revision`; el operador no) y commit `feat(flujo): línea de etapas y contratación en la ficha`.

---

### Task B6: Versiones y edición sobre el documento

**Files:**
- Create: `src/flujo/edicion.ts`, `src/pages/api/documentos/[tipo]/[id].ts` (PATCH), `src/pages/api/documentos/[tipo]/[id]/versiones.ts` (GET y POST restaurar), `src/render/editorial/flujo-cliente.ts`
- Modify:
  - render de investigación: `src/render/investigacion/lectura.ts`, `detalle.ts`, `documento.ts`;
  - render de pilares: `src/render/pilares/*`;
  - render de Growth: `src/render/growth/secciones/*.ts`, `src/render/growth/manual.ts`;
  - cabecera editorial: `src/render/editorial/cabecera.ts`, botones Editar, Comentar y Versiones en el panel;
  - `src/render/barra-operador.ts`: los mismos botones para Growth.
- Test: `tests/flujo/edicion.test.ts`, `tests/render/editable.test.ts`

**Produces:**
- `aplicarCambios(datos: unknown, cambios: { ruta: string; valor: string }[]): { ok: true; datos: unknown } | { ok: false; errores: string[] }`. Es pura:
  - no muta la entrada;
  - la ruta usa puntos y los índices numéricos son válidos en arreglos;
  - se rechazan los segmentos `__proto__`, `constructor` y `prototype`, las rutas inexistentes, los destinos que no sean string, los valores que no sean string o que pasen de 2000 caracteres, y más de 200 cambios.
- `validarDocumento(tipo, datos)`:
  - `research`: `investigacionSchema`;
  - `pilares`: `estrategiaSchema` sobre `datos.estrategia` y `temaGeneradoSchema` sobre cada tema;
  - `growth`: `growthSchema.partial().passthrough()`.

  Devuelve `{ ok } | { ok: false; errores }`.
- `puedeEditar(rol, esOperadorAsignado, estado)`: admin siempre; operador asignado si el estado no es `en_revision`; cliente nunca.
- API:
  - `PATCH /api/documentos/[tipo]/[id]` `{ cambios }`:
    1. `documentoVisible` + operable + `puedeEditar` con la etapa del documento. Si el documento no es el vigente de su etapa, lo permite igual.
    2. `aplicarCambios` y `validarDocumento`.
    3. `guardarVersion(..., datosAnteriores, 'edicion')` y actualiza `datos`.
    4. Responde `{ ok, version }`.
  - `GET .../versiones`: lista `numero, motivo, autor, creadoEn`, sin datos.
  - `POST .../versiones` `{ numero }`: restaura. Guarda los actuales como `restaurada`, reemplaza por los de esa versión y valida.
- **Marcado en los renders:**
  - Añadir `data-editable="<ruta>"` en cada elemento cuyo contenido de texto sale exactamente de un string de `datos`, sin prefijos ni sufijos dentro del mismo nodo. Si hace falta, envolver el valor en un `<span data-editable>`.
  - Rutas, relativas a `datos`:
    - investigación: `lectura.datos.portada.titular`, `lectura.datos.descubrimos.0.resumen`, `competencia.datos.directos.0.nombre`, …;
    - pilares: `estrategia.ideas.0.titulo`, `pilares.1.subcategorias.0.temas.4.texto`, …;
    - Growth: según su esquema.
  - Solo en la vista interna: la función render recibe `{ editable: true }`. La vista pública y el portal no llevan `data-editable`.
  - Las rutas se escapan como atributo.
- **`SCRIPT_FLUJO`** (ES5), inyectado en la vista interna junto con `data-flujo='{"tipo","id","etapaId","puedeEditar","puedeComentar"}'` en `<body>`. El modo Editar:
  - pone `contenteditable="plaintext-only"` a los `[data-editable]`, con contorno;
  - una barra fija abajo muestra «N cambios · Guardar · Descartar»;
  - Guardar hace `PATCH` y recarga; un error lo avisa en la barra;
  - Escape sale del modo, preguntando si hay cambios.

  El panel «Versiones» es un `dialog` con la lista y «Restaurar» con confirmación.

- [ ] **Pruebas:**
  - `aplicarCambios`: ruta válida, índice, inexistente, no string, `__proto__`, largo, sin mutación.
  - `validarDocumento` con los fixtures.
  - `puedeEditar`.
  - Render interno con `data-editable` en el titular de la lectura, un tema del mapa y un título de Growth, y la vista pública sin ellos.
  - Script válido con `new Function`.
- [ ] Verificación por curl: `PATCH` de un cambio válido → 200 y la versión incrementa; cambio inválido → 400; operador con etapa `en_revision` → 409 o 403.
- [ ] Commit `feat(flujo): edición sobre el documento con versiones`.

---

### Task B7: Comentarios anclados

**Files:**
- Create: `src/flujo/comentarios.ts`, `src/pages/api/comentarios/index.ts` (GET y POST), `src/pages/api/comentarios/[id].ts` (PATCH), `src/pages/api/comentarios/[id]/respuestas.ts` (POST)
- Modify: los renders (`data-ancla`), `src/render/editorial/flujo-cliente.ts` (modo Comentar y panel), `src/flujo/servicio.ts` (el comentario del cliente cambia el estado y avisa)
- Test: `tests/flujo/comentarios.test.ts`

**Produces:**
- `validarComentario({ texto, ancla })`: texto de 1 a 2000 caracteres después de `trim`; ancla de 1 a 200 caracteres con `^[\w:.\-]+$`.
- `puedeCambiarEstadoComentario(rol, esOperadorAsignado, nuevo)`: `atendido` lo marca el operador asignado o un admin; `descartado`, solo un admin; `abierto` (reabrir), solo un admin.
- `comentariosVisibles(rol, usuarioId, lista)`: el cliente solo ve los propios y sus respuestas.
- **Anclas en el render** (interno y portal):
  - secciones: `data-ancla="seccion:<id>"`;
  - tarjetas: la ruta del objeto (`lectura.datos.descubrimos.2`);
  - temas: `tema:P2-S1-07`.
- **API:**
  - `GET /api/comentarios?etapa=`: visibilidad por rol.
  - `POST /api/comentarios` `{ etapaId, ancla, texto }`:
    - el documento y la versión vienen de la etapa: vigente para usuarios internos, aprobada para el cliente;
    - `puedeComentar`;
    - para el cliente, la etapa debe tener versión aprobada y ser la suya;
    - si es cliente, aplica `estadoTrasComentarioCliente`, inserta el evento `comentario_cliente` y avisa.
  - `PATCH /api/comentarios/[id]` `{ estado }`.
  - `POST .../respuestas` `{ texto }`.
- **Modo Comentar en `SCRIPT_FLUJO`:**
  - al pasar sobre `[data-ancla]` se resalta, y un clic abre un recuadro con textarea y Enviar;
  - un marcador con número queda sobre los elementos con comentarios abiertos;
  - panel lateral (`dialog` o `aside`) con filtro Abiertos / Atendidos / Todos;
  - cada comentario muestra autor, rol, fecha, texto, «Ir», «Responder», «Marcar atendido» y «Descartar», según permisos;
  - los comentarios con ancla `general` salen arriba.

- [ ] Pruebas puras, verificación por curl (el cliente comenta un manual aprobado → la etapa pasa a `con_cambios` y el operador recibe un aviso; el operador marca atendido; `solicitar` ya se permite) y commit `feat(flujo): comentarios anclados y observaciones del cliente`.
