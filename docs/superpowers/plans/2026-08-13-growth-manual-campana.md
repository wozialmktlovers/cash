# Growth Wozial · Manual de campaña — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar el «Growth Wozial · Manual de campaña» a partir de una investigación Social Research ya completada, con la misma línea de diseño del machote.

**Architecture:** El render se parte en tres capas (`base/`, `deck/`, `growth/`) para que los dos documentos compartan tokens y las 41 clases comunes, y con ellas la escala tipográfica de videollamada. El pipeline reutiliza `research_jobs` con una columna `tipo`. Cuatro agentes escriben solo lo que varía por cliente; la fontanería (UTM, GTM/GA4, medición, contadores) sale de código determinista.

**Tech Stack:** Astro 5 + Node adapter, Drizzle ORM sobre Postgres, Zod 4, SDK de Anthropic, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-13-growth-manual-campana-design.md`

## Global Constraints

- Estructura fija: **3 campañas Meta, 5 de Google, 9 creativos, 14 URLs**. Solo `semanas` varía (2..12).
- Los 9 creativos son 3 grupos (`a`,`b`,`c`) × 3 formatos (`imagen`,`video`,`carrusel`).
- Las 5 campañas de Google son exactamente `marca`, `categoria`, `precio`, `geo`, `contenido`.
- UTM en minúsculas, guion bajo, **sin acentos ni eñes**.
- `[periodo]` de `utm_campaign` = `YYYYMM` del `createdAt` del resultado, nunca de un reloj en tiempo de render.
- Límites reales de Google Ads: titulares RSA ≤ 30 caracteres, descripciones ≤ 90.
- Todo texto que venga de datos se escapa con `escapar()` antes de entrar al HTML.
- Ningún `font-size` en px sueltos y nada por debajo de `0.75rem`, en las tres capas de render.
- Ningún backtick ni `${` dentro de los literales de plantilla que contienen JavaScript.
- El machote manda sobre la línea de diseño: `~/Desktop/Claude/Wozial/estrategias/machote-growth-wozial.html`.

---

### Task 1: Freno real del tope de costo

Hoy las etapas paralelas consultan el tope antes de arrancar, todas con el acumulado en cero, así que ninguna se corta a media corrida. Es independiente del Growth y se puede desplegar solo.

**Files:**
- Modify: `src/research/pipeline.ts`
- Test: `tests/research/pipeline.test.ts`

**Interfaces:**
- Consumes: `superaTope(costoAcumulado, tope)` ya existe.
- Produces: `decidirEtapasPendientes` sin cambios; el comportamiento nuevo es interno a `ejecutarJob`.

- [ ] **Step 1: Write the failing test**

```ts
it('corta las etapas que aún no arrancaron cuando una se pasa del tope', async () => {
  // Dos etapas terminan baratas y la tercera se pasa sola del tope.
  // Las que queden sin arrancar deben quedar omitidas, no ejecutarse.
  const { repartirPorTope } = await import('@/research/pipeline');
  const estado: Record<string, string> = {};
  const gasto = { valor: 0 };
  const correr = async (etapa: string, costo: number) => { gasto.valor += costo; };

  await repartirPorTope(['competencia', 'audiencia', 'canales', 'mercado'], 3, gasto, estado, correr);

  expect(Object.values(estado)).toContain('omitido_por_costo');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/research/pipeline.test.ts -t "corta las etapas"`
Expected: FAIL — `repartirPorTope` no existe.

- [ ] **Step 3: Write minimal implementation**

En `src/research/pipeline.ts`, extraer el reparto a una función exportada y comprobar el tope **también al terminar cada etapa**:

```ts
/**
 * Corre las etapas en paralelo comprobando el tope antes de arrancar cada una
 * Y al terminar cada una. Sin la segunda comprobación el tope no frena nada:
 * las cuatro arrancan a la vez con el acumulado en cero.
 */
export async function repartirPorTope(
  etapas: string[],
  tope: number,
  gasto: { valor: number },
  estado: Record<string, string>,
  correr: (etapa: string) => Promise<void>,
  publicar: () => void = () => {},
): Promise<void> {
  await Promise.all(etapas.map(async (etapa) => {
    if (superaTope(gasto.valor, tope)) { estado[etapa] = 'omitido_por_costo'; publicar(); return; }
    estado[etapa] = 'corriendo';
    publicar();
    try {
      await correr(etapa);
      estado[etapa] = 'ok';
    } catch (e) {
      estado[etapa] = 'fallo';
      console.error(`[${etapa}]`, e);
    }
    publicar();
  }));
}
```

`ejecutarJob` pasa a usarla, y `correr` es quien suma a `gasto.valor` con `calcularCosto` justo al recibir la respuesta, para que las etapas que aún no arrancaron vean el acumulado real.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/research/pipeline.test.ts`
Expected: PASS, y los tests que ya existían del pipeline siguen verdes.

- [ ] **Step 5: Comprobar el tope entre reanudaciones de búsqueda web**

En `src/research/claude.ts`, `pedirJson` acepta `onUso?: (entrada: number, salida: number) => boolean`. Se llama tras cada respuesta, incluidas las reanudaciones de `pause_turn`; si devuelve `false`, el bucle se corta y devuelve lo acumulado. Test:

```ts
it('deja de reanudar el turno si el que llama dice que ya no hay presupuesto', async () => {
  const { pedirJson } = await import('@/research/claude');
  crear.mockResolvedValue(respuesta('', 100, 50, { stop_reason: 'pause_turn' }));
  await expect(pedirJson({
    modelo: 'claude-sonnet-5', sistema: 's', usuario: 'u', schema: esquema,
    buscarWeb: true, onUso: () => false,
  })).rejects.toThrow();
  expect(crear).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 6: Run full suite**

Run: `npx vitest run`
Expected: todo verde.

- [ ] **Step 7: Commit**

```bash
git add src/research/pipeline.ts src/research/claude.ts tests/research/
git commit -m "fix(costo): el tope no frenaba las etapas paralelas ni las reanudaciones"
```

---

### Task 2: Partir la hoja de estilos en base y deck

Refactor puro: mover reglas, no reescribirlas. El deck debe seguir produciendo exactamente lo mismo.

**Files:**
- Create: `src/render/base/tokens.ts`, `src/render/base/comunes.ts`
- Modify: `src/render/estilos.ts` (pasa a componer desde base + deck)
- Test: `tests/render/presentation.test.ts`

**Interfaces:**
- Produces: `TOKENS: string`, `CSS_COMUN: string` desde `@/render/base`; `ESTILOS` sigue exportándose desde `@/render/estilos` con la misma forma, para no tocar `presentation.ts`.

- [ ] **Step 1: Write the failing test**

```ts
it('la base trae los tokens y las clases comunes, y el deck las suyas', async () => {
  const { TOKENS, CSS_COMUN } = await import('@/render/base');
  expect(TOKENS).toContain('--esc');
  expect(TOKENS).toContain('--dim');
  for (const c of ['.card', '.tbl', '.lst', '.badge', '.blob', '.wrap', '.guia', '.grad']) {
    expect(CSS_COMUN, `falta ${c} en la base`).toContain(c);
  }
  // El envase del deck NO vive en la base: es lo que no comparte con el Growth.
  expect(CSS_COMUN).not.toContain('.deck{');
  expect(CSS_COMUN).not.toContain('.panel{');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/presentation.test.ts -t "la base trae"`
Expected: FAIL — no existe `@/render/base`.

- [ ] **Step 3: Mover las reglas**

`tokens.ts` se lleva el bloque `:root`, el reset, `html`, `body`, `body::before` y el bloque `@media (prefers-reduced-motion)`. `comunes.ts` se lleva tipografía, cards, grids, badges, stats, tabla, quote, listas, blobs, alert, guía, src, week, bar, persona, flow y `.par`. `estilos.ts` queda con el envase del deck (`deck`, `panel`, `wrap`, `nav-*`, `prog`, `dots`, `hint`, `mas`) y compone:

```ts
import { TOKENS, CSS_COMUN } from './base';
export const ESTILOS = `${TOKENS}\n${CSS_COMUN}\n${CSS_DECK}`;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: PASS. Las pruebas de videollamada siguen pasando porque miran `ESTILOS` compuesto.

- [ ] **Step 5: Verificar que el deck no cambió**

Run: `npx vitest run tests/render/`
Expected: sigue produciendo 17 paneles y todas las pruebas de escape.

- [ ] **Step 6: Commit**

```bash
git add src/render/ tests/render/
git commit -m "refactor(render): separar tokens y clases comunes del envase del deck"
```

---

### Task 3: Esquemas Zod del Growth

**Files:**
- Create: `src/growth/schemas.ts`
- Test: `tests/growth/schemas.test.ts`

**Interfaces:**
- Produces: `growthSchema`, y los tipos `Growth`, `CampanaMeta`, `CampanaGoogle`, `Creativo`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { growthSchema } from '@/growth/schemas';
import completo from '../fixtures/growth-completo.json';

describe('growthSchema', () => {
  it('acepta el fixture completo', () => {
    const r = growthSchema.safeParse(completo);
    if (!r.success) console.error(r.error.issues.slice(0, 5));
    expect(r.success).toBe(true);
  });

  it('rechaza ocho creativos: la estructura de la casa son nueve', () => {
    const malo = { ...structuredClone(completo), creativos: completo.creativos.slice(0, 8) };
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza diez creativos', () => {
    const malo = structuredClone(completo);
    malo.creativos.push(structuredClone(completo.creativos[0]));
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza un titular RSA de 31 caracteres, que Google no admite', () => {
    const malo = structuredClone(completo);
    malo.rsa.titulares[0] = 'x'.repeat(31);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza una descripción RSA de 91 caracteres', () => {
    const malo = structuredClone(completo);
    malo.rsa.descripciones[0] = 'x'.repeat(91);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza campañas de Google con una clave fuera del estándar', () => {
    const malo = structuredClone(completo);
    (malo.campanasGoogle[0] as any).clave = 'remarketing';
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/growth/schemas.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Write the schemas**

```ts
import { z } from 'zod';

export const GRUPOS = ['a', 'b', 'c'] as const;
export const FORMATOS = ['imagen', 'video', 'carrusel'] as const;
export const CLAVES_GOOGLE = ['marca', 'categoria', 'precio', 'geo', 'contenido'] as const;

export const campanaMetaSchema = z.object({
  grupo: z.enum(GRUPOS),
  nombre: z.string().min(1),
  objetivo: z.string().min(1),
  audiencia: z.string().min(1),
  angulo: z.string().min(1),
});

export const campanaGoogleSchema = z.object({
  clave: z.enum(CLAVES_GOOGLE),
  nombre: z.string().min(1),
  intencion: z.string().min(1),
});

export const creativoSchema = z.object({
  grupo: z.enum(GRUPOS),
  formato: z.enum(FORMATOS),
  ratio: z.enum(['1x1', '4x5', '9x16']),
  medidas: z.string().min(1),
  angulo: z.string().min(1),
  copyA: z.string().min(1),
  copyB: z.string().min(1),
});

export const growthSchema = z.object({
  semanas: z.number().int().min(2).max(12),
  campanasMeta: z.array(campanaMetaSchema).length(3),
  campanasGoogle: z.array(campanaGoogleSchema).length(5),
  creativos: z.array(creativoSchema).length(9),
  promptsImagen: z.object({
    base: z.string().min(1),
    porCreativo: z.array(z.string().min(1)).length(9),
  }),
  googleKeywords: z.array(z.object({
    clave: z.enum(CLAVES_GOOGLE),
    keywords: z.array(z.string()).min(1),
    negativas: z.array(z.string()),
  })).length(5),
  rsa: z.object({
    // Límites reales de Google Ads: cargar un titular más largo falla.
    titulares: z.array(z.string().min(1).max(30)).length(15),
    descripciones: z.array(z.string().min(1).max(90)).length(4),
  }),
  bloqueantes: z.array(z.string().min(1)).min(1),
  reglasCopy: z.array(z.string().min(1)).min(1),
});

export type Growth = z.infer<typeof growthSchema>;
export type CampanaMeta = z.infer<typeof campanaMetaSchema>;
export type CampanaGoogle = z.infer<typeof campanaGoogleSchema>;
export type Creativo = z.infer<typeof creativoSchema>;
```

- [ ] **Step 4: Crear el fixture**

`tests/fixtures/growth-completo.json` con los 9 creativos (a/b/c × imagen/video/carrusel), 3 campañas Meta, 5 de Google, 15 titulares de ≤30 caracteres y 4 descripciones de ≤90. Tomar el contenido del ejemplo real de Yessica Villa para que sea representativo y no relleno.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/growth/schemas.test.ts`
Expected: PASS, las seis.

- [ ] **Step 6: Commit**

```bash
git add src/growth/schemas.ts tests/growth/ tests/fixtures/growth-completo.json
git commit -m "feat(growth): esquemas con la estructura fija de la casa"
```

---

### Task 4: Constructor de URLs con UTM

Función pura. Es el corazón comprobable del generador determinista.

**Files:**
- Create: `src/growth/utm.ts`
- Test: `tests/growth/utm.test.ts`

**Interfaces:**
- Consumes: `Growth`, `CampanaMeta`, `Creativo` de `@/growth/schemas`.
- Produces: `normalizar(s: string): string` y `construirUrls(opts): UrlEtiquetada[]`, donde `UrlEtiquetada = { plataforma: 'meta'|'google', etiqueta: string, url: string }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { normalizar, construirUrls } from '@/growth/utm';
import completo from '../fixtures/growth-completo.json';

describe('normalizar', () => {
  it('baja a minúsculas', () => expect(normalizar('Meta')).toBe('meta'));
  it('quita acentos', () => expect(normalizar('Cosmiatría')).toBe('cosmiatria'));
  it('convierte la eñe', () => expect(normalizar('Diseño')).toBe('diseno'));
  it('cambia espacios por guion bajo', () => expect(normalizar('San Luis Potosí')).toBe('san_luis_potosi'));
  it('colapsa separadores repetidos', () => expect(normalizar('a  -  b')).toBe('a_b'));
  it('quita signos', () => expect(normalizar('¡Oferta! 50%')).toBe('oferta_50'));
  it('recorta los bordes', () => expect(normalizar('  hola  ')).toBe('hola'));
});

describe('construirUrls', () => {
  const opts = {
    growth: completo as any,
    destino: 'https://ejemplo.mx/registro',
    cliente: 'Yessica Villa',
    ciudad: 'San Luis Potosí',
    creadoEn: new Date('2026-08-13T00:00:00Z'),
  };

  it('produce exactamente 14 URLs: 9 de Meta y 5 de Google', () => {
    const urls = construirUrls(opts);
    expect(urls).toHaveLength(14);
    expect(urls.filter((u) => u.plataforma === 'meta')).toHaveLength(9);
    expect(urls.filter((u) => u.plataforma === 'google')).toHaveLength(5);
  });

  it('usa el periodo del resultado, no la fecha de hoy', () => {
    const urls = construirUrls(opts);
    expect(urls[0].url).toContain('utm_campaign=yessica_villa_202608');
  });

  it('etiqueta los creativos de Meta como grupo y formato', () => {
    const urls = construirUrls(opts).filter((u) => u.plataforma === 'meta');
    const contents = urls.map((u) => new URL(u.url).searchParams.get('utm_content'));
    expect(contents).toContain('ga_imagen');
    expect(contents).toContain('gc_carrusel');
  });

  it('mete la ciudad normalizada en la campaña geo de Google', () => {
    const geo = construirUrls(opts).find((u) => u.url.includes('g4_geo'));
    expect(geo!.url).toContain('g4_geo_san_luis_potosi');
  });

  it('omite la ciudad cuando el cliente no la tiene', () => {
    const geo = construirUrls({ ...opts, ciudad: undefined }).find((u) => u.url.includes('g4_geo'));
    expect(geo!.url).toContain('utm_content=g4_geo&');
  });

  it('Meta lleva paid_social y Google cpc', () => {
    const urls = construirUrls(opts);
    expect(urls.find((u) => u.plataforma === 'meta')!.url).toContain('utm_medium=paid_social');
    expect(urls.find((u) => u.plataforma === 'google')!.url).toContain('utm_medium=cpc');
  });

  it('deja la inserción dinámica de keyword sin codificar en Google', () => {
    const url = construirUrls(opts).find((u) => u.plataforma === 'google')!.url;
    expect(url).toContain('utm_term={keyword}');
  });

  it('conserva la query que ya trae la URL de destino', () => {
    const urls = construirUrls({ ...opts, destino: 'https://ejemplo.mx/r?plan=12' });
    expect(urls[0].url).toContain('plan=12');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/growth/utm.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Write the implementation**

```ts
import type { Growth } from './schemas';

export type UrlEtiquetada = { plataforma: 'meta' | 'google'; etiqueta: string; url: string };

/**
 * Minúsculas, guion bajo, sin acentos ni eñes. La regla del machote existe
 * porque en el reporte «Meta» y «meta» son dos fuentes distintas, y un acento
 * en un parámetro rompe el agrupado.
 */
export function normalizar(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function periodo(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function construirUrls(opts: {
  growth: Growth;
  destino: string;
  cliente: string;
  ciudad?: string;
  creadoEn: Date;
}): UrlEtiquetada[] {
  const { growth, destino, cliente, ciudad, creadoEn } = opts;
  const campana = `${normalizar(cliente)}_${periodo(creadoEn)}`;

  const armar = (params: Record<string, string>) => {
    const u = new URL(destino);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
    // La inserción dinámica de Google va literal: codificada, no la sustituye.
    return u.toString().replace(/%7Bkeyword%7D/gi, '{keyword}');
  };

  const meta = growth.creativos.map((c) => ({
    plataforma: 'meta' as const,
    etiqueta: `Grupo ${c.grupo.toUpperCase()} · ${c.formato}`,
    url: armar({
      utm_source: 'meta', utm_medium: 'paid_social', utm_campaign: campana,
      utm_content: `g${c.grupo}_${c.formato}`, utm_term: normalizar(c.angulo),
    }),
  }));

  const orden: Record<string, number> = { marca: 1, categoria: 2, precio: 3, geo: 4, contenido: 5 };
  const google = growth.campanasGoogle.map((c) => {
    const base = `g${orden[c.clave]}_${c.clave}`;
    const content = c.clave === 'geo' && ciudad ? `${base}_${normalizar(ciudad)}` : base;
    return {
      plataforma: 'google' as const,
      etiqueta: c.nombre,
      url: armar({
        utm_source: 'google', utm_medium: 'cpc', utm_campaign: campana,
        utm_content: content, utm_term: '{keyword}',
      }),
    };
  });

  return [...meta, ...google];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/growth/utm.test.ts`
Expected: PASS, las quince.

- [ ] **Step 5: Commit**

```bash
git add src/growth/utm.ts tests/growth/utm.test.ts
git commit -m "feat(growth): constructor determinista de las 14 URLs con UTM"
```

---

### Task 5: Migración de base de datos

**Files:**
- Modify: `src/db/schema.ts`, `src/lib/share.ts`
- Create: `drizzle/` (migración generada)
- Test: `tests/db/schema.test.ts`, `tests/lib/share.test.ts`

**Interfaces:**
- Produces: tabla `growthResults`; `researchJobs.tipo`; `shareLinks.documentoId` + `shareLinks.documentoTipo`. `crearShareLink(documentoId, tipo)` y `resolverShareLink(token)` devolviendo `{ documentoId, documentoTipo }`.

- [ ] **Step 1: Write the failing test**

```ts
it('share_links apunta a un documento con su tipo, no solo a una investigación', async () => {
  const { shareLinks, growthResults, researchJobs } = await import('@/db/schema');
  expect(shareLinks.documentoId).toBeDefined();
  expect(shareLinks.documentoTipo).toBeDefined();
  expect(growthResults).toBeDefined();
  expect(researchJobs.tipo).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Cambiar el esquema**

```ts
export const documentoTipo = pgEnum('documento_tipo', ['research', 'growth']);

export const growthResults = pgTable('growth_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

En `researchJobs` añadir `tipo: documentoTipo('tipo').notNull().default('research')`.

En `shareLinks`, sustituir `resultId` por `documentoId: uuid('documento_id').notNull()` y `documentoTipo: documentoTipo('documento_tipo').notNull().default('research')`. **Sin referencia de clave foránea**: apunta a dos tablas distintas, así que el borrado en cascada se hace a mano al borrar un resultado.

- [ ] **Step 4: Generar la migración con relleno**

Run: `npx drizzle-kit generate`

Editar el SQL generado para que la columna nueva se rellene antes de volverse obligatoria:

```sql
ALTER TABLE "share_links" ADD COLUMN "documento_id" uuid;
UPDATE "share_links" SET "documento_id" = "result_id";
ALTER TABLE "share_links" ALTER COLUMN "documento_id" SET NOT NULL;
ALTER TABLE "share_links" DROP COLUMN "result_id";
```

Los links ya repartidos siguen resolviendo: heredan `documento_tipo` con el valor por omisión `research`.

- [ ] **Step 5: Actualizar share.ts y sus tests**

```ts
export async function crearShareLink(documentoId: string, documentoTipo: 'research' | 'growth' = 'research'): Promise<string> {
  const token = generarTokenShare();
  await db.insert(shareLinks).values({ token, documentoId, documentoTipo });
  return token;
}
```

`resolverShareLink` devuelve `{ documentoId, documentoTipo } | null`, manteniendo la revocación y el contador de visitas.

- [ ] **Step 6: Run tests**

Run: `npx vitest run`
Expected: verde, incluidos los tests de share ya existentes adaptados.

- [ ] **Step 7: Commit**

```bash
git add src/db/ src/lib/share.ts drizzle/ tests/
git commit -m "feat(db): growth_results, tipo de job y share_links polimórfico"
```

---

### Task 6: Contexto y los cuatro agentes

**Files:**
- Create: `src/growth/contexto.ts`, `src/growth/agents/{estructura,creativos,google,prompts}.ts`
- Test: `tests/growth/agents.test.ts`

**Interfaces:**
- Consumes: `pedirJson` de `@/research/claude`; `Investigacion` de `@/research/schemas`.
- Produces: `armarContextoGrowth(inv, cliente): string`; `correrEstructura(ctx)`, `correrCreativos(ctx, estructura)`, `correrGoogle(ctx, estructura)`, `correrPrompts(ctx, creativos)`, cada uno devolviendo `{ datos, tokensEntrada, tokensSalida }`.

- [ ] **Step 1: Write the failing test**

```ts
it('el contexto lleva la investigación, no la ficha cruda del cliente', async () => {
  const { armarContextoGrowth } = await import('@/growth/contexto');
  const ctx = armarContextoGrowth(completa as any, { nombre: 'Ana', giro: 'X', producto: 'Y' } as any);
  expect(ctx).toContain('Ana');
  expect(ctx.toLowerCase()).toContain('competencia');
  expect(ctx.toLowerCase()).toContain('audiencia');
});

it('el contexto declara qué etapas vinieron vacías en vez de callarlo', async () => {
  const { armarContextoGrowth } = await import('@/growth/contexto');
  const ctx = armarContextoGrowth(parcial as any, { nombre: 'Ana' } as any);
  expect(ctx).toMatch(/no produjo|sin datos/i);
});

it('cada agente pide su esquema y suma su consumo', async () => {
  const { correrEstructura } = await import('@/growth/agents/estructura');
  // pedirJson mockeado devuelve el trozo de estructura del fixture
  const r = await correrEstructura('ctx');
  expect(r.datos.campanasMeta).toHaveLength(3);
  expect(r.tokensEntrada).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/growth/agents.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar contexto y agentes**

`armarContextoGrowth` serializa audiencia, personas, competencia, precios, ciclo de compra y regulación de la investigación, y **declara explícitamente las etapas vacías con su razón** para que el modelo no invente sobre datos que no existen.

Cada agente sigue el patrón de `src/research/agents/*.ts`: sistema con reglas duras, `pedirJson` con el sub-esquema correspondiente y `buscarWeb: false` — el Growth razona sobre lo ya investigado, no vuelve a buscar. Reglas por agente:

- `estructura`: 3 campañas Meta con grupos a/b/c y 5 de Google con las cinco claves obligatorias; `semanas` entre 2 y 12.
- `creativos`: exactamente 9, uno por combinación grupo × formato; los ratios por formato son `imagen`→`1x1`, `carrusel`→`4x5`, `video`→`9x16`; dos opciones de copy por creativo.
- `google`: keywords y negativas por campaña, más 15 titulares de ≤30 caracteres y 4 descripciones de ≤90. El límite va escrito en el prompt además de en el esquema.
- `prompts`: en inglés, un prompt base y uno por creativo. **Regla dura heredada del ejemplo real: nunca generar rostros identificables** — los prompts producen fondos, texturas y escenas, y la foto real se compone encima.

`estructura` produce además `bloqueantes` y `reglasCopy`. No son deterministas por mucho que lo parezcan: en el documento real son prosa apoyada en los hallazgos («el aval no es titular: IMNAS lo tiene por $3,450, va en el cuerpo como objeción resuelta»). El prompt le da la síntesis y `mercado.regulacion` como materia prima y le exige que cada bloqueante sea accionable y cada regla de copy verificable contra las políticas del giro.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/growth/agents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/growth/ tests/growth/agents.test.ts
git commit -m "feat(growth): contexto desde la investigación y los cuatro agentes"
```

---

### Task 7: Pipeline del Growth

**Files:**
- Create: `src/growth/pipeline.ts`
- Modify: `src/research/worker.ts`
- Test: `tests/growth/pipeline.test.ts`

**Interfaces:**
- Consumes: `repartirPorTope` de Task 1; los agentes de Task 6.
- Produces: `ejecutarGrowth(jobId: string): Promise<void>`; `ETAPAS_GROWTH`.

- [ ] **Step 1: Write the failing test**

```ts
it('prompts espera a creativos y las otras tres van en paralelo', async () => {
  const { ETAPAS_GROWTH, decidirParalelas } = await import('@/growth/pipeline');
  expect(ETAPAS_GROWTH).toEqual(['estructura', 'creativos', 'google', 'prompts']);
  expect(decidirParalelas(ETAPAS_GROWTH)).toEqual(['estructura', 'creativos', 'google']);
});

it('si creativos falla, prompts no se ejecuta y se declara vacío con su razón', async () => {
  const { razonDeVacioGrowth } = await import('@/growth/pipeline');
  expect(razonDeVacioGrowth('fallo')).toMatch(/no devolvió/i);
  expect(razonDeVacioGrowth('omitido_por_costo')).toMatch(/tope/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/growth/pipeline.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

`ejecutarGrowth` sigue la forma de `ejecutarJob`: carga el job, el cliente y **el último `research_results` del cliente**; si no hay ninguno, marca el job fallido con «Este cliente no tiene una investigación completada». Corre las tres etapas paralelas con `repartirPorTope`, luego `prompts` si `creativos` salió bien, e inserta en `growth_results`.

`worker.ts` despacha por `job.tipo`: `research` → `ejecutarJob`, `growth` → `ejecutarGrowth`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
git add src/growth/pipeline.ts src/research/worker.ts tests/growth/pipeline.test.ts
git commit -m "feat(growth): pipeline de cuatro etapas y despacho por tipo de job"
```

---

### Task 8: Estilos y navegación del Growth

**Files:**
- Create: `src/render/growth/estilos.ts`, `src/render/growth/navegacion.ts`
- Test: `tests/render/growth.test.ts`

**Interfaces:**
- Consumes: `TOKENS`, `CSS_COMUN` de `@/render/base`.
- Produces: `ESTILOS_GROWTH: string`, `NAVEGACION_GROWTH: string`.

- [ ] **Step 1: Write the failing test**

```ts
it('el script de navegación del Growth es JavaScript válido', async () => {
  const { NAVEGACION_GROWTH } = await import('@/render/growth/navegacion');
  expect(() => new Function(NAVEGACION_GROWTH)).not.toThrow();
});

it('los estilos del Growth heredan la base de videollamada', async () => {
  const { ESTILOS_GROWTH } = await import('@/render/growth/estilos');
  expect(ESTILOS_GROWTH).toContain('--esc');
  const sinRaiz = ESTILOS_GROWTH.replace(/html\s*\{[^}]*\}/g, '');
  expect([...sinRaiz.matchAll(/font-size:\s*([\d.]+)px/g)]).toEqual([]);
  const rems = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
  expect(Math.min(...rems)).toBeGreaterThanOrEqual(0.75);
});

it('trae las clases propias del machote', async () => {
  const { ESTILOS_GROWTH } = await import('@/render/growth/estilos');
  for (const c of ['.sec', '.slot', '.slots-car', '.ar-1x1', '.copy', '.kv', '.chips', '.utm', '.shead']) {
    expect(ESTILOS_GROWTH, `falta ${c}`).toContain(c);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/growth.test.ts`
Expected: FAIL.

- [ ] **Step 3: Portar el CSS del machote**

Copiar del machote las 49 clases propias, **convirtiendo todo `font-size` en px a rem** (÷16, con piso de 0.75rem) para cumplir el estándar de videollamada. Componer:

```ts
export const ESTILOS_GROWTH = `${TOKENS}\n${CSS_COMUN}\n${CSS_GROWTH}`;
```

`navegacion.ts`: nav de anclas con scroll-spy (marca el enlace de la sección visible con `IntersectionObserver`), barra de progreso de lectura, y los mismos controles de videollamada que el deck — botón de escala con tres pasos y pantalla completa. **Sin backticks ni `${` dentro del literal.**

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/render/growth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/growth/ tests/render/growth.test.ts
git commit -m "feat(growth): envase de nueve secciones con escala de videollamada"
```

---

### Task 9: Secciones deterministas

Las cuatro que no consumen tokens.

**Files:**
- Create: `src/render/growth/secciones/{portada,traza,tecnico,seguimiento}.ts`
- Test: `tests/render/growth-deterministas.test.ts`

**Interfaces:**
- Consumes: `construirUrls` de Task 4; `escapar` de `@/render/panels/comunes`.
- Produces: `seccionPortada(growth, meta)`, `seccionTraza(urls)`, `seccionTecnico(meta)`, `seccionSeguimiento(growth)`.

- [ ] **Step 1: Write the failing test**

```ts
it('la portada deriva los contadores de la estructura, no de constantes sueltas', async () => {
  const { seccionPortada } = await import('@/render/growth/secciones/portada');
  // Las semanas viven en el growth, no en meta: las decide el agente de estructura.
  const html = seccionPortada(
    { ...(completo as any), semanas: 6 },
    { cliente: 'Ana', producto: 'Diplomado' } as any,
    14, // cuántas URLs produjo el constructor de UTM
  );
  expect(html).toContain('3+5');
  expect(html).toContain('9');
  expect(html).toContain('14');
  expect(html).toContain('6');
});

it('los contadores salen de los datos, no están escritos a mano', async () => {
  const { seccionPortada } = await import('@/render/growth/secciones/portada');
  const html = seccionPortada({ ...(completo as any), semanas: 3 }, { cliente: 'Ana' } as any, 14);
  expect(html).toContain('3'); // semanas cambiadas se reflejan
  expect(html).not.toContain('4 Semanas');
});

it('la tabla de trazabilidad lista las 14 URLs y las escapa', async () => {
  const { seccionTraza } = await import('@/render/growth/secciones/traza');
  const urls = [{ plataforma: 'meta', etiqueta: '<script>x</script>', url: 'https://a.mx/?a=1' }];
  const html = seccionTraza(urls as any);
  expect(html).not.toContain('<script>x</script>');
  expect(html).toContain('&lt;script&gt;');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/growth-deterministas.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Cada archivo porta el markup de su bloque del machote, con esta correspondencia exacta:

| Archivo | Bloque del machote |
|---|---|
| `portada.ts` | cabecera de `<section id="setup">` hasta antes de «Bloqueantes» |
| `traza.ts` | `<section id="traza">` completa |
| `tecnico.ts` | `<section id="tecnico">` completa |
| `seguimiento.ts` | `<section id="seguimiento">` completa |

`seccionPortada(growth, meta, totalUrls)` calcula los contadores: `3+5` de las longitudes de `campanasMeta` y `campanasGoogle`, `9` de `creativos.length`, las URLs del argumento y las semanas de `growth.semanas`. Ninguno escrito a mano.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/render/growth-deterministas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/growth/secciones/ tests/render/growth-deterministas.test.ts
git commit -m "feat(growth): las cuatro secciones que no consumen tokens"
```

---

### Task 10: Secciones generadas y ensamblado

**Files:**
- Create: `src/render/growth/secciones/{setup,meta,creativos,prompts,google,rsa}.ts`, `src/render/growth/manual.ts`
- Test: `tests/render/growth-manual.test.ts`

**Interfaces:**
- Produces: `renderizarManual(growth, meta, barraOperador?): string`.

- [ ] **Step 1: Write the failing test**

```ts
it('produce las nueve secciones', () => {
  const html = renderizarManual(completo as any, meta);
  expect((html.match(/class="sec"/g) ?? []).length).toBe(9);
});

it('los nueve slots salen con su ratio y medidas aunque falten los copys', () => {
  const sinCopys = { ...structuredClone(completo), creativos: null };
  const html = renderizarManual(sinCopys as any, meta);
  expect((html.match(/class="slot/g) ?? []).length).toBeGreaterThanOrEqual(9);
  expect(html).toMatch(/no devolvió|sin datos/i);
});

it('escapa el HTML de los copys generados', () => {
  const malo = structuredClone(completo);
  malo.creativos[0].copyA = '<script>alert(1)</script>';
  const html = renderizarManual(malo as any, meta);
  expect(html).not.toContain('<script>alert(1)</script>');
});

it('avisa cuando la investigación de origen venía parcial', () => {
  const html = renderizarManual(completo as any, { ...meta, investigacionParcial: true });
  expect(html).toMatch(/parcial|incompleta/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/growth-manual.test.ts`
Expected: FAIL — no existe `manual.ts`.

- [ ] **Step 3: Implementar**

Correspondencia con el machote:

| Archivo | Bloque del machote |
|---|---|
| `setup.ts` | «Bloqueantes» y «Reglas de copy» de `<section id="setup">` |
| `meta.ts` | `<section id="meta">` |
| `creativos.ts` | `<section id="creativos">` |
| `prompts.ts` | `<section id="prompts">` |
| `google.ts` | `<section id="google">` |
| `rsa.ts` | `<section id="rsa">` |

Los slots son deterministas: `ratio` y `medidas` salen del formato, así que se rinden **aunque `creativos` haya fallado**, con el copy declarado ausente y su razón. `manual.ts` ensambla el shell (nav de anclas, barra de progreso, `main`, controles de videollamada) igual que `presentation.ts` ensambla el deck, y acepta `barraOperador` para la vista interna.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/render/`
Expected: PASS, incluidas las del deck sin cambios.

- [ ] **Step 5: Commit**

```bash
git add src/render/growth/ tests/render/growth-manual.test.ts
git commit -m "feat(growth): secciones generadas y ensamblado del manual"
```

---

### Task 11: Rutas y flujo

**Files:**
- Modify: `src/pages/api/jobs/index.ts`, `src/pages/clientes/[id].astro`, `src/pages/p/[token].astro`, `src/pages/api/share.ts`, `src/lib/precheck.ts`
- Create: `src/pages/growth/[id].astro`
- Test: `tests/lib/precheck.test.ts`

**Interfaces:**
- Consumes: `renderizarManual` de Task 10; `resolverShareLink` de Task 5.

- [ ] **Step 1: Write the failing test**

```ts
it('no deja encolar un growth si el cliente no tiene investigación completada', async () => {
  const { puedeGenerarGrowth } = await import('@/lib/precheck');
  expect(puedeGenerarGrowth({ tieneResultado: false }).ok).toBe(false);
  expect(puedeGenerarGrowth({ tieneResultado: true }).ok).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails / Step 3: Implementar**

`POST /api/jobs` acepta `tipo` y valida el precheck del Growth. La ficha del cliente muestra «Generar manual de campaña», deshabilitado con su razón si no hay investigación. `/growth/[id]` rinde con barra de operador; `/p/[token]` despacha por `documentoTipo` entre deck y manual.

- [ ] **Step 4: Run full suite**

Run: `npx vitest run && npm run build`
Expected: verde y build limpio.

- [ ] **Step 5: Commit y desplegar**

```bash
git add src/pages/ src/lib/precheck.ts tests/
git commit -m "feat(growth): flujo completo desde la ficha del cliente"
```

---

## Verificación final

- [ ] `npx vitest run` — todo verde
- [ ] `npm run build` — limpio sin DATABASE_URL
- [ ] `docker build` — reproduce el build de Railway
- [ ] Desplegar y comprobar que los 17 paneles del deck siguen idénticos
- [ ] Comprobar que un link público repartido antes de la migración sigue resolviendo
- [ ] Medir el desbordamiento de las 9 secciones a 1920×963 en las tres escalas
