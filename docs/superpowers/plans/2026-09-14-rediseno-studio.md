# Rediseño del Studio · Etapa 1 · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar toda la app de operador de Wozial Studio con la línea visual de familiaenpractica.com/menu —claro por defecto, switch día/noche, navegación tipo app, tablero, paleta ⌘K— sin perder ninguna función actual.

**Architecture:** Los tokens de color, tipografía y forma viven en `src/styles/tokens.css` y el tema oscuro solo redefine valores bajo `:root[data-tema="oscuro"]`. Toda la lógica nueva que se puede separar del DOM —tema, iniciales, búsqueda, estado de cliente, indicadores, avance— vive en funciones puras bajo `src/lib/ui/` con pruebas Vitest. Las páginas Astro consumen esas funciones; las islas React (`Paleta`, `ProgresoJob`) también. `LinksEditor` y `FilesUploader` no se tocan: la hoja nueva conserva sus clases.

**Tech Stack:** Astro 7.2.1 SSR (adaptador node), React 19, Drizzle 0.45.2 + Postgres, Vitest 4.1.10, Poppins de Google Fonts.

**Spec:** `docs/superpowers/specs/2026-09-14-rediseno-studio-design.md`

---

## Restricciones globales

- Rama `feat/rediseno`. **Nunca `git push` ni despliegue** sin visto bueno explícito del usuario: un push a `main` redepliega Railway.
- Nunca pedir ni escribir la `ANTHROPIC_API_KEY` en el chat ni en archivos versionados. El repo `wozialmktlovers/cash` es público.
- Comentarios en español, con la misma voz que el código existente: explican el *porqué*.
- Todo commit termina con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Ejecutar comandos desde `/Users/michelangelgonzalezhernandez/Desktop/Claude/Wozial Studio`.
- `npm test` debe pasar al final de cada tarea.
- No usar `alert()` en código nuevo.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/styles/tokens.css` | Crear | Tokens claro y oscuro |
| `src/styles/global.css` | Reescribir | Base, shell, componentes, clases compatibles |
| `src/lib/ui/contraste.ts` | Crear | Luminancia y razón de contraste WCAG |
| `src/lib/ui/tema.ts` | Crear | Resolución de tema y script en línea sin destello |
| `src/lib/ui/cliente-visual.ts` | Crear | Iniciales y tinte estable |
| `src/lib/ui/buscar.ts` | Crear | Normalizar y buscar sin acentos |
| `src/lib/ui/estado-cliente.ts` | Crear | Estado de cliente, filtros, costo acumulado |
| `src/lib/ui/tablero.ts` | Crear | Indicadores del tablero |
| `src/lib/ui/progreso.ts` | Crear | Etapas por tipo, porcentaje, tiempo, etiquetas de estado |
| `src/lib/clientes.ts` | Modificar | Añadir `resumenCliente` |
| `src/pages/api/clientes/index.ts` | Modificar | Añadir `GET` |
| `src/scripts/tema-switch.ts` | Crear | Conecta el switch con el script de tema |
| `src/scripts/toast.ts` | Crear | Toasts |
| `src/scripts/copiar.ts` | Crear | Copiar con respaldo |
| `src/components/Icono.astro` | Crear | Iconos SVG en línea |
| `src/components/TemaSwitch.astro` | Crear | Control sol/luna |
| `src/components/TarjetaCliente.astro` | Crear | Tarjeta reutilizada en tablero y lista |
| `src/components/Paleta.tsx` | Crear | Paleta ⌘K |
| `src/components/ProgresoJob.tsx` | Reescribir | Línea de tiempo y bug de etapas de Growth |
| `src/layouts/Base.astro` | Reescribir | Shell: barra lateral, barra superior, pestañas móviles |
| `src/pages/login.astro` | Reescribir | Acceso |
| `src/pages/index.astro` | Reescribir | Tablero |
| `src/pages/clientes/index.astro` | Crear | Lista de clientes |
| `src/pages/clientes/nuevo.astro` | Reescribir | Alta |
| `src/pages/clientes/[id].astro` | Reescribir | Ficha con pestañas |
| `src/pages/clientes/[id]/investigar.astro` | Reescribir | Checklist y costo |
| `src/pages/jobs/[id].astro` | Reescribir | Progreso |
| `src/pages/entregables.astro` | Crear | Entregables |
| `tests/lib/ui/*.test.ts` | Crear | Pruebas de la lógica pura |
| `tests/lib/clientes.test.ts` | Modificar | Prueba de `resumenCliente` |

---

### Task 0: Entorno local para verificar

Sin Postgres local no se puede ver ninguna pantalla. Esta tarea no cambia código.

**Files:** ninguno.

- [ ] **Step 1: Encender Docker**

Run: `docker info >/dev/null 2>&1 && echo listo || open -a Docker`
Si abrió Docker, repetir `docker info >/dev/null 2>&1 && echo listo` cada 10 s hasta ver `listo` (máximo 2 min).

- [ ] **Step 2: Levantar Postgres**

Run:
```bash
docker start wozial-pg 2>/dev/null || docker run -d --name wozial-pg -e POSTGRES_PASSWORD=wozial -e POSTGRES_USER=wozial -e POSTGRES_DB=wozial_studio -p 5432:5432 postgres:16-alpine
```
Expected: imprime `wozial-pg` o un id de contenedor.

- [ ] **Step 3: Migrar, crear usuario local y sembrar**

Run:
```bash
node --env-file=.env scripts/migrate.mjs
node --env-file=.env scripts/crear-usuario.mjs studio@local.test "local-solo-para-probar-2026"
node --env-file=.env scripts/sembrar-ejemplo.mjs
node --env-file=.env scripts/sembrar-growth.mjs
```
Expected: sin errores; `Usuario listo: studio@local.test`. Este usuario solo existe en la base local.

- [ ] **Step 4: Línea base**

Run: `npm test 2>&1 | tail -5`
Expected: todos los tests pasan. Anotar el número para comparar al final.

---

### Task 1: Tokens y prueba de contraste

**Files:**
- Create: `src/lib/ui/contraste.ts`
- Create: `src/styles/tokens.css`
- Test: `tests/lib/ui/contraste.test.ts`

- [ ] **Step 1: Escribir la prueba**

`tests/lib/ui/contraste.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contraste } from '@/lib/ui/contraste';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function bloque(selector: string): Record<string, string> {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No existe el bloque ${selector}`);
  const cuerpo = css.slice(inicio, css.indexOf('}', inicio));
  const tokens: Record<string, string> = {};
  for (const m of cuerpo.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

const claro = bloque(':root');
const oscuro = { ...claro, ...bloque(':root[data-tema="oscuro"]') };

// Cada par es texto sobre fondo tal como aparece en pantalla.
const PARES: Array<[string, string]> = [
  ['tinta', 'fondo'], ['texto', 'fondo'], ['texto', 'gris'],
  ['suave', 'fondo'], ['suave', 'gris'], ['suave', 'tarjeta'],
  ['rosa', 'fondo'], ['rosa', 'rosa-s'], ['sobre-acento', 'rosa'],
  ['azul', 'fondo'], ['azul', 'azul-s'],
  ['amarillo', 'fondo'], ['amarillo', 'amarillo-s'],
  ['verde', 'fondo'], ['verde', 'verde-s'],
  ['rojo', 'fondo'], ['rojo', 'rojo-s'],
];

describe('contraste', () => {
  it('calcula los extremos conocidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  for (const [nombre, tokens] of [['claro', claro], ['oscuro', oscuro]] as const) {
    it(`todos los pares de texto cumplen AA en tema ${nombre}`, () => {
      for (const [fg, bg] of PARES) {
        expect(tokens[fg], `falta --${fg}`).toBeDefined();
        expect(tokens[bg], `falta --${bg}`).toBeDefined();
        const r = contraste(tokens[fg], tokens[bg]);
        expect(r, `--${fg} sobre --${bg} da ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
```

- [ ] **Step 2: Correrla y ver que falla**

Run: `npx vitest run tests/lib/ui/contraste.test.ts`
Expected: FAIL, no encuentra `@/lib/ui/contraste`.

- [ ] **Step 3: Implementar `contraste.ts`**

`src/lib/ui/contraste.ts`:
```ts
/** Luminancia relativa según WCAG 2.x. */
export function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const canal = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
}

/** Razón de contraste entre dos colores, de 1 a 21. */
export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}
```

- [ ] **Step 4: Crear `tokens.css`**

`src/styles/tokens.css`:
```css
/* Tokens del Studio. El tema oscuro solo redefine valores: ningún componente
   pregunta en qué tema está. Los tonos de marca originales (#D4688A, #C8C800)
   no alcanzan 4.5:1 sobre blanco; en claro se usan versiones más profundas del
   mismo tono. tests/lib/ui/contraste.test.ts lo vigila. */
:root {
  color-scheme: light;

  --rosa: #B8446B;
  --azul: #4E62C0;
  --amarillo: #6E6600;
  --verde: #08704E;
  --rojo: #B83434;
  --sobre-acento: #FFFFFF;

  --rosa-s: #FBEEF2;
  --azul-s: #EEF0FB;
  --amarillo-s: #F7F7E0;
  --verde-s: #E7F6F0;
  --rojo-s: #FCECEC;

  --tinta: #1A1624;
  --texto: #4A4258;
  --suave: #716882;
  --linea: #EEEAF2;
  --fondo: #FFFFFF;
  --gris: #F6F4F9;
  --tarjeta: #FFFFFF;

  --fuente: 'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --t-display: 700 clamp(30px, 6vw, 42px)/1.06 var(--fuente);
  --t-h1: 700 clamp(25px, 5vw, 34px)/1.14 var(--fuente);
  --t-h2: 700 clamp(19px, 3.6vw, 22px)/1.2 var(--fuente);
  --t-h3: 600 16.5px/1.25 var(--fuente);
  --t-body: 400 15.5px/1.6 var(--fuente);
  --t-small: 500 13px/1.45 var(--fuente);
  --t-micro: 700 11.5px/1.3 var(--fuente);
  --tracking-titulo: -0.035em;

  --r: 18px;
  --r-sm: 12px;
  --r-pill: 999px;
  --sombra: 0 1px 2px rgba(26, 22, 36, 0.04), 0 10px 30px -20px rgba(26, 22, 36, 0.4);
  --foco: 0 0 0 3px color-mix(in srgb, var(--rosa) 35%, transparent);
  --ancho: 1120px;
  --tabs: 70px;
  --lateral: 248px;
}

:root[data-tema="oscuro"] {
  color-scheme: dark;

  --rosa: #F08BAC;
  --azul: #8E9EEB;
  --amarillo: #DCDC4A;
  --verde: #34D399;
  --rojo: #F87171;
  --sobre-acento: #1A1624;

  --rosa-s: #33222A;
  --azul-s: #1F2236;
  --amarillo-s: #2A2A16;
  --verde-s: #14291F;
  --rojo-s: #301A1A;

  --tinta: #F7F4FA;
  --texto: #DAD3E4;
  --suave: #A69CB8;
  --linea: #2C2636;
  --fondo: #111017;
  --gris: #1B1822;
  --tarjeta: #1D1A25;

  --sombra: 0 1px 2px rgba(0, 0, 0, 0.5), 0 12px 32px -22px #000;
}
```

- [ ] **Step 5: Correr la prueba**

Run: `npx vitest run tests/lib/ui/contraste.test.ts`
Expected: PASS (3 tests). Si un par falla, oscurecer (claro) o aclarar (oscuro) ese token y volver a correr; nunca bajar el umbral.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ui/contraste.ts src/styles/tokens.css tests/lib/ui/contraste.test.ts
git commit -m "feat(rediseño): tokens claro/oscuro con contraste AA verificado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Resolución de tema sin destello

**Files:**
- Create: `src/lib/ui/tema.ts`
- Test: `tests/lib/ui/tema.test.ts`

- [ ] **Step 1: Escribir la prueba**

`tests/lib/ui/tema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolverTema, SCRIPT_TEMA, CLAVE_TEMA, COLOR_BARRA } from '@/lib/ui/tema';

describe('resolverTema', () => {
  it('la elección guardada gana al dispositivo', () => {
    expect(resolverTema('claro', true)).toBe('claro');
    expect(resolverTema('oscuro', false)).toBe('oscuro');
  });
  it('sin elección válida sigue al dispositivo', () => {
    expect(resolverTema(null, true)).toBe('oscuro');
    expect(resolverTema('basura', false)).toBe('claro');
  });
});

/** Ejecuta el script en línea contra un navegador falso. */
function correr(o: { guardado?: string; oscuro: boolean; bloqueado?: boolean }) {
  const dataset: Record<string, string> = {};
  const meta = { content: '', setAttribute(_k: string, v: string) { this.content = v; } };
  const almacen = new Map<string, string>(o.guardado ? [[CLAVE_TEMA, o.guardado]] : []);
  let oyente: ((e: { matches: boolean }) => void) | null = null;
  const eventos: string[] = [];

  const localStorage = {
    getItem: (k: string) => { if (o.bloqueado) throw new Error('bloqueado'); return almacen.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (o.bloqueado) throw new Error('bloqueado'); almacen.set(k, v); },
  };
  const document = {
    documentElement: { dataset },
    querySelector: () => meta,
    dispatchEvent: (e: { type: string }) => { eventos.push(e.type); return true; },
  };
  const window: any = {
    matchMedia: () => ({ matches: o.oscuro, addEventListener: (_t: string, f: typeof oyente) => { oyente = f; } }),
  };
  class CustomEvent { constructor(public type: string, public detail?: unknown) {} }

  new Function('window', 'document', 'localStorage', 'CustomEvent', SCRIPT_TEMA)(window, document, localStorage, CustomEvent);
  return { dataset, meta, almacen, eventos, api: window.__wozialTema, dispositivo: (m: boolean) => oyente?.({ matches: m }) };
}

describe('SCRIPT_TEMA', () => {
  it('aplica el tema del dispositivo y el color de barra', () => {
    const n = correr({ oscuro: true });
    expect(n.dataset.tema).toBe('oscuro');
    expect(n.meta.content).toBe(COLOR_BARRA.oscuro);
  });

  it('respeta la elección guardada', () => {
    expect(correr({ guardado: 'claro', oscuro: true }).dataset.tema).toBe('claro');
  });

  it('elegir guarda, aplica y avisa', () => {
    const n = correr({ oscuro: false });
    n.api.elegir('oscuro');
    expect(n.dataset.tema).toBe('oscuro');
    expect(n.almacen.get(CLAVE_TEMA)).toBe('oscuro');
    expect(n.eventos).toContain('wozial:tema');
  });

  it('sigue al dispositivo en vivo solo si nunca se eligió', () => {
    const libre = correr({ oscuro: false });
    libre.dispositivo(true);
    expect(libre.dataset.tema).toBe('oscuro');

    const fijo = correr({ guardado: 'claro', oscuro: false });
    fijo.dispositivo(true);
    expect(fijo.dataset.tema).toBe('claro');
  });

  it('con localStorage bloqueado funciona sin guardar', () => {
    const n = correr({ oscuro: true, bloqueado: true });
    expect(n.dataset.tema).toBe('oscuro');
    expect(() => n.api.elegir('claro')).not.toThrow();
    expect(n.dataset.tema).toBe('claro');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/lib/ui/tema.test.ts`
Expected: FAIL, no encuentra `@/lib/ui/tema`.

- [ ] **Step 3: Implementar**

`src/lib/ui/tema.ts`:
```ts
export type Tema = 'claro' | 'oscuro';

export const CLAVE_TEMA = 'wozial-tema';

/** Color de la barra del navegador en celular; iguala a --fondo de cada tema. */
export const COLOR_BARRA: Record<Tema, string> = { claro: '#FFFFFF', oscuro: '#111017' };

export function resolverTema(guardado: string | null, prefiereOscuro: boolean): Tema {
  if (guardado === 'claro' || guardado === 'oscuro') return guardado;
  return prefiereOscuro ? 'oscuro' : 'claro';
}

/**
 * Va en línea dentro del <head>, antes de la hoja de estilos: si se cargara
 * como módulo, cada página pintaría un cuadro en claro antes de pasar a oscuro.
 * Por eso no puede importar nada y repite en ES5 la regla de resolverTema.
 */
export const SCRIPT_TEMA = `(function () {
  var clave = ${JSON.stringify(CLAVE_TEMA)};
  var colores = ${JSON.stringify(COLOR_BARRA)};
  var guardado = null;
  try { guardado = localStorage.getItem(clave); } catch (e) {}
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function elegido() { return guardado === 'claro' || guardado === 'oscuro'; }
  function aplicar(t) {
    document.documentElement.dataset.tema = t;
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', colores[t]);
    document.dispatchEvent(new CustomEvent('wozial:tema', { detail: t }));
  }
  aplicar(elegido() ? guardado : (mq.matches ? 'oscuro' : 'claro'));
  window.__wozialTema = {
    elegir: function (t) {
      guardado = t;
      try { localStorage.setItem(clave, t); } catch (e) {}
      aplicar(t);
    }
  };
  if (mq.addEventListener) {
    mq.addEventListener('change', function (e) {
      if (!elegido()) aplicar(e.matches ? 'oscuro' : 'claro');
    });
  }
})();`;
```

- [ ] **Step 4: Ver que pasa**

Run: `npx vitest run tests/lib/ui/tema.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/tema.ts tests/lib/ui/tema.test.ts
git commit -m "feat(rediseño): resolución de tema sin destello, sigue al dispositivo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Iniciales, tinte y búsqueda sin acentos

**Files:**
- Create: `src/lib/ui/cliente-visual.ts`
- Create: `src/lib/ui/buscar.ts`
- Test: `tests/lib/ui/cliente-visual.test.ts`
- Test: `tests/lib/ui/buscar.test.ts`

- [ ] **Step 1: Escribir las pruebas**

`tests/lib/ui/cliente-visual.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { iniciales, tinte, TINTES } from '@/lib/ui/cliente-visual';

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('Yessica Villa')).toBe('YV');
    expect(iniciales('Ana Yessica Villa')).toBe('AY');
  });
  it('una sola palabra da una letra', () => {
    expect(iniciales('Kvalita')).toBe('K');
  });
  it('ignora signos y espacios de más, respeta acentos', () => {
    expect(iniciales('  (clínica)   Ñandú ')).toBe('CÑ');
  });
  it('sin nombre usable devuelve ?', () => {
    expect(iniciales('   ')).toBe('?');
    expect(iniciales('— —')).toBe('?');
  });
});

describe('tinte', () => {
  it('es estable para el mismo id', () => {
    const id = '3f1c2b8e-1111-4a2b-9c3d-000000000001';
    expect(tinte(id)).toBe(tinte(id));
  });
  it('siempre es uno de los tintes', () => {
    for (const id of ['a', 'b', 'c', 'uuid-largo-123', '']) expect(TINTES).toContain(tinte(id));
  });
  it('reparte entre los tres tintes', () => {
    const vistos = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(tinte));
    expect(vistos.size).toBe(3);
  });
});
```

`tests/lib/ui/buscar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { normalizar, coincide } from '@/lib/ui/buscar';

describe('normalizar', () => {
  it('quita acentos, mayúsculas y espacios de los bordes', () => {
    expect(normalizar('  Cosmetología ÁREA ')).toBe('cosmetologia area');
  });
});

describe('coincide', () => {
  const campos = ['Yessica Villa', 'Cosmetología', 'Guadalajara'];
  it('consulta vacía coincide con todo', () => {
    expect(coincide('  ', campos)).toBe(true);
  });
  it('encuentra sin acentos ni mayúsculas en cualquier campo', () => {
    expect(coincide('COSMETOLOGIA', campos)).toBe(true);
    expect(coincide('guada', campos)).toBe(true);
  });
  it('cada palabra de la consulta debe aparecer', () => {
    expect(coincide('villa gdl', campos)).toBe(false);
    expect(coincide('villa guadalajara', campos)).toBe(true);
  });
  it('tolera campos nulos', () => {
    expect(coincide('villa', ['Villa', null, undefined])).toBe(true);
  });
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/lib/ui/cliente-visual.test.ts tests/lib/ui/buscar.test.ts`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`src/lib/ui/cliente-visual.ts`:
```ts
export const TINTES = ['rosa', 'azul', 'amarillo'] as const;
export type Tinte = (typeof TINTES)[number];

export function iniciales(nombre: string): string {
  const letras = nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.match(/[\p{L}\p{N}]/u)?.[0])
    .filter((l): l is string => Boolean(l))
    .slice(0, 2);
  return letras.length ? letras.join('').toLocaleUpperCase('es-MX') : '?';
}

/**
 * Depende solo del id: el mismo cliente conserva su color en el tablero, la
 * lista y la ficha, aunque cambie de nombre o de posición.
 */
export function tinte(id: string): Tinte {
  let suma = 0;
  for (const ch of id) suma += ch.codePointAt(0) ?? 0;
  return TINTES[suma % TINTES.length];
}
```

`src/lib/ui/buscar.ts`:
```ts
/** Minúsculas y sin acentos, para que «cosmetologia» encuentre «Cosmetología». */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es-MX').trim();
}

export function coincide(consulta: string, campos: Array<string | null | undefined>): boolean {
  const q = normalizar(consulta);
  if (!q) return true;
  const pajar = normalizar(campos.filter(Boolean).join(' '));
  return q.split(/\s+/).every((palabra) => pajar.includes(palabra));
}
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run tests/lib/ui/cliente-visual.test.ts tests/lib/ui/buscar.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/cliente-visual.ts src/lib/ui/buscar.ts tests/lib/ui/cliente-visual.test.ts tests/lib/ui/buscar.test.ts
git commit -m "feat(rediseño): iniciales con tinte estable y búsqueda sin acentos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Estado de cliente e indicadores del tablero

**Files:**
- Create: `src/lib/ui/estado-cliente.ts`
- Create: `src/lib/ui/tablero.ts`
- Test: `tests/lib/ui/estado-cliente.test.ts`
- Test: `tests/lib/ui/tablero.test.ts`

- [ ] **Step 1: Escribir las pruebas**

`tests/lib/ui/estado-cliente.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resumirPorCliente, resumenDe, pasaFiltro } from '@/lib/ui/estado-cliente';

const j = (clientId: string, estado: string, dia: number, costoUsd = '1.5') =>
  ({ clientId, estado, costoUsd, createdAt: new Date(2026, 8, dia) });

describe('resumirPorCliente', () => {
  it('sin jobs el cliente está sin investigar', () => {
    expect(resumenDe(resumirPorCliente([]), 'x')).toEqual({ estado: 'sin_investigar', costo: 0, ultimo: null });
  });

  it('último job completado es listo y suma el costo de todos', () => {
    const r = resumenDe(resumirPorCliente([j('a', 'fallido', 1, '2'), j('a', 'completado', 5, '3.25')]), 'a');
    expect(r.estado).toBe('listo');
    expect(r.costo).toBeCloseTo(5.25);
    expect(r.ultimo?.createdAt.getDate()).toBe(5);
  });

  it('un job encolado o corriendo gana aunque haya uno completado más nuevo', () => {
    const m = resumirPorCliente([j('a', 'corriendo', 1), j('a', 'completado', 9)]);
    expect(resumenDe(m, 'a').estado).toBe('en_curso');
  });

  it('último job fallido o cancelado queda en otro', () => {
    const m = resumirPorCliente([j('a', 'completado', 1), j('a', 'cancelado', 3)]);
    expect(resumenDe(m, 'a').estado).toBe('otro');
  });

  it('no depende del orden de entrada', () => {
    const m = resumirPorCliente([j('a', 'completado', 9), j('a', 'fallido', 2)]);
    expect(resumenDe(m, 'a').estado).toBe('listo');
  });
});

describe('pasaFiltro', () => {
  it('todos deja pasar cualquier estado', () => {
    for (const e of ['listo', 'en_curso', 'sin_investigar', 'otro'] as const) expect(pasaFiltro(e, 'todos')).toBe(true);
  });
  it('otro solo aparece en todos', () => {
    expect(pasaFiltro('otro', 'listo')).toBe(false);
    expect(pasaFiltro('otro', 'en_curso')).toBe(false);
    expect(pasaFiltro('otro', 'sin_investigar')).toBe(false);
  });
  it('los demás filtros son exactos', () => {
    expect(pasaFiltro('listo', 'listo')).toBe(true);
    expect(pasaFiltro('listo', 'en_curso')).toBe(false);
  });
});
```

`tests/lib/ui/tablero.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { indicadores, claveMes } from '@/lib/ui/tablero';

describe('claveMes', () => {
  it('usa la hora de Ciudad de México, no la del servidor', () => {
    // 1 de octubre 03:00 UTC sigue siendo 30 de septiembre en CDMX.
    expect(claveMes(new Date('2026-10-01T03:00:00Z'))).toBe('2026-09');
  });
});

describe('indicadores', () => {
  const ahora = new Date('2026-09-14T18:00:00Z');
  const jobs = [
    { estado: 'corriendo', costoUsd: '2.5', createdAt: new Date('2026-09-14T17:00:00Z') },
    { estado: 'encolado', costoUsd: '0', createdAt: new Date('2026-09-14T17:30:00Z') },
    { estado: 'completado', costoUsd: '6.8', createdAt: new Date('2026-09-02T12:00:00Z') },
    { estado: 'completado', costoUsd: '7', createdAt: new Date('2026-08-30T12:00:00Z') },
  ];

  it('cuenta clientes, en curso y entregables', () => {
    const r = indicadores({ clientes: 4, jobs, entregables: 3, ahora });
    expect(r.clientes).toBe(4);
    expect(r.enCurso).toBe(2);
    expect(r.entregables).toBe(3);
  });

  it('el gasto del mes solo suma jobs creados en el mes actual', () => {
    expect(indicadores({ clientes: 0, jobs, entregables: 0, ahora }).gastoMes).toBeCloseTo(9.3);
  });

  it('sin jobs todo en cero', () => {
    expect(indicadores({ clientes: 0, jobs: [], entregables: 0, ahora })).toEqual({ clientes: 0, enCurso: 0, entregables: 0, gastoMes: 0 });
  });
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/lib/ui/estado-cliente.test.ts tests/lib/ui/tablero.test.ts`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar**

`src/lib/ui/estado-cliente.ts`:
```ts
export type EstadoCliente = 'listo' | 'en_curso' | 'sin_investigar' | 'otro';
export type FiltroCliente = 'todos' | 'listo' | 'en_curso' | 'sin_investigar';

export type JobResumible = { clientId: string; estado: string; costoUsd: string | number; createdAt: Date };
export type ResumenCliente = { estado: EstadoCliente; costo: number; ultimo: JobResumible | null };

const ACTIVO = new Set(['encolado', 'corriendo']);

export function resumirPorCliente(jobs: JobResumible[]): Map<string, ResumenCliente> {
  const m = new Map<string, { costo: number; ultimo: JobResumible; activo: boolean }>();
  for (const job of jobs) {
    const previo = m.get(job.clientId);
    m.set(job.clientId, {
      costo: (previo?.costo ?? 0) + Number(job.costoUsd),
      ultimo: !previo || job.createdAt > previo.ultimo.createdAt ? job : previo.ultimo,
      activo: (previo?.activo ?? false) || ACTIVO.has(job.estado),
    });
  }

  const salida = new Map<string, ResumenCliente>();
  for (const [id, r] of m) {
    // Un job activo manda sobre el histórico: es lo que el operador tiene que vigilar.
    const estado: EstadoCliente = r.activo ? 'en_curso' : r.ultimo.estado === 'completado' ? 'listo' : 'otro';
    salida.set(id, { estado, costo: Math.round(r.costo * 10_000) / 10_000, ultimo: r.ultimo });
  }
  return salida;
}

export function resumenDe(m: Map<string, ResumenCliente>, clientId: string): ResumenCliente {
  return m.get(clientId) ?? { estado: 'sin_investigar', costo: 0, ultimo: null };
}

/** Un cliente con su último job fallido o cancelado solo aparece en «Todos». */
export function pasaFiltro(estado: EstadoCliente, filtro: FiltroCliente): boolean {
  return filtro === 'todos' || estado === filtro;
}

export const ETIQUETA_CLIENTE: Record<EstadoCliente, string> = {
  listo: 'Listo',
  en_curso: 'En curso',
  sin_investigar: 'Sin investigar',
  otro: 'Revisar',
};
```

`src/lib/ui/tablero.ts`:
```ts
type JobIndicador = { estado: string; costoUsd: string | number; createdAt: Date };

/**
 * El servidor corre en UTC. Sin fijar la zona, lo gastado la noche del último
 * día del mes en México se contaría en el mes siguiente.
 */
export function claveMes(d: Date, zona = 'America/Mexico_City'): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit' }).formatToParts(d);
  const valor = (t: string) => partes.find((p) => p.type === t)?.value;
  return `${valor('year')}-${valor('month')}`;
}

export function indicadores(d: { clientes: number; jobs: JobIndicador[]; entregables: number; ahora: Date }) {
  const mes = claveMes(d.ahora);
  const gasto = d.jobs
    .filter((j) => claveMes(j.createdAt) === mes)
    .reduce((s, j) => s + Number(j.costoUsd), 0);
  return {
    clientes: d.clientes,
    enCurso: d.jobs.filter((j) => j.estado === 'encolado' || j.estado === 'corriendo').length,
    entregables: d.entregables,
    gastoMes: Math.round(gasto * 100) / 100,
  };
}
```

- [ ] **Step 4: Ver que pasan**

Run: `npx vitest run tests/lib/ui/estado-cliente.test.ts tests/lib/ui/tablero.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/estado-cliente.ts src/lib/ui/tablero.ts tests/lib/ui/estado-cliente.test.ts tests/lib/ui/tablero.test.ts
git commit -m "feat(rediseño): estado de cliente e indicadores del tablero

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Etapas por tipo, avance y tiempo

**Files:**
- Create: `src/lib/ui/progreso.ts`
- Test: `tests/lib/ui/progreso.test.ts`

- [ ] **Step 1: Escribir la prueba**

`tests/lib/ui/progreso.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { etapasDe, porcentaje, transcurrido, ETIQUETA_ESTADO } from '@/lib/ui/progreso';
import { ETAPAS } from '@/research/pipeline';
import { ETAPAS_GROWTH } from '@/growth/pipeline';
import { jobEstado } from '@/db/schema';

describe('etapasDe', () => {
  it('coincide con las etapas reales de cada pipeline', () => {
    expect(etapasDe('research').map((e) => e.clave)).toEqual([...ETAPAS]);
    expect(etapasDe('growth').map((e) => e.clave)).toEqual([...ETAPAS_GROWTH]);
  });
  it('un tipo desconocido usa las de investigación', () => {
    expect(etapasDe(undefined)).toEqual(etapasDe('research'));
    expect(etapasDe('raro')).toEqual(etapasDe('research'));
  });
});

describe('porcentaje', () => {
  it('cuenta solo etapas ok sobre el total del tipo', () => {
    expect(porcentaje({ estructura: 'ok', creativos: 'ok', google: 'corriendo' }, 'growth')).toBe(50);
    expect(porcentaje({ competencia: 'ok', audiencia: 'fallo' }, 'research')).toBe(20);
    expect(porcentaje({}, 'research')).toBe(0);
  });
  it('ignora claves que no son del tipo', () => {
    expect(porcentaje({ competencia: 'ok' }, 'growth')).toBe(0);
  });
});

describe('transcurrido', () => {
  const t0 = new Date('2026-09-14T10:00:00Z');
  it('sin inicio devuelve null', () => {
    expect(transcurrido(null, t0)).toBeNull();
  });
  it('formatea segundos, minutos y horas', () => {
    expect(transcurrido(t0, new Date('2026-09-14T10:00:42Z'))).toBe('42 s');
    expect(transcurrido(t0.toISOString(), new Date('2026-09-14T10:04:12Z'))).toBe('4 min 12 s');
    expect(transcurrido(t0, new Date('2026-09-14T11:03:00Z'))).toBe('1 h 3 min');
  });
  it('nunca da negativo', () => {
    expect(transcurrido(t0, new Date('2026-09-14T09:59:00Z'))).toBe('0 s');
  });
});

describe('ETIQUETA_ESTADO', () => {
  it('tiene texto para cada estado de job', () => {
    for (const e of jobEstado.enumValues) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/lib/ui/progreso.test.ts`
Expected: FAIL, no encuentra `@/lib/ui/progreso`.

- [ ] **Step 3: Implementar**

`src/lib/ui/progreso.ts`:
```ts
export type Etapa = { clave: string; titulo: string; detalle: string };

// Se copian aquí y no se importan de los pipelines porque ProgresoJob corre en
// el navegador y los pipelines arrastran la base y el SDK de Anthropic. La
// prueba compara ambas listas para que no se separen.
const INVESTIGACION: Etapa[] = [
  { clave: 'competencia', titulo: 'Competencia', detalle: 'Precios, competidores directos e indirectos, referentes.' },
  { clave: 'audiencia', titulo: 'Audiencia', detalle: 'Jerga, dolores, aspiraciones y dos personas contrastantes.' },
  { clave: 'canales', titulo: 'Canales', detalle: 'Plataformas, formatos, horarios y advertencias regulatorias.' },
  { clave: 'mercado', titulo: 'Mercado', detalle: 'Datos oficiales, salarios, regulación y crecimiento.' },
  { clave: 'sintesis', titulo: 'Síntesis', detalle: 'Decisiones estratégicas. Espera a las cuatro anteriores.' },
];

const GROWTH: Etapa[] = [
  { clave: 'estructura', titulo: 'Estructura', detalle: 'Campañas, conjuntos de anuncios y audiencias.' },
  { clave: 'creativos', titulo: 'Creativos', detalle: 'Anuncios por formato con títulos, textos y llamados a la acción.' },
  { clave: 'google', titulo: 'Google', detalle: 'Palabras clave, grupos y anuncios de búsqueda.' },
  { clave: 'prompts', titulo: 'Prompts', detalle: 'Indicaciones de imagen por pieza. Espera a los creativos.' },
];

export function etapasDe(tipo: string | undefined): Etapa[] {
  return tipo === 'growth' ? GROWTH : INVESTIGACION;
}

export function porcentaje(etapas: Record<string, string>, tipo: string | undefined): number {
  const lista = etapasDe(tipo);
  const listas = lista.filter((e) => etapas[e.clave] === 'ok').length;
  return Math.round((listas / lista.length) * 100);
}

export function transcurrido(desde: Date | string | null, hasta: Date): string | null {
  if (!desde) return null;
  const s = Math.max(0, Math.floor((hasta.getTime() - new Date(desde).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  encolado: 'En cola',
  corriendo: 'Corriendo',
  completado: 'Completado',
  fallido: 'Falló',
  cancelado: 'Cancelado',
};

export const ETIQUETA_ETAPA: Record<string, string> = {
  ok: 'Lista',
  corriendo: 'Corriendo',
  fallo: 'Falló',
  omitido_por_costo: 'Omitida por costo',
};
```

- [ ] **Step 4: Ver que pasa**

Run: `npx vitest run tests/lib/ui/progreso.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/progreso.ts tests/lib/ui/progreso.test.ts
git commit -m "feat(rediseño): etapas por tipo de job, avance y tiempo transcurrido

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `GET /api/clientes`

**Files:**
- Modify: `src/lib/clientes.ts` (añadir al final)
- Modify: `src/pages/api/clientes/index.ts`
- Test: `tests/lib/clientes.test.ts` (añadir al final)

- [ ] **Step 1: Escribir la prueba**

Añadir al final de `tests/lib/clientes.test.ts` (y añadir `resumenCliente` al import existente de `@/lib/clientes`):
```ts
describe('resumenCliente', () => {
  it('expone solo id, nombre, giro y ciudad', () => {
    const r = resumenCliente({
      id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null,
      notas: 'privado', contacto: '33 0000 0000', producto: 'Diplomado',
    } as any);
    expect(r).toEqual({ id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null });
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/lib/clientes.test.ts`
Expected: FAIL, `resumenCliente` no existe.

- [ ] **Step 3: Implementar**

Añadir al final de `src/lib/clientes.ts`:
```ts
export type ResumenCliente = { id: string; nombre: string; giro: string; ciudad: string | null };

/**
 * Lo que la paleta ⌘K puede ver de un cliente. Se arma campo por campo para
 * que añadir columnas a la tabla nunca las filtre a la respuesta.
 */
export function resumenCliente(c: ResumenCliente): ResumenCliente {
  return { id: c.id, nombre: c.nombre, giro: c.giro, ciudad: c.ciudad };
}
```

En `src/pages/api/clientes/index.ts`, cambiar el import y añadir el handler antes de `POST`:
```ts
import { asc } from 'drizzle-orm';
import { validarCliente, resumenCliente } from '@/lib/clientes';
```
```ts
export const GET: APIRoute = async () => {
  const filas = await db
    .select({ id: clients.id, nombre: clients.nombre, giro: clients.giro, ciudad: clients.ciudad })
    .from(clients)
    .orderBy(asc(clients.nombre));
  return json({ ok: true, clientes: filas.map(resumenCliente) });
};
```
(El middleware ya responde 401 a `/api/*` sin sesión.)

- [ ] **Step 4: Ver que pasa**

Run: `npx vitest run tests/lib/clientes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes.ts src/pages/api/clientes/index.ts tests/lib/clientes.test.ts
git commit -m "feat(api): GET /api/clientes con la proyección mínima para la paleta

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Hoja global nueva

**Files:**
- Rewrite: `src/styles/global.css`

- [ ] **Step 1: Reescribir `global.css` completo**

```css
@import './tokens.css';

/* Hoja del Studio. Conserva los nombres de clase que usan LinksEditor y
   FilesUploader (btn, fantasma, chico, campo, crece, aviso, etiqueta, zona,
   lista-enlaces, lista-archivos…) para que se vean bien sin tocar su JSX. */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%; }

body {
  font: var(--t-body);
  color: var(--texto);
  background: var(--fondo);
  min-height: 100dvh;
  transition: background-color 0.25s ease, color 0.25s ease;
}

a { color: inherit; }
img { max-width: 100%; }
button { font: inherit; color: inherit; }

h1, h2, h3 { color: var(--tinta); letter-spacing: var(--tracking-titulo); }
h1 { font: var(--t-h1); }
h2 { font: var(--t-h2); }
h3 { font: var(--t-h3); letter-spacing: -0.01em; }

.display { font: var(--t-display); color: var(--tinta); letter-spacing: var(--tracking-titulo); }
.eyebrow { font: var(--t-micro); letter-spacing: 0.14em; text-transform: uppercase; color: var(--rosa); }
.sub { font: var(--t-small); color: var(--suave); margin-top: 6px; }
.secundario { font: var(--t-small); color: var(--suave); }

:focus-visible { outline: none; box-shadow: var(--foco); border-radius: var(--r-sm); }
@supports not (color: color-mix(in srgb, red 50%, blue)) {
  :focus-visible { outline: 2px solid var(--rosa); outline-offset: 2px; box-shadow: none; }
}

.saltar { position: absolute; left: -9999px; top: 8px; z-index: 100; }
.saltar:focus { left: 16px; background: var(--tarjeta); padding: 8px 14px; border-radius: var(--r-pill); }

/* ── Logo ───────────────────────────────────────────────
   El PNG es blanco sobre transparente. En claro se vuelve negro con un filtro;
   el archivo no se toca. */
.logo { height: 22px; width: auto; display: block; filter: brightness(0); }
:root[data-tema="oscuro"] .logo { filter: none; }

.marca { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; }
.marca span {
  font: var(--t-micro); letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--rosa); padding-left: 10px; border-left: 1px solid var(--linea);
}

/* ── Shell ─────────────────────────────────────────── */

.app { min-height: 100dvh; }

.lateral {
  position: fixed; inset: 0 auto 0 0; width: var(--lateral);
  background: var(--gris); border-right: 1px solid var(--linea);
  display: none; flex-direction: column; gap: 28px; padding: 26px 18px;
}
.lateral nav ul { list-style: none; display: flex; flex-direction: column; gap: 4px; }

.nav-item {
  display: flex; align-items: center; gap: 12px; padding: 11px 14px;
  border-radius: var(--r-sm); text-decoration: none; font-weight: 500; color: var(--texto);
  transition: background-color 0.15s ease, color 0.15s ease;
}
.nav-item:hover { background: var(--tarjeta); color: var(--tinta); }
.nav-item.activo { background: var(--rosa-s); color: var(--rosa); font-weight: 600; }
.nav-item svg { width: 20px; height: 20px; flex-shrink: 0; }
.lateral .btn { margin-top: auto; justify-content: center; }

.superior {
  position: sticky; top: 0; z-index: 30;
  display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  background: color-mix(in srgb, var(--fondo) 88%, transparent);
  backdrop-filter: blur(14px); border-bottom: 1px solid var(--linea);
}
.superior .marca { margin-right: auto; }
.superior form { display: none; }

.contenido {
  max-width: var(--ancho); margin: 0 auto;
  padding: 24px 16px calc(var(--tabs) + 40px + env(safe-area-inset-bottom));
}

.volver {
  display: inline-flex; align-items: center; gap: 6px; margin-bottom: 18px;
  font: var(--t-small); color: var(--suave); text-decoration: none;
}
.volver:hover { color: var(--rosa); }
.volver svg { width: 16px; height: 16px; }

.barra-pestanas {
  position: fixed; inset: auto 0 0 0; z-index: 40;
  height: calc(var(--tabs) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: grid; grid-template-columns: repeat(4, 1fr);
  background: color-mix(in srgb, var(--tarjeta) 94%, transparent);
  backdrop-filter: blur(14px); border-top: 1px solid var(--linea);
}
.barra-pestanas a {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  font: var(--t-micro); letter-spacing: 0.02em; color: var(--suave); text-decoration: none; min-height: 44px;
}
.barra-pestanas a.activo { color: var(--rosa); }
.barra-pestanas svg { width: 22px; height: 22px; }
.barra-pestanas .nuevo svg {
  width: 40px; height: 40px; padding: 9px; border-radius: 50%;
  background: var(--rosa); color: var(--sobre-acento);
}

@media (min-width: 900px) {
  .lateral { display: flex; }
  .barra-pestanas { display: none; }
  .principal-col { margin-left: var(--lateral); }
  .superior { padding: 14px 32px; }
  .superior .marca { display: none; }
  .superior .buscador-disparador { margin-right: auto; }
  .superior form { display: block; }
  .contenido { padding: 36px 32px 80px; }
}

/* ── Buscador tipo píldora ─────────────────────────── */

.buscador-disparador {
  display: inline-flex; align-items: center; gap: 10px;
  height: 44px; padding: 0 14px; border-radius: var(--r-pill);
  background: var(--gris); border: 1px solid var(--linea); color: var(--suave);
  cursor: pointer; min-width: 44px;
}
.buscador-disparador svg { width: 18px; height: 18px; }
.buscador-disparador span, .buscador-disparador kbd { display: none; }
.buscador-disparador kbd {
  font: var(--t-micro); padding: 3px 7px; border-radius: 6px;
  background: var(--tarjeta); border: 1px solid var(--linea); margin-left: auto;
}
@media (min-width: 900px) {
  .buscador-disparador { width: min(420px, 50%); }
  .buscador-disparador span, .buscador-disparador kbd { display: inline; }
}
.buscador-disparador.grande { width: 100%; height: 56px; padding: 0 20px; font-size: 15.5px; margin: 22px 0 28px; }
.buscador-disparador.grande span { display: inline; }

/* ── Switch día/noche ──────────────────────────────── */

.tema-switch {
  display: inline-flex; padding: 3px; gap: 2px; border-radius: var(--r-pill);
  background: var(--gris); border: 1px solid var(--linea);
}
.tema-switch button {
  width: 38px; height: 38px; border: 0; border-radius: 50%; background: transparent;
  color: var(--suave); cursor: pointer; display: grid; place-items: center;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.tema-switch button svg { width: 18px; height: 18px; }
.tema-switch button[aria-checked="true"] { background: var(--tarjeta); color: var(--tinta); box-shadow: var(--sombra); }

/* ── Encabezados de pantalla ───────────────────────── */

.encabezado {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; margin-bottom: 26px;
}
.seccion { margin-top: 34px; }
.seccion > h2 { margin-bottom: 14px; }
.seccion-cabeza { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.seccion-cabeza a { font: var(--t-small); color: var(--rosa); text-decoration: none; }

/* ── Tarjetas ──────────────────────────────────────── */

.tarjeta {
  background: var(--tarjeta); border: 1px solid var(--linea);
  border-radius: var(--r); padding: 22px; box-shadow: var(--sombra);
}
.tarjeta + .tarjeta { margin-top: 18px; }
.tarjeta > h2 { margin-bottom: 4px; }
.tarjeta > .sub { margin-bottom: 18px; }
@media (min-width: 900px) { .tarjeta { padding: 28px; } }

a.tarjeta { display: block; text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease; }
a.tarjeta:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--rosa) 30%, var(--linea)); }

.rejilla { display: grid; gap: 14px; grid-template-columns: 1fr; }
@media (min-width: 600px) { .rejilla { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1000px) { .rejilla.tres { grid-template-columns: repeat(3, 1fr); } }

/* ── Indicadores ───────────────────────────────────── */

.indicadores { display: grid; gap: 12px; grid-template-columns: repeat(2, 1fr); }
@media (min-width: 900px) { .indicadores { grid-template-columns: repeat(4, 1fr); } }
.indicador { border-radius: var(--r); padding: 18px; background: var(--gris); }
.indicador svg { width: 22px; height: 22px; }
.indicador .valor { display: block; font: var(--t-h1); color: var(--tinta); letter-spacing: var(--tracking-titulo); margin-top: 10px; }
.indicador .nombre { font: var(--t-small); color: var(--texto); }
.indicador.rosa { background: var(--rosa-s); } .indicador.rosa svg { color: var(--rosa); }
.indicador.azul { background: var(--azul-s); } .indicador.azul svg { color: var(--azul); }
.indicador.amarillo { background: var(--amarillo-s); } .indicador.amarillo svg { color: var(--amarillo); }
.indicador.verde { background: var(--verde-s); } .indicador.verde svg { color: var(--verde); }

/* ── Avatar de iniciales ───────────────────────────── */

.avatar {
  flex-shrink: 0; width: 44px; height: 44px; border-radius: 14px;
  display: grid; place-items: center; font-weight: 700; font-size: 15px; letter-spacing: 0.02em;
}
.avatar.grande { width: 64px; height: 64px; border-radius: 20px; font-size: 22px; }
.avatar.rosa { background: var(--rosa-s); color: var(--rosa); }
.avatar.azul { background: var(--azul-s); color: var(--azul); }
.avatar.amarillo { background: var(--amarillo-s); color: var(--amarillo); }

.cliente-tarjeta { display: flex; gap: 14px; align-items: flex-start; }
.cliente-tarjeta .cuerpo { min-width: 0; flex: 1; }
.cliente-tarjeta h3 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cliente-tarjeta .pie { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; font: var(--t-small); }

.punto { display: inline-flex; align-items: center; gap: 6px; font: var(--t-small); }
.punto::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--suave); }
.punto.listo::before { background: var(--verde); }
.punto.en_curso::before { background: var(--azul); }
.punto.otro::before { background: var(--rojo); }

/* ── Chips ─────────────────────────────────────────── */

.chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 18px; scrollbar-width: none; }
.chip {
  flex-shrink: 0; height: 38px; padding: 0 16px; border-radius: var(--r-pill);
  border: 1px solid var(--linea); background: var(--tarjeta); color: var(--texto);
  font: var(--t-small); cursor: pointer;
}
.chip[aria-pressed="true"] { background: var(--tinta); border-color: var(--tinta); color: var(--fondo); }

/* ── Campos ────────────────────────────────────────── */

.campos { display: grid; gap: 16px; grid-template-columns: 1fr; }
@media (min-width: 700px) { .campos { grid-template-columns: repeat(2, 1fr); } }
.campo { display: flex; flex-direction: column; }
.campo.ancho { grid-column: 1 / -1; }

label { font: var(--t-small); font-weight: 600; color: var(--tinta); margin-bottom: 7px; }
label .req { color: var(--rosa); }

input, select, textarea {
  font: var(--t-body); color: var(--tinta); width: 100%;
  background: var(--gris); border: 1px solid var(--linea); border-radius: var(--r-sm);
  padding: 11px 14px; min-height: 46px;
  transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}
input::placeholder, textarea::placeholder { color: var(--suave); }
textarea { resize: vertical; min-height: 96px; line-height: 1.55; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--rosa); background: var(--tarjeta); box-shadow: var(--foco); }

.con-icono { position: relative; }
.con-icono > svg { position: absolute; left: 14px; top: 50%; translate: 0 -50%; width: 18px; height: 18px; color: var(--suave); pointer-events: none; }
.con-icono input { padding-left: 44px; }
.con-icono .ojo {
  position: absolute; right: 4px; top: 50%; translate: 0 -50%;
  width: 40px; height: 40px; border: 0; background: transparent; color: var(--suave);
  cursor: pointer; display: grid; place-items: center; border-radius: 50%;
}
.con-icono .ojo svg { width: 18px; height: 18px; }

.ayuda { font-size: 12.5px; color: var(--suave); margin-top: 6px; }

/* ── Botones ───────────────────────────────────────── */

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 46px; padding: 0 22px; border-radius: var(--r-pill);
  border: 1px solid transparent; background: var(--rosa); color: var(--sobre-acento);
  font: 600 14.5px/1 var(--fuente); text-decoration: none; white-space: nowrap; cursor: pointer;
  transition: filter 0.15s ease, background-color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
}
.btn:hover { filter: brightness(1.06); }
.btn:active { transform: scale(0.98); }
.btn svg { width: 18px; height: 18px; }
.btn.fantasma { background: transparent; border-color: var(--linea); color: var(--tinta); }
.btn.fantasma:hover { filter: none; border-color: var(--rosa); color: var(--rosa); }
.btn.suave { background: var(--rosa-s); color: var(--rosa); }
.btn.peligro { background: transparent; border-color: color-mix(in srgb, var(--rojo) 40%, transparent); color: var(--rojo); }
.btn.peligro:hover { filter: none; background: var(--rojo-s); }
.btn.peligro.lleno { background: var(--rojo); border-color: var(--rojo); color: var(--sobre-acento); }
.btn.chico { min-height: 36px; padding: 0 14px; font-size: 13px; }
.btn.ancho-total { width: 100%; }
.btn[disabled] { opacity: 0.45; cursor: not-allowed; filter: none; transform: none; }

.icono-btn {
  width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--linea);
  background: var(--tarjeta); color: var(--tinta); display: grid; place-items: center; cursor: pointer;
}
.icono-btn svg { width: 20px; height: 20px; }

.acciones { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 24px; }

/* ── Etiquetas de estado ───────────────────────────── */

.etiqueta {
  display: inline-flex; align-items: center; font: var(--t-micro); letter-spacing: 0.03em;
  padding: 5px 10px; border-radius: var(--r-pill); background: var(--gris); color: var(--texto); white-space: nowrap;
}
.etiqueta.encolado { background: var(--amarillo-s); color: var(--amarillo); }
.etiqueta.corriendo { background: var(--azul-s); color: var(--azul); }
.etiqueta.completado { background: var(--verde-s); color: var(--verde); }
.etiqueta.fallido { background: var(--rojo-s); color: var(--rojo); }
.etiqueta.cancelado { background: var(--gris); color: var(--suave); }

/* ── Avisos ────────────────────────────────────────── */

.aviso {
  padding: 13px 16px; border-radius: var(--r-sm); font: var(--t-small); font-weight: 400;
  background: var(--gris); color: var(--texto); border: 1px solid var(--linea);
}
.aviso + .aviso { margin-top: 10px; }
/* En los componentes existentes «rosa» siempre anuncia un error. */
.aviso.rosa { background: var(--rojo-s); color: var(--rojo); border-color: transparent; }
.aviso.amarillo { background: var(--amarillo-s); color: var(--amarillo); border-color: transparent; }
.aviso.verde { background: var(--verde-s); color: var(--verde); border-color: transparent; }

/* ── Vacíos ────────────────────────────────────────── */

.vacio { text-align: center; padding: 44px 20px; color: var(--suave); font: var(--t-small); }
.vacio svg { width: 44px; height: 44px; color: var(--rosa); margin-bottom: 12px; }
.vacio strong { display: block; color: var(--tinta); font: var(--t-h3); margin-bottom: 6px; }
.vacio .btn { margin-top: 18px; }

/* ── Enlaces y archivos (islas de React) ───────────── */

.lista-enlaces, .lista-archivos, .lista { list-style: none; display: flex; flex-direction: column; gap: 8px; }
.lista-enlaces li, .lista-archivos li {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 10px 12px; border-radius: var(--r-sm); background: var(--gris); font: var(--t-small);
}
.lista-enlaces a, .lista-archivos .nombre {
  flex: 1; min-width: 0; color: var(--tinta); text-decoration: none;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lista-enlaces a:hover { color: var(--rosa); }

.agregar {
  display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;
  margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--linea);
}
.agregar .campo { min-width: 150px; }
.agregar .campo.crece { flex: 1; min-width: 220px; }

.zona {
  margin-top: 18px; padding: 30px 20px; text-align: center; cursor: pointer;
  border: 1.5px dashed var(--linea); border-radius: var(--r); background: var(--gris);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}
.zona:hover, .zona:focus-visible, .zona.encima { border-color: var(--rosa); background: var(--rosa-s); outline: none; }
.zona .titulo { font: var(--t-h3); color: var(--tinta); }

/* ── Datos ─────────────────────────────────────────── */

.datos { display: grid; gap: 16px 24px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.datos dt { font: var(--t-micro); letter-spacing: 0.1em; text-transform: uppercase; color: var(--suave); margin-bottom: 4px; }
.datos dd { color: var(--tinta); overflow-wrap: anywhere; }

/* ── Pestañas de la ficha ──────────────────────────── */

.pestanas { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--linea); margin: 28px 0 20px; scrollbar-width: none; }
.pestanas [role="tab"] {
  flex-shrink: 0; min-height: 44px; padding: 0 14px; border: 0; background: transparent; cursor: pointer;
  font: var(--t-small); font-weight: 600; color: var(--suave); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.pestanas [role="tab"][aria-selected="true"] { color: var(--rosa); border-bottom-color: var(--rosa); }
.pestanas .cuenta { margin-left: 6px; padding: 1px 7px; border-radius: var(--r-pill); background: var(--gris); font-size: 11.5px; }

/* ── Tarjetas de acción ────────────────────────────── */

.accion { display: flex; flex-direction: column; gap: 6px; }
.accion .icono-tinte { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; margin-bottom: 6px; }
.accion .icono-tinte svg { width: 22px; height: 22px; }
.accion .btn { align-self: flex-start; margin-top: 12px; }

/* ── Renglones ─────────────────────────────────────── */

.renglon {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 14px 0; border-bottom: 1px solid var(--linea);
}
.renglon:last-child { border-bottom: 0; }
.renglon .cuerpo { flex: 1; min-width: 200px; }
.renglon .cuerpo strong { color: var(--tinta); font-weight: 600; }
.cifra { font-variant-numeric: tabular-nums; }

/* ── Barra de avance ───────────────────────────────── */

.avance { height: 8px; border-radius: var(--r-pill); background: var(--gris); overflow: hidden; }
.avance i { display: block; height: 100%; background: var(--rosa); border-radius: inherit; transition: width 0.4s ease; }

/* ── Línea de tiempo ───────────────────────────────── */

.linea-tiempo { list-style: none; margin-top: 22px; }
.linea-tiempo li { position: relative; display: flex; gap: 14px; padding-bottom: 20px; }
.linea-tiempo li:not(:last-child)::before {
  content: ''; position: absolute; left: 15px; top: 34px; bottom: 2px; width: 2px; background: var(--linea);
}
.linea-tiempo .marca-etapa {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center;
  background: var(--gris); color: var(--suave); border: 2px solid var(--linea);
}
.linea-tiempo .marca-etapa svg { width: 16px; height: 16px; }
.linea-tiempo .ok .marca-etapa { background: var(--verde-s); color: var(--verde); border-color: transparent; }
.linea-tiempo .corriendo .marca-etapa { background: var(--azul-s); color: var(--azul); border-color: var(--azul); animation: latido 1.4s ease-in-out infinite; }
.linea-tiempo .fallo .marca-etapa { background: var(--rojo-s); color: var(--rojo); border-color: transparent; }
.linea-tiempo .omitido_por_costo .marca-etapa { background: var(--amarillo-s); color: var(--amarillo); border-color: transparent; }
.linea-tiempo strong { color: var(--tinta); }

@keyframes latido { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--azul) 18%, transparent); } }

/* ── Diálogo ───────────────────────────────────────── */

dialog {
  margin: auto; border: 0; border-radius: var(--r); padding: 26px; max-width: min(440px, calc(100vw - 32px));
  background: var(--tarjeta); color: var(--texto); box-shadow: var(--sombra);
}
dialog::backdrop { background: rgba(17, 16, 23, 0.45); backdrop-filter: blur(3px); }

.menu { position: relative; }
.menu-lista {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; min-width: 200px; list-style: none;
  background: var(--tarjeta); border: 1px solid var(--linea); border-radius: var(--r-sm); box-shadow: var(--sombra); padding: 6px;
}
.menu-lista button {
  width: 100%; text-align: left; border: 0; background: transparent; padding: 10px 12px;
  border-radius: 8px; cursor: pointer; color: var(--rojo); font: var(--t-small);
}
.menu-lista button:hover { background: var(--rojo-s); }

/* ── Paleta ⌘K ─────────────────────────────────────── */

.paleta-fondo {
  position: fixed; inset: 0; z-index: 60; background: rgba(17, 16, 23, 0.45); backdrop-filter: blur(3px);
  display: flex; align-items: flex-start; justify-content: center; padding: 10vh 16px 16px;
}
.paleta {
  width: min(560px, 100%); background: var(--tarjeta); border-radius: var(--r);
  box-shadow: var(--sombra); border: 1px solid var(--linea); overflow: hidden;
}
.paleta input { border: 0; border-bottom: 1px solid var(--linea); border-radius: 0; background: transparent; min-height: 58px; padding: 0 20px; box-shadow: none; }
.paleta input:focus { box-shadow: none; background: transparent; }
.paleta ul { list-style: none; max-height: 52vh; overflow-y: auto; padding: 8px; }
.paleta li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: var(--r-sm); cursor: pointer; }
.paleta li[aria-selected="true"] { background: var(--rosa-s); }
.paleta li .avatar { width: 34px; height: 34px; border-radius: 10px; font-size: 12.5px; }
.paleta .grupo { font: var(--t-micro); letter-spacing: 0.12em; text-transform: uppercase; color: var(--suave); padding: 10px 12px 4px; cursor: default; }
.paleta .nota { padding: 14px 12px; color: var(--suave); font: var(--t-small); }

.esqueleto { height: 16px; border-radius: 8px; background: linear-gradient(90deg, var(--gris), var(--linea), var(--gris)); background-size: 200% 100%; animation: brillo 1.2s linear infinite; }
@keyframes brillo { to { background-position: -200% 0; } }

/* ── Toasts ────────────────────────────────────────── */

.toasts {
  position: fixed; z-index: 70; left: 16px; right: 16px;
  bottom: calc(var(--tabs) + 14px + env(safe-area-inset-bottom));
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
}
@media (min-width: 900px) { .toasts { left: auto; right: 24px; bottom: 24px; align-items: flex-end; } }
.toast {
  pointer-events: auto; padding: 12px 18px; border-radius: var(--r-pill); font: var(--t-small);
  background: var(--tinta); color: var(--fondo); box-shadow: var(--sombra); animation: entra 0.2s ease;
}
.toast.error { background: var(--rojo); color: var(--sobre-acento); }
.toast.saliendo { opacity: 0; transition: opacity 0.25s ease; }
@keyframes entra { from { opacity: 0; translate: 0 8px; } }

/* ── Tablas (se conservan para vistas que aún las usen) */

.tabla-envoltura { overflow-x: auto; border: 1px solid var(--linea); border-radius: var(--r); }
table { width: 100%; border-collapse: collapse; font: var(--t-small); }
th { text-align: left; font: var(--t-micro); letter-spacing: 0.1em; text-transform: uppercase; color: var(--suave); background: var(--gris); padding: 12px 16px; }
td { padding: 14px 16px; border-top: 1px solid var(--linea); }

/* ── Movimiento reducido ───────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}

/* hidden debe ganarle a cualquier display de clase. */
[hidden] { display: none !important; }
```

- [ ] **Step 2: Compilar**

Run: `npm run build 2>&1 | tail -5`
Expected: build completo sin errores (las páginas todavía usan clases viejas; se verán sin estilo en partes hasta las tareas siguientes).

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(rediseño): hoja global clara con clases compatibles

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Iconos, switch, toasts y copiar

**Files:**
- Create: `src/components/Icono.astro`
- Create: `src/components/TemaSwitch.astro`
- Create: `src/scripts/tema-switch.ts`
- Create: `src/scripts/toast.ts`
- Create: `src/scripts/copiar.ts`

- [ ] **Step 1: `Icono.astro`**

```astro
---
// Iconos de trazo, 24×24, heredan el color del texto. Un solo archivo para no
// añadir una dependencia por veinte figuras.
const TRAZOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.4 2 5 5.4"/>',
  entregables: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  investigar: '<path d="M9 3h6M10 3v6L4.5 19A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7 15h10"/>',
  megafono: '<path d="M3 10v4a1 1 0 0 0 1 1h3l6 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M17 8.5a5 5 0 0 1 0 7"/>',
  puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  enlace: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dinero: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6.5v11"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6 8.5 7 8.5-7"/>',
  candado: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  abrir: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  vacio: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M3 12h5l1.5 2h5L16 12h5M7 7l2-3h6l2 3"/>',
} as const;

interface Props { nombre: keyof typeof TRAZOS; class?: string }
const { nombre, class: clase } = Astro.props;
---
<svg class={clase} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" set:html={TRAZOS[nombre]}></svg>
```

- [ ] **Step 2: `TemaSwitch.astro` y su script**

`src/components/TemaSwitch.astro`:
```astro
---
import Icono from './Icono.astro';
---
<div class="tema-switch" role="radiogroup" aria-label="Tema de color">
  <button type="button" role="radio" aria-checked="false" data-tema-valor="claro" aria-label="Día" title="Día">
    <Icono nombre="sol" />
  </button>
  <button type="button" role="radio" aria-checked="false" data-tema-valor="oscuro" aria-label="Noche" title="Noche">
    <Icono nombre="luna" />
  </button>
</div>

<script>
  import '@/scripts/tema-switch';
</script>
```

`src/scripts/tema-switch.ts`:
```ts
import type { Tema } from '@/lib/ui/tema';

type ApiTema = { elegir(t: Tema): void };

function sincronizar() {
  const actual = document.documentElement.dataset.tema;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tema-valor]')) {
    b.setAttribute('aria-checked', String(b.dataset.temaValor === actual));
  }
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tema-valor]')) {
  b.addEventListener('click', () => {
    (window as unknown as { __wozialTema?: ApiTema }).__wozialTema?.elegir(b.dataset.temaValor as Tema);
  });
}

// El script en línea avisa cada cambio, también cuando lo provoca el dispositivo.
document.addEventListener('wozial:tema', sincronizar);
sincronizar();
```

- [ ] **Step 3: `toast.ts` y `copiar.ts`**

`src/scripts/toast.ts`:
```ts
export function toast(mensaje: string, tipo: 'ok' | 'error' = 'ok') {
  const contenedor = document.getElementById('toasts');
  if (!contenedor) return;
  const el = document.createElement('div');
  el.className = `toast ${tipo === 'error' ? 'error' : ''}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.textContent = mensaje;
  contenedor.appendChild(el);
  setTimeout(() => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 250);
  }, 4000);
}
```

`src/scripts/copiar.ts`:
```ts
import { toast } from './toast';

/**
 * Sin permiso de portapapeles (http local, Safari antiguo) deja el texto
 * seleccionado en su campo para que baste con ⌘C.
 */
export async function copiar(texto: string, campo?: HTMLInputElement | null) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Link copiado');
  } catch {
    campo?.focus();
    campo?.select();
    toast('Cópialo con ⌘C');
  }
}
```

- [ ] **Step 4: Compilar**

Run: `npm run build 2>&1 | tail -3`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/Icono.astro src/components/TemaSwitch.astro src/scripts/tema-switch.ts src/scripts/toast.ts src/scripts/copiar.ts
git commit -m "feat(rediseño): iconos, switch día/noche, toasts y copiar con respaldo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Paleta ⌘K

**Files:**
- Create: `src/components/Paleta.tsx`

- [ ] **Step 1: Implementar**

`src/components/Paleta.tsx`:
```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { coincide } from '@/lib/ui/buscar';
import { iniciales, tinte } from '@/lib/ui/cliente-visual';
import type { ResumenCliente } from '@/lib/clientes';

type Item =
  | { tipo: 'cliente'; id: string; c: ResumenCliente; href: string }
  | { tipo: 'accion'; id: string; texto: string; href: string };

const ACCIONES: Item[] = [
  { tipo: 'accion', id: 'nuevo', texto: 'Nuevo cliente', href: '/clientes/nuevo' },
  { tipo: 'accion', id: 'entregables', texto: 'Ver entregables', href: '/entregables' },
];

export default function Paleta() {
  const [abierta, setAbierta] = useState(false);
  const [q, setQ] = useState('');
  const [clientes, setClientes] = useState<ResumenCliente[] | null>(null);
  const [error, setError] = useState(false);
  const [sel, setSel] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierta((a) => !a);
      }
    };
    const clic = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('[data-abrir-paleta]')) {
        e.preventDefault();
        setAbierta(true);
      }
    };
    document.addEventListener('keydown', tecla);
    document.addEventListener('click', clic);
    return () => {
      document.removeEventListener('keydown', tecla);
      document.removeEventListener('click', clic);
    };
  }, []);

  useEffect(() => {
    if (!abierta) return;
    previo.current = document.activeElement as HTMLElement | null;
    setQ('');
    setSel(0);
    entrada.current?.focus();
    // La lista se pide la primera vez que se abre y se reutiliza después.
    if (clientes === null) {
      setError(false);
      fetch('/api/clientes')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((cuerpo) => setClientes(cuerpo.clientes))
        .catch(() => setError(true));
    }
    return () => previo.current?.focus();
  }, [abierta]);

  const items = useMemo<Item[]>(() => {
    const deClientes: Item[] = (clientes ?? [])
      .filter((c) => coincide(q, [c.nombre, c.giro, c.ciudad]))
      .slice(0, 8)
      .map((c) => ({ tipo: 'cliente', id: c.id, c, href: `/clientes/${c.id}` }));
    const acciones = ACCIONES.filter((a) => a.tipo === 'accion' && coincide(q, [a.texto]));
    return [...deClientes, ...acciones];
  }, [clientes, q]);

  useEffect(() => setSel(0), [q]);

  if (!abierta) return null;

  const cerrar = () => setAbierta(false);
  const ir = (item: Item | undefined) => { if (item) window.location.href = item.href; };

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cerrar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); ir(items[sel]); }
  };

  const cargando = clientes === null && !error;

  return (
    <div className="paleta-fondo" onClick={cerrar}>
      <div className="paleta" role="dialog" aria-modal="true" aria-label="Buscar" onClick={(e) => e.stopPropagation()}>
        <input
          ref={entrada}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={teclas}
          placeholder="Busca por nombre, giro o ciudad…"
          role="combobox"
          aria-expanded="true"
          aria-controls="paleta-lista"
          aria-activedescendant={items[sel] ? `paleta-${items[sel].id}` : undefined}
        />
        <ul id="paleta-lista" role="listbox">
          {cargando && [0, 1, 2].map((i) => (
            <li key={i} aria-hidden="true"><div className="esqueleto" style={{ width: `${70 - i * 15}%` }} /></li>
          ))}
          {error && <li className="nota" role="presentation">No se pudo cargar la lista</li>}
          {!cargando && !error && items.every((i) => i.tipo === 'accion') && q && (
            <li className="nota" role="presentation">Ningún cliente coincide</li>
          )}
          {items.map((item, i) => (
            <li
              key={item.id}
              id={`paleta-${item.id}`}
              role="option"
              aria-selected={i === sel}
              onMouseEnter={() => setSel(i)}
              onClick={() => ir(item)}
            >
              {item.tipo === 'cliente' ? (
                <>
                  <span className={`avatar ${tinte(item.c.id)}`}>{iniciales(item.c.nombre)}</span>
                  <span>
                    <strong>{item.c.nombre}</strong>
                    <span className="secundario" style={{ display: 'block' }}>
                      {item.c.giro}{item.c.ciudad ? ` · ${item.c.ciudad}` : ''}
                    </span>
                  </span>
                </>
              ) : (
                <span>{item.texto}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Compilar**

Run: `npm run build 2>&1 | tail -3`
Expected: sin errores de tipos ni de build.

- [ ] **Step 3: Commit**

```bash
git add src/components/Paleta.tsx
git commit -m "feat(rediseño): paleta ⌘K para saltar a cualquier cliente

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Shell nuevo en `Base.astro`

**Files:**
- Rewrite: `src/layouts/Base.astro`

La prop `migas` desaparece; en su lugar `activo` marca la sección y `volver` pinta el enlace de regreso. Las páginas se ajustan en las tareas siguientes; hasta entonces Astro ignora la prop sobrante.

- [ ] **Step 1: Reescribir**

```astro
---
import '@/styles/global.css';
import Icono from '@/components/Icono.astro';
import TemaSwitch from '@/components/TemaSwitch.astro';
import Paleta from '@/components/Paleta';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';

type Seccion = 'inicio' | 'clientes' | 'entregables';

interface Props {
  titulo: string;
  activo?: Seccion;
  volver?: { href: string; texto: string };
}

const { titulo, activo, volver } = Astro.props;

const NAV: Array<{ clave: Seccion; href: string; texto: string; icono: 'inicio' | 'clientes' | 'entregables' }> = [
  { clave: 'inicio', href: '/', texto: 'Inicio', icono: 'inicio' },
  { clave: 'clientes', href: '/clientes', texto: 'Clientes', icono: 'clientes' },
  { clave: 'entregables', href: '/entregables', texto: 'Entregables', icono: 'entregables' },
];
---

<html lang="es-MX">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <title>{titulo} · Wozial Studio</title>
    <meta name="theme-color" content={COLOR_BARRA.claro} />
    <script is:inline set:html={SCRIPT_TEMA}></script>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="mask-icon" href="/favicon.svg" color="#d4688a" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <a class="saltar" href="#contenido">Saltar al contenido</a>
    <div class="app">
      <aside class="lateral">
        <a href="/" class="marca" aria-label="Wozial Studio · inicio">
          <img class="logo" src="/logo-wozial.png" alt="Wozial" width="545" height="194" />
          <span>Studio</span>
        </a>
        <nav aria-label="Principal">
          <ul>
            {NAV.map((n) => (
              <li>
                <a href={n.href} class:list={['nav-item', { activo: activo === n.clave }]} aria-current={activo === n.clave ? 'page' : undefined}>
                  <Icono nombre={n.icono} />{n.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a href="/clientes/nuevo" class="btn"><Icono nombre="mas" />Nuevo cliente</a>
      </aside>

      <div class="principal-col">
        <header class="superior">
          <a href="/" class="marca" aria-label="Wozial Studio · inicio">
            <img class="logo" src="/logo-wozial.png" alt="Wozial" width="545" height="194" />
          </a>
          <button type="button" class="buscador-disparador" data-abrir-paleta aria-label="Buscar cliente">
            <Icono nombre="buscar" /><span>Busca un cliente…</span><kbd>⌘K</kbd>
          </button>
          <TemaSwitch />
          <form method="POST" action="/api/logout">
            <button type="submit" class="btn fantasma chico">Salir</button>
          </form>
        </header>

        <main id="contenido" class="contenido">
          {volver && <a class="volver" href={volver.href}><Icono nombre="atras" />{volver.texto}</a>}
          <slot />
        </main>
      </div>
    </div>

    <nav class="barra-pestanas" aria-label="Principal">
      <a href="/" class:list={[{ activo: activo === 'inicio' }]} aria-current={activo === 'inicio' ? 'page' : undefined}><Icono nombre="inicio" />Inicio</a>
      <a href="/clientes" class:list={[{ activo: activo === 'clientes' }]} aria-current={activo === 'clientes' ? 'page' : undefined}><Icono nombre="clientes" />Clientes</a>
      <a href="/clientes/nuevo" class="nuevo" aria-label="Nuevo cliente"><Icono nombre="mas" /></a>
      <a href="/entregables" class:list={[{ activo: activo === 'entregables' }]} aria-current={activo === 'entregables' ? 'page' : undefined}><Icono nombre="entregables" />Entregables</a>
    </nav>

    <Paleta client:load />
    <div class="toasts" id="toasts"></div>
  </body>
</html>
```

En celular «Salir» no está en la barra superior; se ofrece en el tablero (Task 12, Step 1).

- [ ] **Step 2: Compilar**

Run: `npm run build 2>&1 | tail -3`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Base.astro
git commit -m "feat(rediseño): shell con barra lateral, pestañas móviles y switch de tema

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Login

**Files:**
- Rewrite: `src/pages/login.astro`

- [ ] **Step 1: Reescribir**

```astro
---
import '@/styles/global.css';
import Icono from '@/components/Icono.astro';
import TemaSwitch from '@/components/TemaSwitch.astro';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';

const error = Astro.url.searchParams.get('error');
const mensaje =
  error === 'bloqueado'
    ? 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentar.'
    : error
      ? 'Correo o contraseña incorrectos.'
      : null;
---

<html lang="es-MX">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="robots" content="noindex,nofollow" />
    <title>Entrar · Wozial Studio</title>
    <meta name="theme-color" content={COLOR_BARRA.claro} />
    <script is:inline set:html={SCRIPT_TEMA}></script>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div class="login-switch"><TemaSwitch /></div>
    <main class="login">
      <form method="POST" action="/api/login">
        <img class="logo" src="/logo-wozial.png" alt="Wozial" width="545" height="194" />
        <p class="eyebrow">Studio · Acceso privado</p>
        <h1 class="display">Investigación de mercado asistida por agentes</h1>

        <div class="campo">
          <label for="email">Correo</label>
          <div class="con-icono">
            <Icono nombre="correo" />
            <input id="email" name="email" type="email" autocomplete="username" required autofocus />
          </div>
        </div>

        <div class="campo">
          <label for="password">Contraseña</label>
          <div class="con-icono">
            <Icono nombre="candado" />
            <input id="password" name="password" type="password" autocomplete="current-password" required />
            <button type="button" class="ojo" id="ojo" aria-label="Mostrar contraseña" aria-pressed="false">
              <Icono nombre="ojo" />
            </button>
          </div>
        </div>

        {mensaje && <p class="aviso rosa" role="alert">{mensaje}</p>}

        <button type="submit" class="btn ancho-total">Entrar</button>
      </form>
    </main>
  </body>
</html>

<script>
  const ojo = document.getElementById('ojo') as HTMLButtonElement;
  const clave = document.getElementById('password') as HTMLInputElement;
  ojo.addEventListener('click', () => {
    const mostrar = clave.type === 'password';
    clave.type = mostrar ? 'text' : 'password';
    ojo.setAttribute('aria-pressed', String(mostrar));
    ojo.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
</script>

<style>
  .login-switch { position: fixed; top: 16px; right: 16px; }
  .login { min-height: 100dvh; display: grid; place-items: center; padding: 72px 16px 40px; }
  form { width: min(400px, 100%); display: flex; flex-direction: column; gap: 18px; }
  .logo { height: 30px; margin-bottom: 10px; }
  .display { margin-bottom: 10px; }
</style>
```

- [ ] **Step 2: Verificar en navegador**

Run: `npm run dev` en segundo plano. Abrir `http://localhost:4321/login` en el Browser pane.
Expected: fondo blanco (o oscuro si el sistema lo está), logo negro en claro, switch arriba a la derecha. `http://localhost:4321/login?error=1` muestra el aviso arriba del botón. El ojo alterna la contraseña. Entrar con `studio@local.test` lleva a `/`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/login.astro
git commit -m "feat(rediseño): login claro con switch de tema y ver contraseña

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Tarjeta de cliente, tablero y lista

**Files:**
- Create: `src/components/TarjetaCliente.astro`
- Rewrite: `src/pages/index.astro`
- Create: `src/pages/clientes/index.astro`

- [ ] **Step 1: `TarjetaCliente.astro`**

```astro
---
import { iniciales, tinte } from '@/lib/ui/cliente-visual';
import { normalizar } from '@/lib/ui/buscar';
import { ETIQUETA_CLIENTE, type ResumenCliente } from '@/lib/ui/estado-cliente';

interface Props {
  cliente: { id: string; nombre: string; giro: string; ciudad: string | null };
  resumen: ResumenCliente;
}
const { cliente: c, resumen: r } = Astro.props;
const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
---
<a href={`/clientes/${c.id}`} class="tarjeta cliente-tarjeta"
  data-estado={r.estado} data-busqueda={normalizar(`${c.nombre} ${c.giro} ${c.ciudad ?? ''}`)}>
  <span class={`avatar ${tinte(c.id)}`}>{iniciales(c.nombre)}</span>
  <div class="cuerpo">
    <h3>{c.nombre}</h3>
    <p class="secundario">{c.giro}{c.ciudad ? ` · ${c.ciudad}` : ''}</p>
    <div class="pie">
      <span class={`punto ${r.estado}`}>{ETIQUETA_CLIENTE[r.estado]}</span>
      <span class="secundario cifra">{r.costo > 0 ? dinero(r.costo) : '—'}</span>
    </div>
  </div>
</a>
```

- [ ] **Step 2: Tablero `src/pages/index.astro`**

```astro
---
import { count, desc } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import Icono from '@/components/Icono.astro';
import TarjetaCliente from '@/components/TarjetaCliente.astro';
import { db, clients, researchJobs, researchResults, growthResults } from '@/db';
import { indicadores } from '@/lib/ui/tablero';
import { resumirPorCliente, resumenDe } from '@/lib/ui/estado-cliente';
import { porcentaje, etapasDe } from '@/lib/ui/progreso';

const lista = await db.select().from(clients).orderBy(desc(clients.updatedAt));
const jobs = await db.select().from(researchJobs).orderBy(desc(researchJobs.createdAt));
const [{ n: nInvestigaciones }] = await db.select({ n: count() }).from(researchResults);
const [{ n: nManuales }] = await db.select({ n: count() }).from(growthResults);

const ind = indicadores({ clientes: lista.length, jobs, entregables: nInvestigaciones + nManuales, ahora: new Date() });
const resumen = resumirPorCliente(jobs);
const porId = new Map(lista.map((c) => [c.id, c]));
const activos = jobs.filter((j) => j.estado === 'encolado' || j.estado === 'corriendo');

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
---

<Base titulo="Inicio" activo="inicio">
  <p class="eyebrow">Hola</p>
  <h1 class="display">Tu estudio hoy</h1>

  <button type="button" class="buscador-disparador grande" data-abrir-paleta>
    <Icono nombre="buscar" /><span>Busca un cliente por nombre, giro o ciudad…</span>
  </button>

  <section class="indicadores" aria-label="Indicadores">
    <div class="indicador rosa"><Icono nombre="clientes" /><span class="valor cifra">{ind.clientes}</span><span class="nombre">Clientes</span></div>
    <div class="indicador azul"><Icono nombre="reloj" /><span class="valor cifra">{ind.enCurso}</span><span class="nombre">En curso</span></div>
    <div class="indicador verde"><Icono nombre="entregables" /><span class="valor cifra">{ind.entregables}</span><span class="nombre">Entregables</span></div>
    <div class="indicador amarillo"><Icono nombre="dinero" /><span class="valor cifra">{dinero(ind.gastoMes)}</span><span class="nombre">Gasto del mes</span></div>
  </section>

  {activos.length > 0 && (
    <section class="seccion">
      <h2>En curso</h2>
      <div class="rejilla">
        {activos.map((j) => {
          const etapas = (j.etapas ?? {}) as Record<string, string>;
          const pct = porcentaje(etapas, j.tipo);
          const actual = etapasDe(j.tipo).find((e) => e.clave === j.etapaActual)?.titulo ?? 'En cola';
          return (
            <a href={`/jobs/${j.id}`} class="tarjeta">
              <p class="eyebrow">{j.tipo === 'growth' ? 'Manual de campaña' : 'Investigación'}</p>
              <h3 style="margin:6px 0 12px">{porId.get(j.clientId)?.nombre ?? 'Cliente'}</h3>
              <div class="avance" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"><i style={`width:${pct}%`}></i></div>
              <p class="secundario" style="margin-top:10px">{actual} · {pct}% · {dinero(Number(j.costoUsd))}</p>
            </a>
          );
        })}
      </div>
    </section>
  )}

  <section class="seccion">
    <div class="seccion-cabeza">
      <h2>Clientes recientes</h2>
      {lista.length > 0 && <a href="/clientes">Ver todos</a>}
    </div>
    {lista.length === 0 ? (
      <div class="tarjeta vacio">
        <Icono nombre="clientes" />
        <strong>Sin clientes todavía</strong>
        Da de alta el primero para poder lanzar una investigación.
        <div><a href="/clientes/nuevo" class="btn">Registra tu primer cliente</a></div>
      </div>
    ) : (
      <div class="rejilla tres">
        {lista.slice(0, 6).map((c) => <TarjetaCliente cliente={c} resumen={resumenDe(resumen, c.id)} />)}
      </div>
    )}
  </section>

  <form method="POST" action="/api/logout" class="salir-movil">
    <button type="submit" class="btn fantasma ancho-total">Salir</button>
  </form>
</Base>

<style>
  .salir-movil { margin-top: 40px; }
  @media (min-width: 900px) { .salir-movil { display: none; } }
</style>
```

- [ ] **Step 3: Lista `src/pages/clientes/index.astro`**

```astro
---
import { desc } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import Icono from '@/components/Icono.astro';
import TarjetaCliente from '@/components/TarjetaCliente.astro';
import { db, clients, researchJobs } from '@/db';
import { resumirPorCliente, resumenDe } from '@/lib/ui/estado-cliente';

const lista = await db.select().from(clients).orderBy(desc(clients.updatedAt));
const jobs = await db.select().from(researchJobs);
const resumen = resumirPorCliente(jobs);

const FILTROS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'listo', texto: 'Listos' },
  { valor: 'en_curso', texto: 'En curso' },
  { valor: 'sin_investigar', texto: 'Sin investigar' },
];
---

<Base titulo="Clientes" activo="clientes">
  <div class="encabezado">
    <div>
      <h1>Clientes</h1>
      <p class="sub">{lista.length} {lista.length === 1 ? 'cliente registrado' : 'clientes registrados'}</p>
    </div>
    <a href="/clientes/nuevo" class="btn"><Icono nombre="mas" />Nuevo cliente</a>
  </div>

  {lista.length === 0 ? (
    <div class="tarjeta vacio">
      <Icono nombre="clientes" />
      <strong>Sin clientes todavía</strong>
      Da de alta el primero para poder lanzar una investigación.
      <div><a href="/clientes/nuevo" class="btn">Registra tu primer cliente</a></div>
    </div>
  ) : (
    <>
      <div class="campo con-icono" style="margin-bottom:14px">
        <Icono nombre="buscar" />
        <input id="buscar" type="search" placeholder="Filtra por nombre, giro o ciudad…" autocomplete="off" aria-label="Filtrar clientes" />
      </div>
      <div class="chips" role="group" aria-label="Filtrar por estado">
        {FILTROS.map((f, i) => (
          <button type="button" class="chip" data-filtro={f.valor} aria-pressed={i === 0 ? 'true' : 'false'}>{f.texto}</button>
        ))}
      </div>
      <div class="rejilla tres" id="rejilla">
        {lista.map((c) => <TarjetaCliente cliente={c} resumen={resumenDe(resumen, c.id)} />)}
      </div>
      <p class="vacio" id="sin-resultados" hidden>Ningún cliente coincide con el filtro.</p>
    </>
  )}
</Base>

<script>
  import { normalizar } from '@/lib/ui/buscar';
  import { pasaFiltro, type EstadoCliente, type FiltroCliente } from '@/lib/ui/estado-cliente';

  const buscar = document.getElementById('buscar') as HTMLInputElement | null;
  const tarjetas = [...document.querySelectorAll<HTMLElement>('#rejilla [data-estado]')];
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filtro]')];
  const sinResultados = document.getElementById('sin-resultados');
  let filtro: FiltroCliente = 'todos';

  function aplicar() {
    const palabras = normalizar(buscar?.value ?? '').split(/\s+/).filter(Boolean);
    let visibles = 0;
    for (const t of tarjetas) {
      const ok = pasaFiltro(t.dataset.estado as EstadoCliente, filtro)
        && palabras.every((p) => (t.dataset.busqueda ?? '').includes(p));
      t.hidden = !ok;
      if (ok) visibles++;
    }
    if (sinResultados) sinResultados.hidden = visibles > 0;
  }

  buscar?.addEventListener('input', aplicar);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      filtro = chip.dataset.filtro as FiltroCliente;
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
      aplicar();
    });
  }
</script>
```

- [ ] **Step 4: Verificar en navegador**

Con `npm run dev` corriendo y sesión iniciada: `/` muestra saludo, buscador grande, 4 indicadores con la cliente de ejemplo, «Clientes recientes». `/clientes` muestra la rejilla; escribir `cosmetologia` sin acento filtra; el chip «Sin investigar» oculta a Yessica Villa si tiene jobs. Clic en el buscador grande o ⌘K abre la paleta, flechas y Enter abren la ficha.

- [ ] **Step 5: Commit**

```bash
git add src/components/TarjetaCliente.astro src/pages/index.astro src/pages/clientes/index.astro
git commit -m "feat(rediseño): tablero de inicio y lista de clientes con filtros

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Alta de cliente

**Files:**
- Rewrite: `src/pages/clientes/nuevo.astro`

- [ ] **Step 1: Reescribir**

Conservar sin cambios el `<script>` actual del archivo (envío a `POST /api/clientes`, errores en `#errores`, redirección a la ficha). Sustituir frontmatter y marcado por:

```astro
---
import Base from '@/layouts/Base.astro';
---

<Base titulo="Nuevo cliente" activo="clientes" volver={{ href: '/clientes', texto: 'Clientes' }}>
  <div class="encabezado">
    <div>
      <p class="eyebrow">Alta</p>
      <h1>Nuevo cliente</h1>
      <p class="sub">Nombre, giro y producto son obligatorios. Lo demás mejora la investigación.</p>
    </div>
  </div>

  <form class="tarjeta" id="forma">
    <div class="campos">
      <div class="campo">
        <label for="nombre">Nombre <span class="req">*</span></label>
        <input id="nombre" name="nombre" required autofocus />
      </div>
      <div class="campo">
        <label for="giro">Giro <span class="req">*</span></label>
        <input id="giro" name="giro" required placeholder="Cosmetología, gimnasio, repostería…" />
      </div>
      <div class="campo ancho">
        <label for="producto">Producto o servicio <span class="req">*</span></label>
        <input id="producto" name="producto" required placeholder="Diplomado presencial de 6 meses" />
      </div>
      <div class="campo">
        <label for="ciudad">Ciudad</label>
        <input id="ciudad" name="ciudad" placeholder="Guadalajara" />
        <p class="ayuda">Sin ciudad, el foco geográfico será nacional.</p>
      </div>
      <div class="campo">
        <label for="ticket">Ticket</label>
        <input id="ticket" name="ticket" placeholder="$36,792" />
        <p class="ayuda">Determina si el ciclo de compra es largo.</p>
      </div>
      <div class="campo ancho">
        <label for="contacto">Contacto</label>
        <input id="contacto" name="contacto" placeholder="Nombre, teléfono o correo" />
      </div>
      <div class="campo ancho">
        <label for="notas">Notas del operador</label>
        <textarea id="notas" name="notas" placeholder="Lo que sepas y no esté en los documentos."></textarea>
      </div>
    </div>

    <div class="aviso rosa" id="errores" role="alert" style="margin-top:18px" hidden></div>

    <div class="acciones">
      <button type="submit" class="btn" id="guardar">Guardar cliente</button>
      <a href="/clientes" class="btn fantasma">Cancelar</a>
    </div>
  </form>
</Base>
```

- [ ] **Step 2: Verificar**

En `/clientes/nuevo`, enviar vacío → el navegador exige los obligatorios. Guardar un cliente de prueba → lleva a su ficha. Ver en dos columnas a 1440 px y en una a 390 px.

- [ ] **Step 3: Commit**

```bash
git add src/pages/clientes/nuevo.astro
git commit -m "feat(rediseño): alta de cliente en el sistema nuevo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Ficha del cliente con pestañas

**Files:**
- Rewrite: `src/pages/clientes/[id].astro`

- [ ] **Step 1: Reescribir el frontmatter y el marcado**

```astro
---
import { eq, desc } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import Icono from '@/components/Icono.astro';
import LinksEditor from '@/components/LinksEditor';
import FilesUploader from '@/components/FilesUploader';
import { contarEtapasConDatos } from '@/lib/precheck';
import { iniciales, tinte } from '@/lib/ui/cliente-visual';
import { ETIQUETA_ESTADO } from '@/lib/ui/progreso';
import { db, clients, clientLinks, clientFiles, researchJobs, researchResults, growthResults } from '@/db';

const { id } = Astro.params;

const [cliente] = await db.select().from(clients).where(eq(clients.id, id!)).limit(1);
if (!cliente) return new Response('Cliente no encontrado', { status: 404 });

const enlaces = await db.select().from(clientLinks).where(eq(clientLinks.clientId, cliente.id));
const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, cliente.id));
const jobs = await db.select().from(researchJobs).where(eq(researchJobs.clientId, cliente.id)).orderBy(desc(researchJobs.createdAt));
const resultados = await db.select().from(researchResults).where(eq(researchResults.clientId, cliente.id));
const manuales = await db.select().from(growthResults).where(eq(growthResults.clientId, cliente.id)).orderBy(desc(growthResults.version));

const resultadoPorJob = new Map(resultados.map((r) => [r.jobId, r.id]));
const manualPorJob = new Map(manuales.map((m) => [m.jobId, m.id]));

// El manual de campaña parte de la investigación: sin una con datos no hay
// nada sobre lo que razonar, así que la tarjeta explica por qué no se puede.
const puedeGrowth = resultados.some((r) => contarEtapasConDatos(r.datos) > 0);

const ultimaInvestigacion = jobs.find((j) => j.tipo !== 'growth');
const ultimoGrowth = jobs.find((j) => j.tipo === 'growth');

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fecha = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
const fechaHora = (d: Date) => d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
---

<Base titulo={cliente.nombre} activo="clientes" volver={{ href: '/clientes', texto: 'Clientes' }}>
  <div class="ficha-cabeza">
    <span class={`avatar grande ${tinte(cliente.id)}`}>{iniciales(cliente.nombre)}</span>
    <div class="ficha-titulo">
      <h1>{cliente.nombre}</h1>
      <p class="sub">{cliente.giro}{cliente.ciudad ? ` · ${cliente.ciudad}` : ''}</p>
    </div>
    <div class="menu">
      <button type="button" class="icono-btn" id="menu-boton" aria-haspopup="true" aria-expanded="false" aria-controls="menu-lista" aria-label="Más acciones">
        <Icono nombre="puntos" />
      </button>
      <ul class="menu-lista" id="menu-lista" hidden>
        <li><button type="button" id="borrar">Eliminar cliente</button></li>
      </ul>
    </div>
  </div>

  <div class="rejilla" style="margin-top:24px">
    <section class="tarjeta accion">
      <span class="icono-tinte" style="background:var(--rosa-s);color:var(--rosa)"><Icono nombre="investigar" /></span>
      <h3>Investigar</h3>
      <p class="secundario">Social Research</p>
      <p class="secundario">
        {ultimaInvestigacion
          ? `Última: ${fecha(ultimaInvestigacion.createdAt)} · ${dinero(Number(ultimaInvestigacion.costoUsd))}`
          : 'Nunca investigado'}
      </p>
      <a href={`/clientes/${cliente.id}/investigar`} class="btn">Investigar</a>
    </section>

    <section class="tarjeta accion">
      <span class="icono-tinte" style="background:var(--azul-s);color:var(--azul)"><Icono nombre="megafono" /></span>
      <h3>Manual de campaña</h3>
      <p class="secundario">Growth</p>
      {puedeGrowth ? (
        <p class="secundario">{ultimoGrowth ? `Último: ${fecha(ultimoGrowth.createdAt)} · ${dinero(Number(ultimoGrowth.costoUsd))}` : 'Listo para generarse'}</p>
      ) : (
        <p class="secundario">Requiere una investigación con datos. El manual parte de ella.</p>
      )}
      <button type="button" class="btn" id="generar-growth" disabled={!puedeGrowth}>Generar</button>
    </section>
  </div>

  <div class="pestanas" role="tablist" aria-label="Secciones del cliente">
    <button type="button" role="tab" id="tab-datos" aria-controls="panel-datos" data-pestana="datos" aria-selected="true">Datos</button>
    <button type="button" role="tab" id="tab-enlaces" aria-controls="panel-enlaces" data-pestana="enlaces" aria-selected="false" tabindex="-1">Enlaces<span class="cuenta">{enlaces.length}</span></button>
    <button type="button" role="tab" id="tab-archivos" aria-controls="panel-archivos" data-pestana="archivos" aria-selected="false" tabindex="-1">Archivos<span class="cuenta">{archivos.length}</span></button>
    <button type="button" role="tab" id="tab-historial" aria-controls="panel-historial" data-pestana="historial" aria-selected="false" tabindex="-1">Historial<span class="cuenta">{jobs.length}</span></button>
  </div>

  <section class="tarjeta" role="tabpanel" id="panel-datos" aria-labelledby="tab-datos">
    <form id="forma">
      <div class="campos">
        <div class="campo"><label for="nombre">Nombre <span class="req">*</span></label><input id="nombre" name="nombre" value={cliente.nombre} required /></div>
        <div class="campo"><label for="giro">Giro <span class="req">*</span></label><input id="giro" name="giro" value={cliente.giro} required /></div>
        <div class="campo ancho"><label for="producto">Producto o servicio <span class="req">*</span></label><input id="producto" name="producto" value={cliente.producto} required /></div>
        <div class="campo"><label for="ciudad">Ciudad</label><input id="ciudad" name="ciudad" value={cliente.ciudad ?? ''} /></div>
        <div class="campo"><label for="ticket">Ticket</label><input id="ticket" name="ticket" value={cliente.ticket ?? ''} /></div>
        <div class="campo ancho"><label for="contacto">Contacto</label><input id="contacto" name="contacto" value={cliente.contacto ?? ''} /></div>
        <div class="campo ancho"><label for="notas">Notas del operador</label><textarea id="notas" name="notas">{cliente.notas ?? ''}</textarea></div>
      </div>
      <div class="acciones"><button type="submit" class="btn" id="guardar">Guardar cambios</button></div>
    </form>
  </section>

  <section class="tarjeta" role="tabpanel" id="panel-enlaces" aria-labelledby="tab-enlaces" hidden>
    <p class="sub" style="margin:0 0 16px">Sitio, redes y páginas de venta. La investigación los revisa.</p>
    <LinksEditor client:load clientId={cliente.id} iniciales={enlaces} />
  </section>

  <section class="tarjeta" role="tabpanel" id="panel-archivos" aria-labelledby="tab-archivos" hidden>
    <p class="sub" style="margin:0 0 16px">PDF, DOCX, TXT e imágenes. Se extrae el texto para alimentar la investigación.</p>
    <FilesUploader client:load clientId={cliente.id}
      iniciales={archivos.map((a) => ({ id: a.id, nombreOriginal: a.nombreOriginal, mime: a.mime, bytes: a.bytes, estadoExtraccion: a.estadoExtraccion }))} />
  </section>

  <section class="tarjeta" role="tabpanel" id="panel-historial" aria-labelledby="tab-historial" hidden>
    {jobs.length === 0 ? (
      <div class="vacio">
        <Icono nombre="investigar" />
        <strong>Todavía no investigas a este cliente</strong>
        Revisa que los enlaces y archivos estén completos antes de lanzar.
      </div>
    ) : (
      <ul class="lista">
        {jobs.map((j) => (
          <li class="renglon">
            <div class="cuerpo">
              <strong>{j.tipo === 'growth' ? 'Manual de campaña' : 'Investigación'}</strong>
              <p class="secundario">{fechaHora(j.createdAt)} · <span class="cifra">{dinero(Number(j.costoUsd))}</span></p>
              {j.error && <p class="secundario" style="color:var(--rojo)">{j.error}</p>}
            </div>
            <span class={`etiqueta ${j.estado}`}>{ETIQUETA_ESTADO[j.estado] ?? j.estado}</span>
            {manualPorJob.has(j.id) ? (
              <a href={`/growth/${manualPorJob.get(j.id)}`} class="btn fantasma chico">Ver manual</a>
            ) : resultadoPorJob.has(j.id) ? (
              <a href={`/resultados/${resultadoPorJob.get(j.id)}`} class="btn fantasma chico">Ver presentación</a>
            ) : (
              <a href={`/jobs/${j.id}`} class="btn fantasma chico">Ver progreso</a>
            )}
          </li>
        ))}
      </ul>
    )}
  </section>

  <dialog id="dialogo-borrar" aria-labelledby="borrar-titulo">
    <h2 id="borrar-titulo">¿Eliminar a {cliente.nombre}?</h2>
    <p class="sub" style="margin:10px 0 0">Se borran también enlaces, archivos e investigaciones. No se puede deshacer.</p>
    <div class="acciones">
      <button type="button" class="btn peligro lleno" id="borrar-de-verdad">Sí, eliminar</button>
      <button type="button" class="btn fantasma" id="cancelar-borrado">Cancelar</button>
    </div>
  </dialog>
</Base>
```

- [ ] **Step 2: Scripts**

Sustituir los dos `<script>` y el `<style>` actuales por:

```astro
<script>
  import { toast } from '@/scripts/toast';

  const clientId = window.location.pathname.split('/')[2];

  // ── Pestañas: el hash conserva la pestaña al recargar o compartir el enlace.
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  function mostrar(nombre: string, enfocar = false) {
    const destino = tabs.find((t) => t.dataset.pestana === nombre) ?? tabs[0];
    for (const t of tabs) {
      const activa = t === destino;
      t.setAttribute('aria-selected', String(activa));
      t.tabIndex = activa ? 0 : -1;
      (document.getElementById(t.getAttribute('aria-controls')!) as HTMLElement).hidden = !activa;
    }
    if (enfocar) destino.focus();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { history.replaceState(null, '', `#${t.dataset.pestana}`); mostrar(t.dataset.pestana!); });
    t.addEventListener('keydown', (e) => {
      const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!paso) return;
      const siguiente = tabs[(i + paso + tabs.length) % tabs.length];
      history.replaceState(null, '', `#${siguiente.dataset.pestana}`);
      mostrar(siguiente.dataset.pestana!, true);
    });
  });
  mostrar(location.hash.slice(1) || 'datos');

  // ── Guardar datos
  const forma = document.getElementById('forma') as HTMLFormElement;
  const guardar = document.getElementById('guardar') as HTMLButtonElement;
  forma.addEventListener('submit', async (e) => {
    e.preventDefault();
    guardar.disabled = true;
    try {
      const res = await fetch(`/api/clientes/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(forma).entries())),
      });
      const cuerpo = await res.json();
      if (cuerpo.ok) toast('Cambios guardados');
      else toast((cuerpo.errores ?? ['No se pudo guardar.']).join(' · '), 'error');
    } catch {
      toast('No se pudo contactar al servidor.', 'error');
    }
    guardar.disabled = false;
  });

  // ── Menú ⋯ y borrado en dos pasos
  const menuBoton = document.getElementById('menu-boton') as HTMLButtonElement;
  const menuLista = document.getElementById('menu-lista') as HTMLElement;
  const dialogo = document.getElementById('dialogo-borrar') as HTMLDialogElement;
  const cerrarMenu = () => { menuLista.hidden = true; menuBoton.setAttribute('aria-expanded', 'false'); };
  menuBoton.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = menuLista.hidden;
    menuLista.hidden = !abrir;
    menuBoton.setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', cerrarMenu);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarMenu(); });
  document.getElementById('borrar')!.addEventListener('click', () => { cerrarMenu(); dialogo.showModal(); });
  document.getElementById('cancelar-borrado')!.addEventListener('click', () => dialogo.close());
  document.getElementById('borrar-de-verdad')!.addEventListener('click', async () => {
    const res = await fetch(`/api/clientes/${clientId}`, { method: 'DELETE' });
    if (res.ok) window.location.href = '/clientes';
    else toast('No se pudo eliminar el cliente.', 'error');
  });

  // ── Generar manual. El servidor vuelve a comprobar que haya investigación:
  // la interfaz no es una garantía.
  const growth = document.getElementById('generar-growth') as HTMLButtonElement;
  growth.addEventListener('click', async () => {
    growth.disabled = true;
    const original = growth.textContent;
    growth.textContent = 'Encolando…';
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, tipo: 'growth' }),
      });
      const cuerpo = await res.json();
      if (cuerpo.ok) { location.href = `/jobs/${cuerpo.id}`; return; }
      if (cuerpo.jobId) { location.href = `/jobs/${cuerpo.jobId}`; return; }
      toast((cuerpo.errores ?? ['No se pudo encolar.']).join(' · '), 'error');
    } catch {
      toast('Sin conexión con el servidor.', 'error');
    }
    growth.disabled = false;
    growth.textContent = original;
  });
</script>

<style>
  .ficha-cabeza { display: flex; align-items: center; gap: 16px; }
  .ficha-titulo { flex: 1; min-width: 0; }
  .ficha-titulo h1 { overflow-wrap: anywhere; }
</style>
```

- [ ] **Step 3: Verificar**

En la ficha de Yessica Villa: las 4 pestañas cambian; `#enlaces` en la URL abre Enlaces al recargar; flechas ←/→ mueven la pestaña. Agregar y quitar un enlace funciona (LinksEditor sin cambios). Guardar datos muestra toast. Historial: columnas en orden (tipo, fecha·costo, estado, acción). ⋯ → Eliminar abre el diálogo; Cancelar lo cierra (no borrar la cliente de ejemplo).

- [ ] **Step 4: Commit**

```bash
git add "src/pages/clientes/[id].astro"
git commit -m "feat(rediseño): ficha con tarjetas de acción, pestañas y borrado en diálogo

Corrige el historial, cuyos encabezados no coincidían con sus celdas.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: Investigar

**Files:**
- Rewrite: `src/pages/clientes/[id]/investigar.astro`

- [ ] **Step 1: Reescribir**

Conservar el `<script>` actual del archivo tal cual (maneja `ok`, `409` con `jobId` y errores en `#error`). Sustituir frontmatter y marcado por:

```astro
---
import { eq } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import Icono from '@/components/Icono.astro';
import { db, clients, clientLinks, clientFiles } from '@/db';
import { revisarAntesDeInvestigar } from '@/lib/precheck';

const { id } = Astro.params;

const [cliente] = await db.select().from(clients).where(eq(clients.id, id!)).limit(1);
if (!cliente) return new Response('Cliente no encontrado', { status: 404 });

const enlaces = await db.select().from(clientLinks).where(eq(clientLinks.clientId, cliente.id));
const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, cliente.id));
const conTexto = archivos.filter((a) => a.estadoExtraccion === 'ok');

const revision = revisarAntesDeInvestigar({
  enlaces: enlaces.length,
  archivosConTexto: conTexto.length,
  ticket: cliente.ticket,
  ciudad: cliente.ciudad,
});

// Cada advertencia de revisarAntesDeInvestigar nombra el dato que falta; se
// asocia a su renglón por esa palabra para no duplicar los textos aquí.
const advertencia = (clave: string) => revision.advertencias.find((a) => a.toLowerCase().includes(clave));

const renglones = [
  { nombre: 'Giro', valor: cliente.giro, aviso: undefined },
  { nombre: 'Producto', valor: cliente.producto, aviso: undefined },
  { nombre: 'Ciudad', valor: cliente.ciudad ?? 'Sin ciudad', aviso: advertencia('ciudad') },
  { nombre: 'Ticket', valor: cliente.ticket ?? 'Sin ticket', aviso: advertencia('ticket') },
  { nombre: 'Enlaces', valor: `${enlaces.length}`, aviso: advertencia('enlaces') },
  { nombre: 'Archivos con texto', valor: `${conTexto.length} de ${archivos.length}`, aviso: advertencia('archivos') },
];

const estimado = Number(process.env.COST_ESTIMATE_USD || 8);
const tope = Number(process.env.COST_LIMIT_USD || 15);
const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
---

<Base titulo={`Investigar · ${cliente.nombre}`} activo="clientes" volver={{ href: `/clientes/${cliente.id}`, texto: cliente.nombre }}>
  <div class="encabezado">
    <div>
      <p class="eyebrow">Social Research</p>
      <h1>Investigar a {cliente.nombre}</h1>
      <p class="sub">Cinco agentes: competencia, audiencia, canales, mercado y síntesis.</p>
    </div>
  </div>

  <div class="investigar">
    <section class="tarjeta">
      <h2>Lo que se va a enviar</h2>
      <p class="sub">Nada de lo que falta bloquea la investigación, pero baja la calidad del resultado.</p>
      <ul class="lista">
        {renglones.map((r) => (
          <li class="renglon">
            <span class="icono-tinte" style={r.aviso ? 'color:var(--amarillo)' : 'color:var(--verde)'}>
              <Icono nombre={r.aviso ? 'alerta' : 'check'} />
            </span>
            <div class="cuerpo">
              <strong>{r.nombre}</strong>
              <p class="secundario">{r.valor}</p>
              {r.aviso && <p class="ayuda" style="color:var(--amarillo)">{r.aviso}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>

    <aside class="tarjeta costo">
      <p class="eyebrow">Costo estimado</p>
      <p class="display cifra">{dinero(estimado)}</p>
      <p class="secundario">Tope duro: <span class="cifra">{dinero(tope)}</span></p>
      <p class="aviso" style="margin-top:16px">Al alcanzar el tope, las etapas que falten se declaran vacías en lugar de continuar.</p>
      <div class="aviso rosa" id="error" role="alert" style="margin-top:12px" hidden></div>
      <div class="acciones">
        <button type="button" class="btn ancho-total" id="lanzar">Lanzar investigación</button>
        <a href={`/clientes/${cliente.id}`} class="btn fantasma ancho-total">Cancelar</a>
      </div>
    </aside>
  </div>
</Base>

<style>
  .investigar { display: grid; gap: 18px; }
  .investigar .tarjeta + .tarjeta { margin-top: 0; }
  .icono-tinte svg { width: 22px; height: 22px; }
  @media (min-width: 900px) {
    .investigar { grid-template-columns: 1fr 340px; align-items: start; }
    .costo { position: sticky; top: 90px; }
  }
</style>
```

- [ ] **Step 2: Verificar**

`/clientes/<id>/investigar`: renglones con ✓ verde o ⚠ amarillo y su texto; panel de costo a la derecha en 1440 px y abajo en 390 px. **No pulsar «Lanzar»**: gasta API real si hay key.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/clientes/[id]/investigar.astro"
git commit -m "feat(rediseño): investigar como checklist con panel de costo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Progreso como línea de tiempo

**Files:**
- Rewrite: `src/components/ProgresoJob.tsx`
- Rewrite: `src/pages/jobs/[id].astro`

- [ ] **Step 1: Reescribir `ProgresoJob.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { etapasDe, porcentaje, transcurrido, ETIQUETA_ESTADO, ETIQUETA_ETAPA } from '@/lib/ui/progreso';

type Estado = {
  ok: boolean;
  estado: string;
  etapaActual: string | null;
  etapas: Record<string, string>;
  costoUsd: number;
  error: string | null;
  resultId: string | null;
  tipo?: 'research' | 'growth';
  startedAt: string | null;
  finishedAt: string | null;
};

const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const TRAZO: Record<string, string> = {
  ok: 'm5 12.5 4.5 4.5L19 7',
  fallo: 'M6 6l12 12M18 6 6 18',
  omitido_por_costo: 'M5 12h14',
  corriendo: 'M12 7v5l3 2',
};

function MarcaEtapa({ estado }: { estado?: string }) {
  const d = estado ? TRAZO[estado] : undefined;
  return (
    <span className="marca-etapa" aria-hidden="true">
      {d && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
      )}
    </span>
  );
}

export default function ProgresoJob({ jobId, inicial, tope }: { jobId: string; inicial: Estado; tope: number }) {
  const [estado, setEstado] = useState<Estado>(inicial);
  const [conexion, setConexion] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => new Date());

  const terminado = ['completado', 'fallido', 'cancelado'].includes(estado.estado);

  useEffect(() => {
    if (terminado) return;
    const consulta = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const cuerpo = await res.json();
        if (cuerpo.ok) { setEstado(cuerpo); setConexion(null); }
      } catch {
        setConexion('Se perdió la conexión con el servidor. Reintentando…');
      }
    }, 3000);
    const reloj = setInterval(() => setAhora(new Date()), 1000);
    return () => { clearInterval(consulta); clearInterval(reloj); };
  }, [jobId, terminado]);

  const etapas = etapasDe(estado.tipo);
  // Al terminar la barra se llena aunque haya etapas omitidas: ya no avanzará más.
  const pct = terminado ? 100 : porcentaje(estado.etapas ?? {}, estado.tipo);
  const tiempo = transcurrido(estado.startedAt, estado.finishedAt ? new Date(estado.finishedAt) : ahora);
  const esGrowth = estado.tipo === 'growth';

  return (
    <div>
      <section className="tarjeta">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className={`etiqueta ${estado.estado}`}>{ETIQUETA_ESTADO[estado.estado] ?? estado.estado}</span>
          <span className="secundario cifra">{tiempo ?? 'En cola'}</span>
        </div>
        <p className="display cifra" style={{ margin: '14px 0 10px' }}>{pct}%</p>
        <div className="avance" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} />
        </div>
        <p className="secundario cifra" style={{ marginTop: 10 }}>
          {dinero(estado.costoUsd)} de {dinero(tope)} de tope
        </p>
        {conexion && <p className="aviso amarillo" style={{ marginTop: 14 }}>{conexion}</p>}
        {estado.error && <p className="aviso rosa" role="alert" style={{ marginTop: 14 }}>{estado.error}</p>}
      </section>

      <section className="tarjeta">
        <h2>Etapas</h2>
        <ol className="linea-tiempo">
          {etapas.map((e) => {
            const s = estado.etapas?.[e.clave];
            return (
              <li key={e.clave} className={s ?? ''} aria-current={s === 'corriendo' ? 'step' : undefined}>
                <MarcaEtapa estado={s} />
                <div>
                  <strong>{e.titulo}</strong>
                  <span className="secundario"> · {s ? ETIQUETA_ETAPA[s] ?? s : 'En espera'}</span>
                  <p className="ayuda" style={{ marginTop: 2 }}>{e.detalle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {terminado && estado.resultId && (
        <a href={esGrowth ? `/growth/${estado.resultId}` : `/resultados/${estado.resultId}`} className="btn ancho-total" style={{ marginTop: 18 }}>
          {esGrowth ? 'Ver el manual de campaña' : 'Ver la presentación'}
        </a>
      )}
      {terminado && !estado.resultId && (
        <p className="aviso amarillo" style={{ marginTop: 18 }}>El trabajo terminó sin producir un resultado que mostrar.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reescribir `src/pages/jobs/[id].astro`**

```astro
---
import { eq } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import ProgresoJob from '@/components/ProgresoJob';
import { db, researchJobs, researchResults, growthResults, clients } from '@/db';

const { id } = Astro.params;

const [job] = await db.select().from(researchJobs).where(eq(researchJobs.id, id!)).limit(1);
if (!job) return new Response('Investigación no encontrada', { status: 404 });

const [cliente] = await db.select().from(clients).where(eq(clients.id, job.clientId)).limit(1);
// El resultado vive en una tabla u otra según el tipo del job.
const tabla = job.tipo === 'growth' ? growthResults : researchResults;
const [resultado] = await db.select({ id: tabla.id }).from(tabla).where(eq(tabla.jobId, job.id)).limit(1);

const esGrowth = job.tipo === 'growth';
const tope = Number(process.env.COST_LIMIT_USD || 15);

const inicial = {
  ok: true,
  estado: job.estado,
  etapaActual: job.etapaActual,
  etapas: (job.etapas ?? {}) as Record<string, string>,
  costoUsd: Number(job.costoUsd),
  error: job.error,
  tipo: job.tipo,
  resultId: resultado?.id ?? null,
  startedAt: job.startedAt?.toISOString() ?? null,
  finishedAt: job.finishedAt?.toISOString() ?? null,
};
---

<Base
  titulo={`${esGrowth ? 'Manual de campaña' : 'Investigación'} · ${cliente?.nombre ?? ''}`}
  activo="clientes"
  volver={{ href: `/clientes/${job.clientId}`, texto: cliente?.nombre ?? 'Cliente' }}
>
  <div class="encabezado">
    <div>
      <p class="eyebrow">{esGrowth ? 'Manual de campaña' : 'Social Research'}</p>
      <h1>{cliente?.nombre}</h1>
      <p class="sub">La página se actualiza sola cada tres segundos.</p>
    </div>
  </div>
  <ProgresoJob client:load jobId={job.id} inicial={inicial} tope={tope} />
</Base>
```

- [ ] **Step 3: Verificar el bug corregido**

Run: `psql "postgresql://wozial:wozial@localhost:5432/wozial_studio" -Atc "select id, tipo, estado from research_jobs order by created_at desc limit 5"` (o `docker exec wozial-pg psql -U wozial -d wozial_studio -Atc "…"` si no hay psql local).
Abrir `/jobs/<id>` de un job `growth` y de uno `research`.
Expected: el de growth lista Estructura, Creativos, Google, Prompts; el de research, las cinco etapas de investigación. Ambos con el botón final correcto.

- [ ] **Step 4: Commit**

```bash
git add src/components/ProgresoJob.tsx "src/pages/jobs/[id].astro"
git commit -m "feat(rediseño): progreso en línea de tiempo con tiempo y tope

Corrige que un job de Growth mostrara las etapas de investigación.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: Entregables

**Files:**
- Create: `src/pages/entregables.astro`

- [ ] **Step 1: Crear**

```astro
---
import { desc, eq, and, inArray } from 'drizzle-orm';
import Base from '@/layouts/Base.astro';
import Icono from '@/components/Icono.astro';
import { db, clients, researchResults, growthResults, shareLinks } from '@/db';
import { slugificar } from '@/lib/slug';

const investigaciones = await db
  .select({ id: researchResults.id, version: researchResults.version, createdAt: researchResults.createdAt, clientId: clients.id, nombre: clients.nombre })
  .from(researchResults).innerJoin(clients, eq(clients.id, researchResults.clientId));
const manuales = await db
  .select({ id: growthResults.id, version: growthResults.version, createdAt: growthResults.createdAt, clientId: clients.id, nombre: clients.nombre })
  .from(growthResults).innerJoin(clients, eq(clients.id, growthResults.clientId));

const documentos = [
  ...investigaciones.map((d) => ({ ...d, tipo: 'research' as const })),
  ...manuales.map((d) => ({ ...d, tipo: 'growth' as const })),
].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

const links = documentos.length
  ? await db.select().from(shareLinks)
      .where(and(eq(shareLinks.revocado, false), inArray(shareLinks.documentoId, documentos.map((d) => d.id))))
      .orderBy(desc(shareLinks.createdAt))
  : [];
// Si un documento tiene varios links vivos se muestra el más reciente.
const linkPorDocumento = new Map<string, (typeof links)[number]>();
for (const l of links) if (!linkPorDocumento.has(l.documentoId)) linkPorDocumento.set(l.documentoId, l);

const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') || Astro.url.origin;
const fecha = (d: Date) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
---

<Base titulo="Entregables" activo="entregables">
  <div class="encabezado">
    <div>
      <h1>Entregables</h1>
      <p class="sub">Presentaciones de Social Research y manuales de campaña.</p>
    </div>
  </div>

  {documentos.length === 0 ? (
    <div class="tarjeta vacio">
      <Icono nombre="vacio" />
      <strong>Todavía no hay entregables</strong>
      Aparecen aquí cuando termina una investigación o un manual.
      <div><a href="/clientes" class="btn">Lanza tu primera investigación</a></div>
    </div>
  ) : (
    <>
      <div class="chips" role="group" aria-label="Filtrar por tipo">
        <button type="button" class="chip" data-filtro="todos" aria-pressed="true">Todos</button>
        <button type="button" class="chip" data-filtro="research" aria-pressed="false">Investigaciones</button>
        <button type="button" class="chip" data-filtro="growth" aria-pressed="false">Manuales</button>
      </div>
      <section class="tarjeta">
        <ul class="lista">
          {documentos.map((d) => {
            const link = linkPorDocumento.get(d.id);
            const url = link ? `${base}/p/${slugificar(d.nombre)}/${link.token}` : '';
            const vista = d.tipo === 'growth' ? `/growth/${d.id}` : `/resultados/${d.id}`;
            return (
              <li class="renglon" data-tipo={d.tipo} data-result-id={d.id}>
                <div class="cuerpo">
                  <p class="eyebrow">{d.tipo === 'growth' ? 'Manual de campaña' : 'Social Research'}</p>
                  <strong>{d.nombre}</strong>
                  <p class="secundario">Versión {d.version} · {fecha(d.createdAt)}{link ? ` · ${link.visitas} ${link.visitas === 1 ? 'visita' : 'visitas'}` : ''}</p>
                  <div class="link-publico" hidden={!link}>
                    <input readonly value={url} aria-label={`Link público de ${d.nombre}`} />
                    <button type="button" class="btn suave chico" data-copiar><Icono nombre="copiar" />Copiar</button>
                  </div>
                </div>
                {!link && <button type="button" class="btn fantasma chico" data-crear><Icono nombre="enlace" />Crear link</button>}
                <a href={vista} class="btn fantasma chico"><Icono nombre="abrir" />Abrir</a>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  )}
</Base>

<script>
  import { copiar } from '@/scripts/copiar';
  import { toast } from '@/scripts/toast';

  const renglones = [...document.querySelectorAll<HTMLElement>('[data-tipo]')];
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filtro]')];
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      for (const c of chips) c.setAttribute('aria-pressed', String(c === chip));
      for (const r of renglones) r.hidden = chip.dataset.filtro !== 'todos' && r.dataset.tipo !== chip.dataset.filtro;
    });
  }

  for (const r of renglones) {
    const campo = r.querySelector<HTMLInputElement>('.link-publico input');
    r.querySelector('[data-copiar]')?.addEventListener('click', () => copiar(campo?.value ?? '', campo));

    const crear = r.querySelector<HTMLButtonElement>('[data-crear]');
    crear?.addEventListener('click', async () => {
      crear.disabled = true;
      try {
        const res = await fetch('/api/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resultId: r.dataset.resultId, tipo: r.dataset.tipo }),
        });
        const cuerpo = await res.json();
        if (!cuerpo.ok) throw new Error((cuerpo.errores ?? []).join(' · '));
        if (campo) campo.value = cuerpo.url;
        (r.querySelector('.link-publico') as HTMLElement).hidden = false;
        crear.remove();
        await copiar(cuerpo.url, campo);
      } catch (e) {
        toast(e instanceof Error && e.message ? e.message : 'No se pudo crear el link.', 'error');
        crear.disabled = false;
      }
    });
  }
</script>

<style>
  .link-publico { display: flex; gap: 8px; margin-top: 10px; max-width: 520px; }
  .link-publico input { min-height: 36px; padding: 6px 12px; font-size: 13px; }
</style>
```

- [ ] **Step 2: Verificar**

`/entregables` lista los resultados sembrados; los chips filtran. En uno sin link, «Crear link» lo crea, muestra el campo y copia (toast). Abrir el link en otra pestaña carga `/p/...`. Si ya había links revocados no aparecen.

- [ ] **Step 3: Commit**

```bash
git add src/pages/entregables.astro
git commit -m "feat(rediseño): vista de entregables con links públicos y visitas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 18: Verificación final

**Files:** ninguno, salvo correcciones que aparezcan.

- [ ] **Step 1: Restos del sistema viejo**

Run: `grep -rn "migas=\|var(--pink)\|var(--border\|var(--glass\|var(--dim)\|var(--mid)\|var(--radius\|alert(" src --include=*.astro --include=*.tsx --include=*.ts | grep -v "src/render\|src/pages/p/\|src/pages/resultados\|src/pages/growth"`
Expected: sin resultados. `src/render`, `/p`, `/resultados` y `/growth` son entregables de la etapa 2 y no usan esta hoja; si alguno importa `global.css`, anotarlo para el usuario sin cambiarlo.

- [ ] **Step 2: Pruebas y build**

Run: `npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -3`
Expected: todos los tests pasan (línea base de Task 0 + los nuevos) y el build termina sin errores.

- [ ] **Step 3: Recorrido visual**

Con `npm run dev`, en el Browser pane, recorrer `/login`, `/`, `/clientes`, `/clientes/nuevo`, una ficha (las 4 pestañas), `/investigar`, un `/jobs/<id>` de cada tipo y `/entregables`:
- a 1440 px y a 390 px (`resize_window`),
- en claro y en oscuro con el switch.

Comprobar en cada una: sin desbordamiento horizontal; el logo se ve en ambos temas; la barra de pestañas no tapa contenido en 390 px; recargar en oscuro no parpadea en claro; con el switch sin tocar (borrar `localStorage['wozial-tema']`) sigue a `colorScheme` emulado. Tab recorre todo con foco visible.

- [ ] **Step 4: Restablecer el navegador**

`resize_window` con `preset: "desktop"`.

- [ ] **Step 5: Informe al usuario**

Resumir qué cambió, el número de tests, las capturas relevantes y los dos bugs corregidos. Recordar que todo está en `feat/rediseno` **sin subir** y preguntar si quiere revisarlo en local o que se prepare el merge y el despliegue.

---

## Cobertura del spec

| Spec | Tarea |
|---|---|
| §2 Tokens, contraste AA | 1, 7 |
| §3 Tema, switch, sin destello, logo | 2, 7, 8, 10, 11 |
| §4 Barra lateral, pestañas móviles, rutas | 10, 12, 17 |
| §5 Login | 11 |
| §5 Tablero | 4, 12 |
| §5 Lista con chips y búsqueda | 3, 4, 12 |
| §5 Alta | 13 |
| §5 Ficha: acciones, ⋯, pestañas con hash, historial corregido, toasts | 14 |
| §5 Investigar | 15 |
| §5 Progreso y bug de Growth | 5, 16 |
| §5 Entregables | 17 |
| §6 Paleta ⌘K y `GET /api/clientes` | 6, 9 |
| §6 Toasts, vacíos, iniciales y tinte, accesibilidad | 3, 7, 8, 12–17 |
| §7 Clases compatibles | 7 |
| §8 Bordes | 2 (storage bloqueado), 7 (color-mix), 8 (portapapeles), 9 (fallo de lista), 5 y 16 (sin startedAt, tipo desconocido) |
| §9 Pruebas | 1–6, 18 |
| §10 Sin despliegue | Restricciones globales, 18 |
