# Sistema de trabajo · C · Portal del cliente · D · Desempeño · Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:**
- **Portal del cliente:** muestra su avance, sus etapas y sus documentos aprobados, y le permite dejar observaciones en las etapas 3 y 4.
- **Tablero de desempeño:** mide tiempos, calidad, carga y costo por operador y por cliente.

**Architecture:**
- **Portal:** usa su propio layout (`PortalBase.astro`) con la línea editorial del Studio. Los documentos se rinden desde la versión aprobada (`documento_versiones`) con los renders públicos, anclas y el modo Comentar del cliente.
- **Desempeño:** funciones puras (`src/lib/desempeno.ts`) sobre eventos, comentarios, jobs y etapas; la página solo consulta y presenta.

**Spec:** `docs/superpowers/specs/2026-09-16-sistema-trabajo-design.md` §4, §5

**Depende de:** planes A y B completos.

## Global Constraints

Las mismas de los planes A y B:
- Rama `feat/rediseno`, sin push ni despliegue.
- `node_modules` va por enlace: nunca `npm install`/`npm ci`.
- No tocar el `astro dev` del usuario en 4321.
- Sin llamadas reales a Anthropic ni a Resend; nunca imprimir ni editar `.env`.
- Migraciones solo en la base local.
- Comentarios en español.
- Commits con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Tests y build en verde en cada tarea.
- Sin permiso: 404.
- Diseño con tokens: sin `.a + .a {margin}`, objetivos de 44 px, foco visible, claro y oscuro, datos escapados.

---

### Task C1: Layout y portada del portal

**Files:**
- Create: `src/layouts/PortalBase.astro`, `src/pages/portal/index.astro`, `src/lib/portal.ts`
- Test: `tests/lib/portal.test.ts`

**Produces:**
- `resumenPortal(etapas: EtapaCliente[] & { versionAprobadaId, actualizadoEn }[]): { avance: number; tarjetas: { etapaId; etapa; nombre; estadoCliente; listo: boolean; puedeComentar: boolean; proximamente: boolean }[] }`. Es pura: usa `etapasVisiblesCliente`, `avanceCliente`, `ESTADO_CLIENTE` y `puedeComentar('cliente', false, etapa)`. `listo` = hay `versionAprobadaId`; `proximamente` = `desarrollo_mensual`.
- `clientePortal(usuario, query)`:
  - Si el usuario es `cliente`, usa su `clientId`.
  - Si es admin u operador asignado con `?cliente=<id>`, abre ese cliente en modo vista previa.
  - En cualquier otro caso devuelve `null` (404).

**Requisitos:**
- **`PortalBase.astro`:**
  - `<head>` igual que Base: tokens, `SCRIPT_TEMA`, Poppins.
  - Cabecera tipo píldora con logo, nombre de la empresa, switch día/noche, `Campana` y «Salir».
  - Sin barra lateral.
  - Contenido al 85% (máximo 1100 px, porque es menos denso).
  - Banda «Vista previa del portal · volver a la ficha» cuando la ve alguien interno.
- **`/portal`:**
  - Saludo «Hola, {nombre del usuario o de la empresa}».
  - **Anillo de avance:** SVG con `stroke-dasharray` por porcentaje, `role="img"` y `aria-label="Avance {n}%"`.
  - **Tarjetas por etapa visible:** número, nombre, estado para el cliente y fecha, más botones:
    - «Ver documento» si está lista;
    - «Dejar observaciones» si está lista y `puedeComentar`;
    - «Próximamente» para la etapa 3.
  - **Actividad reciente:** los últimos 8 eventos visibles para el cliente: aprobaciones de etapas visibles y respuestas a sus comentarios.
  - **Estado vacío:** «Tu equipo está preparando tus primeros entregables».
- **Pruebas** de `resumenPortal`: avance, orden, ocultar las internas, `puedeComentar` solo en las etapas 3 y 4, `proximamente`.
- **Verificación por curl:**
  - el usuario cliente local recibe 200 en `/portal`, que contiene su avance;
  - el operador asignado recibe 200 con `?cliente=`;
  - operador2 recibe 404.
- **Commit:** `feat(portal): portada del cliente con avance y etapas`.

---

### Task C2: Documento aprobado en el portal y observaciones

**Files:**
- Create: `src/pages/portal/documentos/[etapaId].astro`
- Modify: los renders para aceptar `{ vista: 'portal', comentarios: boolean }` si hace falta; `src/render/editorial/flujo-cliente.ts` (modo Comentar del cliente)
- Test: `tests/render/portal.test.ts`

**Requisitos:**
- **Carga:**
  - Carga la etapa y su `versionAprobadaId` desde `documento_versiones`; si no hay versión aprobada, 404.
  - Verifica que el cliente sea el suyo, o vista previa interna.
- **Render:** según `documentoTipo` y con los `datos` de la versión aprobada:

| Tipo | Función |
|---|---|
| `research` | `renderizarInvestigacion` |
| `pilares` | `renderizarPilares` |
| `growth` | `renderizarManual` |

  - Sin controles internos: sin Compartir, Editar ni estados de temas.
  - Con `data-ancla`.
  - Enlace «← Mi portal».
- **Observaciones** (solo en `manual_campana` y `desarrollo_mensual`):
  - Inyectar `SCRIPT_FLUJO` con `data-flujo` `{ rol: 'cliente', puedeComentar: true, puedeEditar: false, etapaId }`.
  - El panel muestra solo sus comentarios y las respuestas del equipo.
  - Texto de ayuda: «Selecciona una parte del documento para dejar una observación a tu equipo».
- **Pruebas:**
  - El HTML del portal para `research` no contiene `Compartir`, `data-editable` ni `/api/share`.
  - Para `growth`, contiene `data-flujo` con `puedeComentar`.
  - Para `research`, no contiene `puedeComentar":true`.
- **Verificación por curl:**
  - Aprobar localmente un documento con el admin, por la API de transición.
  - El cliente abre el documento: 200.
  - Para `growth`: comenta; la etapa pasa a `con_cambios`; aparece el aviso al operador.
- **Commit:** `feat(portal): documentos aprobados y observaciones del cliente`.

---

### Task D1: Métricas de desempeño (puras)

**Files:** Create `src/lib/desempeno.ts`; Test `tests/lib/desempeno.test.ts`.

**Produces:**
```ts
export type Evento = { etapaId: string; clientId: string; etapa: Etapa; accion: string; de: Estado | null; a: Estado; creadoEn: Date };
export type ComentarioM = { etapaId: string; autorRol: 'admin' | 'operador' | 'cliente'; creadoEn: Date };
export type JobM = { clientId: string; tipo: 'research' | 'growth' | 'pilares'; costoUsd: number; creadoPor: string | null; creadoEn: Date };
export type EtapaM = { id: string; clientId: string; etapa: Etapa; estado: Estado; contratada: boolean; interna: boolean; operadorId: string | null };
export type Periodo = { desde: Date | null; hasta: Date };

export function periodo(clave: 'mes' | 'mes_anterior' | '90' | 'todo', ahora: Date): Periodo; // zona America/Mexico_City para límites de mes
export function diasEntre(a: Date, b: Date): number; // 1 decimal
export function resumenEstadistico(valores: number[]): { promedio: number | null; mediana: number | null; n: number };
export function tiemposPorEtapa(eventos: Evento[]): {
  duracion: Record<Etapa, number[]>;        // primer a='en_proceso' → siguiente a='aprobada' por etapaId
  esperaRevision: number[];                  // cada accion='solicitar' → siguiente aprobar|pedir_cambios de esa etapa
  respuestaCambios: number[];                // cada pedir_cambios|reabrir|comentario_cliente → siguiente solicitar
};
export function calidad(eventos: Evento[], comentarios: ComentarioM[]): {
  rondasPorEtapaAprobada: number[];          // por etapaId con al menos un 'aprobar': conteo pedir_cambios+reabrir
  comentariosAdminPorEntregable: number; comentariosClientePorEntregable: number; // promedios por etapaId con comentarios
};
export function carga(etapas: EtapaM[], eventos: Evento[], p: Periodo): {
  clientes: number; etapasActivas: number; avancePromedio: number; aprobadasEnPeriodo: number;
};
export function costo(jobs: JobM[], operadorDeCliente: Map<string, string | null>, p: Periodo): {
  total: number; porCliente: Map<string, number>; porEtapa: Record<'research' | 'growth' | 'pilares', number>; porOperador: Map<string, number>;
};
export function filtrarPeriodo<T extends { creadoEn: Date }>(xs: T[], p: Periodo): T[];
```

- [ ] **Pruebas** con eventos sintéticos de fechas fijas. Cada función con al menos un caso normal y uno de borde:
  - etapa sin aprobar: no cuenta en duración;
  - `solicitar` sin decisión: no cuenta;
  - listas vacías: `null`;
  - mediana con n par;
  - costo con `creadoPor` nulo, que usa el operador del cliente;
  - `periodo('mes')` en el borde UTC/CDMX, que devuelve el día 1 local.
- [ ] Implementar y commit `feat(desempeno): métricas de tiempos, calidad, carga y costo`.

---

### Task D2: Tablero `/desempeno`

**Files:** Create `src/pages/desempeno.astro`; Modify `src/layouts/Base.astro` (`activo="desempeno"`, si no quedó en A5).

**Requisitos:**
- **Consulta:**
  - Etapas, eventos, comentarios y jobs de los clientes visibles.
  - El admin puede filtrar `?operador=<id>`; el operador solo ve lo suyo.
  - `?periodo=mes|mes_anterior|90|todo` (por omisión, `mes`).
- **Vista:**
  - Encabezado «Desempeño».
  - Chips de periodo y select de operador (solo admin).
  - **Fila de 4 indicadores:**
    - clientes;
    - etapas activas;
    - avance promedio;
    - aprobadas en el periodo.
  - **Fila de 4 indicadores:**
    - días promedio a aprobar;
    - espera promedio en revisión;
    - rondas de cambios promedio;
    - costo del periodo.
  - **Barras horizontales:**
    - días promedio por etapa;
    - costo por tipo.

    Usar `graficaBarras` de `src/render/investigacion/graficas.ts` (o del lugar al que se haya movido en la base editorial). Si su formato de monto no aplica a días, añadir un parámetro `formato: (n) => string` con valor por omisión de pesos, sin romper sus pruebas.
  - **Tabla «Por operador»** (admin): clientes, etapas activas, avance promedio, días a aprobar, rondas y costo.
  - **Tabla «Por cliente»:** avance, etapa actual, operador y costo.
  - Estados vacíos claros: «Todavía no hay actividad en este periodo».
- **Verificación:**
  - Sembrar localmente unos eventos con transiciones reales hechas por la API en B, o insertar eventos de prueba en el scratchpad.
  - Por curl: el admin recibe 200 con cifras; el operador recibe 200 sin el select de operador; el cliente es redirigido al portal.
- **Commit:** `feat(desempeno): tablero por operador y por cliente`.
