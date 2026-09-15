# Wozial Studio — Rediseño del sistema

**Fecha:** 2026-09-14
**Referencia visual:** https://familiaenpractica.com/menu/
**Alcance de este documento:** Etapa 1 · la app del operador. La etapa 2 (entregables) se describe al final y tendrá su propio plan.

---

## 1. Qué cambia y por qué

Hoy la app es oscura, con textura de ruido, una tira de calibración de cuatro colores y navegación por migas en una barra superior. Funciona, pero se lee como una herramienta interna: todas las pantallas pesan igual, las acciones importantes compiten con las secundarias y en el celular no hay una forma natural de moverse.

El rediseño adopta el lenguaje de la referencia —luminoso, aireado, con fichas pastel y navegación de app— conservando la identidad de Wozial: su logo y su paleta rosa, azul y amarillo.

No es solo aspecto. Cambia cómo se navega (lateral en escritorio, pestañas abajo en el celular), agrega un tablero de inicio, un buscador con ⌘K, una vista de entregables, y reorganiza la ficha del cliente en pestañas con las dos acciones principales arriba.

### Decisiones tomadas

| Tema | Decisión |
|---|---|
| Alcance | Todo, en dos etapas: primero la app, después los entregables |
| Color | Paleta Wozial traducida al estilo claro de la referencia |
| Tema inicial | Según el dispositivo; el switch manual se recuerda y manda |
| Navegación | Tipo app: lateral en escritorio, pestañas inferiores en celular |
| Fuente | Poppins en todo el sistema |
| Logo | Se conserva intacto |
| Implementación | Sistema nuevo de tokens CSS; sin Tailwind ni dependencias nuevas |

---

## 2. Sistema de tokens

Todos los colores, radios, sombras y tamaños viven como variables CSS en `:root`. El tema oscuro redefine **solo los valores**, nunca los nombres, bajo `:root[data-tema="oscuro"]`. Ningún componente escribe un color literal.

### Color

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--rosa` | `#B8446B` | `#F08BAC` | Acento principal, botón primario, eyebrow, foco |
| `--azul` | `#4E62C0` | `#8E9EEB` | Apoyo, estado "en curso" |
| `--amarillo` | `#6E6600` | `#DCDC4A` | Detalle, advertencias |
| `--verde` | `#08704E` | `#34D399` | Estado "listo" |
| `--rojo` | `#B83434` | `#F87171` | Errores y acciones destructivas |
| `--sobre-acento` | `#FFFFFF` | `#1A1624` | Texto sobre botón primario `--rosa` |
| `--rosa-s` | `#FBEEF2` | `#33222A` | Tinte de ficha rosa |
| `--azul-s` | `#EEF0FB` | `#1F2236` | Tinte de ficha azul |
| `--amarillo-s` | `#F7F7E0` | `#2A2A16` | Tinte de ficha amarilla |
| `--verde-s` | `#E7F6F0` | `#14291F` | Tinte de estado listo |
| `--rojo-s` | `#FCECEC` | `#301A1A` | Tinte de error |
| `--tinta` | `#1A1624` | `#F7F4FA` | Títulos |
| `--texto` | `#4A4258` | `#DAD3E4` | Cuerpo |
| `--suave` | `#716882` | `#A69CB8` | Texto secundario, ayudas |
| `--linea` | `#EEEAF2` | `#2C2636` | Bordes y divisores |
| `--fondo` | `#FFFFFF` | `#111017` | Fondo de página |
| `--gris` | `#F6F4F9` | `#1B1822` | Buscador, zonas, barra lateral |
| `--tarjeta` | `#FFFFFF` | `#1D1A25` | Tarjetas |

Los tonos de marca originales (`#D4688A`, `#C8C800`, verde `#0E9F6E`) **no alcanzan 4.5:1 sobre blanco** (3.4, 2.5 y 3.4). En claro se usan versiones más profundas del mismo tono, medidas contra `--fondo` y contra su propio tinte `-s` (todas ≥ 4.5:1). En oscuro el botón primario lleva texto `--sobre-acento` (tinta), porque blanco sobre `#F08BAC` da 2.3:1. Toda combinación de texto sobre fondo debe cumplir WCAG AA: 4.5:1 en cuerpo, 3:1 en texto grande; el plan incluye una prueba que lo verifica sobre los tokens.

### Tipografía

Poppins, pesos 400, 500, 600 y 700.

| Token | Valor | Uso |
|---|---|---|
| `--t-display` | `700 clamp(30px, 6vw, 42px)/1.06` | Saludo del tablero, título de login |
| `--t-h1` | `700 clamp(25px, 5vw, 34px)/1.14` | Título de pantalla |
| `--t-h2` | `700 clamp(19px, 3.6vw, 22px)/1.2` | Títulos de sección |
| `--t-h3` | `600 16.5px/1.25` | Títulos de tarjeta |
| `--t-body` | `400 15.5px/1.6` | Cuerpo |
| `--t-small` | `500 13px/1.45` | Etiquetas, datos secundarios |
| `--t-micro` | `700 11.5px/1.3` | Eyebrow en mayúsculas con espaciado `.14em` |

Los títulos llevan `letter-spacing: -0.035em`.

### Forma y profundidad

| Token | Valor |
|---|---|
| `--r` | `18px` · tarjetas |
| `--r-sm` | `12px` · campos, fichas pequeñas |
| `--r-pill` | `999px` · botones, buscador, chips |
| `--sombra` | `0 1px 2px rgba(26,22,36,.04), 0 10px 30px -20px rgba(26,22,36,.4)` |
| `--sombra` oscuro | `0 1px 2px rgba(0,0,0,.5), 0 12px 32px -22px #000` |
| `--foco` | `0 0 0 3px color-mix(in srgb, var(--rosa) 35%, transparent)` |
| `--ancho` | `1120px` · contenido máximo |
| `--tabs` | `70px` · alto de la barra inferior en celular |

### Lo que se retira

La textura de ruido del fondo y la tira de calibración del encabezado. Estaban pensadas para el fondo oscuro y sobre el claro se leen como suciedad.

---

## 3. Tema claro y oscuro

### Resolución

1. Si hay una elección guardada en `localStorage` bajo la clave `wozial-tema`, se usa.
2. Si no, se sigue `prefers-color-scheme` del dispositivo.
3. El resultado se escribe como `data-tema="claro"` o `data-tema="oscuro"` en `<html>`.

### Sin destello

El script que resuelve el tema va **en línea dentro del `<head>`**, antes de la hoja de estilos. Así el navegador pinta desde el primer cuadro con el tema correcto. Si se cargara después, cada página parpadearía en blanco antes de pasar a oscuro.

### El switch

Control segmentado sol/luna, como el de la referencia, presente en la barra superior de la app y en el login. Al moverlo se guarda la elección y se actualiza `data-tema` sin recargar. También se actualiza `<meta name="theme-color">` para que la barra del navegador del celular combine.

Si el usuario nunca movió el switch y cambia el tema de su dispositivo con la app abierta, la app lo sigue en vivo.

### El logo

`logo-wozial.png` es blanco sobre transparente. En tema claro se muestra con `filter: brightness(0)`, que lo vuelve negro sin tocar el archivo; en oscuro se muestra sin filtro. Es un logo monocromático de línea, así que el resultado es fiel.

---

## 4. Estructura de navegación

### Escritorio (≥ 900 px)

```
┌─────────────┬──────────────────────────────────────────┐
│  [LOGO]     │  🔍 Busca cliente…  ⌘K        ☀☾   Salir  │
│  STUDIO     ├──────────────────────────────────────────┤
│             │                                          │
│  ▣ Inicio   │                                          │
│  👥 Clientes │           contenido de la pantalla       │
│  📑 Entregab.│                                          │
│             │                                          │
│ [+ Nuevo    │                                          │
│   cliente]  │                                          │
└─────────────┴──────────────────────────────────────────┘
```

Barra lateral fija de 248 px sobre `--gris`. El ítem activo lleva fondo `--rosa-s` y texto `--rosa`.

### Celular (< 900 px)

La barra lateral desaparece. Arriba queda una barra con el logo, el switch y un botón de búsqueda. Abajo, una barra de pestañas fija: **Inicio · Clientes · Nuevo · Entregables**, respetando `env(safe-area-inset-bottom)`. El contenido reserva ese espacio al final para que la barra no tape nada.

### Rutas

| Ruta | Pantalla | Cambio |
|---|---|---|
| `/` | Tablero de inicio | **Nueva.** Antes era la lista de clientes |
| `/clientes` | Lista de clientes | **Nueva ruta** para la lista |
| `/clientes/nuevo` | Alta | Rediseño |
| `/clientes/[id]` | Ficha | Reorganizada en pestañas |
| `/clientes/[id]/investigar` | Confirmación | Rediseño a checklist |
| `/jobs/[id]` | Progreso | Línea de tiempo; corrige el bug de etapas de Growth |
| `/entregables` | Entregables | **Nueva** |
| `/login` | Acceso | Rediseño |

`/resultados/[id]`, `/growth/[id]` y `/p/...` no cambian en esta etapa: son entregables.

---

## 5. Pantallas

### Login

Sin tarjeta: composición centrada como el hero de la referencia. Logo, eyebrow `STUDIO · ACCESO PRIVADO`, título `Investigación de mercado asistida por agentes`, dos campos con icono y un botón primario de ancho completo.

- El switch sol/luna está en la esquina superior derecha.
- El campo de contraseña tiene un botón de ojo para mostrar u ocultar.
- Los errores existentes (`?error=bloqueado` y `?error=1`) aparecen en un aviso en línea arriba del botón, con su texto actual.

### Tablero de inicio

1. Eyebrow `HOLA` + título `Tu estudio hoy`.
2. **Buscador grande** tipo píldora que abre la paleta ⌘K.
3. **Cuatro fichas de indicadores** con tinte pastel:
   - Clientes registrados
   - En curso: jobs en estado `encolado` o `corriendo`
   - Entregables: suma de filas en `research_results` y `growth_results`
   - Gasto del mes: suma de `costo_usd` de los jobs creados en el mes calendario actual
4. **En curso**: solo si hay jobs activos. Por cada uno, cliente, tipo, barra de avance (etapas `ok` sobre el total del tipo), etapa actual y costo acumulado. Enlaza a `/jobs/[id]`.
5. **Clientes recientes**: los 6 más recientes por `updated_at`, como tarjetas con iniciales sobre tinte rotativo.

### Lista de clientes

- Buscador siempre visible. Se retira la regla actual que solo lo mostraba con más de diez clientes.
- Chips de filtro: `Todos · Listos · En curso · Sin investigar`.
  - **Listo**: su último job está `completado`.
  - **En curso**: tiene un job `encolado` o `corriendo`.
  - **Sin investigar**: no tiene ningún job.
  - Un cliente cuyo último job está `fallido` o `cancelado` aparece en `Todos` y en ningún otro filtro.
- Rejilla de tarjetas: 3 columnas en escritorio, 2 en tableta, 1 en celular. Cada tarjeta muestra iniciales, nombre, giro y ciudad, estado con punto de color y costo acumulado.
- Filtro y búsqueda combinan, se aplican en el cliente sin recargar.

### Alta de cliente

Mismos siete campos y validación actual. Formulario en una tarjeta con dos columnas en escritorio y una en celular. Los tres campos obligatorios —nombre, giro, producto— van primero y marcados. Al guardar con éxito lleva a la ficha nueva.

### Ficha del cliente

```
← Clientes
[YV]  Yessica Villa                               ⋯
      Cosmetología · Guadalajara

┌──────────────────────────┐ ┌──────────────────────────┐
│ 🔬 Investigar            │ │ 📣 Manual de campaña     │
│ Social Research          │ │ Growth                   │
│ Última: 12 ago · $6.80   │ │ Requiere investigación   │
│           [ Investigar ] │ │           [  Generar  ]  │
└──────────────────────────┘ └──────────────────────────┘

[ Datos ]  [ Enlaces 4 ]  [ Archivos 2 ]  [ Historial 3 ]
```

- **Tarjetas de acción.** La de Investigar muestra la fecha y el costo del último job de investigación, o `Nunca investigado`. La de Growth muestra el último manual o, si `puedeGrowth` es falso, el motivo y el botón deshabilitado.
- **Menú ⋯** con `Eliminar cliente`. La confirmación de dos pasos se conserva, ahora dentro de un diálogo.
- **Pestañas:** Datos, Enlaces, Archivos, Historial, con contador. La pestaña activa se refleja en el hash de la URL (`#enlaces`) para que un enlace directo o recargar la página conserve la pestaña.
- **Historial:** lista de jobs con fecha, tipo, estado, costo y enlace al resultado o al progreso. Corrige la tabla actual, cuyos encabezados no coinciden con sus celdas.
- Guardar datos y generar Growth conservan su lógica actual. Los mensajes pasan a toasts; los `alert()` actuales se reemplazan.

### Investigar

- Encabezado con el nombre del cliente y la frase de los cinco agentes.
- **Checklist visual** de lo que se envía: giro, producto, ciudad, ticket, enlaces, archivos con texto. Cada renglón con ✓ si hay dato y ⚠ si falta, usando las advertencias que ya produce `revisarAntesDeInvestigar`.
- **Panel de costo** a la derecha en escritorio, abajo en celular: estimado en grande, tope duro debajo y la nota de que al alcanzar el tope las etapas faltantes se declaran vacías.
- Botón `Lanzar investigación` con la misma lógica, incluida la redirección al job existente cuando el servidor responde 409.

### Progreso

- Encabezado con tipo y cliente.
- **Tarjeta de avance:** barra de porcentaje, tiempo transcurrido desde `startedAt` y costo acumulado contra el tope.
- **Línea de tiempo vertical** con las etapas del tipo correcto:
  - Investigación: competencia, audiencia, canales, mercado, síntesis.
  - Manual de campaña: estructura, creativos, google, prompts.
- Cada etapa con icono de estado: ✓ lista, animación en la que corre, ✕ falló, ○ en espera, ⊘ omitida por costo.
- No se muestra costo por etapa: **ese dato no se guarda**; solo existe el acumulado.
- Al terminar con resultado, botón grande `Ver la presentación` o `Ver el manual de campaña`.
- La consulta cada tres segundos se conserva.

### Entregables

- Lista de todos los documentos, de `research_results` y `growth_results`, del más reciente al más viejo.
- Chips de filtro: `Todos · Investigaciones · Manuales`.
- Cada renglón: cliente, tipo, versión, fecha, y el link público si existe uno sin revocar, con botón **Copiar** y contador de visitas. Si no existe, botón **Crear link**, que usa el `POST /api/share` actual.
- Enlace para abrir el documento en su vista de operador.

---

## 6. Componentes transversales

### Paleta ⌘K

- Se abre con ⌘K en Mac, Ctrl+K en otros sistemas, o tocando el buscador.
- Pide la lista a un nuevo `GET /api/clientes` que devuelve `id`, `nombre`, `giro` y `ciudad`, la primera vez que se abre; después la reutiliza.
- Filtra por nombre, giro o ciudad, sin distinguir acentos ni mayúsculas.
- Flechas para moverse, Enter para abrir la ficha, Escape para cerrar.
- Incluye dos acciones fijas: `Nuevo cliente` y `Ver entregables`.
- Mientras carga, muestra renglones esqueleto.

### Toasts

Aviso breve en la esquina inferior —arriba de la barra de pestañas en celular— para guardado, copiado y errores. Desaparece a los 4 segundos. Usa `role="status"` para lectores de pantalla, o `role="alert"` si es error.

### Estados vacíos

Cada lista vacía tiene una ilustración simple, una frase y una acción: sin clientes → `Registra tu primer cliente`; sin entregables → `Lanza tu primera investigación`.

### Iniciales y tinte

Las iniciales salen de las dos primeras palabras del nombre. El tinte se elige de forma **estable** a partir del id del cliente entre rosa, azul y amarillo: el mismo cliente conserva su color en todas las pantallas.

### Accesibilidad

- Foco visible con `--foco` en todo elemento interactivo.
- Navegación completa por teclado, incluida la paleta y las pestañas.
- `prefers-reduced-motion` desactiva animaciones y transiciones.
- Áreas táctiles de al menos 44 px en celular.

---

## 7. Compatibilidad con los componentes existentes

`LinksEditor`, `FilesUploader` y `ProgresoJob` usan clases compartidas: `btn`, `fantasma`, `chico`, `peligro`, `campo`, `campos`, `ancho`, `req`, `crece`, `aviso`, `rosa`, `amarillo`, `verde`, `ayuda`, `vacio`, `secundario`, `etiqueta` con sus estados (`encolado`, `corriendo`, `completado`, `fallido`, `cancelado`), `acciones`, `agregar`, `zona`, `encima`, `lista-enlaces`, `lista-archivos`, `nombre`, `titulo`, `tarjeta`, `sub`, `datos`.

La nueva hoja **conserva esos nombres** con el aspecto nuevo. Así `LinksEditor` y `FilesUploader` se ven bien sin tocar su JSX. `ProgresoJob` sí se reescribe, por la línea de tiempo y el bug de etapas.

---

## 8. Errores y bordes

| Situación | Comportamiento |
|---|---|
| `localStorage` bloqueado (modo privado) | El tema sigue al dispositivo; el switch funciona en la sesión sin guardarse |
| Navegador sin `color-mix` | El foco cae a un contorno rosa sólido |
| `GET /api/clientes` falla al abrir ⌘K | La paleta muestra `No se pudo cargar la lista` y conserva las acciones fijas |
| Copiar link sin permiso de portapapeles | Se selecciona el texto del link y el toast dice `Cópialo con ⌘C` |
| Job sin `startedAt` todavía | Se muestra `En cola` en lugar del tiempo transcurrido |
| Tipo de job desconocido | Se usan las etapas de investigación, como hoy |

---

## 9. Pruebas

| Nivel | Qué | Cómo |
|---|---|---|
| Lógica pura | Resolución de tema, iniciales, tinte estable, filtro sin acentos, estado de cliente, indicadores del tablero, porcentaje de avance, etapas por tipo, contraste AA de los tokens | Vitest, sin base |
| Endpoint | `GET /api/clientes` devuelve solo los cuatro campos | La proyección vive en una función pura probada con Vitest; el endpoint se comprueba con `curl` contra la app local |
| Visual | Cada pantalla en claro y oscuro, a 1440 px y a 390 px | Navegador contra la app local con datos de ejemplo |
| Regresión | Los tests existentes siguen pasando; `npm run build` compila | `npm test`, `npm run build` |

La verificación visual necesita **Postgres local**: hoy no está corriendo y Docker está instalado pero apagado.

---

## 10. Despliegue

Se trabaja en la rama `feat/rediseno`. **Nada se sube ni se despliega sin tu visto bueno explícito**: un push a `main` redepliega el servicio en Railway.

---

## 11. Etapa 2 · Entregables (fuera de este plan)

Aplicar el mismo sistema de tokens al deck de Social Research (`src/render`), al manual de Growth y a las páginas públicas `/p/...`, incluido el switch día/noche. Tiene implicaciones propias —los clientes ya recibieron links con el diseño actual, y el deck se navega en horizontal— así que tendrá su propio spec y su propio plan cuando la etapa 1 esté aprobada.
