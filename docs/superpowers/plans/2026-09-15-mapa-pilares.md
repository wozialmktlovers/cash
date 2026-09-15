# Mapa de Pilares · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nuevo entregable «Mapa de pilares»: estrategia, 5 pilares × 3 subcategorías × 20 temas y tablero de avance compartido. Se genera desde la investigación y se presenta con la línea editorial del Studio.

**Architecture:** Un pipeline nuevo (`src/pilares/`) corre en la cola existente con `tipo = 'pilares'`: estratega, luego 5 agentes de pilar en paralelo, luego una revisión en código con una corrección opcional. Guarda en `pilares_results`, y el avance por tema va en `pilares_temas`. El render (`src/render/pilares/`) reutiliza una base editorial compartida extraída del documento de investigación, con cabecera flotante, tokens, marco con índice e interacción común.

**Tech Stack:** Astro 7.2.1 SSR, TypeScript, Zod 4.4.3, Drizzle 0.45.2 + drizzle-kit, Postgres, Vitest 4.1.10, @anthropic-ai/sdk.

**Spec:** `docs/superpowers/specs/2026-09-15-mapa-pilares-design.md`

**Depende de:** Task H del plan `2026-09-15-investigacion-editorial.md` (cabecera flotante), que debe estar terminada y con commit antes de la Tarea P5.

## Global Constraints

- Rama `feat/rediseno`. **Nunca `git push` ni despliegue** sin visto bueno explícito.
- `node_modules` es un enlace a `node_modules.nosync/`. **Nunca correr `npm ci` ni `npm install`.**
- El usuario tiene `astro dev` en el puerto 4321: no detenerlo ni correr `astro dev stop`.
- Nunca llamar a la API de Anthropic ni hacer POST a `/api/jobs` en pruebas o verificación. Nunca imprimir ni editar `.env`.
- **El repo es público:** no versionar contenido real de clientes (por ejemplo, el ejemplo de Mar de Miel). Los fixtures son sintéticos.
- Comentarios en español, explicando el porqué. Cada commit termina con una línea en blanco y `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `npm test` y `npm run build` deben pasar al final de cada tarea.
- Todo texto del modelo pasa por `escapar` antes de tocar el HTML.
- Diseño: tokens del Studio, 85% del ancho con máximo de 1600 px, separación con `gap` (nunca `.a + .a {margin}`), áreas táctiles de 44 px, foco visible, `prefers-reduced-motion`, claro y oscuro.
- Funciones: `autoridad | conexion | engagement | prueba_social | venta`. Formatos: `reel | carrusel | story`. Estados: `pendiente | en_desarrollo | desarrollado | publicado`.
- Ids de tema: `P{pilar}-S{subcategoria}-{nn}`, con `nn` de dos dígitos (01–20).

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/pilares/schemas.ts` | Crear | Constantes, esquemas Zod y tipos |
| `src/pilares/revision.ts` | Crear | Normalización, ids, duplicados, mix, reemplazos |
| `src/pilares/agentes.ts` | Crear | Sistema, entradas y llamadas de estratega, pilar y corrección |
| `src/pilares/pipeline.ts` | Crear | Etapas, armado de datos y `ejecutarPilares` |
| `src/pilares/avance.ts` | Crear | Validación de cambios de tema |
| `src/db/schema.ts` + `drizzle/0002_*.sql` | Modificar/crear | Enum y tablas |
| `src/lib/precheck.ts` | Modificar | `puedeGenerarPilares` |
| `src/research/worker.ts`, `src/pages/api/jobs/index.ts`, `src/pages/api/jobs/[id].ts` | Modificar | Tipo `pilares` |
| `src/pages/api/pilares/[id]/temas/[temaId].ts` | Crear | PATCH del avance |
| `src/lib/share.ts`, `src/pages/api/share.ts`, `src/lib/documento-publico.ts` | Modificar | Compartir el mapa |
| `src/render/editorial/*` | Crear | Base editorial compartida |
| `src/render/pilares/*` | Crear | Documento del mapa |
| `src/pages/pilares/[id].astro`, `src/pages/clientes/[id]/pilares.astro` | Crear | Vista interna y confirmación |
| `src/pages/clientes/[id].astro`, `src/pages/entregables.astro`, `src/pages/jobs/[id].astro`, `src/components/ProgresoJob.tsx`, `src/lib/ui/progreso.ts` | Modificar | Integración en el Studio |
| `tests/fixtures/pilares.ts` | Crear | Generador de mapa sintético |

---

### Task P1: Esquemas y revisión

**Files:**
- Create: `src/pilares/schemas.ts`, `src/pilares/revision.ts`, `tests/fixtures/pilares.ts`
- Test: `tests/pilares/schemas.test.ts`, `tests/pilares/revision.test.ts`

**Interfaces:**
- Produces:
  - Desde `schemas.ts`:
    - Constantes: `FUNCIONES`, `FORMATOS`, `ESTADOS_TEMA` y sus tipos `Funcion`, `Formato`, `EstadoTema`.
    - Esquemas: `estrategiaSchema`, `temaGeneradoSchema`, `pilarSchemaPara(nombres: string[])`, `reemplazosSchema`.
    - Tipos: `Estrategia`, `TemaGenerado`, `PilarGenerado`, `Tema`, `PilarMapa`, `Revision`, `MapaPilares`.
  - Desde `revision.ts`:
    - `normalizarTema(t: string): string`, `palabras(t: string): Set<string>`, `jaccard(a: Set<string>, b: Set<string>): number`, `sonParecidos(a: string, b: string): boolean`.
    - `asignarIds(numero: number, p: PilarGenerado): Extract<PilarMapa, { estado: 'ok' }>` y `todosLosTemas(pilares: PilarMapa[]): Tema[]`.
    - `buscarDuplicados(temas: Tema[]): [string, string][]`, `mixReal(temas: Tema[]): Record<Funcion, number>`, `fueraDeMargen(mix: Estrategia['mix'], real: Record<Funcion, number>, margen?: number): Funcion[]`.
    - `aplicarReemplazos(pilares: PilarMapa[], reemplazos: Tema[]): PilarMapa[]`.
  - Desde `tests/fixtures/pilares.ts`: `estrategiaFalsa(): Estrategia`, `pilarFalso(numero: number, estrategia: Estrategia): PilarGenerado` y `mapaFalso(): MapaPilares`, todos deterministas y sin temas parecidos.

- [ ] **Step 1: Fixture sintético**

`tests/fixtures/pilares.ts`:
```ts
import type { Estrategia, PilarGenerado, MapaPilares, Funcion, Formato } from '@/pilares/schemas';
import { asignarIds, todosLosTemas, mixReal, fueraDeMargen, buscarDuplicados } from '@/pilares/revision';

// Palabras únicas hechas solo de letras: así cada tema comparte a lo más «tema»
// con los demás y la revisión no los ve parecidos.
function palabra(i: number): string {
  let s = '';
  let n = i + 17576; // 26^3: asegura cuatro letras o más
  while (n > 0) { s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

const FUNCIONES_CICLO: Funcion[] = ['autoridad', 'conexion', 'autoridad', 'conexion', 'engagement', 'prueba_social', 'venta', 'autoridad', 'conexion', 'venta'];
const FORMATOS_CICLO: Formato[] = ['reel', 'carrusel', 'story'];

export function estrategiaFalsa(): Estrategia {
  return {
    resumen: 'Mapa editorial de prueba para un cliente sintético.',
    ideas: [1, 2, 3].map((i) => ({ titulo: `Idea ${i}`, texto: `Texto de la idea ${i}.` })),
    principios: Array.from({ length: 12 }, (_, i) => ({ titulo: `Principio ${i + 1}`, texto: `Texto del principio ${i + 1}.` })),
    pilares: [1, 2, 3, 4, 5].map((p) => ({
      nombre: `Pilar ${p}`, pregunta: `¿Pregunta del pilar ${p}?`, funcion: `Función ${p}`,
      objetivo: `Objetivo del pilar ${p}.`, frontera: `Frontera del pilar ${p}.`,
      subcategorias: [1, 2, 3].map((s) => ({ nombre: `Subcategoría ${p}.${s}` })),
    })),
    mix: [
      { funcion: 'autoridad', porcentaje: 30, descripcion: 'Explicar y dar criterio.' },
      { funcion: 'conexion', porcentaje: 30, descripcion: 'Escenas reconocibles.' },
      { funcion: 'engagement', porcentaje: 10, descripcion: 'Conversación.' },
      { funcion: 'prueba_social', porcentaje: 10, descripcion: 'Casos reales.' },
      { funcion: 'venta', porcentaje: 20, descripcion: 'Consideración.' },
    ],
    conversion: {
      titulo: 'De la duda a la acción', texto: 'Texto de conversión.',
      pasos: [{ nombre: 'Orientar', texto: 'Paso uno.' }, { nombre: 'Valorar', texto: 'Paso dos.' }, { nombre: 'Acompañar', texto: 'Paso tres.' }],
    },
    reglaEspecial: null,
    supuestos: [],
  };
}

export function pilarFalso(numero: number, estrategia: Estrategia): PilarGenerado {
  return {
    subcategorias: estrategia.pilares[numero - 1].subcategorias.map((sub, s) => ({
      nombre: sub.nombre,
      temas: Array.from({ length: 20 }, (_, t) => {
        const base = ((numero - 1) * 3 + s) * 20 + t;
        return {
          texto: `Tema ${palabra(base * 3)} ${palabra(base * 3 + 1)} ${palabra(base * 3 + 2)}`,
          funcion: FUNCIONES_CICLO[t % FUNCIONES_CICLO.length],
          formato: FORMATOS_CICLO[t % FORMATOS_CICLO.length],
        };
      }),
    })),
  };
}

export function mapaFalso(): MapaPilares {
  const estrategia = estrategiaFalsa();
  const pilares = [1, 2, 3, 4, 5].map((n) => asignarIds(n, pilarFalso(n, estrategia)));
  const temas = todosLosTemas(pilares);
  const real = mixReal(temas);
  return {
    estrategia,
    pilares,
    revision: { duplicadosRestantes: buscarDuplicados(temas), mixReal: real, fueraDeMargen: fueraDeMargen(estrategia.mix, real), reescritos: 0 },
  };
}
```

- [ ] **Step 2: Pruebas**

`tests/pilares/schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { estrategiaSchema, pilarSchemaPara, reemplazosSchema } from '@/pilares/schemas';
import { estrategiaFalsa, pilarFalso } from '../fixtures/pilares';

const e = () => JSON.parse(JSON.stringify(estrategiaFalsa()));

describe('estrategiaSchema', () => {
  it('acepta la estrategia de prueba', () => {
    const r = estrategiaSchema.safeParse(estrategiaFalsa());
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });
  it('exige 3 ideas, 12 principios, 5 pilares y 3 subcategorías por pilar', () => {
    const a = e(); a.ideas.pop(); expect(estrategiaSchema.safeParse(a).success).toBe(false);
    const b = e(); b.principios.pop(); expect(estrategiaSchema.safeParse(b).success).toBe(false);
    const c = e(); c.pilares.pop(); expect(estrategiaSchema.safeParse(c).success).toBe(false);
    const d = e(); d.pilares[0].subcategorias.pop(); expect(estrategiaSchema.safeParse(d).success).toBe(false);
  });
  it('el mix suma 100 y tiene una entrada por función', () => {
    const a = e(); a.mix[0].porcentaje = 31;
    const ra = estrategiaSchema.safeParse(a);
    expect(ra.success).toBe(false);
    expect(JSON.stringify(ra.error?.issues)).toContain('100');
    const b = e(); b.mix[1].funcion = 'autoridad'; b.mix[0].porcentaje = 30;
    expect(estrategiaSchema.safeParse(b).success).toBe(false);
  });
  it('conversión con exactamente 3 pasos', () => {
    const a = e(); a.conversion.pasos.pop();
    expect(estrategiaSchema.safeParse(a).success).toBe(false);
  });
});

describe('pilarSchemaPara', () => {
  const est = estrategiaFalsa();
  const nombres = est.pilares[1].subcategorias.map((s) => s.nombre);
  const p = () => JSON.parse(JSON.stringify(pilarFalso(2, est)));

  it('acepta un pilar válido', () => {
    expect(pilarSchemaPara(nombres).safeParse(pilarFalso(2, est)).success).toBe(true);
  });
  it('exige 20 temas por subcategoría con función y formato válidos', () => {
    const a = p(); a.subcategorias[0].temas.pop(); expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
    const b = p(); b.subcategorias[0].temas[0].formato = 'post'; expect(pilarSchemaPara(nombres).safeParse(b).success).toBe(false);
  });
  it('los nombres de subcategoría coinciden con la estrategia, sin importar mayúsculas ni acentos', () => {
    const a = p(); a.subcategorias[0].nombre = 'Otra';
    expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
    const b = p(); b.subcategorias[0].nombre = nombres[0].toUpperCase();
    expect(pilarSchemaPara(nombres).safeParse(b).success).toBe(true);
  });
  it('rechaza temas con el mismo texto normalizado dentro del pilar', () => {
    const a = p(); a.subcategorias[2].temas[5].texto = a.subcategorias[0].temas[0].texto.toUpperCase() + '!';
    expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
  });
});

describe('reemplazosSchema', () => {
  it('acepta temas con id', () => {
    expect(reemplazosSchema.safeParse({ temas: [{ id: 'P1-S1-01', texto: 'Nuevo', funcion: 'venta', formato: 'reel' }] }).success).toBe(true);
  });
});
```

`tests/pilares/revision.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  normalizarTema, palabras, jaccard, sonParecidos, asignarIds, todosLosTemas,
  buscarDuplicados, mixReal, fueraDeMargen, aplicarReemplazos,
} from '@/pilares/revision';
import { estrategiaFalsa, pilarFalso, mapaFalso } from '../fixtures/pilares';

describe('similitud', () => {
  it('normaliza acentos, signos y espacios', () => {
    expect(normalizarTema('  ¿Esto es  NORMAL? ')).toBe('esto es normal');
  });
  it('palabras solo cuenta las de 4 letras o más', () => {
    expect([...palabras('No sé si esto pasa')]).toEqual(['esto', 'pasa']);
  });
  it('jaccard', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
  it('detecta textos iguales o muy parecidos', () => {
    expect(sonParecidos('¿Berrinche o manipulación?', 'berrinche o manipulacion')).toBe(true);
    expect(sonParecidos('Cuando tu hijo explota después de la escuela', 'Cuando tu hijo explota después del kínder escuela')).toBe(true);
    expect(sonParecidos('Miedos nocturnos en la infancia', 'Cómo elegir terapia de lenguaje')).toBe(false);
  });
});

describe('ids y recorridos', () => {
  it('asigna ids P-S-nn estables', () => {
    const p = asignarIds(2, pilarFalso(2, estrategiaFalsa()));
    expect(p.estado).toBe('ok');
    expect(p.subcategorias[0].temas[0].id).toBe('P2-S1-01');
    expect(p.subcategorias[2].temas[19].id).toBe('P2-S3-20');
  });
  it('todosLosTemas ignora pilares vacíos', () => {
    const m = mapaFalso();
    m.pilares[4] = { numero: 5, estado: 'vacio', razon: 'x' };
    expect(todosLosTemas(m.pilares)).toHaveLength(240);
  });
});

describe('revisión', () => {
  it('el mapa sintético no tiene duplicados', () => {
    expect(buscarDuplicados(todosLosTemas(mapaFalso().pilares))).toEqual([]);
  });
  it('encuentra duplicados entre pilares y devuelve el par en orden', () => {
    const m = mapaFalso();
    const a = (m.pilares[0] as any).subcategorias[0].temas[0];
    (m.pilares[3] as any).subcategorias[1].temas[4].texto = a.texto;
    expect(buscarDuplicados(todosLosTemas(m.pilares))).toEqual([['P1-S1-01', 'P4-S2-05']]);
  });
  it('mix real en porcentajes enteros', () => {
    const real = mixReal(todosLosTemas(mapaFalso().pilares));
    expect(real).toEqual({ autoridad: 30, conexion: 30, engagement: 10, prueba_social: 10, venta: 20 });
    expect(mixReal([])).toEqual({ autoridad: 0, conexion: 0, engagement: 0, prueba_social: 0, venta: 0 });
  });
  it('fuera de margen con más de 5 puntos', () => {
    const mix = estrategiaFalsa().mix;
    expect(fueraDeMargen(mix, { autoridad: 36, conexion: 25, engagement: 10, prueba_social: 10, venta: 19 })).toEqual(['autoridad']);
  });
  it('aplica reemplazos sin mutar el original', () => {
    const m = mapaFalso();
    const nuevos = aplicarReemplazos(m.pilares, [{ id: 'P3-S2-10', texto: 'Tema reescrito', funcion: 'venta', formato: 'story' }]);
    expect((nuevos[2] as any).subcategorias[1].temas[9]).toEqual({ id: 'P3-S2-10', texto: 'Tema reescrito', funcion: 'venta', formato: 'story' });
    expect((m.pilares[2] as any).subcategorias[1].temas[9].texto).not.toBe('Tema reescrito');
  });
});
```

- [ ] **Step 3: Ver que fallan**

Run: `npx vitest run tests/pilares`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 4: `schemas.ts`**

```ts
import { z } from 'zod';
import { normalizar } from '@/lib/ui/buscar';

export const FUNCIONES = ['autoridad', 'conexion', 'engagement', 'prueba_social', 'venta'] as const;
export const FORMATOS = ['reel', 'carrusel', 'story'] as const;
export const ESTADOS_TEMA = ['pendiente', 'en_desarrollo', 'desarrollado', 'publicado'] as const;
export type Funcion = (typeof FUNCIONES)[number];
export type Formato = (typeof FORMATOS)[number];
export type EstadoTema = (typeof ESTADOS_TEMA)[number];

const texto = (max: number) => z.string().min(1).max(max);

export const estrategiaSchema = z.object({
  resumen: texto(240),
  ideas: z.array(z.object({ titulo: texto(80), texto: texto(320) })).length(3),
  principios: z.array(z.object({ titulo: texto(80), texto: texto(220) })).length(12),
  pilares: z.array(z.object({
    nombre: texto(50),
    pregunta: texto(160),
    funcion: texto(120),
    objetivo: texto(320),
    frontera: texto(220),
    subcategorias: z.array(z.object({ nombre: texto(70) })).length(3),
  })).length(5),
  mix: z.array(z.object({
    funcion: z.enum(FUNCIONES),
    porcentaje: z.number().int().min(0).max(100),
    descripcion: texto(140),
  })).length(5),
  conversion: z.object({
    titulo: texto(90),
    texto: texto(320),
    pasos: z.array(z.object({ nombre: texto(30), texto: texto(180) })).length(3),
  }),
  reglaEspecial: texto(400).nullable(),
  supuestos: z.array(texto(200)).max(5),
}).superRefine((e, ctx) => {
  const suma = e.mix.reduce((s, m) => s + m.porcentaje, 0);
  if (suma !== 100) ctx.addIssue({ code: 'custom', message: `Los porcentajes del mix suman ${suma}; deben sumar 100.` });
  if (new Set(e.mix.map((m) => m.funcion)).size !== FUNCIONES.length) {
    ctx.addIssue({ code: 'custom', message: 'El mix debe tener exactamente una entrada por función.' });
  }
});
export type Estrategia = z.infer<typeof estrategiaSchema>;

export const temaGeneradoSchema = z.object({
  texto: texto(160),
  funcion: z.enum(FUNCIONES),
  formato: z.enum(FORMATOS),
});
export type TemaGenerado = z.infer<typeof temaGeneradoSchema>;

const claveTexto = (t: string) => normalizar(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Esquema de un pilar atado a las subcategorías que definió la estrategia. */
export function pilarSchemaPara(nombres: string[]) {
  return z.object({
    subcategorias: z.array(z.object({
      nombre: texto(70),
      temas: z.array(temaGeneradoSchema).length(20),
    })).length(3),
  }).superRefine((p, ctx) => {
    p.subcategorias.forEach((s, i) => {
      if (claveTexto(s.nombre) !== claveTexto(nombres[i] ?? '')) {
        ctx.addIssue({ code: 'custom', message: `La subcategoría ${i + 1} debe llamarse «${nombres[i]}».` });
      }
    });
    const vistos = new Set<string>();
    for (const s of p.subcategorias) for (const t of s.temas) {
      const k = claveTexto(t.texto);
      if (vistos.has(k)) ctx.addIssue({ code: 'custom', message: `Tema repetido: «${t.texto}».` });
      vistos.add(k);
    }
  });
}
export type PilarGenerado = { subcategorias: { nombre: string; temas: TemaGenerado[] }[] };

export const reemplazosSchema = z.object({
  temas: z.array(z.object({ id: z.string().regex(/^P[1-5]-S[1-3]-\d{2}$/), ...temaGeneradoSchema.shape })),
});

export type Tema = TemaGenerado & { id: string };
export type PilarMapa =
  | { numero: number; estado: 'ok'; subcategorias: { nombre: string; temas: Tema[] }[] }
  | { numero: number; estado: 'vacio'; razon: string };
export type Revision = {
  duplicadosRestantes: [string, string][];
  mixReal: Record<Funcion, number>;
  fueraDeMargen: Funcion[];
  reescritos: number;
};
export type MapaPilares = { estrategia: Estrategia; pilares: PilarMapa[]; revision: Revision };
```

- [ ] **Step 5: `revision.ts`**

```ts
import { normalizar } from '@/lib/ui/buscar';
import { FUNCIONES, type Estrategia, type Funcion, type PilarGenerado, type PilarMapa, type Tema } from './schemas';

export function normalizarTema(t: string): string {
  return normalizar(t).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Palabras de 4 letras o más: las cortas («de», «tu», «no») hacen parecer iguales temas distintos. */
export function palabras(t: string): Set<string> {
  return new Set(normalizarTema(t).split(' ').filter((w) => w.length >= 4));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 0;
  let comunes = 0;
  for (const x of a) if (b.has(x)) comunes++;
  return comunes / (a.size + b.size - comunes);
}

export function sonParecidos(a: string, b: string): boolean {
  return normalizarTema(a) === normalizarTema(b) || jaccard(palabras(a), palabras(b)) >= 0.6;
}

// El id lo pone el código, no el modelo: la etapa de desarrollo de piezas se ligará a él.
export function asignarIds(numero: number, p: PilarGenerado): Extract<PilarMapa, { estado: 'ok' }> {
  return {
    numero,
    estado: 'ok',
    subcategorias: p.subcategorias.map((s, i) => ({
      nombre: s.nombre,
      temas: s.temas.map((t, j) => ({ id: `P${numero}-S${i + 1}-${String(j + 1).padStart(2, '0')}`, ...t })),
    })),
  };
}

export function todosLosTemas(pilares: PilarMapa[]): Tema[] {
  return pilares.flatMap((p) => (p.estado === 'ok' ? p.subcategorias.flatMap((s) => s.temas) : []));
}

/** Pares [primero, repetido] en orden de aparición. El segundo es el que se reescribe. */
export function buscarDuplicados(temas: Tema[]): [string, string][] {
  const pares: [string, string][] = [];
  for (let i = 0; i < temas.length; i++) {
    for (let j = i + 1; j < temas.length; j++) {
      if (sonParecidos(temas[i].texto, temas[j].texto)) pares.push([temas[i].id, temas[j].id]);
    }
  }
  return pares;
}

export function mixReal(temas: Tema[]): Record<Funcion, number> {
  const conteo = Object.fromEntries(FUNCIONES.map((f) => [f, 0])) as Record<Funcion, number>;
  for (const t of temas) conteo[t.funcion]++;
  if (!temas.length) return conteo;
  return Object.fromEntries(FUNCIONES.map((f) => [f, Math.round((conteo[f] / temas.length) * 100)])) as Record<Funcion, number>;
}

export function fueraDeMargen(mix: Estrategia['mix'], real: Record<Funcion, number>, margen = 5): Funcion[] {
  return mix.filter((m) => Math.abs((real[m.funcion] ?? 0) - m.porcentaje) > margen).map((m) => m.funcion);
}

export function aplicarReemplazos(pilares: PilarMapa[], reemplazos: Tema[]): PilarMapa[] {
  const porId = new Map(reemplazos.map((r) => [r.id, r]));
  return pilares.map((p) => p.estado !== 'ok' ? p : {
    ...p,
    subcategorias: p.subcategorias.map((s) => ({ ...s, temas: s.temas.map((t) => porId.get(t.id) ?? t) })),
  });
}
```

- [ ] **Step 6: Ver que pasan**

Run: `npx vitest run tests/pilares`, luego `npm test` y `npm run build`.
Expected: PASS. Si la frase de ejemplo de `sonParecidos` del kínder no alcanza 0.6, ajustar el ejemplo de la prueba a un par que sí lo alcance (manteniendo el caso distinto en `false`) y explicarlo en el reporte.

- [ ] **Step 7: Commit**

```bash
git add src/pilares tests/pilares tests/fixtures/pilares.ts
git commit -m "feat(pilares): esquemas, ids y revisión de duplicados y mix

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P2: Agentes

**Files:**
- Create: `src/pilares/agentes.ts`
- Test: `tests/pilares/agentes.test.ts`

**Interfaces:**
- Consumes: P1 (esquemas y tipos); `pedirJson` de `@/research/claude`.
- Produces:
  - `SISTEMA_PILARES: string`.
  - `armarEntradaEstrategia(ctx: string, investigacion: Record<string, unknown>): string`, `armarEntradaPilar(ctx: string, estrategia: Estrategia, numero: number): string` y `armarEntradaCorreccion(estrategia: Estrategia, numero: number, aReescribir: Tema[], evitar: string[]): string`.
  - `correrEstrategia(ctx, investigacion, onUso?)`, `correrPilar(ctx, estrategia, numero, onUso?)` y `correrCorreccion(estrategia, numero, aReescribir, evitar, onUso?)`. Las tres devuelven `{ datos, tokensEntrada, tokensSalida }`.

- [ ] **Step 1: Pruebas**

`tests/pilares/agentes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SISTEMA_PILARES, armarEntradaEstrategia, armarEntradaPilar, armarEntradaCorreccion } from '@/pilares/agentes';
import { estrategiaFalsa } from '../fixtures/pilares';
import completa from '../fixtures/investigacion-completa.json';

describe('sistema', () => {
  it('fija las reglas del estratega', () => {
    for (const s of ['300', 'Reels', 'no inventes', 'supuestos', 'frases de agencia']) expect(SISTEMA_PILARES.toLowerCase()).toContain(s.toLowerCase());
  });
});

describe('entradas', () => {
  it('la estrategia recibe el contexto y solo las etapas de investigación con datos', () => {
    const inv = { ...(completa as any), audiencia: { estado: 'vacio', razon: 'x' } };
    const e = armarEntradaEstrategia('## Cliente\nAna', inv);
    expect(e).toContain('## Cliente');
    expect(e).toContain('### Competencia');
    expect(e).not.toContain('### Audiencia');
    for (const campo of ['ideas', 'principios', 'pilares', 'subcategorias', 'mix', 'conversion', 'reglaEspecial', 'supuestos']) expect(e).toContain(campo);
  });

  it('el pilar recibe la estrategia completa, su número, su nombre y sus subcategorías', () => {
    const est = estrategiaFalsa();
    const e = armarEntradaPilar('ctx', est, 3);
    expect(e).toContain(JSON.stringify(est, null, 2));
    expect(e).toContain('pilar 3');
    expect(e).toContain('Pilar 3');
    for (const s of est.pilares[2].subcategorias) expect(e).toContain(s.nombre);
    for (const campo of ['texto', 'funcion', 'formato', 'reel', 'carrusel', 'story']) expect(e).toContain(campo);
  });

  it('la corrección lista los ids a reescribir y los temas a evitar', () => {
    const e = armarEntradaCorreccion(estrategiaFalsa(), 2, [{ id: 'P2-S1-04', texto: 'Tema viejo', funcion: 'venta', formato: 'reel' }], ['Otro tema']);
    expect(e).toContain('P2-S1-04');
    expect(e).toContain('Tema viejo');
    expect(e).toContain('Otro tema');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/pilares/agentes.test.ts`
Expected: FAIL.

- [ ] **Step 3: `agentes.ts`**

```ts
import { pedirJson } from '@/research/claude';
import {
  estrategiaSchema, pilarSchemaPara, reemplazosSchema,
  type Estrategia, type PilarGenerado, type Tema,
} from './schemas';

export const SISTEMA_PILARES = `Eres estratega y planner de contenidos para Facebook e Instagram en una agencia mexicana. Tu trabajo no es redactar posts: defines por qué debe existir cada pieza y cómo conecta los objetivos del negocio con lo que la audiencia quiere ver y valora.

El entregable completo son 5 pilares, 3 subcategorías por pilar y 20 temas por subcategoría: 300 temas únicos.

Reglas:
- Los temas equilibran autoridad, conexión humana, participación, prueba social y venta.
- Un tema no es un post: es un headline, un disparador o un ángulo que funcione en Reels, carruseles y stories.
- Parte de escenas y verdades humanas reconocibles, en el lenguaje de la audiencia. Evita ideas genéricas, slogans vacíos y frases de agencia como «descubre», «innovador» o «la mejor opción».
- Nada de temas demasiado parecidos entre sí.
- Calibra el tono con la investigación y los documentos del cliente: no fuerces una personalidad estándar.
- No inventes datos del cliente. Si falta información, avanza con supuestos razonables y decláralos en supuestos.
- Responde solo con JSON válido, sin texto antes ni después.`;

const NOMBRES_INVESTIGACION: Record<string, string> = {
  competencia: 'Competencia', audiencia: 'Audiencia', canales: 'Canales', mercado: 'Mercado', sintesis: 'Síntesis estratégica',
};

const FORMA_ESTRATEGIA = `{
  "resumen": "máx. 240",
  "ideas": [ { "titulo": "máx. 80", "texto": "máx. 320" } ],   // exactamente 3: la idea que gobierna toda la comunicación
  "principios": [ { "titulo": "máx. 80", "texto": "máx. 220" } ],   // exactamente 12 no negociables
  "pilares": [ { "nombre": "máx. 50", "pregunta": "qué conversación resuelve, máx. 160", "funcion": "máx. 120", "objetivo": "máx. 320", "frontera": "qué le toca y qué no, máx. 220",
                 "subcategorias": [ { "nombre": "máx. 70" } ] } ],   // exactamente 5 pilares con 3 subcategorias cada uno
  "mix": [ { "funcion": "autoridad | conexion | engagement | prueba_social | venta", "porcentaje": 0, "descripcion": "máx. 140" } ],   // una por función, suman 100
  "conversion": { "titulo": "máx. 90", "texto": "máx. 320", "pasos": [ { "nombre": "máx. 30", "texto": "máx. 180" } ] },   // 3 pasos
  "reglaEspecial": "una regla editorial que el giro exige, máx. 400, o null",
  "supuestos": ["máx. 200"]   // 0 a 5
}`;

export function armarEntradaEstrategia(ctx: string, investigacion: Record<string, unknown>): string {
  const bloques = Object.entries(NOMBRES_INVESTIGACION)
    .filter(([k]) => (investigacion[k] as any)?.estado === 'ok')
    .map(([k, nombre]) => `### ${nombre}\n${JSON.stringify((investigacion[k] as any).datos, null, 2)}`)
    .join('\n\n');
  return `${ctx}\n\n## Investigación\n${bloques || '(sin datos)'}\n\nDefine la estrategia del mapa de pilares. Devuelve el JSON con esta forma:\n${FORMA_ESTRATEGIA}`;
}

const FORMA_PILAR = `{
  "subcategorias": [
    { "nombre": "exactamente el nombre definido en la estrategia", "temas": [ { "texto": "máx. 160", "funcion": "autoridad | conexion | engagement | prueba_social | venta", "formato": "reel | carrusel | story" } ] }
  ]
}   // 3 subcategorias en el orden de la estrategia, 20 temas cada una`;

export function armarEntradaPilar(ctx: string, estrategia: Estrategia, numero: number): string {
  const p = estrategia.pilares[numero - 1];
  return `${ctx}

## Estrategia completa
${JSON.stringify(estrategia, null, 2)}

## Tu tarea
Escribe los 60 temas del pilar ${numero}: «${p.nombre}».
Respeta su frontera y no invadas los otros cuatro pilares.
Reparte las funciones según el mix de la estrategia y alterna formatos.
Subcategorías, en este orden:
${p.subcategorias.map((s, i) => `${i + 1}. ${s.nombre}`).join('\n')}

Devuelve el JSON con esta forma:
${FORMA_PILAR}`;
}

export function armarEntradaCorreccion(estrategia: Estrategia, numero: number, aReescribir: Tema[], evitar: string[]): string {
  return `## Estrategia
${JSON.stringify(estrategia, null, 2)}

## Tu tarea
Estos temas del pilar ${numero} («${estrategia.pilares[numero - 1].nombre}») se parecen demasiado a otros del mapa. Reescribe cada uno con un ángulo nuevo, sin salirte de su subcategoría, y conserva su id.
${aReescribir.map((t) => `- ${t.id}: ${t.texto}`).join('\n')}

Temas del mapa que no puedes repetir ni parafrasear:
${evitar.map((t) => `- ${t}`).join('\n')}

Devuelve { "temas": [ { "id": "el mismo", "texto": "máx. 160", "funcion": "...", "formato": "reel | carrusel | story" } ] }`;
}

export async function correrEstrategia(ctx: string, investigacion: Record<string, unknown>, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<Estrategia>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaEstrategia(ctx, investigacion),
    schema: estrategiaSchema,
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento consume del mismo presupuesto que el texto.
    maxTokens: 24_000,
  });
}

export async function correrPilar(ctx: string, estrategia: Estrategia, numero: number, onUso?: (e: number, s: number) => boolean) {
  return pedirJson<PilarGenerado>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaPilar(ctx, estrategia, numero),
    schema: pilarSchemaPara(estrategia.pilares[numero - 1].subcategorias.map((s) => s.nombre)),
    buscarWeb: false,
    onUso,
    maxTokens: 16_000,
  });
}

export async function correrCorreccion(
  estrategia: Estrategia, numero: number, aReescribir: Tema[], evitar: string[], onUso?: (e: number, s: number) => boolean,
) {
  return pedirJson<{ temas: Tema[] }>({
    modelo: process.env.MODEL_RESEARCH || 'claude-sonnet-5',
    sistema: SISTEMA_PILARES,
    usuario: armarEntradaCorreccion(estrategia, numero, aReescribir, evitar),
    schema: reemplazosSchema,
    buscarWeb: false,
    onUso,
  });
}
```

- [ ] **Step 4: Ver que pasa**

Run: `npx vitest run tests/pilares/agentes.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pilares/agentes.ts tests/pilares/agentes.test.ts
git commit -m "feat(pilares): agentes estratega, de pilar y de corrección

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P3: Base de datos, cola y pipeline

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0002_*.sql` (generado)
- Modify: `src/lib/precheck.ts`, `src/research/worker.ts`, `src/pages/api/jobs/index.ts`, `src/pages/api/jobs/[id].ts`
- Create: `src/pilares/pipeline.ts`
- Test: `tests/pilares/pipeline.test.ts`, `tests/db/schema.test.ts` (añadir casos)

**Interfaces:**
- Consumes: P1, P2; `repartirPorTope`, `superaTope` de `@/research/pipeline`; `armarContexto`; `calcularCosto`; `contarEtapasConDatos`.
- Produces:
  - En la base: `documentoTipo` con `'pilares'`, y tablas `pilaresResults` y `pilaresTemas` (exportadas desde `@/db`).
  - `puedeGenerarPilares(d: { etapasConDatos: number }): { ok: boolean; razon: string }`.
  - `ETAPAS_PILARES`, `armarPilares(estrategia: Estrategia, generados: Record<number, PilarGenerado | undefined>, estado: Record<string, string>): PilarMapa[]` y `ejecutarPilares(jobId: string): Promise<void>`.

- [ ] **Step 1: Pruebas**

`tests/pilares/pipeline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ETAPAS_PILARES, armarPilares } from '@/pilares/pipeline';
import { puedeGenerarPilares } from '@/lib/precheck';
import { estrategiaFalsa, pilarFalso } from '../fixtures/pilares';

describe('pipeline de pilares', () => {
  it('etapas en orden', () => {
    expect([...ETAPAS_PILARES]).toEqual(['estrategia', 'pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5', 'revision']);
  });
  it('arma los cinco pilares con ids y declara los vacíos con su razón', () => {
    const est = estrategiaFalsa();
    const p = armarPilares(est, { 1: pilarFalso(1, est), 3: pilarFalso(3, est) }, { pilar2: 'fallo', pilar4: 'omitido_por_costo' });
    expect(p.map((x) => x.estado)).toEqual(['ok', 'vacio', 'ok', 'vacio', 'vacio']);
    expect((p[0] as any).subcategorias[0].temas[0].id).toBe('P1-S1-01');
    expect((p[1] as any).razon).toContain('dos intentos');
    expect((p[3] as any).razon).toContain('tope de costo');
    expect((p[4] as any).razon).toContain('no se ejecutó');
  });
  it('precheck como Growth', () => {
    expect(puedeGenerarPilares({ etapasConDatos: 0 }).ok).toBe(false);
    expect(puedeGenerarPilares({ etapasConDatos: 0 }).razon).toContain('investigación');
    expect(puedeGenerarPilares({ etapasConDatos: 2 })).toEqual({ ok: true, razon: '' });
  });
});
```

En `tests/db/schema.test.ts`, añadir un caso con el estilo del archivo existente que compruebe:
- que `documentoTipo.enumValues` contiene `'pilares'`;
- que `pilaresResults` y `pilaresTemas` están exportadas desde `@/db/schema`.

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/pilares/pipeline.test.ts tests/db/schema.test.ts`
Expected: FAIL.

- [ ] **Step 3: Esquema de base y migración**

En `src/db/schema.ts`:
- `documentoTipo`: `pgEnum('documento_tipo', ['research','growth','pilares'])`, actualizando el comentario a «Los documentos que produce el sistema».
- Añadir, después de `growthResults`:
```ts
export const pilaresResults = pgTable('pilares_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Avance del equipo por tema. Solo existe fila para los temas que alguien tocó:
 * sin fila, el tema está pendiente. Así un mapa nuevo no inserta 300 filas vacías.
 */
export const pilaresTemas = pgTable('pilares_temas', {
  resultId: uuid('result_id').notNull().references(() => pilaresResults.id, { onDelete: 'cascade' }),
  temaId: text('tema_id').notNull(),
  estado: text('estado').notNull().default('pendiente'),
  nota: text('nota'),
  actualizadoPor: uuid('actualizado_por').references(() => users.id, { onDelete: 'set null' }),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.resultId, t.temaId] })]);
```
Añadir `primaryKey` al import de `drizzle-orm/pg-core`.

Run: `npx drizzle-kit generate --name pilares`
Expected: se crea `drizzle/0002_pilares.sql` (y su snapshot) con `ALTER TYPE "public"."documento_tipo" ADD VALUE 'pilares';` y las dos tablas. Si drizzle-kit pide confirmación interactiva o falla, detenerse y reportar BLOCKED con la salida.

Aplicar a la base local: `node --env-file=.env scripts/migrate.mjs`
Expected: sin errores.

- [ ] **Step 4: Precheck, cola y endpoints de jobs**

`src/lib/precheck.ts`, añadir:
```ts
/** El mapa de pilares, como el manual, parte de una investigación con datos. */
export function puedeGenerarPilares(d: { etapasConDatos: number }): { ok: boolean; razon: string } {
  if (d.etapasConDatos === 0) {
    return { ok: false, razon: 'Este cliente aún no tiene una investigación con datos. El mapa de pilares parte de ella.' };
  }
  return { ok: true, razon: '' };
}
```

`src/pages/api/jobs/index.ts`:
- `const tipo = crudo.tipo === 'growth' ? 'growth' : crudo.tipo === 'pilares' ? 'pilares' : 'research';`
- Generalizar la validación: si `tipo !== 'research'`, calcular `mejor` igual que hoy y usar `puedeGenerarGrowth` para growth o `puedeGenerarPilares` para pilares.

`src/pages/api/jobs/[id].ts`: `const tabla = job.tipo === 'growth' ? growthResults : job.tipo === 'pilares' ? pilaresResults : researchResults;` (importar `pilaresResults`).

`src/research/worker.ts`: importar `ejecutarPilares` de `@/pilares/pipeline` y despachar `else if (siguiente.tipo === 'pilares') await ejecutarPilares(siguiente.id);` antes del `else` de investigación.

- [ ] **Step 5: `pipeline.ts`**

```ts
import { eq, desc } from 'drizzle-orm';
import { db, researchJobs, researchResults, pilaresResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from '@/research/contexto';
import { repartirPorTope, superaTope } from '@/research/pipeline';
import { calcularCosto } from '@/lib/cost';
import { contarEtapasConDatos } from '@/lib/precheck';
import { correrEstrategia, correrPilar, correrCorreccion } from './agentes';
import {
  asignarIds, todosLosTemas, buscarDuplicados, mixReal, fueraDeMargen, aplicarReemplazos, sonParecidos,
} from './revision';
import type { Estrategia, PilarGenerado, PilarMapa, Tema } from './schemas';

export const ETAPAS_PILARES = ['estrategia', 'pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5', 'revision'] as const;

function razon(estado: string | undefined): string {
  if (estado === 'fallo') return 'El agente no devolvió datos válidos tras dos intentos.';
  if (estado === 'omitido_por_costo') return 'Se alcanzó el tope de costo antes de ejecutar este pilar.';
  return 'Este pilar no se ejecutó.';
}

export function armarPilares(
  estrategia: Estrategia,
  generados: Record<number, PilarGenerado | undefined>,
  estado: Record<string, string>,
): PilarMapa[] {
  return estrategia.pilares.map((_, i) => {
    const n = i + 1;
    const g = generados[n];
    return g ? asignarIds(n, g) : { numero: n, estado: 'vacio', razon: razon(estado[`pilar${n}`]) };
  });
}

export async function ejecutarPilares(jobId: string): Promise<void> {
  const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, jobId)).limit(1);
  if (!job) return;
  const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
  if (!cliente) return;

  const fallar = (error: string) => db.update(researchJobs)
    .set({ estado: 'fallido', error, finishedAt: new Date() }).where(eq(researchJobs.id, jobId));

  const [investigacion] = await db.select().from(researchResults)
    .where(eq(researchResults.clientId, job.clientId)).orderBy(desc(researchResults.version)).limit(1);
  if (!investigacion || contarEtapasConDatos(investigacion.datos) === 0) {
    await fallar('Este cliente no tiene una investigación con datos. El mapa de pilares parte de ella.');
    return;
  }

  const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, job.clientId));
  const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, job.clientId));
  const ctx = armarContexto(cliente, links, archivos);

  const tope = Number(process.env.COST_LIMIT_USD || 15);
  const modeloSin = process.env.MODEL_SYNTHESIS || 'claude-opus-5';
  const modeloInv = process.env.MODEL_RESEARCH || 'claude-sonnet-5';
  const estado: Record<string, string> = { ...(job.etapas as Record<string, string>) };
  const gasto = { valor: Number(job.costoUsd) };
  let tIn = job.tokensEntrada, tOut = job.tokensSalida;

  const vigilar = (modelo: string) => (e: number, s: number) => {
    gasto.valor += calcularCosto(modelo, e, s);
    return !superaTope(gasto.valor, tope);
  };
  const guardar = () => db.update(researchJobs).set({
    etapas: estado, tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor),
  }).where(eq(researchJobs.id, jobId));
  const publicar = () => { void guardar().catch((e) => console.error(`[${jobId}] guardar progreso:`, e)); };

  await db.update(researchJobs).set({ estado: 'corriendo', startedAt: job.startedAt ?? new Date() }).where(eq(researchJobs.id, jobId));

  // 1 · Estrategia. Sin ella no hay pilares que escribir: el job termina aquí.
  let estrategia: Estrategia;
  estado.estrategia = 'corriendo';
  await db.update(researchJobs).set({ etapaActual: 'estrategia', etapas: estado }).where(eq(researchJobs.id, jobId));
  try {
    const r = await correrEstrategia(ctx, investigacion.datos as Record<string, unknown>, vigilar(modeloSin));
    estrategia = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
    estado.estrategia = 'ok';
  } catch (e) {
    console.error(`[${jobId}] estrategia:`, e);
    estado.estrategia = 'fallo';
    await guardar();
    await fallar('No se pudo definir la estrategia del mapa.');
    return;
  }
  await guardar();

  // 2 · Los cinco pilares en paralelo, con freno de costo.
  const generados: Record<number, PilarGenerado> = {};
  const pilaresEtapas = ['pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5'];
  await repartirPorTope(pilaresEtapas, tope, gasto, estado, async (etapa) => {
    const n = Number(etapa.slice(-1));
    const r = await correrPilar(ctx, estrategia, n, vigilar(modeloInv));
    generados[n] = r.datos;
    tIn += r.tokensEntrada; tOut += r.tokensSalida;
  }, publicar);
  await guardar();

  // 3 · Revisión en código y una sola ronda de corrección de duplicados.
  estado.revision = 'corriendo';
  await db.update(researchJobs).set({ etapaActual: 'revision', etapas: estado }).where(eq(researchJobs.id, jobId));
  let pilares = armarPilares(estrategia, generados, estado);
  let reescritos = 0;
  const duplicados = buscarDuplicados(todosLosTemas(pilares));

  if (duplicados.length && !superaTope(gasto.valor, tope)) {
    const temas = todosLosTemas(pilares);
    const porId = new Map(temas.map((t) => [t.id, t]));
    const repetidos = [...new Set(duplicados.map(([, b]) => b))];
    const porPilar = new Map<number, Tema[]>();
    for (const id of repetidos) {
      const n = Number(id[1]);
      porPilar.set(n, [...(porPilar.get(n) ?? []), porId.get(id)!]);
    }
    for (const [n, aReescribir] of porPilar) {
      if (superaTope(gasto.valor, tope)) break;
      try {
        const ids = new Set(aReescribir.map((t) => t.id));
        const evitar = temas.filter((t) => !ids.has(t.id)).map((t) => t.texto);
        const r = await correrCorreccion(estrategia, n, aReescribir, evitar, vigilar(modeloInv));
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        // Solo se aceptan reemplazos de ids pedidos que ya no se parezcan a nada del mapa.
        const validos = r.datos.temas.filter((t) => ids.has(t.id) && !evitar.some((otro) => sonParecidos(t.texto, otro)));
        pilares = aplicarReemplazos(pilares, validos);
        reescritos += validos.length;
      } catch (e) {
        console.error(`[${jobId}] corrección pilar ${n}:`, e);
      }
    }
  }

  const finales = todosLosTemas(pilares);
  const real = mixReal(finales);
  const revision = {
    duplicadosRestantes: buscarDuplicados(finales),
    mixReal: real,
    fueraDeMargen: fueraDeMargen(estrategia.mix, real),
    reescritos,
  };
  estado.revision = 'ok';

  const previas = await db.select({ id: pilaresResults.id }).from(pilaresResults).where(eq(pilaresResults.clientId, job.clientId));
  await db.insert(pilaresResults).values({
    jobId, clientId: job.clientId, datos: { estrategia, pilares, revision }, version: previas.length + 1,
  });

  await db.update(researchJobs).set({
    estado: 'completado', etapas: estado, etapaActual: null, finishedAt: new Date(),
    tokensEntrada: tIn, tokensSalida: tOut, costoUsd: String(gasto.valor), error: null,
  }).where(eq(researchJobs.id, jobId));
}
```

- [ ] **Step 6: Ver que pasan**

Run: `npx vitest run tests/pilares tests/db`, luego `npm test` y `npm run build`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle src/lib/precheck.ts src/research/worker.ts src/pages/api/jobs src/pilares/pipeline.ts tests/pilares/pipeline.test.ts tests/db/schema.test.ts
git commit -m "feat(pilares): tablas, cola y pipeline estrategia → 5 pilares → revisión

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P4: Avance por tema y compartir

**Files:**
- Create: `src/pilares/avance.ts`, `src/pages/api/pilares/[id]/temas/[temaId].ts`
- Modify: `src/lib/share.ts`, `src/pages/api/share.ts`, `src/lib/documento-publico.ts` (solo el tipo; el render llega en P6)
- Test: `tests/pilares/avance.test.ts`

**Interfaces:**
- Consumes: P1 (`ESTADOS_TEMA`, `MapaPilares`, `todosLosTemas`), P3 (tablas).
- Produces:
  - `temaExiste(datos: unknown, temaId: string): boolean`.
  - `validarCambioTema(cuerpo: unknown): { ok: true; estado?: EstadoTema; nota?: string | null } | { ok: false; errores: string[] }`.
  - `type AvanceTema = { estado: EstadoTema; nota: string | null; actualizadoPor: string | null; actualizadoEn: string }`.
  - `DocumentoTipo` con `'pilares'`.

- [ ] **Step 1: Pruebas**

`tests/pilares/avance.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { temaExiste, validarCambioTema } from '@/pilares/avance';
import { mapaFalso } from '../fixtures/pilares';

describe('avance por tema', () => {
  it('temaExiste busca en los pilares con datos', () => {
    const m = mapaFalso();
    expect(temaExiste(m, 'P5-S3-20')).toBe(true);
    expect(temaExiste(m, 'P6-S1-01')).toBe(false);
    m.pilares[4] = { numero: 5, estado: 'vacio', razon: 'x' };
    expect(temaExiste(m, 'P5-S3-20')).toBe(false);
    expect(temaExiste(null, 'P1-S1-01')).toBe(false);
  });

  it('valida estado y nota', () => {
    expect(validarCambioTema({ estado: 'publicado' })).toEqual({ ok: true, estado: 'publicado' });
    expect(validarCambioTema({ nota: 'Pedir foto' })).toEqual({ ok: true, nota: 'Pedir foto' });
    expect(validarCambioTema({ nota: '   ' })).toEqual({ ok: true, nota: null });
    expect(validarCambioTema({ estado: 'listo' }).ok).toBe(false);
    expect(validarCambioTema({ nota: 'x'.repeat(2001) }).ok).toBe(false);
    expect(validarCambioTema({}).ok).toBe(false);
    expect(validarCambioTema('x').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/pilares/avance.test.ts`
Expected: FAIL.

- [ ] **Step 3: `avance.ts`**

```ts
import { ESTADOS_TEMA, type EstadoTema, type MapaPilares } from './schemas';
import { todosLosTemas } from './revision';

export type AvanceTema = { estado: EstadoTema; nota: string | null; actualizadoPor: string | null; actualizadoEn: string };

export function temaExiste(datos: unknown, temaId: string): boolean {
  const pilares = (datos as MapaPilares | null)?.pilares;
  if (!Array.isArray(pilares)) return false;
  return todosLosTemas(pilares).some((t) => t.id === temaId);
}

export function validarCambioTema(cuerpo: unknown):
  | { ok: true; estado?: EstadoTema; nota?: string | null }
  | { ok: false; errores: string[] } {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, errores: ['El cuerpo debe ser un objeto.'] };
  const c = cuerpo as Record<string, unknown>;
  const salida: { ok: true; estado?: EstadoTema; nota?: string | null } = { ok: true };
  if ('estado' in c) {
    if (!ESTADOS_TEMA.includes(c.estado as EstadoTema)) return { ok: false, errores: ['Estado no válido.'] };
    salida.estado = c.estado as EstadoTema;
  }
  if ('nota' in c) {
    if (c.nota !== null && typeof c.nota !== 'string') return { ok: false, errores: ['La nota debe ser texto.'] };
    const nota = typeof c.nota === 'string' ? c.nota.trim() : '';
    if (nota.length > 2000) return { ok: false, errores: ['La nota admite hasta 2000 caracteres.'] };
    salida.nota = nota || null;
  }
  if (!('estado' in salida) && !('nota' in salida)) return { ok: false, errores: ['Nada que actualizar.'] };
  return salida;
}
```

- [ ] **Step 4: Endpoint**

`src/pages/api/pilares/[id]/temas/[temaId].ts`:
```ts
import type { APIRoute } from 'astro';
import { eq, sql } from 'drizzle-orm';
import { db, pilaresResults, pilaresTemas, users } from '@/db';
import { temaExiste, validarCambioTema } from '@/pilares/avance';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const [r] = await db.select({ id: pilaresResults.id, datos: pilaresResults.datos })
    .from(pilaresResults).where(eq(pilaresResults.id, params.id!)).limit(1);
  if (!r || !temaExiste(r.datos, params.temaId!)) return json({ ok: false, errores: ['El tema no existe.'] }, 404);

  let crudo: unknown;
  try { crudo = await request.json(); } catch { return json({ ok: false, errores: ['El cuerpo no es JSON válido.'] }, 400); }
  const v = validarCambioTema(crudo);
  if (!v.ok) return json(v, 400);

  const cambios = {
    ...(v.estado !== undefined ? { estado: v.estado } : {}),
    ...(v.nota !== undefined ? { nota: v.nota } : {}),
    actualizadoPor: locals.userId ?? null,
    actualizadoEn: new Date(),
  };
  const [fila] = await db.insert(pilaresTemas)
    .values({ resultId: r.id, temaId: params.temaId!, ...cambios })
    .onConflictDoUpdate({ target: [pilaresTemas.resultId, pilaresTemas.temaId], set: cambios })
    .returning();

  const [autor] = fila.actualizadoPor
    ? await db.select({ email: users.email }).from(users).where(eq(users.id, fila.actualizadoPor)).limit(1)
    : [];

  return json({ ok: true, estado: fila.estado, nota: fila.nota, actualizadoPor: autor?.email ?? null, actualizadoEn: fila.actualizadoEn });
};
```
(Si `sql` no se usa, quitarlo del import.)

- [ ] **Step 5: Compartir**

- `src/lib/share.ts`: `export type DocumentoTipo = 'research' | 'growth' | 'pilares';`.
- `src/pages/api/share.ts`:
  - `const tipo = crudo.tipo === 'growth' ? 'growth' : crudo.tipo === 'pilares' ? 'pilares' : 'research';`
  - `const tabla = tipo === 'growth' ? growthResults : tipo === 'pilares' ? pilaresResults : researchResults;` (importar `pilaresResults`).
- `src/lib/documento-publico.ts`: añadir `pilaresResults` a la elección de tabla. En la rama del render, si `link.documentoTipo === 'pilares'`, devolver por ahora `renderizarPilares`. Si P6 aún no existe, dejar la rama con un HTML mínimo `<!DOCTYPE html><title>Mapa de pilares</title><p>Disponible pronto.</p>`, y P6 la sustituye.

- [ ] **Step 6: Ver que pasa**

Run: `npx vitest run tests/pilares/avance.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pilares/avance.ts src/pages/api/pilares src/lib/share.ts src/pages/api/share.ts src/lib/documento-publico.ts tests/pilares/avance.test.ts
git commit -m "feat(pilares): avance por tema compartido y links públicos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P5: Base editorial compartida

**Prerrequisito:** la Task H (cabecera flotante) tiene commit. Antes de empezar, leer `src/render/investigacion/{documento,estilos,comunes,cabecera}.ts` y `src/render/barra-operador.ts` tal como quedaron.

**Files:**
- Create: `src/render/editorial/estilos.ts`, `src/render/editorial/cabecera.ts`, `src/render/editorial/interaccion.ts`, `src/render/editorial/comunes.ts`
- Modify: `src/render/investigacion/*` (importan de la base), `src/render/barra-operador.ts` (`OpcionesBarra.tipo` admite `'pilares'`)
- Test: `tests/render/editorial.test.ts`; las pruebas existentes de investigación siguen pasando sin cambiar sus aserciones de contenido.

**Interfaces:**
- Produces:
  - `ESTILOS_EDITORIAL: string`: tokens, base, cabecera flotante, `.pagina`/`.marco`/`.indice-lateral`, portada y cifras, `.seccion`/`.alterna`/`.seccion-cabeza`, `.rejilla`/`.pila`/`.tarjeta`/`.etiqueta`/`.chips`/`.lista`, `.pestanas`/`.panel-tema` (respetando `hidden`), `.aparece`, `.mas`, `.destacado`, pie, foco, movimiento reducido e impresión.
  - `ESTILOS_INVESTIGACION = ESTILOS_EDITORIAL + reglas propias` (gráficas, perfiles, pasos, cita).
  - `cabeceraDocumento(o: { etiqueta: string; cliente: string; operador?: OpcionesBarra }): string` y `SCRIPT_CABECERA: string`, generalizados desde lo que produjo H: el texto «Investigación · {cliente}» pasa a «{etiqueta} · {cliente}».
  - `SCRIPT_EDITORIAL: string`: tema, pestañas ARIA, índice activo, apariciones e impresión. Es el `SCRIPT_DOCUMENTO` de investigación, sin nada específico de un documento.
  - `envolverDocumento(o: { titulo: string; etiqueta: string; cliente: string; fecha: string; estilos: string; indice: [num: string, id: string, nombre: string][]; cuerpo: string; operador?: OpcionesBarra; scriptsExtra?: string }): string`: el `<!DOCTYPE>` completo con head, `SCRIPT_TEMA`, marca `js`, cabecera, `.pagina > .marco > nav + main`, pie y scripts.
  - `escapar`, `encabezadoSeccion` y `lista`, reexportados desde `src/render/editorial/comunes.ts`.
- `renderizarInvestigacion` conserva su firma y su HTML resultante equivalente (mismas clases, ids y textos).

- [ ] **Step 1: Prueba de la base**

`tests/render/editorial.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';
import { cabeceraDocumento, SCRIPT_CABECERA } from '@/render/editorial/cabecera';
import { SCRIPT_EDITORIAL } from '@/render/editorial/interaccion';
import { envolverDocumento } from '@/render/editorial/comunes';

const operador = { clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1', version: 2, tipo: 'pilares' as const, tokenActivo: null, base: 'https://x' };

describe('base editorial', () => {
  it('estilos con tokens, ancho 85%, pestañas que respetan hidden y sin márgenes entre hermanos', () => {
    expect(ESTILOS_EDITORIAL).toContain(':root[data-tema="oscuro"]');
    expect(ESTILOS_EDITORIAL).toContain('min(85%,1600px)');
    expect(ESTILOS_EDITORIAL).not.toMatch(/\.panel-tema\s*\{[^}]*display:grid/);
    expect(ESTILOS_EDITORIAL).not.toMatch(/\.[\w-]+\s*\+\s*\.[\w-]+\s*\{/);
  });
  it('cabecera con etiqueta, sin Compartir en pública y con Compartir en interna', () => {
    const pub = cabeceraDocumento({ etiqueta: 'Mapa de pilares', cliente: '<Ana>' });
    expect(pub).toContain('Mapa de pilares');
    expect(pub).toContain('&lt;Ana&gt;');
    expect(pub).not.toContain('Compartir');
    const int = cabeceraDocumento({ etiqueta: 'Mapa de pilares', cliente: 'Ana', operador });
    expect(int).toContain('Compartir');
    expect(int).toContain('Vista interna · v2');
  });
  it('scripts válidos', () => {
    expect(() => new Function(SCRIPT_CABECERA)).not.toThrow();
    expect(() => new Function(SCRIPT_EDITORIAL)).not.toThrow();
  });
  it('envolverDocumento arma el marco con índice, cuerpo y pie', () => {
    const h = envolverDocumento({ titulo: 'T', etiqueta: 'Mapa de pilares', cliente: 'Ana', fecha: '2026-09-15', estilos: 'x{}', indice: [['01', 'uno', 'Uno']], cuerpo: '<section id="uno"></section>' });
    expect(h).toContain('<title>T</title>');
    expect(h).toContain('class="indice-lateral"');
    expect(h).toContain('href="#uno"');
    expect(h).toContain('Preparado por Wozial');
    expect(h).toContain("classList.add('js')");
  });
});
```

- [ ] **Step 2: Refactorizar**

Mover el código ya existente a la base, sin cambiar su comportamiento. La investigación importa de `src/render/editorial/*`. `OpcionesBarra.tipo` pasa a `'research' | 'growth' | 'pilares'`, y la cabecera usa `tipo` para `POST /api/share` y para el enlace «Regenerar»:

| Tipo | «Regenerar» apunta a |
|---|---|
| `research` | `/clientes/{id}/investigar` |
| `pilares` | `/clientes/{id}/pilares` |
| `growth` | `/clientes/{id}` |

- [ ] **Step 3: Ver que pasan**

Run: `npx vitest run tests/render`, luego `npm test` y `npm run build`.
Expected: todo en verde. Las pruebas de investigación siguen iguales en contenido; solo cambian sus imports si referían a módulos movidos.

- [ ] **Step 4: Commit**

```bash
git add src/render tests/render
git commit -m "refactor(render): base editorial compartida entre investigación y mapa de pilares

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P6: Documento del Mapa de Pilares

**Files:**
- Create: `src/render/pilares/estilos.ts`, `src/render/pilares/secciones.ts`, `src/render/pilares/banco.ts`, `src/render/pilares/script.ts`, `src/render/pilares/documento.ts`
- Modify: `src/lib/documento-publico.ts` (rama `pilares` con el render real)
- Test: `tests/render/pilares.test.ts`

**Interfaces:**
- Consumes: P1 (tipos, `todosLosTemas`), P4 (`AvanceTema`), P5 (`ESTILOS_EDITORIAL`, `envolverDocumento`, `encabezadoSeccion`, `escapar`, `lista`), `OpcionesBarra`.
- Produces: `renderizarPilares(mapa: MapaPilares, meta: { cliente: string; fecha: string }, opciones?: { operador?: OpcionesBarra; avance?: Record<string, AvanceTema>; resultId?: string }): string` y `SCRIPT_PILARES: string`.

- [ ] **Step 1: Pruebas**

`tests/render/pilares.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderizarPilares, SCRIPT_PILARES } from '@/render/pilares/documento';
import { mapaFalso } from '../fixtures/pilares';

const meta = { cliente: 'Ana Villa', fecha: '2026-09-15' };
// Las comprobaciones negativas miran solo el marcado: los estilos y scripts en
// línea mencionan clases y rutas aunque la vista no las use.
const marcado = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
const operador = { clienteId: 'c1', clienteNombre: 'Ana Villa', clienteSlug: 'ana-villa', documentoId: 'r1', version: 1, tipo: 'pilares' as const, tokenActivo: 'tok', base: 'https://x' };

describe('mapa de pilares · vista interna', () => {
  const avance = { 'P1-S1-01': { estado: 'publicado' as const, nota: 'Listo', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' } };
  const html = renderizarPilares(mapaFalso(), meta, { operador, avance, resultId: 'r1' });

  it('trae las seis secciones numeradas con índice', () => {
    for (const [num, id] of [['01', 'partida'], ['02', 'principios'], ['03', 'pilares'], ['04', 'mix'], ['05', 'conversion'], ['06', 'banco']]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`class="seccion-num">${num}<`);
    }
  });

  it('rinde los 300 temas con id, función y formato', () => {
    expect((html.match(/class="tema-tarjeta/g) ?? []).length).toBe(300);
    expect(html).toContain('data-tema="P5-S3-20"');
    expect(html).toContain('data-funcion="autoridad"');
    expect(html).toContain('data-formato="reel"');
  });

  it('muestra controles, avance, mix real y el estado guardado', () => {
    expect(html).toContain('Compartir');
    expect(html).toContain('Exportar CSV');
    expect(html).toContain('Mix real del banco');
    expect(html).toContain('data-estado="publicado"');
    expect(html).toContain('eq@wozial.mx');
    expect((html.match(/class="boton-estado/g) ?? []).length).toBe(300);
  });

  it('pestañas ARIA por subcategoría dentro de cada pilar', () => {
    expect((html.match(/role="tab"(?=[\s>])/g) ?? []).length).toBe(15);
  });
});

describe('mapa de pilares · vista pública', () => {
  const html = renderizarPilares(mapaFalso(), meta);
  it('sin controles, estados, notas ni supuestos', () => {
    for (const s of ['Compartir', 'Exportar CSV', 'boton-estado', 'data-estado', 'Mix real del banco', '/api/pilares']) expect(marcado(html)).not.toContain(s);
    expect((html.match(/class="tema-tarjeta/g) ?? []).length).toBe(300);
  });
});

describe('bordes', () => {
  it('pilar vacío declara su razón y ofrece regenerar solo en la interna', () => {
    const m = mapaFalso();
    m.pilares[1] = { numero: 2, estado: 'vacio', razon: 'Se alcanzó el tope de costo antes de ejecutar este pilar.' };
    expect(renderizarPilares(m, meta, { operador, resultId: 'r1' })).toContain('Regenerar el mapa');
    const pub = renderizarPilares(m, meta);
    expect(pub).toContain('Este pilar no se generó');
    expect(marcado(pub)).not.toContain('Regenerar el mapa');
  });
  it('aviso de revisión solo en la interna', () => {
    const m = mapaFalso();
    m.revision.fueraDeMargen = ['venta'];
    expect(renderizarPilares(m, meta, { operador, resultId: 'r1' })).toContain('aviso-revision');
    expect(marcado(renderizarPilares(m, meta))).not.toContain('aviso-revision');
  });
  it('escapa el texto del modelo', () => {
    const m = mapaFalso();
    (m.pilares[0] as any).subcategorias[0].temas[0].texto = '<script>alert(1)</script>';
    m.estrategia.ideas[0].titulo = '<img onerror=x>';
    const h = renderizarPilares(m, meta);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).not.toContain('<img onerror=x>');
  });
  it('el script del mapa es JavaScript válido y guarda por PATCH', () => {
    expect(() => new Function(SCRIPT_PILARES)).not.toThrow();
    for (const s of ['PATCH', '/api/pilares/', 'text/csv', 'Escape']) expect(SCRIPT_PILARES).toContain(s);
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/render/pilares.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Requisitos del spec §5, con estas decisiones de marcado que las pruebas fijan:
- **Índice:** `[['01','partida','Punto de partida'],['02','principios','No negociables'],['03','pilares','Los 5 pilares'],['04','mix','Mix editorial'],['05','conversion','Conversión'],['06','banco','Banco de temas']]`.
- **Portada:** eyebrow «Mapa de pilares · {cliente} · {fecha}» y título «Mapa de pilares y banco de contenidos». Las cifras 5 · 15 · {total} · «Facebook + Instagram» van con `.cifra-tarjeta`. En la interna, la barra «{hechos} de {total} desarrollados» cuenta `desarrollado + publicado`.
- **Secciones 01–05:** usan `encabezadoSeccion` y las clases de la base. Los pilares tienen color por número en la variable `--color-pilar`: rosa, azul, amarillo, verde, tinta. El mix es una barra apilada con `style="width:{p}%"` por función.
- **Banco:** `<section class="seccion" id="banco" data-seccion>` contiene:
  - La barra de herramientas (`.herramientas`, `position:sticky`), con:
    - `input type="search" data-filtro="texto"`;
    - `select data-filtro="pilar|subcategoria|funcion|formato"` y, en la interna, `select data-filtro="estado"`;
    - `button data-accion="limpiar"`;
    - `<output data-contador>`.
  - En la interna, además, «Exportar CSV» (`data-accion="csv"`) e «Imprimir / PDF» (`data-accion="imprimir"`).
- **Pilar:** `<details class="pilar-bloque" open data-pilar="{n}">`. Dentro, un `role="tablist"` con 3 `button role="tab"` y 3 `role="tabpanel"`.
- **Tema:** `<article class="tema-tarjeta" data-tema data-pilar data-subcategoria data-funcion data-formato data-busqueda="{normalizado}" [data-estado en interna]>`, con:
  - id, etiqueta de función y formato;
  - texto;
  - en la interna, `button class="boton-estado" data-estado-actual` y `button class="boton-nota"` (con `data-nota` y la clase `con-nota` si existe), más «{email} · {fecha}» si hay avance.
- **Pilar vacío:** `.pilar-bloque.vacio` con «Este pilar no se generó» y su razón. En la interna añade el enlace «Regenerar el mapa» a `/clientes/{clienteId}/pilares`.
- **Aviso de revisión** (interna, si hay `duplicadosRestantes` o `fueraDeMargen`): `<div class="aviso-revision">` con la lista de pares y funciones.
- **Nota:** un único `<dialog class="panel-nota">` con el título del tema, un `textarea maxlength="2000"`, Guardar y Cerrar.
- **Pie:** `reglaEspecial` si existe; `supuestos` solo en la interna.
- **`SCRIPT_PILARES`**, ES5:
  - Filtros combinados, que ocultan tarjetas con `hidden` y actualizan el contador. Si un pilar queda sin coincidencias, se oculta su bloque. El filtro de subcategoría se llena según el pilar elegido.
  - Clic en una tarjeta de pilar (03) → aplica el filtro de pilar y baja a `#banco`.
  - Botón de estado:
    - Avanza en ciclo `pendiente → en_desarrollo → desarrollado → publicado → pendiente`.
    - Actualiza al instante y hace `fetch('/api/pilares/' + resultId + '/temas/' + id, { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ estado }) })`.
    - Si la respuesta es ok, muestra «Guardado» y el autor y fecha; si no, revierte y muestra «No se pudo guardar».
    - El `resultId` sale de `data-result-id` en `#banco`.
  - Nota: abre el `dialog` con su texto, guarda con PATCH `{ nota }` y marca `con-nota`. Escape cierra.
  - CSV: construye las filas desde los `data-*` de las tarjetas visibles, en el orden id, pilar, subcategoría, tema, función, formato, estado, nota. Escapa comillas y descarga con `Blob` de tipo `text/csv;charset=utf-8`.
  - Imprimir: `window.print()`. En `beforeprint` abre todos los `details` y quita `hidden` de tarjetas y paneles; en `afterprint` restaura.
- **Estilos** (`ESTILOS_PILARES = ESTILOS_EDITORIAL + propios`): tarjetas de tema en `.rejilla.dos`, colores de función y estado con tokens, barra apilada del mix, cabecera de pilar con `--color-pilar`, herramientas en píldora y `dialog`. Todo con `gap`, 44 px, claro y oscuro.
- **`renderizarPilares`:** usa `envolverDocumento` con `etiqueta: 'Mapa de pilares'`, `titulo: 'Mapa de pilares · {cliente}'` y `scriptsExtra: SCRIPT_PILARES`.
- **`documento-publico.ts`:** la rama `pilares` llama a `renderizarPilares(r.datos, { cliente, fecha })` sin opciones.

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run tests/render/pilares.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/pilares src/lib/documento-publico.ts tests/render/pilares.test.ts
git commit -m "feat(pilares): documento editorial con banco de temas filtrable y avance

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P7: Integración en el Studio

**Files:**
- Create: `src/pages/pilares/[id].astro`, `src/pages/clientes/[id]/pilares.astro`
- Modify: `src/pages/clientes/[id].astro`, `src/pages/entregables.astro`, `src/pages/jobs/[id].astro`, `src/components/ProgresoJob.tsx`, `src/lib/ui/progreso.ts`
- Test: `tests/lib/ui/progreso.test.ts` (añadir casos)

**Interfaces:**
- Consumes: P3 (tablas, `ETAPAS_PILARES`), P4, P6.

- [ ] **Step 1: Progreso**

En `tests/lib/ui/progreso.test.ts`, añadir:
```ts
import { ETAPAS_PILARES } from '@/pilares/pipeline';
// …
it('las etapas del mapa de pilares coinciden con su pipeline', () => {
  expect(etapasDe('pilares').map((e) => e.clave)).toEqual([...ETAPAS_PILARES]);
});
```
En `src/lib/ui/progreso.ts`, añadir la lista `PILARES`:
- `estrategia`, «Estrategia», «Idea rectora, principios, pilares y mix.»
- `pilar1` a `pilar5`, «Pilar 1» a «Pilar 5», «Sesenta temas en tres subcategorías.»
- `revision`, «Revisión», «Temas repetidos y reparto por función.»

`etapasDe` devuelve `PILARES` para `tipo === 'pilares'`. Se mantiene el comentario de por qué se copian las etapas en lugar de importarlas.

`src/components/ProgresoJob.tsx`:
- `tipo?: 'research' | 'growth' | 'pilares'`.
- El destino final es `/pilares/{resultId}` con el texto «Ver el mapa de pilares» para `pilares`.

`src/pages/jobs/[id].astro`:
- Tabla por tipo, incluida `pilaresResults`.
- Eyebrow y título «Mapa de pilares» para `pilares`.

- [ ] **Step 2: Vista interna `/pilares/[id]`**

`src/pages/pilares/[id].astro`, siguiendo el patrón de `src/pages/resultados/[id].astro`:
- Carga el resultado y el cliente (404 si no existen).
- Carga el link activo de `share_links` con `documentoTipo='pilares'`.
- Carga el avance con un join de `pilaresTemas` y `users`, y lo pasa a `Record<temaId, AvanceTema>` con `actualizadoEn` en ISO.
- Calcula `base` y llama a `renderizarPilares(datos, { cliente, fecha }, { operador: {…, tipo: 'pilares'}, avance, resultId: r.id })` dentro de `<Fragment set:html>`.

- [ ] **Step 3: Confirmación `/clientes/[id]/pilares`**

`src/pages/clientes/[id]/pilares.astro`, con la misma estructura visual que `src/pages/clientes/[id]/investigar.astro`: `Base` con `volver` y rejilla checklist + panel de costo.
- **Renglones:**
  - Investigación: ✓ si `puedeGenerarPilares({ etapasConDatos: max(contarEtapasConDatos) }).ok`; si no, ⚠ con la razón.
  - Giro y producto ✓.
  - Ciudad, enlaces y archivos con texto: ✓/⚠.
- **Panel de costo:** `COST_ESTIMATE_PILARES_USD` (3 por omisión) y tope `COST_LIMIT_USD`.
- **Botón «Generar mapa de pilares»:**
  - Deshabilitado si no hay investigación con datos.
  - Hace `POST /api/jobs {clientId, tipo:'pilares'}`; con ok o con 409 y `jobId`, redirige a `/jobs/{id}`.
  - Los errores van en `#error` con `role="alert"`, sin `alert()`.

- [ ] **Step 4: Ficha, historial y entregables**

`src/pages/clientes/[id].astro`:
- Cargar `pilaresResults` del cliente, ordenados por versión descendente.
- Tercera tarjeta de acción «Mapa de pilares» con icono `entregables`:
  - «Último mapa: {fecha}» o «Listo para generarse»; si no puede generarse, la razón.
  - Botón-enlace «Generar» a `/clientes/{id}/pilares`, deshabilitado visualmente con la razón si no se puede.
- La rejilla de acciones pasa a `.rejilla tres`.
- `ultimaInvestigacion` pasa a `jobs.find((j) => j.tipo === 'research')`.
- En el historial, el tipo `pilares` se nombra «Mapa de pilares» y enlaza a `/pilares/{id}` cuando hay resultado.

`src/pages/entregables.astro`:
- Añadir los resultados de `pilaresResults` con `tipo: 'pilares'`.
- Chip «Mapas de pilares», eyebrow «Mapa de pilares» y vista `/pilares/{id}`.
- «Crear link» envía `tipo: 'pilares'`.

- [ ] **Step 5: Verificar**

Run: `npm test` y `npm run build`.
Con build, en segundo plano: `PORT=4399 node --env-file=.env ./dist/server/entry.mjs`. Iniciar sesión con curl (usuario local `studio@local.test` / `local-solo-para-probar-2026`) y comprobar:
- `/entregables` responde 200;
- la ficha de un cliente responde 200 y contiene «Mapa de pilares»;
- `/clientes/<id>/pilares` responde 200.

No pulsar Generar. Matar solo ese PID.

- [ ] **Step 6: Commit**

```bash
git add src/pages src/components/ProgresoJob.tsx src/lib/ui/progreso.ts tests/lib/ui/progreso.test.ts
git commit -m "feat(pilares): vista interna, confirmación y entrada en ficha, entregables y progreso

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task P8: Verificación visual (controlador)

**Files:** ninguno versionado.

- [ ] **Step 1: Sembrar un mapa de demostración solo en la base local**

Con un script en el scratchpad (no en el repo), construir `datos` a partir del ejemplo local `Wozial/Info cliente/Mar_de_Miel_Mapa_Maestro_Editorial.html`:
- Pilares, subcategorías y temas del arreglo `pillars`.
- Ideas, principios, fronteras, mix y conversión transcritos del HTML.
- Función y formato asignados en ciclo.
- Ids con `asignarIds` y revisión calculada.

Insertar un `research_jobs` completado `tipo='pilares'` y un `pilares_results` para el cliente de ejemplo, más un link compartido.

- [ ] **Step 2: Recorrido**

En el Browser pane:
- **Link público** `/p/x/<token>`: 1440 claro y 375 oscuro. Revisar portada, pilares, mix, pestañas por subcategoría, filtros y contador, y que no haya desbordamiento.
- **`/pilares/<id>`**: el usuario lo revisa con su sesión (cambiar estado, nota, CSV).

- [ ] **Step 3: Informe al usuario**

Qué quedó, qué falta (desarrollo de piezas) y que nada está subido.
