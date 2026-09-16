# Tablero de avance e Inicio personalizado · Plan

> **Para agentes:** ejecutar con superpowers:subagent-driven-development, tarea por tarea.

**Objetivo:** que el Inicio salude por el nombre, muestre primero lo que espera por quien mira, y que tanto el Inicio como la lista de clientes muestren el avance de cada cliente.

**Diseño:** `docs/superpowers/specs/2026-09-16-tablero-avance-design.md` — léelo antes de empezar.

**Clave:** el cálculo del avance ya existe (`avanceCliente` en `src/flujo/reglas.ts`, con `PESOS`). Esto es sacar a la pantalla datos que ya se calculan, no inventar métricas nuevas.

**Entorno:** el proyecto vive en `/Volumes/TWF/Proyectos 2026/Wozial Studio`. Nunca `npm install`. `npx tsc --noEmit` está roto en este repo (unos `.d.cts` de `@jridgewell`); verificar con `npx vitest run` y `npx astro build`.

---

### Tarea 1: `resumenAvance`, función pura

**Archivos:** modificar `src/lib/ui/progreso.ts`; prueba en `tests/lib/ui/progreso.test.ts`.

- [ ] **Paso 1: pruebas que fallan.** Casos:
  - Cuatro etapas contratadas en estados `aprobada, aprobada, en_revision, no_iniciada` → `porcentaje` 63 (media de 100,100,50,0 redondeada) y `pasoActual` = la tercera.
  - Etapas no contratadas quedan fuera del porcentaje pero sí aparecen en `pasos` con `contratada: false`.
  - Sin etapas contratadas → `{ porcentaje: 0, pasoActual: null }`.
  - Todas aprobadas → `porcentaje` 100 y `pasoActual` null.
- [ ] **Paso 2:** correr y verlas fallar.
- [ ] **Paso 3: implementar.** `resumenAvance(etapas)` devuelve `{ porcentaje, pasos, pasoActual }`. Reusa `avanceCliente` y `etapasParaAvance` de `@/flujo/reglas` en lugar de recalcular; `pasos` va en el orden de `ETAPAS`; `pasoActual` es la primera etapa contratada cuyo estado no es `aprobada`.
- [ ] **Paso 4:** correr y verlas pasar.
- [ ] **Paso 5:** commit `feat(tablero): resumenAvance por cliente`.

---

### Tarea 2: etapas por lote

**Archivos:** modificar `src/flujo/servicio.ts`; prueba nueva si el patrón del repo lo permite.

- [ ] **Paso 1:** añadir `etapasDeClientes(clientIds: string[]): Promise<Map<string, FilaEtapa[]>>`, junto a `etapasDelCliente`. Un solo `select` con `inArray`. Con la lista vacía devuelve un `Map` vacío **sin consultar**.
- [ ] **Paso 2:** si `etapasDelCliente` puede expresarse con la nueva sin perder claridad, hazlo; si no, déjala como está y comenta por qué.
- [ ] **Paso 3:** `npx vitest run`.
- [ ] **Paso 4:** commit `feat(tablero): etapas de varios clientes en una consulta`.

---

### Tarea 3: extraer los pendientes a una función compartida

**Archivos:** modificar `src/lib/pendientes.ts` y `src/pages/pendientes.astro`.

Hoy la consulta vive dentro de la página. El Inicio la necesita también, y **duplicarla sería un error**: las reglas de qué cuenta como pendiente son sutiles (etapa contratada, rol del que mira, comentarios sin atender).

- [ ] **Paso 1:** leer `src/pages/pendientes.astro` completa y entender los dos caminos (admin y operador).
- [ ] **Paso 2:** extraer a `src/lib/pendientes.ts` una función `listarPendientes(usuario, { limite }): Promise<{ etapas: [...], comentarios: [...], total: number }>` que devuelva lo que hoy calcula la página, con el mismo criterio y el mismo orden.
- [ ] **Paso 3:** hacer que `/pendientes` use la función nueva y **comprobar que la página se ve exactamente igual que antes**. Este paso no debe cambiar ni un texto.
- [ ] **Paso 4:** `npx vitest run` y `npx astro build`.
- [ ] **Paso 5:** commit `refactor(pendientes): reusar la consulta desde el Inicio`.

---

### Tarea 4: el Inicio

**Archivos:** modificar `src/pages/index.astro`.

**Depende de las tareas 1, 2 y 3.**

- [ ] **Paso 1: saludo.** `Hola, {usuario.nombre || nombreVisible(usuario)}` en el `<h1 class="display">`. Conservar debajo la línea con la fecha.
- [ ] **Paso 2: bloque «Te toca a ti»**, primero en la página, con `listarPendientes(usuario, { limite: 8 })`. Cada renglón: cliente, etapa, cuánto lleva esperando (`fechaCorta` o relativo, mira qué usa `/pendientes`) y enlace al documento. Si `total > 8`, un enlace «Ver los N pendientes» a `/pendientes`. Si no hay nada, el vacío amable del diseño.
- [ ] **Paso 3: bloque «Avance de los clientes»** con `etapasDeClientes` + `resumenAvance`, ordenado por porcentaje ascendente. Cada tarjeta: cliente, responsable (`nombreVisible`), porcentaje, barra y la tira de los 4 pasos. Reusa las clases y colores de estado que ya usa la ficha del cliente (`src/pages/clientes/[id].astro`) para que un mismo estado se vea igual en todos lados; **no inventes una paleta nueva**.
- [ ] **Paso 4: cifras de arriba:** clientes activos, esperan por ti, avance promedio y gasto del mes.
- [ ] **Paso 5:** verificar de verdad a 1280px y a 375px, y en modo noche. La tira de 4 pasos en móvil no debe desbordar. Di en el reporte cómo lo comprobaste.
- [ ] **Paso 6:** `npx vitest run`, `npx astro build`, commit `feat(inicio): saludo, pendientes y avance por cliente`.

---

### Tarea 5: avance en la lista de clientes

**Archivos:** modificar `src/components/TarjetaCliente.astro` y `src/pages/clientes/index.astro`.

**Depende de las tareas 1 y 2.**

- [ ] **Paso 1:** `clientes/index.astro` trae las etapas con `etapasDeClientes` y le pasa a cada `TarjetaCliente` su `resumenAvance`.
- [ ] **Paso 2:** la tarjeta pinta barra, porcentaje y el nombre del paso en curso. Sin etapas contratadas: «Sin etapas contratadas», sin barra.
- [ ] **Paso 3:** `TarjetaCliente` se usa en más de un sitio — busca todos los usos con `grep -rn "TarjetaCliente" src/` y asegúrate de que el avance sea **opcional**, para no romper a quien no se lo pase.
- [ ] **Paso 4:** verificar a 1280px y 375px, día y noche.
- [ ] **Paso 5:** `npx vitest run`, `npx astro build`, commit `feat(clientes): avance en cada tarjeta`.

---

### Tarea 6: verificación final

- [ ] `npx vitest run` — todo en verde
- [ ] `npx astro build`
- [ ] Repasar el diseño sección por sección y confirmar que cada punto está
- [ ] Confirmar que `/pendientes` quedó idéntica a como estaba
