# Sistema de trabajo por cliente · Diseño

**Fecha:** 2026-09-16
**Estado:** decisiones tomadas con el usuario en conversación. Él autorizó continuar sin detenerse; queda pendiente su revisión escrita.
**Alcance:** sub-proyectos **A** (usuarios, roles, asignación), **B** (etapas, autorización, comentarios anclados, edición sobre el documento, versiones, avisos), **C** (portal del cliente) y **D** (tablero de desempeño).
**Fuera de alcance:** **E** (etapa 3, *Desarrollo mensual*). Tendrá su propio spec a partir del entregable base `Wozial/Info cliente/OLAM_Contenido_Septiembre_Entregable…html`: feed del mes, plan, piezas post/carrusel/reel e historias. Aquí solo existe como etapa «Próximamente».

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Etapas por cliente | 1 Investigación · 2 Mapa de pilares · 3 Desarrollo mensual · 4 Manual de campaña. Un cliente contrata todas o solo algunas |
| Roles | **Admin** (crea, modifica, autoriza, asigna) · **Operador** (crea, modifica, solicita autorización) · **Cliente** (ve sus reportes y su % de avance; comenta solo en etapas 3 y 4) |
| Alta de clientes | El operador que crea un cliente queda asignado; el Admin reasigna |
| Gasto de API | El operador genera sin pedir permiso, con el tope por trabajo; lo que se autoriza es el entregable |
| Acceso del cliente | Usuarios propios, varios por cliente, con correo y contraseña; se invitan |
| % de avance | Promedio de las etapas contratadas visibles, con peso por estado |
| Edición | Sobre el mismo documento, con versiones e historial |
| Observaciones | Comentarios anclados a partes del documento; se atienden uno por uno |
| Avisos | Dentro del Studio y por correo. El correo queda listo pero apagado hasta configurar Resend |
| Desempeño | Tiempos, calidad, carga y avance, y costo |
| Dependencias | Si la etapa contratada necesita la investigación y esta no se contrató, se hace como etapa **interna** |
| Usuarios existentes | El más antiguo pasa a Admin; los demás, a Operador. Los clientes existentes se asignan a ese Admin |

---

## 2. A · Usuarios, roles y asignación

### Datos

- `users` gana:
  - `rol` (`admin | operador | cliente`, por omisión `operador`);
  - `nombre` (texto, opcional);
  - `client_id` (→ clients, `cascade`), obligatorio si `rol = cliente` y nulo si no;
  - `activo` (booleano, por omisión `true`).
- `clients` gana `operador_id` (→ users, `set null`).
- `research_jobs` gana `creado_por` (→ users, `set null`) para atribuir costo.
- Tabla `invitaciones`:
  - `id`, `token_hash` (sha256 del token), `email`, `rol`, `client_id` nullable, `creado_por`, `expira_en` (7 días), `usada_en` nullable y `creado_en`.
- **Migración de datos:** el usuario con `created_at` más antiguo queda `admin` y los demás `operador`. Todos los clientes quedan con `operador_id` = ese admin.

### Sesión y acceso

- `validarSesion` devuelve el usuario completo (`id, email, nombre, rol, clientId, activo`). El middleware lo pone en `locals.usuario`, conserva `locals.userId` y rechaza usuarios inactivos: cierra la sesión y manda a `/login`.
- Tras iniciar sesión, un `cliente` va a `/portal`; los demás, a `/`.
- **Reglas de ruta** (función pura `rutaPermitida(rol, ruta)`):

| Rol | Rutas permitidas |
|---|---|
| `cliente` | `/portal`, `/portal/*`, `/api/portal/*`, `/api/comentarios*` (validado por etapa), `/api/notificaciones*`, `/api/logout`, `/p/*` |
| `operador` | Todo menos `/admin/*` y `/api/admin/*` |
| `admin` | Todo |

- **Visibilidad de clientes** (funciones puras en `src/lib/permisos.ts`):
  - `puedeVerCliente(u, cliente)`: admin siempre; operador si `cliente.operadorId === u.id`; cliente si `u.clientId === cliente.id`.
  - `filtroClientes(u)` da la condición de consulta: admin sin filtro; operador `operador_id = u.id`.
- **Toda consulta o endpoint** que toque clientes o sus documentos aplica la visibilidad; si no hay permiso responde 404, sin distinguirlo de «no existe». Esto incluye:
  - tablero, lista de clientes, ficha, alta, investigar y pilares;
  - `/jobs/[id]`, `/resultados/[id]`, `/growth/[id]` y `/pilares/[id]`;
  - entregables y `GET /api/clientes`;
  - las API de clientes, enlaces, archivos, jobs, share y pilares.

### Pantallas

- **`/admin/usuarios`** (admin):
  - Tabla de usuarios internos y de clientes: nombre, correo, rol, cliente, activo y último acceso.
  - «Invitar» con correo, rol (admin u operador) o cliente, más la selección de cliente.
  - Cambiar rol (solo entre admin y operador) y desactivar o reactivar. No se puede desactivar a uno mismo ni al último admin activo.
- **Ficha del cliente:**
  - Bloque «Responsable», donde el admin elige el operador en un select y el operador solo lo ve.
  - Bloque «Usuarios del cliente» (admin y operador asignado), con lista e «Invitar usuario del cliente».
- **Lista de clientes y tablero:** el admin ve todos, con filtro por operador; el operador ve solo los suyos.
- **Navegación:** «Usuarios» y «Desempeño» en la barra lateral según el rol.
- **Invitación `/invitacion/[token]`** (pública): nombre y contraseña (mínimo 12 caracteres, confirmación). Al enviar se crea o actualiza el usuario, se marca la invitación como usada y se inicia sesión. Si el token venció o ya se usó, un mensaje claro. Al crear la invitación, la respuesta incluye el enlace para copiar, y además se envía por correo si está configurado.

---

## 3. B · Etapas, autorización, comentarios, edición y avisos

### Etapas por cliente

Tabla `cliente_etapas`:

| Columna | Detalle |
|---|---|
| `id` | |
| `client_id` | |
| `etapa` | `investigacion \| pilares \| desarrollo_mensual \| manual_campana` |
| `contratada` | bool |
| `interna` | bool |
| `estado` | `no_iniciada \| en_proceso \| en_revision \| con_cambios \| aprobada` |
| `documento_tipo` | nullable |
| `documento_id` | nullable: el entregable vigente |
| `version_aprobada_id` | → `documento_versiones`, nullable |
| `actualizado_en` | |

La combinación (`client_id`, `etapa`) es única.

- **Correspondencia con documentos:**

| Etapa | Documento |
|---|---|
| `investigacion` | `research` |
| `pilares` | `pilares` |
| `manual_campana` | `growth` |
| `desarrollo_mensual` | sin documento (Próximamente) |

- **Contratación** (alta y ficha, admin u operador asignado): casillas por etapa.
  - Al guardar se crean o actualizan las filas.
  - Si se contrata `pilares` o `manual_campana` y no `investigacion`, la investigación se crea `interna = true`, `contratada = false`: no se muestra al cliente ni cuenta en su avance.
  - Los clientes existentes se migran con **todas** las etapas contratadas en `no_iniciada`, excepto `desarrollo_mensual` (no contratada). Si ya tienen un documento de ese tipo, la etapa pasa a `en_proceso` con ese documento vigente.

- **Peso en el avance:** `no_iniciada` 0 · `en_proceso` 25 · `en_revision` 50 · `con_cambios` 60 · `aprobada` 100. `avanceCliente(etapas)` es el promedio redondeado de las contratadas no internas, o 0 si no hay.

- **Transiciones** (función pura `aplicarAccion(etapa, accion, usuario, contexto)`, que devuelve el nuevo estado o un error en español):

| Acción | Desde | Hacia | Quién | Condición |
|---|---|---|---|---|
| `iniciar` | no_iniciada | en_proceso | admin, operador asignado | Dependencias cumplidas |
| `solicitar` | en_proceso, con_cambios | en_revision | admin, operador asignado | Hay documento vigente y **no quedan comentarios abiertos** de admin ni de cliente |
| `aprobar` | en_revision | aprobada | admin | — |
| `pedir_cambios` | en_revision | con_cambios | admin | Al menos un comentario abierto en la versión vigente, o comentario general no vacío |
| `reabrir` | aprobada | con_cambios | admin | Comentario general no vacío |

  - **Dependencias:**
    - `pilares` y `manual_campana` requieren una investigación con datos; si la investigación está contratada (no interna), además debe estar `aprobada`.
    - `manual_campana` requiere `pilares` aprobada solo si pilares está contratada.
    - `desarrollo_mensual` no se puede iniciar (Próximamente).
  - **Generar:** cuando un job produce un resultado, `registrarEntregable(clientId, etapa, tipo, resultId)` pone ese resultado como vigente. Si la etapa estaba `no_iniciada`, pasa a `en_proceso`; en otro estado lo conserva, salvo `aprobada`, que pasa a `con_cambios`, porque un documento nuevo requiere volver a autorizarse. Guarda también una versión `generado`.
  - **Al aprobar** se guarda una versión `aprobada` con los datos vigentes y se enlaza en `version_aprobada_id`.
  - **Eventos:** cada transición inserta en `etapa_eventos` (`id, etapa_id, accion, de, a, usuario_id, comentario, creado_en`).
- **Ficha del cliente:** las tarjetas de acción se reemplazan por una **línea de etapas** con las 4 etapas contratadas. Cada una muestra estado, fecha, responsable, botones según rol y estado (Generar, Iniciar, Ver documento, Solicitar autorización, Aprobar, Pedir cambios, Reabrir) y el conteo de comentarios abiertos. Las internas aparecen marcadas «Interna».

### Versiones y edición sobre el documento

- Tabla `documento_versiones`: `id, documento_tipo, documento_id, numero` (secuencia por documento), `datos` jsonb, `motivo` (`generado | edicion | aprobada | restaurada`), `autor_id`, `creado_en`.
- **Modo edición:** en la vista interna del documento (investigación, mapa de pilares y manual), el botón **Editar** del panel de la cabecera. Solo admin u operador asignado, y solo si la etapa no está `en_revision`: en revisión, el documento queda congelado para el operador, y el admin sí puede editar.
- **Marcado:** el render añade `data-editable="<ruta>"` a cada texto que sale del modelo. La ruta usa puntos sobre `datos` (por ejemplo `lectura.datos.descubrimos.0.titulo`, `estrategia.principios.3.texto`, `pilares.1.subcategorias.0.temas.4.texto`). En modo edición esos nodos pasan a `contenteditable="plaintext-only"` con contorno. Una barra fija muestra «N cambios · Guardar · Descartar».
- **Guardar:** `PATCH /api/documentos/[tipo]/[id]` con `{ cambios: [{ ruta, valor }] }`. En el servidor:
  1. Verifica permiso y que la etapa no esté en revisión, salvo que el usuario sea admin.
  2. Cada ruta debe existir, apuntar a un string y tener un `valor` string de máximo 2000 caracteres. Se rechazan claves `__proto__`, `constructor` y `prototype`.
  3. Aplica los cambios sobre una copia y valida el resultado con el esquema del tipo (`investigacionSchema`; `{estrategia: estrategiaSchema}` para pilares; esquema de growth). Si falla, 400 con los mensajes.
  4. Guarda una versión `edicion` con los datos **anteriores** y actualiza `datos`.
- **Alcance de edición:** textos. Agregar o quitar elementos de listas queda fuera de esta fase, igual que editar imágenes o gráficas.
- **Historial:** en el panel, «Versiones» lista número, motivo, autor y fecha, con «Restaurar» (admin u operador), que guarda una versión `restaurada` y reemplaza `datos`.

### Comentarios anclados

- Tabla `comentarios`: `id, etapa_id, documento_tipo, documento_id, version_numero`, `ancla` (texto), `texto` (máx. 2000), `autor_id`, `autor_rol`, `estado` (`abierto | atendido | descartado`), `respuesta_de` (→ comentarios, nullable), `resuelto_por`, `resuelto_en` y `creado_en`.
- **Anclas:** el render marca con `data-ancla` las secciones (`seccion:<id>`), las tarjetas (`<ruta>` del bloque, por ejemplo `lectura.datos.descubrimos.2`) y los temas (`tema:P2-S1-07`).
- **Modo comentar:**
  - Botón **Comentar** en el panel. Al pasar sobre un elemento con `data-ancla` se resalta, y al hacer clic se abre un recuadro con textarea y «Enviar».
  - `POST /api/comentarios` crea el comentario.
  - Los elementos con comentarios abiertos llevan un marcador con número.
  - Un **panel lateral de comentarios** los lista con filtro Abiertos / Atendidos / Todos y el ancla. Cada uno permite ir al ancla, responder, «Marcar atendido» (operador o admin) y «Descartar» (admin).
- **Quién comenta:**

| Quién | Dónde | Cuándo |
|---|---|---|
| Admin y operador asignado | Cualquier etapa | Siempre |
| Cliente | Solo `manual_campana` y `desarrollo_mensual`, desde el portal, sobre la versión aprobada | Siempre |

  - Si la etapa está `aprobada`, el comentario del cliente la pasa a `con_cambios` con un evento `comentario_cliente`.
  - El cliente ve sus comentarios y su estado, no los internos.
- **API:**
  - `GET /api/comentarios?etapa=<id>` (el cliente solo ve los suyos);
  - `POST /api/comentarios`;
  - `POST /api/comentarios/[id]/respuestas`;
  - `PATCH /api/comentarios/[id]` con `{estado}`.

### Avisos

- Tabla `notificaciones`: `id, usuario_id, tipo, titulo, texto, enlace, leida_en, creado_en`.
- **`notificar(destinatarios, evento)`:** inserta una fila por usuario activo y llama a `enviarCorreo`.
  - `enviarCorreo({ para, asunto, html, texto })` usa la API HTTP de Resend (`POST https://api.resend.com/emails`) solo si existen `RESEND_API_KEY` y `CORREO_REMITENTE`. Si no, registra en consola «correo omitido» sin fallar.
  - Un error de envío nunca rompe la acción que lo originó.
  - Plantilla HTML sencilla con logo, texto y botón al enlace (`PUBLIC_BASE_URL + enlace`).
- **Eventos:**

| Evento | Para |
|---|---|
| Invitación | El invitado (correo con enlace) |
| Solicitud de autorización | Todos los admins activos |
| Cambios pedidos / reabierta | Operador asignado |
| Aprobada | Operador asignado; y usuarios del cliente si la etapa es visible para él |
| Comentario del cliente | Operador asignado y admins |
| Cliente reasignado | Nuevo operador |
| Entregable generado (job completado) | Quien lanzó el job |
| Job fallido | Quien lanzó el job |

- **UI:**
  - Campana en la barra superior con contador de no leídas; el desplegable muestra las últimas 20 y «Marcar todas como leídas».
  - `GET /api/notificaciones` y `POST /api/notificaciones/leer` `{ids? | todas}`.
  - Página **`/pendientes`**:

| Rol | Ve |
|---|---|
| Admin | Etapas `en_revision` de todos |
| Operador | Sus etapas `con_cambios`, `en_proceso` sin solicitar y comentarios abiertos |

  - Enlace «Pendientes» con contador en la barra lateral.

---

## 4. C · Portal del cliente

- **Diseño:** `PortalBase.astro`, con la misma línea editorial (tokens, cabecera tipo píldora con logo, nombre de la empresa, switch día/noche, campana y Salir), sin la barra lateral del Studio.
- **`/portal`** (cliente; admin y operador asignado con `?cliente=<id>` para previsualizar, con banda «Vista previa del portal»):
  - Saludo con el nombre del cliente y **% de avance** en grande, con anillo.
  - Tarjetas por etapa contratada visible, en orden 1–4, con el nombre claro de la etapa y su estado para el cliente:

| Estado interno | Etiqueta para el cliente |
|---|---|
| `no_iniciada` | Por iniciar |
| `en_proceso`, `con_cambios` | En preparación |
| `en_revision` | En revisión |
| `aprobada` | Listo |

    Si hay versión aprobada: «Ver documento» (y «Dejar observaciones» en etapas 3 y 4). Si la etapa 3 está contratada: «Próximamente».
  - Actividad reciente: aprobaciones y respuestas a sus comentarios.
- **`/portal/documentos/[etapaId]`:** rinde **la versión aprobada**, con el render público del tipo (sin controles internos). En etapas 3 y 4 añade el modo comentar del cliente y el panel con sus comentarios. Si la etapa no tiene versión aprobada, 404.
- El link público `/p/...` sigue funcionando igual.

---

## 5. D · Tablero de desempeño

`/desempeno`: el admin ve a todos, con filtro por operador; el operador, lo suyo. Filtro de periodo (mes actual, mes anterior, últimos 90 días, todo).

- **Métricas** (funciones puras en `src/lib/desempeno.ts`, sobre eventos, comentarios, jobs y etapas):
  - **Tiempos:**
    - días por etapa, del primer `en_proceso` al primer `aprobada` posterior;
    - espera en revisión, de cada `solicitar` a la siguiente decisión (`aprobar` o `pedir_cambios`);
    - respuesta a cambios, de cada `pedir_cambios` al siguiente `solicitar`.
    - Se reportan promedio y mediana en días, con un decimal.
  - **Calidad:** rondas de cambios por etapa aprobada (conteo de `pedir_cambios` y `reabrir`), y comentarios de admin y de cliente por entregable.
  - **Carga y avance:** clientes asignados, etapas activas (`en_proceso`, `en_revision`, `con_cambios`), % de avance promedio y etapas aprobadas en el periodo.
  - **Costo:** suma de `costo_usd` de jobs por cliente, por etapa (tipo de job) y por operador (`creado_por`; si es nulo, el operador asignado al cliente).
- **Vista:**
  - Fila de indicadores (tarjetas de cifra).
  - Tabla por operador (admin) y tabla por cliente.
  - Barras horizontales de días promedio por etapa y de costo por etapa, con las funciones de gráficas existentes o equivalentes.
  - Estados vacíos claros.

---

## 6. Seguridad y bordes

| Situación | Comportamiento |
|---|---|
| Usuario sin permiso sobre un cliente o documento | 404 |
| Cliente pide una ruta interna | Redirección a `/portal` (páginas) o 403 (API) |
| Token de invitación inválido, vencido o usado | Mensaje; no se crea usuario |
| Contraseña de invitación con menos de 12 caracteres o que no coincide | 400 con mensaje |
| Desactivar al último admin activo o a uno mismo | 400 |
| Edición con ruta inexistente, no string o clave peligrosa | 400 |
| Edición que rompe el esquema | 400, sin guardar |
| Transición no permitida | 409 con la razón |
| Correo sin configurar o con error | Se registra; la acción sigue |
| Textos de usuarios (comentarios, nombres) | Siempre escapados al renderizar |
| CSRF | El middleware existente (`mismoOrigen`) aplica a los nuevos POST/PATCH |

---

## 7. Pruebas

- **Puras (Vitest):** `rutaPermitida`, `puedeVerCliente`, `avanceCliente`, `aplicarAccion` (tabla completa de transiciones y condiciones), dependencias, `aplicarCambios` (rutas, tipos, claves peligrosas), anclas y rutas generadas por el render, métricas de desempeño con eventos sintéticos, plantilla de correo y omisión sin llave, token de invitación (hash y vencimiento).
- **Render:** atributos `data-editable` y `data-ancla` presentes y escapados; el portal y la vista pública no incluyen controles internos.
- **Migración:** aplicada en la base local; roles y asignación de existentes verificados por consulta.
- **Regresión:** `npm test` y `npm run build`.
- **Visual (controlador):** portal y páginas de admin en claro y oscuro, a 1440 y 390 px, con usuarios de prueba locales creados por script.

---

## 8. Despliegue

Rama `feat/rediseno`. **Nada se sube ni se despliega sin visto bueno explícito.** La migración cambia roles y asigna clientes: antes de desplegar, el usuario debe confirmar qué usuario de producción es el más antiguo, o fijar el admin con `ADMIN_EMAIL`. Para activar correo: `RESEND_API_KEY`, `CORREO_REMITENTE` (dominio verificado en Resend) y `PUBLIC_BASE_URL`.
