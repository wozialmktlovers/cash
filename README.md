# Wozial Studio

Aplicación web privada que toma los datos de un cliente, ejecuta una investigación
de mercado automatizada con la API de Claude y entrega el resultado como una
presentación de 17 paneles con link compartible.

> **Cada investigación gasta dinero real de la cuenta de Anthropic.** El tope por
> investigación es de 15 USD (`COST_LIMIT_USD`). Al alcanzarlo, las etapas que
> falten se declaran vacías en lugar de continuar.

## Qué hace

1. Das de alta un cliente con su giro, producto, enlaces y documentos.
2. Lanzas una investigación. Cinco agentes trabajan sobre ese contexto:
   competencia, audiencia, canales y mercado en paralelo, y después la síntesis.
3. Cada agente devuelve JSON validado con Zod. Lo que no pasa validación se
   reintenta una vez; si vuelve a fallar, la etapa se declara vacía **con su razón**.
4. El resultado se renderiza en una plantilla HTML fija. El diseño de la
   presentación nunca depende del modelo.
5. Generas un link público revocable para compartirlo con el cliente.

### Reglas que el sistema no rompe

- Toda cifra lleva fuente con URL y fecha de consulta. Sin fuente, no se incluye.
- Los paneles sin datos se declaran vacíos con la razón. Nunca se rellenan con
  contenido inventado.
- Las citas de personas privadas van anonimizadas.
- Todo el texto de interfaz está en español de México.

## Stack

Astro 7 con SSR · React 19 · TypeScript · PostgreSQL · Drizzle · Zod ·
`@anthropic-ai/sdk` · Vitest · Railway.

El worker vive dentro del mismo proceso del servidor: toma trabajos de la tabla
`research_jobs` cada cinco segundos. Un reinicio retoma los trabajos que quedaron
en estado `corriendo`.

## Correr en local

Requiere Node 22 o superior y un PostgreSQL accesible.

```bash
npm install
cp .env.example .env          # y llena los valores
npm run db:generate           # solo si cambiaste src/db/schema.ts
node --env-file=.env scripts/migrate.mjs
npm run dev
```

Para levantar Postgres con Docker:

```bash
docker run -d --name wozial-pg \
  -e POSTGRES_PASSWORD=wozial -e POSTGRES_USER=wozial -e POSTGRES_DB=wozial_studio \
  -p 5432:5432 postgres:16-alpine
```

### Crear un usuario

No hay registro público. Los usuarios se crean desde la línea de comandos:

```bash
node --env-file=.env scripts/crear-usuario.mjs tu@correo.com "contraseña-larga-y-única"
```

Las contraseñas se guardan con Argon2id. El mismo comando reemplaza la
contraseña si el correo ya existe.

### Tests

```bash
npm test
```

Ningún test llama a la API real de Anthropic: el SDK siempre va simulado.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL. Sin ella el servidor no arranca. |
| `ANTHROPIC_API_KEY` | Llave de la API de Claude. Sin ella las investigaciones fallan. |
| `SESSION_SECRET` | Secreto de sesión. Genéralo con `openssl rand -base64 32`. |
| `DATA_DIR` | Dónde se guardan los archivos subidos. En Railway apunta al volumen. |
| `COST_LIMIT_USD` | Tope duro por investigación. Al alcanzarlo se detiene. Por defecto 15. |
| `COST_ESTIMATE_USD` | Estimación que se le muestra al operador antes de lanzar. |
| `MODEL_RESEARCH` | Modelo de los cuatro agentes de investigación. |
| `MODEL_SYNTHESIS` | Modelo de la síntesis. |
| `PUBLIC_BASE_URL` | Base con la que se construyen los links públicos. Si queda mal, los links apuntan a un sitio inexistente. |

Las tarifas por millón de tokens viven en `src/lib/cost.ts`. **Revísalas contra la
lista de precios vigente antes de desplegar:** si se desactualizan, el tope de
costo corta antes o después de lo que debería.

## Desplegar

El repositorio está conectado a Railway. Cada push a `main` dispara un despliegue;
no hace falta `railway up`.

El arranque aplica migraciones antes de levantar el servidor
(`scripts/arranque.mjs`). Drizzle las aplica de forma idempotente, así que
reintentar un despliegue es seguro.

El servicio necesita:

- Una base de datos PostgreSQL, con su `DATABASE_URL` referenciada en las
  variables del servicio.
- Un volumen montado en `/data` para los archivos subidos. Sin volumen, los
  archivos se pierden en cada despliegue.

```bash
railway logs        # "Migraciones aplicadas", "[worker] iniciado"
```

### Crear el usuario administrador en producción

Si el servicio no tiene shell, define estas dos variables y redespliega:

| Variable | Valor |
|---|---|
| `ADMIN_EMAIL` | Tu correo |
| `ADMIN_PASSWORD` | Contraseña de 12 caracteres o más |

El arranque crea (o actualiza) ese usuario y lo anuncia en el registro.
**Borra ambas variables en cuanto puedas entrar:** ya cumplieron su función y
no hay razón para dejar una contraseña en las variables del servicio.

## Seguridad

**El repositorio es público.** Ningún secreto entra al historial de git: `.env`
está en `.gitignore` y `.dockerignore`, así que tampoco viaja dentro de la imagen.
Si alguna vez se filtra una llave, rotarla es obligatorio: borrarla del historial
no la invalida.

- Sesiones con cookie `httpOnly`, `sameSite=lax` y `secure` en producción.
- Bloqueo de 15 minutos tras tres intentos fallidos de inicio de sesión.
- Los tokens para compartir son de 32 bytes de `crypto.randomBytes`. Un token
  revocado y uno inexistente devuelven **ambos** 404: confirmar que existió
  filtraría información.
- Todo valor que viene del modelo se escapa antes de entrar al HTML.
- Las rutas de archivo se validan contra escape de directorio.
