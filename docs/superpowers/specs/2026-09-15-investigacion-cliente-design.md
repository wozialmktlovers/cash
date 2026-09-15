# Investigación para el cliente final · Etapa 2 · Diseño

**Fecha:** 2026-09-15
**Estado:** aprobado en conversación, pendiente de revisión escrita
**Alcance:** solo el entregable de Social Research (`/resultados/[id]` y su link público `/p/...`). El manual de Growth queda fuera.

---

## 1. Qué cambia y por qué

Hoy la investigación es un deck horizontal de 17 paneles escrito en lenguaje de marketing. El cliente final la recibe por link y la lee solo, casi siempre sin saber de marketing.

La etapa 2 hace dos cosas:

1. **Contenido.** Un agente nuevo, *Lectura para cliente*, reescribe lo investigado en lenguaje sencillo con una estructura fija. El detalle técnico se conserva: sigue alimentando el manual de Growth y aparece plegado al final del documento.
2. **Formato.** El deck se sustituye por una página continua que se lee con scroll, con el mismo sistema visual del Studio: tokens, Poppins, tema claro u oscuro con switch.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Cómo llega al cliente | La lee solo, por link. Debe explicarse sola |
| Bloques visibles | Qué descubrimos · Tu cliente ideal · Qué te recomendamos |
| Competencia y detalle técnico | Plegados al final en «Ver el detalle de la investigación» |
| De dónde sale el lenguaje sencillo | Agente redactor nuevo (enfoque A) |
| Investigaciones existentes | Se convierten todas automáticamente al arrancar, con tope de gasto |
| Estilo | Igual que el Studio: claro por defecto, sigue el dispositivo, switch sol/luna |

---

## 2. La etapa «Lectura para cliente»

### Dónde corre

Es la sexta etapa del pipeline de investigación: `competencia, audiencia, canales, mercado, sintesis, lectura`. Corre después de la síntesis y solo si al menos una de las cinco etapas anteriores produjo datos. Cuenta dentro del mismo tope de costo del job (`COST_LIMIT_USD`). Si el tope ya se alcanzó, se marca `omitido_por_costo`.

- Modelo: `MODEL_SYNTHESIS` (por omisión `claude-opus-5`).
- Sin búsqueda web: solo reescribe lo que ya se investigó.
- `maxTokens: 24000`: en Opus 5 el razonamiento consume del mismo presupuesto que el texto.
- Costo esperado: entre 0.15 y 0.30 USD.

La pantalla de progreso la muestra como **Lectura para cliente**: *Versión en lenguaje sencillo para tu cliente. Espera a la síntesis.*

### Esquema de salida (`lecturaSchema`)

```
portada:        { titular (≤160), resumen (≤500) }
descubrimos:    3–4 × { tipo: a_favor | cuidar | oportunidad, titulo (≤100), explicacion (≤500) }
clienteIdeal:   {
  quienEs (≤700),
  lePreocupa:   exactamente 3 × texto (≤200),
  quiereLograr: exactamente 3 × texto (≤200),
  perfiles:     exactamente 2 × { nombre (≤50), descripcion (≤320), comoHablarle (≤320) }
}
recomendamos:   {
  pasos:            3–5 × { titulo (≤100), queHacer (≤420), porQue (≤360) },
  dondeAnunciarte:  1–4 × { canal (≤50), porQue (≤280) },
  precio:           texto (≤500) o null
}
faltaConfirmar: 0–5 × texto (≤240)
```

Los límites de longitud son holgados a propósito. Fuerzan la síntesis sin provocar rechazos por unas pocas palabras de más.

### Reglas de estilo del agente

- Le habla de *tú* al dueño del negocio.
- Frases cortas, una idea por frase. Sin rellenos, sin frases motivacionales, sin signos de exclamación.
- Tono seguro y concreto, como un consultor que explica sin presumir.
- **No inventa nada:** usa solo lo que traen las etapas previas y conserva las cifras tal como vienen. Si una etapa no tiene datos, no la rellena; lo menciona en `faltaConfirmar`.
- `precio` es null si la investigación no sustenta una recomendación de precio.
- **Jerga prohibida.** Si una idea técnica es necesaria, se explica con palabras de todos los días.

### Jerga prohibida (validada)

El esquema rechaza la respuesta si cualquier texto contiene alguno de estos términos, sin distinguir mayúsculas ni acentos y como palabra completa:

`buyer persona`, `funnel`, `embudo`, `CTA`, `call to action`, `engagement`, `target`, `insight`, `lead`, `leads`, `KPI`, `ROI`, `awareness`, `branding`, `copy`, `benchmark`, `nicho`, `segmento`, `touchpoint`, `conversión`, `conversiones`, `retargeting`, `remarketing`, `SEO`, `SEM`, `B2B`, `B2C`, `pain point`, `stakeholder`.

Un rechazo reintenta una vez con el error, como el resto de etapas. Si el segundo intento también falla, la etapa queda `fallo` y el documento usa la presentación de respaldo (§4).

---

## 3. Conversión de las investigaciones existentes

Al arrancar el servidor, el worker revisa las filas de `research_results` sin `datos.lectura` y genera la lectura de cada una, **de una en una**.

- Solo convierte filas con al menos una etapa `ok` entre las cinco originales.
- **Tope de gasto total por arranque:** `COST_LIMIT_CONVERSION_USD`, 10 por omisión. Al alcanzarlo se detiene; lo que falte se hace en el siguiente arranque.
- **Error de API** (sin saldo, red, 5xx): se detiene y deja la fila sin lectura para reintentar en el siguiente arranque.
- **Respuesta inválida tras dos intentos** (esquema o jerga): guarda `lectura: { estado: 'vacio', razon }` para no gastar en esa fila en cada arranque.
- No corre sin `ANTHROPIC_API_KEY`, ni con `CONVERTIR_LECTURAS=0`.
- Empieza 15 s después de iniciar el worker, para no competir con el arranque.
- Registra en consola cuántas convirtió, cuántas quedaron pendientes y cuánto gastó.
- No crea jobs ni cambia versiones: actualiza `datos` de la fila existente. Los links ya enviados muestran el formato nuevo en la misma URL.

---

## 4. La página

### Principios

- Una sola página continua. Sin deck, sin flechas, sin contador de paneles.
- Documento autónomo: estilos, logo y scripts en línea, para que se pueda guardar o imprimir.
- Tokens del Studio (`src/styles/tokens.css`) incrustados como texto. Tema resuelto con el mismo `SCRIPT_TEMA` y la misma clave `wozial-tema`.
- Ancho de lectura de 760 px en escritorio; ancho completo con 16 px de margen en celular.
- Al imprimir: tema claro forzado y el detalle desplegado.

### Estructura

1. **Barra superior fija:** logo Wozial, «Investigación · {cliente}» y el switch sol/luna.
2. **Portada:** eyebrow «Investigación de mercado · {fecha}», titular en tamaño display, resumen y un índice con tres accesos por ancla (`#descubrimos`, `#cliente-ideal`, `#recomendamos`).
3. **Qué descubrimos** (`#descubrimos`): una tarjeta por hallazgo con etiqueta de color.
   - `a_favor` → «A tu favor», verde.
   - `cuidar` → «Hay que cuidar», amarillo.
   - `oportunidad` → «Oportunidad», rosa.
4. **Tu cliente ideal** (`#cliente-ideal`):
   - Párrafo `quienEs`.
   - Dos columnas, «Lo que le preocupa» y «Lo que quiere lograr»; una sola en celular.
   - Dos tarjetas de perfil con iniciales, nombre, descripción y recuadro «Cómo hablarle».
5. **Qué te recomendamos** (`#recomendamos`):
   - Pasos numerados, cada uno con «Qué hacer» y «Por qué».
   - Bloque «Dónde anunciarte».
   - Bloque «Sobre tu precio», solo si `precio` no es null.
6. **Lo que falta confirmar:** lista discreta. Se omite si está vacía.
7. **Ver el detalle de la investigación:** `<details>` cerrado. Dentro, por tema:
   - Competencia: tablas de directos e indirectos, referentes y hallazgos.
   - Audiencia: dolores y aspiraciones con su contexto, miedo principal y qué cree que compra.
   - Canales: plataformas, formatos, horarios, tendencias y advertencia regulatoria.
   - Mercado: datos, salarios, regulación y crecimiento.
   - Toda cifra con su enlace de fuente.
   - Una etapa vacía se muestra como una línea: «No se obtuvo información sobre este tema».
8. **Pie:** logo, «Preparado por Wozial» y fecha.

### Presentación de respaldo (sin lectura)

Si `lectura` no existe o no es `ok`, no se muestran las secciones 3 a 6 y la portada cambia:

- **Portada:** titular = nombre del cliente, resumen = giro.
- **Síntesis estratégica** en formato continuo, si existe: los 4 hallazgos, posicionamiento y focos.
- **Detalle** con `<details open>`.

El cliente nunca ve una página vacía ni un error.

### Vista del operador

`/resultados/[id]` rinde el mismo documento con la barra de operador (crear, copiar y revocar el link). La barra desplaza la cabecera fija del documento nuevo y toma sus colores de los tokens cuando existen, conservando los actuales como respaldo para el manual de Growth.

### Lo que se retira

`src/render/presentation.ts`, `src/render/estilos.ts`, `src/render/navegacion.ts` y `src/render/panels/`. `escapar` se mueve a `src/render/escapar.ts`, porque también lo usan la barra de operador y el manual de Growth.

---

## 5. Seguridad y bordes

| Situación | Comportamiento |
|---|---|
| Texto del modelo con HTML | Todo pasa por `escapar` antes de tocar el HTML |
| URL de fuente no http(s) | Se sustituye por `#` |
| `localStorage` bloqueado | Tema del dispositivo; el switch funciona sin guardar |
| Lectura con jerga tras dos intentos | Etapa `fallo` (job) o `vacio` (conversión); documento en respaldo |
| Sin saldo en Anthropic al convertir | Se detiene; reintenta en el siguiente arranque; respaldo mientras tanto |
| Investigación antigua sin la etapa `lectura` en `etapas` | Válida: `lectura` es opcional en `investigacionSchema` |

---

## 6. Pruebas

| Nivel | Qué |
|---|---|
| Esquema | `lecturaSchema` acepta una lectura válida; rechaza jerga, cuentas incorrectas y textos demasiado largos; `investigacionSchema` acepta datos con y sin `lectura` |
| Agente | La entrada del redactor incluye las etapas con datos y declara las vacías; el sistema contiene las reglas clave |
| Pipeline | `ETAPAS` incluye `lectura` al final; `necesitaLectura` y `esRespuestaInvalida` cubren los casos de §3 |
| Render | Con lectura: secciones y anclas presentes, sin clases del deck, `<details>` cerrado. Sin lectura: respaldo con síntesis y `<details open>`. Escapado de HTML y URL. Script de tema presente. Cifras del ejemplo conservadas en el detalle |
| Regresión | `npm test` y `npm run build` |
| Visual | `/resultados/[id]` y `/p/...` con y sin lectura, claro y oscuro, 1440 y 390 px |

---

## 7. Despliegue

Rama `feat/rediseno`, sobre la etapa 1. **Nada se sube ni se despliega sin visto bueno explícito.** Al desplegar, la conversión corre sola en Railway y necesita saldo en la cuenta de Anthropic.
