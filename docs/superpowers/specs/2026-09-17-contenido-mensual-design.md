# Etapa 3 · Contenido mensual · Diseño

**Fecha:** 2026-09-17
**Estado:** aprobado en conversación (partes 1, 2 y 3); pendiente de revisión del spec escrito.
**Sustituye a:** `2026-09-16-desarrollo-mensual-borrador.md` (sus 5 preguntas quedan resueltas aquí).
**Base de contenido:** el entregable OLAM hecho a mano (`Wozial/Info cliente/OLAM_Contenido_Septiembre_Entregable…html`, fuera del repo), llevado a la línea editorial del Studio.
**Depende de:** Mapa de pilares, sistema de trabajo A–D (roles, etapas, versiones, edición, comentarios, avisos, portal, desempeño).

---

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Unidad | Un **lote por cliente y mes**, con 12 piezas |
| Selección de temas | El **operador elige a mano** 12 temas del banco del Mapa de pilares |
| Qué genera la IA | Por pieza: **3 opciones** de copy, brief visual en español y **prompt base de arte en inglés** |
| Artes | Los sube el equipo en un **espacio especial por pieza**; se cargan solos en el documento |
| Formato | Heredado del tema (`reel`, `carrusel`, `story`), editable; se agrega `post` |
| Calendario | **Sugerido** por regla (≈3 por semana: martes, jueves, sábado), editable; plataforma `instagram`, `facebook` o `ambas` (por omisión `ambas`) |
| Publicación | Solo se entrega; se programa fuera del Studio |
| Reels | **Portada subida + link de Drive** |
| Vista del feed | **Automática** con las portadas, en orden de fecha |
| Revisión del cliente | **Por pieza**: Aprobar / Solicitar cambios con nota; **auto-aprobación a los 2 días hábiles** |
| Modelo de datos | Enfoque 1: el lote es un documento (versiones, edición, comentarios, autorización); las decisiones del cliente van en una tabla aparte |

## 2. Flujo de un mes

1. **Crear el mes.** En la ficha, tarjeta de la etapa 3, «Nuevo mes» (selector de mes). Requiere Mapa de pilares **aprobado** y que no exista ya un lote de ese mes. Solo quien opera al cliente.
2. **Elegir 12 temas** en `/clientes/[id]/contenido/nuevo?mes=AAAA-MM`: el banco del mapa vigente con casillas, contador «N de 12», filtros del banco, y marca «Usado en {mes}» en temas ya usados en lotes anteriores (se pueden elegir igual). «Generar» se habilita con exactamente 12.
3. **Generar** (job `contenido`): crea el lote con las 12 piezas; los 12 temas pasan a `en_desarrollo` en el mapa; `registrarEntregable` pone la etapa 3 en `en_proceso` apuntando al lote.
4. **Trabajo del equipo** en `/contenido/[id]`: elegir opción A/B/C por pieza, editar textos, fecha, plataforma y formato, subir artes y link de Drive.
5. **Autorización interna** (flujo existente): `solicitar` exige además **12 piezas con opción elegida y artes completos** según formato (§5.3). El admin comenta, pide cambios o aprueba.
6. **Publicar al cliente** = `aprobar` del admin. Cada pieza sin decisión vigente queda `pendiente` con `vence_en` = 2 días hábiles.
7. **Revisión del cliente** en el portal, por pieza. «Solicitar cambios» exige nota; la etapa pasa a `con_cambios` y avisa al operador asignado y a los admins.
8. **Corrección:** el operador corrige → `solicitar` → admin `aprobar` → **solo las piezas cuya decisión vigente es `cambios` o que cambiaron desde la versión aprobada anterior** vuelven a `pendiente` con plazo nuevo. Las aprobadas y sin cambios se quedan aprobadas.
9. **Auto-aprobación:** toda pieza `pendiente` vencida se aprueba como `automatica`; aviso al operador.
10. **Mes listo:** con las 12 aprobadas (manual o automática) el lote queda **Listo**; sus temas pasan a `publicado` en el mapa (tachados).

## 3. Datos

### 3.1 Tipos y enums

- `documento_tipo` agrega `contenido`.
- `research_jobs.tipo` (o el enum que use la cola) agrega `contenido`.
- `reglas.ts`: `tipoDocumentoDe('desarrollo_mensual') = 'contenido'`, `etapaDeTipo('contenido') = 'desarrollo_mensual'`; `dependenciasCumplidas('desarrollo_mensual')` = pilares aprobada si está contratada (misma regla que `manual_campana`); se retira «Próximamente».
- Migración: la etapa `desarrollo_mensual` de clientes existentes sigue `contratada: false`; se contrata desde «Etapas contratadas».

### 3.2 Tabla `contenido_lotes`

`id uuid`, `client_id` (cascade), `mes date` (día 1), `job_id` (set null), `pilares_result_id` (set null), `datos jsonb`, `version int`, `created_at`. Único (`client_id`, `mes`).

`datos` (Zod `loteSchema`):

```ts
{
  mes: 'AAAA-MM',
  piezas: Pieza[]            // exactamente 12, ids 'C01'..'C12'
}
Pieza = {
  id: string,                // 'C01'
  temaId: string,            // 'P2-S1-07'
  tema: string, pilar: string, subcategoria: string, funcion: Funcion,   // copia del mapa al generar
  formato: 'post' | 'carrusel' | 'reel' | 'story',
  fecha: 'AAAA-MM-DD',
  plataforma: 'instagram' | 'facebook' | 'ambas',
  estadoGeneracion: 'ok' | 'fallo',
  opciones: Opcion[],        // 3 si ok; [] si fallo
  elegida: 0 | 1 | 2 | null,
  brief: { visual: string, portada: string, slides: string[], guion: string },  // slides solo carrusel, guion solo reel
  promptArte: string,        // en inglés
  videoUrl: string | null    // reel: link de Drive (https)
}
Opcion = { enfoque: string, hook: string, copy: string, cta: string, hashtags: string[], palabrasClave: string[] }
```

Límites: hook ≤ 150, copy ≤ 2200 (límite de Instagram), cta ≤ 120, hashtags 5–10 (`^#[\p{L}\p{N}_]+$`), palabrasClave 3, brief.visual ≤ 800, promptArte ≤ 1200, slides ≤ 10.

### 3.3 Tabla `contenido_archivos`

`id`, `lote_id` (cascade), `pieza_id text`, `orden int` (0 = portada/única; 0..9 slides), `ruta`, `mime`, `ancho int`, `alto int`, `bytes int`, `subido_por` (set null), `created_at`. Único (`lote_id`, `pieza_id`, `orden`); reemplazar = borrar + insertar.

Almacenamiento: `guardarArchivo` existente (`DATA_DIR`), subcarpeta `contenido/{loteId}`. Mimes: `image/jpeg`, `image/png`, `image/webp`; máx 10 MB por archivo en servidor.

### 3.4 Tabla `contenido_revisiones`

`id`, `lote_id` (cascade), `pieza_id text`, `estado` enum `pendiente | aprobada | cambios`, `nota text`, `automatica bool`, `version_numero int` (versión aprobada publicada), `vence_en timestamptz`, `decidido_por` (set null), `decidido_en`, `created_at`. Historial: la **decisión vigente** de una pieza es la fila más reciente.

## 4. Generación

- `src/contenido/agentes.ts`: `correrPieza(ctx, tema)` con `pedirJson` y `piezaGeneradaSchema` (opciones ×3, brief, promptArte). Contexto: estrategia del mapa (tono, no negociables, ideas), pilar/subcategoría/función/formato del tema, lectura de la investigación (cliente ideal, recomendaciones) si existe. Prompt en español; el `promptArte` se pide explícitamente en inglés, sin texto dentro de la imagen salvo el de portada indicado.
- `src/contenido/pipeline.ts`: `ejecutarContenido(jobId)` con etapas de progreso `pieza1..pieza12`; concurrencia 4; reintento 1 por pieza; tope de costo (`leerTopeUsd`, `gasto`); pieza fallida → `estadoGeneracion: 'fallo'`. Si fallan las 12 → job `fallido`, sin lote. Si ≥1 ok → inserta lote, temas `en_desarrollo`, `registrarEntregable`.
- «Generar de nuevo» por pieza: `POST /api/contenido/[id]/piezas/[piezaId]/regenerar` — job corto de 1 pieza que reemplaza `opciones`, `brief`, `promptArte` y `elegida=null` guardando versión `edicion`; solo si la etapa no está `en_revision`.
- `src/contenido/calendario.ts` (pura): `sugerirFechas(mes, n=12)` → martes/jueves/sábado desde el primer día hábil del mes, rellenando con lunes/miércoles/viernes si faltan días; nunca fuera del mes.

## 5. Documento `/contenido/[id]`

Render `renderizarContenido(lote, { cliente, fecha }, opciones)` en `src/render/contenido/*`, sobre la base editorial (`envolverDocumento`, `cabeceraDocumento`, `SCRIPT_EDITORIAL`, tokens, índice lateral, 85%).

### 5.1 Secciones

- **Portada:** «Contenido de {mes}», cliente; mensaje de plazo con cuenta regresiva (portal) o estado interno; cifras (piezas, posts, carruseles, reels, historias); barra «N de 12 aprobadas · N con cambios · N pendientes» (cuando ya se publicó).
- **01 · Vista del feed:** cuadrícula 3 columnas de portadas de piezas no-`story` por fecha; punto de estado; lightbox con flechas y Escape (dueño único de Escape compatible con `SCRIPT_FLUJO`). Sin arte: celda con formato y «Falta arte».
- **02 · Calendario:** mes en rejilla lunes–domingo con chips (icono de formato + color de estado) que llevan a la tarjeta; <700 px: lista por semana.
- **03 · Piezas:** filtros formato/estado. Tarjeta: arte a la izquierda (post imagen; carrusel visor con flechas y miniaturas; reel portada + «Ver video» a `videoUrl` en pestaña nueva; sin arte: marcador); a la derecha número, formato, fecha, plataforma, chip pilar/tema, hook, copy con «Copiar», CTA, hashtags.
- **04 · Historias:** tira horizontal de tarjetas 9:16 con los mismos datos y controles.
- Pie editorial.

### 5.2 Por vista

| Elemento | Interna | Portal | `/p/` |
|---|---|---|---|
| Pestañas Opción A/B/C + «Usar esta» | ✅ | — | — |
| Brief visual y prompt en inglés con «Copiar» | ✅ | — | — |
| Espacio de artes y link de Drive | ✅ | — | — |
| Fecha/plataforma/formato editables | ✅ | — | — |
| Editar, Comentar, Versiones, Compartir | ✅ (según permisos existentes) | — | Compartir no |
| Aprobar / Solicitar cambios + nota | ve la decisión | ✅ | — |
| Estados de revisión | ✅ | ✅ | — |
| Nota del cliente en la pieza | ✅ | la propia | — |

Contenido mostrado: interna usa la opción elegida (o la A marcada «sin elegir»); portal y `/p/` usan la **versión aprobada** (portal) o el lote vivo (`/p/`, igual que los demás documentos) y solo piezas con opción elegida.

Editable (`data-editable`): `piezas.N.opciones.K.hook|copy|cta` de la opción elegida, `piezas.N.brief.visual|portada`, `piezas.N.promptArte`. Hashtags, fecha, plataforma, formato y `elegida` se cambian con controles propios vía `PATCH /api/contenido/[id]/piezas/[piezaId]` (misma autorización, candado y versión `edicion` que el PATCH de documentos).

Anclas (`data-ancla`): `seccion:<id>` y `pieza:C03`.

### 5.3 Espacio de artes (interna)

- Recuadro por pieza con requisito según formato: post 1 imagen; carrusel 2–10 slides reordenables; reel portada + `videoUrl` https; story 1 imagen vertical.
- Arrastrar o elegir; **carga en bloque** en la barra superior: nombres `NN.ext` → pieza NN orden 0; `NN-M.ext` → pieza NN slide M−1 (1-based en el nombre). Los que no casan se listan para asignar a mano.
- En el navegador: redimensionar a máx 2000 px lado mayor, WebP calidad 0.85 (canvas); si el navegador no soporta WebP, JPEG.
- `POST /api/contenido/[id]/archivos` (multipart: `piezaId`, `orden`, `archivo`), `DELETE /api/contenido/archivos/[archivoId]`, `PATCH …/orden` para reordenar slides. Editar artes cuenta como cambio de la pieza (§2.8).
- `GET /api/contenido/archivos/[archivoId]` sirve la imagen con `Cache-Control: private, max-age=3600`: equipo con visibilidad, cliente dueño (solo si el lote tiene versión aprobada) o `?t=<token>` de un share vigente del lote.
- **Completo** (`artesCompletos(pieza, archivos)`, pura): post/story ≥1 en orden 0; carrusel ≥2 consecutivos desde 0; reel orden 0 + `videoUrl`.

## 6. Revisión del cliente

- `src/contenido/revision.ts` (puras):
  - `sumarDiasHabiles(desde, 2)` en zona America/Mexico_City, lunes–viernes, sin festivos; vence al final del segundo día hábil (23:59:59 CDMX).
  - `decisionVigente(revisiones, piezaId)`; `estadoPieza(decision, ahora)` → `pendiente | aprobada | cambios | vencida→aprobada`.
  - `estadoLote(piezas, revisiones, ahora)` → conteos y `listo` (12 aprobadas).
  - `piezasARepublicar(aprobadaAnterior, aprobadaNueva, revisiones)` → ids con decisión `cambios` o con diferencias en la pieza (opción elegida, textos, fecha, plataforma, formato, artes).
- Al `aprobar` la etapa 3 (dentro de la misma transacción de `ejecutarTransicion`, después de guardar la versión aprobada): primera publicación → `pendiente` para las 12; siguientes → `pendiente` solo para `piezasARepublicar`.
- `POST /api/portal/contenido/[loteId]/piezas/[piezaId]/decision` `{ estado: 'aprobada' | 'cambios', nota? }`: cliente dueño, etapa contratada y visible, lote con versión aprobada, decisión vigente `pendiente` y no vencida; `cambios` exige nota 1–2000. En una transacción: inserta revisión; si `cambios`, etapa a `con_cambios` (UPDATE condicional) + evento `comentario_cliente`; tras commit, aviso `comentario_cliente` (operador + admins). La nota se muestra en la pieza a equipo y cliente, y cuenta como comentario abierto (se inserta también en `comentarios` con ancla `pieza:CNN` para reutilizar el bloqueo de `solicitar` y el panel).
- Auto-aprobación: `aprobarVencidas()` en el worker cada hora + al abrir portal/documento; inserta revisión `aprobada, automatica=true`; aviso nuevo `auto_aprobada` al operador (texto: «{Cliente} · {n} piezas de {mes} se aprobaron automáticamente»).
- Lote **Listo**: tras cualquier decisión o auto-aprobación, si `estadoLote.listo` → temas del lote a `publicado` (avance del mapa vigente) y evento `mes_listo`; aviso `aprobada` a operador.

## 7. Ficha, portal, desempeño

- **Ficha / LineaEtapas:** tarjeta de la etapa 3 muestra el mes vigente (estado del lote, «9 de 12 aprobadas»), «Nuevo mes», «Ver contenido» y lista corta de meses anteriores. `botonesEtapa` sustituye «Generar» por «Nuevo mes» para `desarrollo_mensual`.
- **Avance del cliente:** para `desarrollo_mensual` se usa un **estado efectivo**: si la etapa está `aprobada` pero el lote vigente no está Listo, cuenta como `en_revision` (peso 50) y el portal la muestra como «Esperando tu revisión»; con el lote Listo, `aprobada` (100).
- **Portal:** tarjeta de la etapa 3 sin «Próximamente»: mes vigente con «Revisar contenido» (→ `/portal/documentos/[etapaId]`), conteo pendiente y plazo; «Meses anteriores» con enlaces de solo lectura. `/portal/documentos/[etapaId]` para `contenido` rinde la versión aprobada + revisiones con controles del cliente.
- **Desempeño:** cada lote es un entregable; métricas existentes aplican; se agregan conteos `automaticas` y `rondas por pieza` solo en la tabla de detalle.
- **Entregables / jobs / progreso / share:** `contenido` en todos los `switch` de tipo (páginas de jobs, entregables, `documento-publico`, `enlaceDocumento`, `documentoVisible`, `datosDelDocumento`, `validarDocumento` con `loteSchema`, `api/share` slug).

## 8. Seguridad y casos límite

- 404 sin permiso; 409 con razón en español para reglas de flujo; 400 validación.
- No se crea un lote si ya existe el mes (409 «Ya existe el contenido de {mes}»).
- Mapa sin aprobar o sin 12 temas válidos del mapa vigente → 409.
- Borrar cliente: cascade de lotes, archivos (filas) y revisiones; los archivos en disco se borran en el mismo endpoint tras el commit (mejor esfuerzo, se registra el error).
- Borrar/reemplazar arte en pieza aprobada por el cliente → al republicar vuelve a `pendiente`.
- `videoUrl` solo `https:`; se muestra como enlace externo `rel="noopener noreferrer"`.
- Todo texto escapado; ids de pieza validados `^C(0[1-9]|1[0-2])$`.
- El cliente nunca ve opciones no elegidas, brief, prompt, nombres del equipo ni costos.
- Auto-aprobación idempotente (inserción condicionada a que la vigente siga `pendiente` y vencida).

## 9. Pruebas

- Puras: `loteSchema`, `sugerirFechas` (meses de 28–31 días, inicio en fin de semana), `sumarDiasHabiles` (viernes→martes, cambio de mes, borde CDMX/UTC), `estadoPieza`/`estadoLote`/`piezasARepublicar`, `artesCompletos`, asignación por nombre de archivo, reglas de etapa 3 (dependencias, `solicitar` con piezas incompletas).
- Render: interna con pestañas A/B/C, brief, prompt y espacio de artes; portal sin nada de eso y con controles de decisión; `/p/` sin controles; anclas `pieza:CNN`; feed ignora historias; calendario ubica fechas.
- Script (fake-dom): cambio de opción, lightbox, decisión del cliente (payload), asignación de carga en bloque.
- Sin llamadas reales a Anthropic; fixtures sintéticos (repo público).
- Verificación en vivo con usuarios locales y un lote de ejemplo sembrado en el scratchpad.

## 10. Fuera de alcance

Publicar/programar en Meta; generar imágenes con IA; subir video; festivos en días hábiles; varios lotes por mes; piezas distintas de 12.
