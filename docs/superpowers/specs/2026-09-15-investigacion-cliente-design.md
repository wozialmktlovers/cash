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
portada:        { titular (≤90), resumen (≤240) }
cifras:         3–4 × { valor (≤20), etiqueta (≤60), tono: a_favor | cuidar | neutral }
descubrimos:    3–4 × { tipo: a_favor | cuidar | oportunidad, titulo (≤80), resumen (≤140), detalle (≤400) }
clienteIdeal:   {
  quienEs (≤320),
  lePreocupa:   exactamente 3 × texto (≤120),
  quiereLograr: exactamente 3 × texto (≤120),
  perfiles:     exactamente 2 × { nombre (≤40), descripcion (≤200), frase (≤140), comoHablarle (≤200) }
}
recomendamos:   {
  pasos:            3–5 × { titulo (≤60), queHacer (≤200), porQue (≤160) },
  dondeAnunciarte:  1–4 × { canal (≤40), porQue (≤140) },
  precio:           texto (≤280) o null
}
faltaConfirmar: 0–5 × texto (≤160)
```

*Revisión editorial (2026-09-15):* los límites se acortaron tras ver la primera versión, que tenía demasiado texto. `cifras` alimenta la portada. En `descubrimos`, `resumen` se lee a primera vista y `detalle` se abre con un clic. `frase` es lo que diría el perfil, en sus palabras.

**Cifras verificables.** Cada `valor` de `cifras` debe contener al menos un dígito, y su secuencia de dígitos debe aparecer en algún texto de las etapas previas. Si no aparece, la respuesta se rechaza y se reintenta como cualquier otra validación. Así la portada nunca muestra un número inventado.

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

## 4. La página (diseño editorial)

### Principios

- Una sola página continua con diseño editorial web: jerarquía marcada entre secciones, columnas, cifras grandes y poco texto a primera vista. Sin deck, sin flechas, sin contador de paneles.
- **Ancho:** el contenido ocupa el **85% del ancho de la ventana** en escritorio (≥ 900 px), con un máximo de 1600 px, y se reparte en columnas. En celular ocupa el ancho completo con 16 px de margen. Los párrafos largos se limitan a unos 68 caracteres por línea dentro de su columna.
- Documento autónomo: estilos, logo y scripts en línea, para que se pueda guardar o imprimir.
- Tokens del Studio (`src/styles/tokens.css`) incrustados como texto. Tema resuelto con el mismo `SCRIPT_TEMA` y la misma clave `wozial-tema`.
- **Interacción sin depender de JS:** sin JavaScript todo el contenido es visible y legible. Con JS se activan las pestañas, los desplegables, el índice activo y las apariciones al hacer scroll.
- `prefers-reduced-motion` desactiva las animaciones.
- Al imprimir: tema claro, todas las pestañas visibles una tras otra, desplegables abiertos y sin barra ni índice.

### Estructura

1. **Barra superior fija:** logo Wozial, «Investigación · {cliente}» y el switch sol/luna.
2. **Índice lateral** (escritorio): columna estrecha fija a la izquierda con los números y nombres de las secciones. Marca la sección visible y enlaza por ancla. En celular no existe; lo sustituye el índice de la portada.
3. **Portada** a altura de pantalla (mín. 70vh en escritorio):
   - Eyebrow «Investigación de mercado · {fecha}» y titular en tamaño display.
   - Resumen en una columna al lado del titular en escritorio; debajo en celular.
   - Fila de 3–4 **tarjetas de cifra** (`cifras`), con el valor grande en el color de su `tono`: verde `a_favor`, amarillo `cuidar`, tinta `neutral`.
   - Accesos rápidos a las secciones.
4. **Encabezado de sección:** número grande «01…04» en color suave, título y una línea de entrada. Las secciones alternan el fondo entre `--fondo` y `--gris` a todo lo ancho, para marcar el cambio.
5. **01 · Qué descubrimos** (`#descubrimos`): tarjetas en 2 columnas (1 en celular). Cada tarjeta muestra etiqueta de color, título y `resumen`; «Ver más» despliega `detalle` (`<details>`).
6. **02 · Tu cliente ideal** (`#cliente-ideal`):
   - Fila de 3 columnas en escritorio: `quienEs`, «Lo que le preocupa» y «Lo que quiere lograr».
   - Debajo, los dos perfiles lado a lado: iniciales, nombre, descripción, la `frase` como cita grande y el recuadro «Cómo hablarle».
7. **03 · Qué te recomendamos** (`#recomendamos`):
   - **Línea de pasos:** horizontal en escritorio (3–5 columnas unidas por una línea con número en círculo), vertical en celular. Cada paso con título, «Qué hacer» y «Por qué».
   - **Dónde anunciarte:** una tarjeta por canal, en rejilla.
   - **Sobre tu precio:** bloque destacado a todo lo ancho, solo si `precio` no es null.
   - **Lo que falta confirmar:** lista discreta al final de la sección; se omite si está vacía.
8. **04 · Detalle de la investigación** (`#detalle`): ya no va plegado entero. Es una sección con **pestañas** (ARIA tabs, navegables con flechas): *Competencia · Tu cliente · Canales · Mercado*. Las cuatro pestañas existen siempre; la de una etapa vacía muestra «No se obtuvo información sobre este tema».
   - **Competencia:**
     - Gráfica de barras horizontales con el precio de cada competidor directo e indirecto cuyo precio se pueda leer como número (`parsearMonto`). Si el nombre contiene «(el cliente)» o el nombre del cliente, su barra va destacada en rosa.
     - Debajo, una tarjeta por competidor (nombre, qué ofrece, modalidad, aval, fuente) en rejilla de 3 columnas.
     - Referentes como fichas con seguidores en grande.
     - Hallazgos como lista.
   - **Tu cliente:** el miedo principal destacado a todo lo ancho; dolores y aspiraciones como citas en tarjetas en 2 columnas, con contexto y fuente; «Qué cree que está comprando» en un bloque.
   - **Canales:** una tarjeta por plataforma (nombre, alcance en grande, notas, fuente) en rejilla; formatos y tendencias como etiquetas; horarios y advertencia en bloques.
   - **Mercado:**
     - Datos como tarjetas de cifra (valor grande, etiqueta, fuente).
     - Salarios como barras de rango: un rango «$10,000 a $18,000» se dibuja de mínimo a máximo, y un valor único como punto. Solo los que se puedan leer como número.
     - Regulación como tarjetas y crecimiento como bloque destacado.
   - Toda cifra conserva su enlace de fuente, en pequeño.
9. **Pie:** logo, «Preparado por Wozial» y fecha.

### Lectura de montos

`parsearMontos(texto)` extrae los números con formato de dinero o cantidad de un texto («$28,500 MXN» → [28500]; «de $10,000 a $18,000» → [10000, 18000]; «16.4K» → [16400]; «Gratis» → []). Una gráfica solo dibuja las filas con al menos un número. Si quedan menos de dos filas, no se dibuja y se muestran solo las tarjetas.

### Presentación de respaldo (sin lectura)

Si `lectura` no existe o no es `ok`, no se muestran las secciones 01–03 y la portada cambia:

- **Portada:** titular = nombre del cliente, resumen = giro, sin tarjetas de cifra.
- **Síntesis estratégica** con el mismo diseño editorial, si existe: los 4 hallazgos en 2 columnas, posicionamiento destacado y focos en 3 columnas.
- **04 · Detalle de la investigación** igual que con lectura.

El cliente nunca ve una página vacía ni un error.

### Vista del operador

**Actualizado tras C2** (la barra de operador fija que describía esta sección se sustituyó por la cabecera flotante compartida de todos los documentos editoriales — `cabeceraDocumento`, `src/render/editorial/cabecera.ts`):

`/resultados/[id]` rinde el mismo documento con la cabecera flotante (cápsula fija con logo, «Etiqueta · Cliente», switch de tema y progreso de lectura) y, solo en esta vista interna (se le pasa `operador`), un botón **Compartir** junto a Editar/Comentar. El botón abre el panel Compartir (`panel-compartir`, fuera del `<header>` para no quedar recortado por su `overflow:hidden`) con la misma lógica de red que tenía la barra anterior — crear, copiar y revocar el link público — más accesos directos a «Cliente» y «Regenerar». Sin permiso de crear un link (M2 punto 1), el botón «Crear link público» se sustituye por la razón por la que no se puede.

Los botones de Editar/Comentar y sus paneles se activan con `puedeEditar`/`puedeComentar`, no con `operador`: en esta vista interna siempre viajan juntos, pero el portal del cliente (spec §4 de C2, abajo) necesita el botón y el panel de Comentar sin Compartir ni el resto de las acciones de operador — de ahí la separación en la firma de `cabeceraDocumento`.

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
| Esquema | `lecturaSchema` acepta una lectura válida; rechaza jerga, cuentas incorrectas y textos demasiado largos; la validación de cifras rechaza valores que no aparecen en la investigación; `investigacionSchema` acepta datos con y sin `lectura` y valida los fixtures completo y parcial |
| Agente | La entrada del redactor incluye las etapas con datos y declara las vacías; el sistema contiene las reglas clave |
| Pipeline | `ETAPAS` incluye `lectura` al final; `necesitaLectura` y `esRespuestaInvalida` cubren los casos de §3 |
| Render | Con lectura: portada con cifras, secciones numeradas con anclas, índice lateral, pestañas del detalle con roles ARIA, gráficas solo con montos legibles. Sin lectura: respaldo con síntesis. Escapado de HTML y URL. Script de tema e interacción válido. Cifras del ejemplo conservadas |
| Montos | `parsearMontos` cubre dinero, rangos, K y textos sin número |
| Regresión | `npm test` y `npm run build` |
| Visual | `/resultados/[id]` y `/p/...` con y sin lectura, claro y oscuro, 1440 y 390 px |

---

## 7. Despliegue

Rama `feat/rediseno`, sobre la etapa 1. **Nada se sube ni se despliega sin visto bueno explícito.** Al desplegar, la conversión corre sola en Railway y necesita saldo en la cuenta de Anthropic.
