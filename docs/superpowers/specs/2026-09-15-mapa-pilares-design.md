# Mapa de Pilares · Diseño

**Fecha:** 2026-09-15
**Estado:** aprobado en conversación, pendiente de revisión escrita
**Alcance:** nuevo entregable por cliente, «Mapa de pilares», generado a partir de la investigación. Incluye estrategia, banco de 300 temas y tablero de avance compartido por el equipo. Queda fuera el «desarrollo de piezas» (copies por tema), que será una etapa posterior.

**Referencia:** `Wozial/Info cliente/Mar_de_Miel_Mapa_Maestro_Editorial.html` (ejemplo hecho a mano con el prompt del estratega de contenidos). Este diseño conserva su contenido y lo lleva a la línea editorial del Studio.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Para quién | Herramienta del equipo Wozial; el avance se guarda en el Studio y es compartido. El cliente recibe un link de solo lectura |
| Insumos | Investigación con datos + ficha del cliente (datos, enlaces, archivos con texto) |
| Etiquetas por tema | Función (Autoridad, Conexión, Engagement, Prueba social, Venta) y formato sugerido (Reel, Carrusel, Story) |
| Desarrollo de piezas | Etapa aparte, posterior |
| Generación | Por etapas: estrategia → 5 pilares en paralelo → revisión automática (enfoque A) |
| Diseño | Misma línea que la investigación: 85% del ancho, tokens, día/noche, cabecera flotante con Compartir |

---

## 2. Cómo se lanza

- **Ficha del cliente:** tercera tarjeta de acción, «Mapa de pilares». Muestra el último mapa (fecha) o «Listo para generarse». Se habilita con la misma regla que Growth: existe una investigación con al menos una etapa con datos. Si no, explica por qué.
- **Confirmación** en `/clientes/[id]/pilares`: lista de insumos con ✓/⚠ (investigación, giro, producto, ciudad, enlaces, archivos con texto), costo estimado (`COST_ESTIMATE_PILARES_USD`, 3 por omisión) y tope duro (`COST_LIMIT_USD`). Botón «Generar mapa de pilares».
- `POST /api/jobs { clientId, tipo: 'pilares' }`: mismas validaciones que Growth (409 si no hay investigación con datos o si hay un job en curso, con `jobId`).
- Corre en la cola de trabajos existente (`research_jobs`, `tipo = 'pilares'`) y el worker lo despacha a `ejecutarPilares(jobId)`.

---

## 3. Generación

### Etapas

`estrategia`, `pilar1`, `pilar2`, `pilar3`, `pilar4`, `pilar5`, `revision`. La pantalla de progreso las muestra como Estrategia · Pilar 1…5 · Revisión.

1. **Estrategia** (modelo `MODEL_SYNTHESIS`). Recibe la investigación más reciente (sus etapas con datos) y el contexto de la ficha (`armarContexto`). Si la estrategia falla, el job falla: sin pilares no hay nada que desarrollar.
2. **Pilar 1–5** (modelo `MODEL_RESEARCH`, en paralelo con `repartirPorTope`). Cada uno recibe el contexto, la estrategia completa (para respetar las fronteras) y el número de su pilar. Devuelve sus 3 subcategorías con 20 temas cada una. Un pilar que falla queda `fallo` y los demás continúan.
3. **Revisión** (sin modelo, salvo la corrección). Se hace en código:
   - **Duplicados:** dos temas del mapa son repetidos si su texto normalizado (minúsculas, sin acentos ni signos) es igual, o si el índice de Jaccard entre sus conjuntos de palabras de 4 o más letras es ≥ 0.6.
   - **Mix:** porcentaje real de temas por función contra `estrategia.mix`; fuera de margen si difiere más de 5 puntos.
   - **Corrección:** si hay duplicados, se pide **una sola vez** por pilar afectado que reescriba solo esos temas (se envían sus ids, el texto y la lista de temas existentes a evitar). Se aceptan los reemplazos que pasen el esquema del tema y ya no dupliquen. El mix no se corrige automáticamente; se reporta.
   - **Resultado:** `revision: { duplicadosRestantes: [idA, idB][], mixReal: Record<Funcion, number>, fueraDeMargen: Funcion[], reescritos: number }`.

Todo el job respeta `COST_LIMIT_USD` con el mismo freno de costo del resto de pipelines. Costo esperado: 2 a 3 USD.

### Reglas del estratega (sistema común)

Basadas en el prompt de referencia:

- **Rol y equilibrio:** eres estratega y planner de contenidos para Facebook e Instagram. Defines por qué existe cada pieza y cómo conecta objetivos de negocio con lo que la audiencia valora. Los temas equilibran autoridad, conexión humana, prueba social, participación y venta.
- **Temas:** no son posts completos, sino headlines, disparadores o ángulos que funcionen en Reels, carruseles y stories.
- **Anti-repetición:** nada de ideas genéricas, slogans vacíos, frases de agencia («descubre», «innovador», «la mejor opción») ni temas demasiado parecidos. Hay que partir de escenas y verdades humanas reconocibles.
- **Tono:** se calibra según la investigación y los documentos del cliente.
- **Honestidad:** no inventes datos del cliente. Si falta información, avanza con supuestos razonables y decláralos en `supuestos`.

### Esquema de la estrategia

```
resumen:        texto ≤ 240
ideas:          exactamente 3 × { titulo ≤ 80, texto ≤ 320 }
principios:     exactamente 12 × { titulo ≤ 80, texto ≤ 220 }
pilares:        exactamente 5 × {
  nombre ≤ 50, pregunta ≤ 160, funcion ≤ 120, objetivo ≤ 320, frontera ≤ 220,
  subcategorias: exactamente 3 × { nombre ≤ 70 }
}
mix:            exactamente 5 × { funcion: autoridad|conexion|engagement|prueba_social|venta, porcentaje entero 0–100, descripcion ≤ 140 }
                · una entrada por función · los porcentajes suman 100
conversion:     { titulo ≤ 90, texto ≤ 320, pasos: exactamente 3 × { nombre ≤ 30, texto ≤ 180 } }
reglaEspecial:  texto ≤ 400 o null
supuestos:      0–5 × texto ≤ 200
```

### Esquema de un pilar

```
subcategorias: exactamente 3 × {
  nombre (igual al definido en la estrategia),
  temas: exactamente 20 × { texto ≤ 160, funcion: autoridad|conexion|engagement|prueba_social|venta, formato: reel|carrusel|story }
}
```

Validaciones extra, en el esquema construido por pilar:
- Los nombres de subcategoría coinciden, en orden, con los de la estrategia.
- No hay dos temas con el mismo texto normalizado dentro del pilar.

### Identificadores

El código asigna el id de cada tema, no el modelo: `P{pilar}-S{subcategoria}-{nn}` (por ejemplo `P2-S1-07`, con `nn` de 01 a 20). El id es estable: la etapa futura de desarrollo de piezas se ligará a él.

### Datos guardados (`pilares_results.datos`)

```
{ estrategia, pilares: [ { numero, estado: 'ok', subcategorias: [...temas con id] } | { numero, estado: 'vacio', razon } ], revision }
```

---

## 4. Persistencia

Migración nueva:

- `documento_tipo` gana el valor `'pilares'`.
- Tabla `pilares_results`: `id` uuid pk, `job_id` → research_jobs (cascade), `client_id` → clients (cascade), `datos` jsonb, `version` int, `created_at`.
- Tabla `pilares_temas`, el avance del equipo:
  - `result_id` → pilares_results (cascade) y `tema_id` text, con pk (`result_id`, `tema_id`).
  - `estado` text: `pendiente|en_desarrollo|desarrollado|publicado`, por omisión `pendiente`.
  - `nota` text nullable.
  - `actualizado_por` → users (set null) y `actualizado_en` timestamptz.
  - Una fila existe solo si alguien tocó el tema; si no hay fila, el estado es `pendiente`.

API, con sesión obligatoria (middleware):

- `PATCH /api/pilares/[resultId]/temas/[temaId]` `{ estado?, nota? }`:
  - Valida que el tema exista en `datos`, que el estado sea válido y que la nota tenga como máximo 2000 caracteres.
  - Hace upsert.
  - Responde `{ ok, estado, nota, actualizadoPor: email | null, actualizadoEn }`.
  - Si el tema no existe: 404. Si el cuerpo es inválido: 400.

Compartir: `share_links.documento_tipo = 'pilares'`. `POST /api/share` acepta `tipo: 'pilares'`. `/p/[slug]/[token]` rinde la vista pública.

---

## 5. La página

Ruta interna `/pilares/[id]`, más su link público. Misma línea que la investigación:

- 85% del ancho con máximo de 1600 px.
- Tokens, día/noche y cabecera flotante (Compartir solo en la interna).
- Índice lateral, secciones numeradas con fondos alternados, apariciones y reglas de impresión.
- Documento autónomo, con estilos y scripts en línea.

### Secciones

**Portada.** Eyebrow «Mapa de pilares · {cliente} · {fecha}», título «Mapa de pilares y banco de contenidos», `estrategia.resumen` y cifras (5 pilares · 15 subcategorías · {n} temas · Facebook + Instagram). En la vista interna, avance global: «{desarrollados + publicados} de {total} desarrollados» con barra.

**01 · Punto de partida.** `ideas` en 3 columnas, cada tarjeta con filo de color.

**02 · No negociables.** `principios` en rejilla de 3 columnas (2 en tableta, 1 en celular): número grande, título y texto.

**03 · Los 5 pilares.**
- Tarjetas en fila en pantallas ≥ 1300 px; 2 columnas en medianas; 1 en celular.
- Cada tarjeta lleva número en círculo con color de pilar, nombre, pregunta y subcategorías como etiquetas.
- Clic en la tarjeta → baja al banco con ese pilar filtrado.
- Debajo, una banda «Frontera entre pilares» con la `frontera` de cada uno.

**04 · Mix editorial.**
- Barra apilada con los porcentajes de `mix` en colores de función y una tarjeta por función con su descripción.
- En la vista interna, segunda barra «Mix real del banco» con `revision.mixReal`; las funciones de `fueraDeMargen` van marcadas.

**05 · Conversión.** Bloque destacado a todo lo ancho: título, texto y los 3 pasos en línea.

**06 · Banco de temas.**
- **Barra de herramientas** fija al bajar, en píldora:
  - Buscador sin acentos.
  - Filtros de pilar, subcategoría (depende del pilar), función, formato y, en la interna, estado.
  - «Limpiar».
  - «Mostrando {n} de {total}».
- **Avance por pilar** (interna): 5 mini tarjetas con barra y conteo.
- **Aviso de revisión** (interna): si hay `duplicadosRestantes` o `fueraDeMargen`, aparece un aviso discreto con la lista.
- **Un bloque plegable por pilar** (`<details open>`), con cabecera en su color, número, nombre, objetivo y conteo. Dentro, las 3 subcategorías como pestañas ARIA.
- **Tema como tarjeta**, en rejilla de 2 columnas (1 en celular):
  - Id, etiqueta de función con su color, formato con icono y texto.
  - **Interna:**
    - Botón de estado que avanza en ciclo al pulsarlo (Pendiente → En desarrollo → Desarrollado → Publicado → Pendiente), con color por estado.
    - Botón de nota con punto si existe.
    - «{email} · {fecha}» si hubo cambio.
    - Los publicados se atenúan.
    - El cambio se guarda al momento con `PATCH` y un aviso «Guardado». Si falla, se revierte y avisa «No se pudo guardar».
  - **Pública:** solo id, etiquetas y texto.
- **Nota:** panel lateral (`dialog`) con el tema, un textarea de máximo 2000 caracteres y Guardar. Se cierra con Escape.
- **Pilar vacío:** el bloque dice «Este pilar no se generó» y su razón. En la interna muestra el enlace «Regenerar el mapa», que lleva a la confirmación. Regenerar un solo pilar queda fuera de alcance.
- **Botones** «Exportar CSV» (interna; columnas id, pilar, subcategoría, tema, función, formato, estado, nota) e «Imprimir / PDF».
- **Impresión:** abre todos los pilares y pestañas, quita controles y aplica tema claro.

**Pie.** `reglaEspecial` si existe; `supuestos` si hay (solo en la interna); logo, «Preparado por Wozial» y fecha.

### Colores

- **Pilares:** 1 rosa, 2 azul, 3 amarillo, 4 verde, 5 tinta (tokens del Studio).
- **Funciones:** autoridad azul, conexión rosa, engagement amarillo, prueba social verde, venta tinta.
- **Estados:** pendiente gris, en desarrollo amarillo, desarrollado azul, publicado verde.
- Texto sobre color, siempre con los pares AA de los tokens.

### Interacción sin JS

Los 300 temas se rinden en el servidor. Sin JS todo se lee e imprime. Con JS se activan filtros, pestañas, estados y notas. Los datos para filtrar salen de atributos `data-*` en cada tarjeta, no de un JSON aparte.

---

## 6. Otros puntos del Studio

- **Entregables:** aparece «Mapa de pilares» como tipo, con chip de filtro, y abre en `/pilares/[id]`.
- **Progreso** (`/jobs/[id]`): etapas del tipo `pilares` y botón final «Ver el mapa de pilares».
- **Historial de la ficha:** los jobs `pilares` enlazan a su mapa.

---

## 7. Seguridad y bordes

| Situación | Comportamiento |
|---|---|
| Texto del modelo con HTML | Todo pasa por `escapar` |
| PATCH a un tema inexistente o de otro resultado | 404 |
| PATCH sin sesión | 401 (middleware) |
| Nota de más de 2000 caracteres | 400 |
| Link público | Sin estados, notas, emails ni supuestos |
| Estrategia falla | Job `fallido` con razón; no se crea resultado |
| Todos los pilares fallan | Resultado con estrategia y pilares vacíos; job `completado` con aviso en revisión |
| Tope de costo | Pilares no iniciados quedan `omitido_por_costo` |

---

## 8. Pruebas

| Nivel | Qué |
|---|---|
| Esquemas | Estrategia (cuentas, mix que suma 100, una entrada por función) y pilar (nombres de subcategoría, 20 temas, sin repetidos) |
| Revisión | Normalización, Jaccard, detección entre pilares, mix real, fuera de margen, asignación de ids |
| Agentes | Entrada del estratega y del pilar (incluye investigación, estrategia y número); sistema con reglas clave |
| Pipeline | Etapas, paralelas, armado de `datos` con pilares vacíos |
| API | Validación de estado, nota y tema existente (función pura) |
| Render | Secciones, 300 tarjetas del fixture, vista pública sin controles, escapado, script válido |
| Visual | Interna y pública, claro y oscuro, 1440 y 390 px |

---

## 9. Despliegue

Rama `feat/rediseno`. Nada se sube ni se despliega sin visto bueno explícito. La migración añade un valor de enum y dos tablas, y no toca filas existentes.
