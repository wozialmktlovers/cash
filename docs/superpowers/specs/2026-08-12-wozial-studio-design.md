# Wozial Studio — Diseño del sistema

**Fecha:** 2026-08-12
**Versión del documento:** 1.0
**Alcance:** v1 · Social Research

---

## 1. Qué es

Una aplicación web privada que automatiza la investigación estratégica de clientes de Wozial y entrega el resultado como una presentación navegable, con link compartible.

Hoy ese trabajo se hace a mano: se investiga durante horas, se redacta y se maqueta un HTML de 17 paneles. El sistema convierte ese proceso en un formulario, un botón y una espera de veinte a treinta minutos.

**Sustituye:** el trabajo manual de investigación y maquetación de la fase 1.
**No sustituye:** el criterio para decidir qué hacer con esos hallazgos.

---

## 2. Alcance

### Dentro de v1

- Autenticación con usuario y contraseña, un solo usuario
- Alta, edición, listado y borrado de clientes
- Registro de enlaces del cliente: sitio, redes, páginas de venta
- Carga de archivos: PDF, DOCX, TXT, PNG, JPG
- Extracción de texto de documentos al momento de subirlos
- Pipeline de investigación con cinco agentes contra la API de Claude
- Almacenamiento del resultado como JSON estructurado
- Renderizado de la presentación de 17 paneles con scroll horizontal
- Link público con token revocable
- Registro de tokens y costo por investigación

### Fuera de v1, explícitamente

- El bloque Growth (fase 2 de campaña). Se agrega después reusando auth, clientes y motor.
- Múltiples usuarios, roles y permisos
- Edición visual de la presentación desde la interfaz
- Exportación a PDF
- Notificaciones por correo
- Historial de versiones de una misma investigación

### Criterio de éxito

Un cliente nuevo pasa de "no existe en el sistema" a "presentación compartible" sin que nadie escriba HTML, y el resultado es publicable ante el cliente final con revisión editorial, no con reescritura.

---

## 3. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Astro 5, SSR con adapter Node | El usuario ya lo usa en otros proyectos. SSR necesario por la sesión |
| Interactividad | React, solo en islas | Formulario, subida de archivos y panel de progreso. El resto es HTML estático |
| Base de datos | PostgreSQL en Railway | Plugin nativo de Railway, cero configuración |
| ORM | Drizzle | SQL tipado sin paso de generación ni binarios. Migraciones legibles |
| Archivos | Volumen de Railway montado en `/data` | El sistema de archivos de Railway es efímero sin volumen |
| API de IA | `@anthropic-ai/sdk` con herramienta de búsqueda web | Es la fuente de la investigación |
| Sesión | Cookie httpOnly firmada, tabla `sessions` | Sin JWT: revocar una sesión debe ser borrar una fila |
| Contraseña | Argon2id | Estándar actual. Un solo hash en la base |

### Por qué worker en el mismo proceso

Con un usuario nunca habrá dos investigaciones simultáneas. Un intervalo que consulta la tabla de trabajos cada cinco segundos es suficiente y evita el costo y la complejidad de un segundo servicio en Railway.

El estado vive en la base de datos, no en memoria. Si Railway reinicia el servicio durante un despliegue, el trabajo se retoma desde la última etapa completada en lugar de perderse.

---

## 4. Modelo de datos

### `users`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| email | text unique | |
| password_hash | text | Argon2id |
| created_at | timestamptz | |

Una sola fila en v1. La tabla existe para que agregar usuarios después no requiera migración de datos.

### `sessions`
| Columna | Tipo | Nota |
|---|---|---|
| id | text pk | Token aleatorio de 32 bytes |
| user_id | uuid fk | |
| expires_at | timestamptz | 30 días |
| created_at | timestamptz | |

### `clients`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| nombre | text | Nombre de la persona o marca |
| giro | text | Sector. Alimenta el prompt de investigación |
| producto | text | Qué vende exactamente |
| ciudad | text | Determina el foco geográfico |
| ticket | text nullable | Precio o rango. Define si el ciclo es largo |
| contacto | text nullable | Correo o teléfono |
| notas | text nullable | Contexto libre que el operador quiera dar al pipeline |
| created_at, updated_at | timestamptz | |

### `client_links`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| client_id | uuid fk cascade | |
| tipo | enum | `sitio`, `instagram`, `facebook`, `tiktok`, `youtube`, `ventas`, `otro` |
| url | text | |

### `client_files`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| client_id | uuid fk cascade | |
| nombre_original | text | |
| ruta | text | Relativa a `/data` |
| mime | text | |
| bytes | integer | |
| texto_extraido | text nullable | Se llena al subir |
| estado_extraccion | enum | `pendiente`, `ok`, `fallo`, `no_aplica` |
| created_at | timestamptz | |

Las imágenes tienen `estado_extraccion = no_aplica`: no se extrae texto, se envían como contenido visual al agente que las necesite.

### `research_jobs`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| client_id | uuid fk cascade | |
| estado | enum | `encolado`, `corriendo`, `completado`, `fallido`, `cancelado` |
| etapa_actual | text nullable | Nombre del agente en curso |
| etapas | jsonb | Estado de cada agente: `{competencia: "ok", audiencia: "corriendo", ...}` |
| tokens_entrada | integer | Acumulado |
| tokens_salida | integer | Acumulado |
| costo_usd | numeric(10,4) | Calculado al cierre de cada etapa |
| error | text nullable | Mensaje si falló |
| started_at, finished_at | timestamptz nullable | |
| created_at | timestamptz | |

### `research_results`
| Columna | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| job_id | uuid fk | |
| client_id | uuid fk cascade | |
| datos | jsonb | El JSON de los 17 paneles |
| version | integer | Incremental por cliente |
| created_at | timestamptz | |

### `share_links`
| Columna | Tipo | Nota |
|---|---|---|
| token | text pk | 32 bytes aleatorios, base64url |
| result_id | uuid fk cascade | |
| revocado | boolean | Default false |
| visitas | integer | Contador simple |
| created_at | timestamptz | |

---

## 5. Pantallas y flujos

### `/login`
Formulario de correo y contraseña. Al validar, crea sesión y redirige a `/`.
Tres intentos fallidos en cinco minutos bloquean el correo durante quince minutos.

### `/`
Lista de clientes. Por cada uno: nombre, giro, fecha de última investigación, estado y costo acumulado.
Botón de alta. Buscador por nombre cuando haya más de diez clientes.

### `/clientes/nuevo`
Formulario con los campos de `clients`. Enlaces y archivos se agregan después, en la ficha.
Solo `nombre`, `giro` y `producto` son obligatorios: son los tres que el pipeline necesita para arrancar.

### `/clientes/[id]`
Ficha en cuatro bloques:
1. **Datos** — editables en línea
2. **Enlaces** — agregar y quitar, con validación de formato de URL
3. **Archivos** — subir, ver estado de extracción, eliminar
4. **Investigaciones** — lista de jobs con su estado, costo y enlace al resultado

Botón **Investigar**, deshabilitado si ya hay un job corriendo para ese cliente.

### `/clientes/[id]/investigar`
Pantalla de confirmación antes de gastar dinero. Muestra:
- Qué datos se van a usar: campos, cuántos enlaces, cuántos archivos con texto extraído
- Advertencias si falta algo relevante: sin enlaces, sin archivos, sin ticket
- Estimación de costo y duración
- Botón de confirmación

### `/jobs/[id]`
Progreso en vivo mediante consulta periódica cada tres segundos.
Muestra las cinco etapas con su estado y, al terminar cada una, un resumen de lo que encontró.
Al completarse, enlace directo al resultado.

### `/resultados/[id]`
La presentación de 17 paneles, renderizada desde el JSON. Vista privada.
Barra superior con: regenerar presentación, crear o revocar link público, ver el JSON crudo.

### `/p/[token]`
La misma presentación, sin barra de administración ni sesión. Incrementa el contador de visitas.
Si el token está revocado, devuelve 404 — no una página de "revocado", que confirmaría que existió.

---

## 6. El pipeline

### Entrada

Un objeto con los datos del cliente, sus enlaces, y el texto extraído de sus archivos.

El texto de cada archivo se recorta a **40,000 caracteres** (unos 10 mil tokens). Si un documento excede ese límite, se conservan los primeros 30,000 y los últimos 10,000 caracteres: el inicio suele traer la propuesta y el índice, el final suele traer precios y condiciones. Se registra en el reporte que hubo recorte.

### Los cinco agentes

Los primeros cuatro corren en paralelo. El quinto espera a los otros.

| # | Agente | Qué investiga | Paneles que alimenta |
|---|---|---|---|
| 1 | Competencia | Competidores directos con precios verificados, indirectos, referentes del nicho, tamaño de sus audiencias | 8, 9, 10 |
| 2 | Audiencia | Cómo se nombra el mercado, jerga, dolores con citas textuales, aspiraciones, objeciones | 3, 4, 6, 7 |
| 3 | Canales | Penetración de plataformas, formatos que rinden, estacionalidad del giro | 5 |
| 4 | Mercado | Datos oficiales del sector, salarios, tamaño, regulación aplicable | 9, 13 |
| 5 | Síntesis | Lee los cuatro anteriores. Produce hallazgos, posicionamiento, oferta y ciclo de compra | 1, 2, 11, 12, 14–17 |

Cada agente recibe: los datos del cliente, la herramienta de búsqueda web, y su esquema de salida.

**Modelos:** los cuatro agentes de investigación usan `claude-sonnet-5` — buscan y extraen, que es trabajo de volumen. La síntesis usa `claude-opus-5`, porque es donde se decide el posicionamiento y se conectan hallazgos entre fuentes, que es el trabajo de criterio. Ambos configurables por variable de entorno para poder abaratar o subir calidad sin tocar código.

### Contrato de salida

Cada agente devuelve JSON validado con Zod. Si la validación falla, se reintenta una vez con el error de validación en el mensaje. Si falla de nuevo, la etapa se marca como `fallo` y **los paneles que dependían de ella se renderizan vacíos con la razón visible**.

Esto es deliberado: es preferible una presentación que declare "no se encontraron datos de competencia" a una que los invente. Es el mismo criterio editorial de los documentos hechos a mano.

### Reglas que hereda del trabajo manual

Se codifican en los prompts del sistema, no quedan a criterio del modelo:

- Toda cifra lleva fuente. Sin fuente, no se incluye.
- Las citas textuales van entre comillas y anonimizadas si son de personas privadas.
- Nunca se inventan testimonios ni verbatims.
- Cuando un dato no existe públicamente, se declara el vacío.
- El aval o credencial que la competencia también tiene no puede ser el diferenciador.

### Costo y control

Antes de lanzar, el sistema estima el costo promediando las corridas previas del mismo giro. Sin historial, muestra **8 USD** como referencia, configurable por variable de entorno.

Durante la corrida acumula tokens reales por etapa. Si el costo supera un tope configurable —por defecto 15 USD— el job se detiene y se marca como fallido con la razón. Un bucle de reintentos descontrolado no puede vaciar la cuenta.

---

## 7. Errores

| Situación | Comportamiento |
|---|---|
| La API devuelve error de límite de tasa | Reintento con espera exponencial, hasta tres veces |
| Un agente devuelve JSON inválido | Un reintento con el error incluido; si falla, etapa marcada como fallo |
| Falla un agente de los cuatro | La síntesis corre igual, con los datos que sí llegaron. Los paneles huérfanos se marcan vacíos |
| Falla la síntesis | El job se marca fallido. Los cuatro resultados parciales quedan guardados y se pueden reusar al reintentar |
| El servicio se reinicia a media corrida | Al arrancar, el worker retoma los jobs en estado `corriendo` desde la última etapa completada |
| Un PDF no se puede leer | Se marca `estado_extraccion = fallo`, se avisa en la ficha, no bloquea la investigación |
| Un enlace no responde | Se registra en el reporte del agente y se sigue |

---

## 8. Seguridad

- La llave de la API vive en variables de entorno de Railway. Nunca en el código ni en la base.
- La contraseña se guarda con Argon2id.
- Cookie de sesión `httpOnly`, `secure`, `sameSite=lax`.
- Los tokens de compartir son de 32 bytes aleatorios criptográficos, no secuenciales ni derivados del id.
- Las rutas de archivo se validan contra escape de directorio antes de leer o escribir.
- Los archivos subidos se sirven solo a través de rutas autenticadas, nunca por URL directa al volumen.
- Límite de tamaño por archivo: 25 MB. Tipos permitidos por lista blanca de MIME.

---

## 9. Despliegue

Un solo servicio de Railway más el plugin de PostgreSQL.

**Variables de entorno:**
```
DATABASE_URL           inyectada por Railway
ANTHROPIC_API_KEY      manual
SESSION_SECRET         manual, 32 bytes aleatorios
DATA_DIR               /data
COST_LIMIT_USD         15
COST_ESTIMATE_USD      8
MODEL_RESEARCH         claude-sonnet-5
MODEL_SYNTHESIS        claude-opus-5
PUBLIC_BASE_URL        el dominio de Railway
```

**Volumen:** montado en `/data`, 5 GB inicial.

**Migraciones:** se ejecutan en el arranque, antes de levantar el servidor. Drizzle las aplica de forma idempotente.

---

## 10. Pruebas

| Nivel | Qué se prueba | Cómo |
|---|---|---|
| Esquemas | Que un JSON válido pase y uno inválido falle con mensaje útil | Zod, sin red |
| Renderizado | Que un JSON completo produzca los 17 paneles, y uno con huecos los marque vacíos | Fixture fijo, sin red |
| Pipeline | Orden de etapas, reanudación, tope de costo | API simulada, sin gasto real |
| Autenticación | Sesión válida, expirada, revocada; bloqueo por intentos | Base de pruebas |
| Archivos | Extracción de PDF, rechazo de MIME no permitido, escape de rutas | Archivos de ejemplo |
| Extremo a extremo | Alta de cliente → investigación simulada → presentación → link público | Playwright, API simulada |

**Regla:** ninguna prueba automatizada llama a la API real de Claude. El gasto se verifica a mano, una vez, con un cliente de prueba.

---

## 11. Riesgos conocidos

**La calidad depende de lo que encuentre la búsqueda web.** En giros con poca información pública en español, la investigación saldrá pobre. El sistema lo declarará en vez de rellenar, pero el operador debe saber que hay sectores donde el resultado será delgado.

**El costo por investigación es variable.** Depende de cuánto encuentre cada agente. El tope duro protege de sorpresas, pero no hace el costo predecible.

**Veinte a treinta minutos es mucho tiempo.** Si el operador cierra la pestaña, el trabajo sigue, pero no hay aviso al terminar. En v1 se resuelve consultando la lista; una notificación queda para después.

**Un solo proceso significa un solo trabajo a la vez.** Suficiente para un usuario. Si en el futuro hay equipo, el worker debe salir a un servicio aparte.

---

## 12. Qué sigue después de v1

En este orden:

1. **Bloque Growth** — el machote de campaña, alimentado por el Social Research del mismo cliente
2. **Edición del JSON desde la interfaz** — corregir un dato sin volver a investigar
3. **Exportación a PDF** — para clientes que piden documento
4. **Notificación al terminar** — correo o WhatsApp
5. **Multiusuario** — solo si entra alguien más al equipo
