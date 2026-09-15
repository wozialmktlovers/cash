# Investigación para el cliente final · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir la etapa «Lectura para cliente» (lenguaje sencillo) al pipeline de investigación, convertir las investigaciones existentes al arrancar, y sustituir el deck horizontal por una página continua con el sistema visual del Studio.

**Architecture:** Un agente nuevo (`src/research/agents/lectura.ts`) produce un JSON validado por `lecturaSchema`, que incluye un filtro de jerga. El pipeline lo corre como sexta etapa y un módulo de conversión lo aplica a filas antiguas desde el worker. El render nuevo vive en `src/render/investigacion/`: incrusta `tokens.css` como texto y reutiliza `SCRIPT_TEMA`, y el deck antiguo se elimina.

**Tech Stack:** Astro 7.2.1 SSR, TypeScript, Zod 4.4.3, Vitest 4.1.10, @anthropic-ai/sdk, Drizzle 0.45.2.

**Spec:** `docs/superpowers/specs/2026-09-15-investigacion-cliente-design.md`

## Global Constraints

- Rama `feat/rediseno`. **Nunca `git push` ni despliegue** sin visto bueno explícito del usuario.
- Nunca escribir ni imprimir valores de `.env`; nunca pedir la `ANTHROPIC_API_KEY`. El repo es público.
- `node_modules` es un enlace a `node_modules.nosync/` (iCloud). **Nunca correr `npm ci` ni `npm install`.**
- El usuario tiene `astro dev` en el puerto 4321: no detenerlo ni correr `astro dev stop`.
- Nunca hacer POST a `/api/jobs` ni correr agentes reales: gasta dinero. Las pruebas usan funciones puras o dobles inyectados.
- Comentarios en español, explicando el porqué. Sin `alert()`.
- Cada commit termina con una línea en blanco y `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `npm test` y `npm run build` deben pasar al final de cada tarea.
- Todo texto que venga del modelo pasa por `escapar` antes de tocar el HTML; las URL de fuente que no sean http(s) se sustituyen por `#`.
- Jerga prohibida, exactamente: `buyer persona`, `funnel`, `embudo`, `CTA`, `call to action`, `engagement`, `target`, `insight`, `lead`, `leads`, `KPI`, `ROI`, `awareness`, `branding`, `copy`, `benchmark`, `nicho`, `segmento`, `touchpoint`, `conversión`, `conversiones`, `retargeting`, `remarketing`, `SEO`, `SEM`, `B2B`, `B2C`, `pain point`, `stakeholder`.

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/research/jerga.ts` | Crear | Lista de jerga y detector sin acentos |
| `src/research/schemas.ts` | Modificar | `lecturaSchema`, `lectura` opcional en `investigacionSchema` |
| `src/research/agents/lectura.ts` | Crear | Sistema, armado de entrada y llamada al modelo |
| `src/research/pipeline.ts` | Modificar | `lectura` como sexta etapa |
| `src/lib/ui/progreso.ts` | Modificar | Etapa visible «Lectura para cliente» |
| `src/research/convertir-lecturas.ts` | Crear | Conversión de filas existentes |
| `src/research/worker.ts` | Modificar | Disparar la conversión al arrancar |
| `src/render/escapar.ts` | Crear | `escapar`, compartido |
| `src/render/investigacion/comunes.ts` | Crear | Fuente, lista, tabla |
| `src/render/investigacion/estilos.ts` | Crear | CSS del documento con tokens incrustados |
| `src/render/investigacion/lectura.ts` | Crear | Secciones de la lectura |
| `src/render/investigacion/detalle.ts` | Crear | Detalle técnico y síntesis de respaldo |
| `src/render/investigacion/documento.ts` | Crear | Documento HTML completo e interacción |
| `src/render/barra-operador.ts` | Modificar | Desplazamiento y colores para el documento nuevo |
| `src/pages/resultados/[id].astro`, `src/lib/documento-publico.ts` | Modificar | Usar el render nuevo |
| `src/render/presentation.ts`, `estilos.ts`, `navegacion.ts`, `panels/` | Eliminar | Deck antiguo |
| `tests/fixtures/lectura-ejemplo.json` | Crear | Lectura válida de ejemplo |

---

### Task 1: Esquema de la lectura con filtro de jerga

**Files:**
- Create: `src/research/jerga.ts`
- Modify: `src/research/schemas.ts`
- Create: `tests/fixtures/lectura-ejemplo.json`
- Test: `tests/research/lectura-schema.test.ts`

**Interfaces:**
- Produces: `JERGA_PROHIBIDA: readonly string[]`, `detectarJerga(valor: unknown): string[]` (términos originales encontrados, sin repetir); `lecturaSchema`, tipo `Lectura`; `investigacionSchema` con `lectura` opcional.

- [ ] **Step 1: Crear el fixture**

`tests/fixtures/lectura-ejemplo.json`:
```json
{
  "portada": {
    "titular": "Tu diplomado vale lo que cuesta, pero hoy se explica con el argumento equivocado",
    "resumen": "Revisamos a tu competencia, a tus posibles alumnas y el mercado laboral de la cosmiatría en México. La conclusión es clara: no vendas el diploma, vende lo que tus egresadas pueden llegar a ganar."
  },
  "descubrimos": [
    { "tipo": "cuidar", "titulo": "El diploma no puede ser tu argumento principal", "explicacion": "Hay un diplomado en línea con avales oficiales que cuesta $3,450. El tuyo cuesta $36,792. Si solo hablas del papel, la persona interesada encontrará algo parecido por mucho menos." },
    { "tipo": "a_favor", "titulo": "Lo que ganan tus egresadas sí justifica el precio", "explicacion": "El sector paga $6,480 al mes en promedio, pero los empleos formales que piden una cosmiatra certificada pagan de $10,000 a $18,000. Esa diferencia se comprueba con datos oficiales." },
    { "tipo": "cuidar", "titulo": "Tus planes de pago premian al que paga más lento", "explicacion": "Pagar en 12 mensualidades sale $1,416 más barato que pagar en 8. Eso anima justo la opción con más riesgo de pagos atrasados." },
    { "tipo": "oportunidad", "titulo": "Nadie en México enseña a conseguir clientas", "explicacion": "Todas las escuelas enseñan la técnica. Ninguna escuela mexicana enseña a llenar la agenda y cobrar bien. Ese lugar está libre." }
  ],
  "clienteIdeal": {
    "quienEs": "Es una mujer de 28 a 45 años que ya trabaja en belleza, como esteticista o cosmetóloga. Tiene ingresos propios, pero siente que llegó a su techo y quiere cobrar más por un trabajo más especializado.",
    "lePreocupa": ["Invertir mucho dinero y no recuperarlo", "Que el diploma no le sirva para conseguir mejores clientas", "No tener tiempo para estudiar mientras trabaja"],
    "quiereLograr": ["Cobrar más por cada servicio", "Que la reconozcan como profesional seria", "Tener la agenda llena sin depender de descuentos"],
    "perfiles": [
      { "nombre": "Mariana", "descripcion": "34 años. Ya trabaja en cabina y tiene clientas fijas, pero sus ingresos no crecen desde hace años.", "comoHablarle": "Muéstrale con números cuánto más puede cobrar y en cuánto tiempo recupera lo que invierte." },
      { "nombre": "Laura", "descripcion": "27 años. Terminó un curso corto y todavía no tiene clientas constantes. Duda si dar el siguiente paso.", "comoHablarle": "Háblale de acompañamiento y de cómo conseguir sus primeras clientas, no solo de la técnica." }
    ]
  },
  "recomendamos": {
    "pasos": [
      { "titulo": "Cambia el mensaje principal", "queHacer": "Deja de presentar el diplomado como un papel con validez oficial y preséntalo como el camino para ganar de $10,000 a $18,000 al mes.", "porQue": "Es el argumento que la competencia barata no puede igualar." },
      { "titulo": "Empieza por quienes ya te siguen", "queHacer": "Ofrece el diplomado primero a las personas que ya siguen tu trabajo y asisten a tus clases gratuitas.", "porQue": "Ya te conocen y confían en ti, así que deciden más rápido." },
      { "titulo": "Ajusta los planes de pago", "queHacer": "Haz que pagar en menos mensualidades sea la opción más conveniente.", "porQue": "Hoy el plan más lento es el más barato y eso te expone a pagos que no llegan." },
      { "titulo": "Enseña también a conseguir clientas", "queHacer": "Agrega al diplomado una parte sobre cómo llenar la agenda y fijar precios.", "porQue": "Nadie en México lo ofrece y es justo lo que tus alumnas quieren lograr." }
    ],
    "dondeAnunciarte": [
      { "canal": "Instagram", "porQue": "Es donde ya está tu comunidad y donde las profesionales de belleza muestran su trabajo." },
      { "canal": "Facebook", "porQue": "Llega a mujeres de 28 a 45 años que ya trabajan en el oficio." }
    ],
    "precio": "Mantén el precio de $36,792 y justifícalo con lo que tus egresadas pueden ganar, no con el diploma."
  },
  "faltaConfirmar": [
    "Los dos perfiles se construyeron con datos del mercado; conviene confirmarlos platicando con 5 a 8 alumnas actuales.",
    "Las cifras de redes sociales son de 2024 y pueden haber cambiado."
  ]
}
```

- [ ] **Step 2: Escribir la prueba**

`tests/research/lectura-schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { detectarJerga, JERGA_PROHIBIDA } from '@/research/jerga';
import { lecturaSchema, investigacionSchema } from '@/research/schemas';
import lectura from '../fixtures/lectura-ejemplo.json';
import completa from '../fixtures/investigacion-completa.json';

const copia = () => JSON.parse(JSON.stringify(lectura));

describe('detectarJerga', () => {
  it('encuentra términos sin importar mayúsculas ni acentos, en objetos anidados', () => {
    expect(detectarJerga({ a: ['Mejora tu ENGAGEMENT'], b: { c: 'más conversion' } })).toEqual(['engagement', 'conversión']);
  });
  it('solo cuenta palabras completas', () => {
    expect(detectarJerga('Liderazgo y copyright')).toEqual([]);
    expect(detectarJerga('Buen copy')).toEqual(['copy']);
  });
  it('detecta frases de varias palabras', () => {
    expect(detectarJerga('Tu buyer persona ideal')).toEqual(['buyer persona']);
  });
  it('no repite términos', () => {
    expect(detectarJerga(['target', 'TARGET'])).toEqual(['target']);
  });
  it('la lista tiene los 29 términos del spec', () => {
    expect(JERGA_PROHIBIDA).toHaveLength(29);
  });
});

describe('lecturaSchema', () => {
  it('acepta la lectura de ejemplo', () => {
    const r = lecturaSchema.safeParse(lectura);
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });

  it('rechaza jerga y nombra el término', () => {
    const l = copia();
    l.recomendamos.pasos[0].queHacer = 'Mejora tu funnel de ventas';
    const r = lecturaSchema.safeParse(l);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('funnel');
  });

  it('exige exactamente dos perfiles y tres preocupaciones', () => {
    const l = copia();
    l.clienteIdeal.perfiles.pop();
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.clienteIdeal.lePreocupa.push('otra');
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('exige de 3 a 4 hallazgos y de 3 a 5 pasos', () => {
    const l = copia();
    l.descubrimos = l.descubrimos.slice(0, 2);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.recomendamos.pasos = m.recomendamos.pasos.slice(0, 2);
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('rechaza textos demasiado largos', () => {
    const l = copia();
    l.portada.titular = 'a'.repeat(161);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
  });

  it('acepta precio null y faltaConfirmar vacío', () => {
    const l = copia();
    l.recomendamos.precio = null;
    l.faltaConfirmar = [];
    expect(lecturaSchema.safeParse(l).success).toBe(true);
  });
});

describe('investigacionSchema con lectura', () => {
  it('sigue aceptando investigaciones sin lectura', () => {
    expect(investigacionSchema.safeParse(completa).success).toBe(true);
  });
  it('acepta la lectura como etapa ok o vacía', () => {
    expect(investigacionSchema.safeParse({ ...completa, lectura: { estado: 'ok', datos: lectura } }).success).toBe(true);
    expect(investigacionSchema.safeParse({ ...completa, lectura: { estado: 'vacio', razon: 'x' } }).success).toBe(true);
  });
});
```

- [ ] **Step 3: Ver que falla**

Run: `npx vitest run tests/research/lectura-schema.test.ts`
Expected: FAIL, no existe `@/research/jerga`.

- [ ] **Step 4: Implementar `jerga.ts`**

`src/research/jerga.ts`:
```ts
/**
 * Palabras que el cliente final no tiene por qué conocer. Si el modelo las usa,
 * el esquema rechaza la respuesta y el reintento recibe la lista: es más fiable
 * que confiar en que el prompt baste.
 */
export const JERGA_PROHIBIDA = [
  'buyer persona', 'funnel', 'embudo', 'CTA', 'call to action', 'engagement', 'target',
  'insight', 'lead', 'leads', 'KPI', 'ROI', 'awareness', 'branding', 'copy', 'benchmark',
  'nicho', 'segmento', 'touchpoint', 'conversión', 'conversiones', 'retargeting',
  'remarketing', 'SEO', 'SEM', 'B2B', 'B2C', 'pain point', 'stakeholder',
] as const;

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

const escaparRegex = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Palabra completa: ni letra ni dígito a los lados, para que «copyright» no cuente como «copy».
const PATRONES = JERGA_PROHIBIDA.map((termino) => ({
  termino,
  regex: new RegExp(`(^|[^\\p{L}\\p{N}])${escaparRegex(normalizar(termino))}(?=$|[^\\p{L}\\p{N}])`, 'u'),
}));

function textos(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor);
  else if (Array.isArray(valor)) valor.forEach((v) => textos(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => textos(v, salida));
  return salida;
}

export function detectarJerga(valor: unknown): string[] {
  const todo = normalizar(textos(valor).join('\n'));
  return PATRONES.filter((p) => p.regex.test(todo)).map((p) => p.termino);
}
```

Nota: `detectarJerga` devuelve los términos en el orden de `JERGA_PROHIBIDA`, no en el orden en que aparecen. La prueba de `['engagement', 'conversión']` respeta ese orden.

- [ ] **Step 5: Añadir el esquema en `schemas.ts`**

Añadir el import al inicio de `src/research/schemas.ts`:
```ts
import { detectarJerga } from './jerga';
```

Añadir antes de `const etapa = ...`:
```ts
const texto = (max: number) => z.string().min(1).max(max);

/**
 * Lo que lee el cliente final. Los límites son holgados a propósito: fuerzan a
 * sintetizar sin rechazar una respuesta buena por unas palabras de más.
 */
export const lecturaSchema = z.object({
  portada: z.object({ titular: texto(160), resumen: texto(500) }),
  descubrimos: z.array(z.object({
    tipo: z.enum(['a_favor', 'cuidar', 'oportunidad']),
    titulo: texto(100),
    explicacion: texto(500),
  })).min(3).max(4),
  clienteIdeal: z.object({
    quienEs: texto(700),
    lePreocupa: z.array(texto(200)).length(3),
    quiereLograr: z.array(texto(200)).length(3),
    perfiles: z.array(z.object({
      nombre: texto(50),
      descripcion: texto(320),
      comoHablarle: texto(320),
    })).length(2),
  }),
  recomendamos: z.object({
    pasos: z.array(z.object({ titulo: texto(100), queHacer: texto(420), porQue: texto(360) })).min(3).max(5),
    dondeAnunciarte: z.array(z.object({ canal: texto(50), porQue: texto(280) })).min(1).max(4),
    precio: texto(500).nullable(),
  }),
  faltaConfirmar: z.array(texto(240)).max(5),
}).superRefine((lectura, ctx) => {
  const halladas = detectarJerga(lectura);
  if (halladas.length) {
    ctx.addIssue({
      code: 'custom',
      message: `Hay jerga que el cliente no entiende: ${halladas.join(', ')}. Explícalo con palabras de todos los días.`,
    });
  }
});
```

En `investigacionSchema`, añadir la línea después de `sintesis`:
```ts
  // Opcional: las investigaciones anteriores a esta etapa no la traen.
  lectura: etapa(lecturaSchema).optional(),
```

Y al final de los tipos:
```ts
export type Lectura = z.infer<typeof lecturaSchema>;
```

- [ ] **Step 6: Ver que pasa**

Run: `npx vitest run tests/research/lectura-schema.test.ts`
Expected: PASS (13 tests). Luego `npm test` completo en verde.

- [ ] **Step 7: Commit**

```bash
git add src/research/jerga.ts src/research/schemas.ts tests/fixtures/lectura-ejemplo.json tests/research/lectura-schema.test.ts
git commit -m "feat(investigación): esquema de la lectura para cliente con filtro de jerga

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Agente «Lectura para cliente»

**Files:**
- Create: `src/research/agents/lectura.ts`
- Test: `tests/research/lectura-agente.test.ts`

**Interfaces:**
- Consumes: `lecturaSchema`, tipos `Lectura`, `Competencia`, `Audiencia`, `Canales`, `Mercado`, `Sintesis` (Task 1 y existentes); `pedirJson` de `@/research/claude`; `JERGA_PROHIBIDA`.
- Produces: `type PreviosLectura = { competencia?: Competencia; audiencia?: Audiencia; canales?: Canales; mercado?: Mercado; sintesis?: Sintesis }`; `SISTEMA_LECTURA: string`; `armarEntradaLectura(ctx: string, previos: PreviosLectura): string`; `correrLectura(ctx: string, previos: PreviosLectura, onUso?: (e: number, s: number) => boolean): Promise<{ datos: Lectura; tokensEntrada: number; tokensSalida: number }>`.

- [ ] **Step 1: Escribir la prueba**

`tests/research/lectura-agente.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { armarEntradaLectura, SISTEMA_LECTURA } from '@/research/agents/lectura';
import { JERGA_PROHIBIDA } from '@/research/jerga';
import completa from '../fixtures/investigacion-completa.json';

const c = completa as any;

describe('entrada del redactor', () => {
  it('incluye el contexto y las etapas con datos', () => {
    const e = armarEntradaLectura('## Cliente\nAna', { competencia: c.competencia.datos, sintesis: c.sintesis.datos });
    expect(e).toContain('## Cliente');
    expect(e).toContain('### Competencia');
    expect(e).toContain('### Síntesis estratégica');
    expect(e).toContain(JSON.stringify(c.competencia.datos, null, 2));
  });

  it('declara las etapas sin datos para que no las rellene', () => {
    const e = armarEntradaLectura('ctx', { competencia: c.competencia.datos });
    expect(e).toContain('## Temas sin datos');
    for (const nombre of ['Audiencia', 'Canales', 'Mercado', 'Síntesis estratégica']) expect(e).toContain(`- ${nombre}`);
    expect(e).toContain('faltaConfirmar');
  });

  it('sin huecos no agrega la sección de temas sin datos', () => {
    const e = armarEntradaLectura('ctx', {
      competencia: c.competencia.datos, audiencia: c.audiencia.datos, canales: c.canales.datos,
      mercado: c.mercado.datos, sintesis: c.sintesis.datos,
    });
    expect(e).not.toContain('## Temas sin datos');
  });

  it('describe la forma exacta del JSON', () => {
    const e = armarEntradaLectura('ctx', {});
    for (const campo of ['portada', 'descubrimos', 'clienteIdeal', 'lePreocupa', 'quiereLograr', 'perfiles', 'comoHablarle', 'recomendamos', 'dondeAnunciarte', 'faltaConfirmar']) {
      expect(e).toContain(campo);
    }
  });
});

describe('sistema del redactor', () => {
  it('fija las reglas clave', () => {
    expect(SISTEMA_LECTURA).toContain('tú');
    expect(SISTEMA_LECTURA.toLowerCase()).toContain('no inventes');
    expect(SISTEMA_LECTURA).toContain('JSON');
  });
  it('lista toda la jerga prohibida', () => {
    for (const t of JERGA_PROHIBIDA) expect(SISTEMA_LECTURA).toContain(t);
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/research/lectura-agente.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar**

`src/research/agents/lectura.ts`:
```ts
import {
  lecturaSchema, type Lectura, type Competencia, type Audiencia, type Canales, type Mercado, type Sintesis,
} from '@/research/schemas';
import { pedirJson } from '@/research/claude';
import { JERGA_PROHIBIDA } from '@/research/jerga';

export type PreviosLectura = {
  competencia?: Competencia;
  audiencia?: Audiencia;
  canales?: Canales;
  mercado?: Mercado;
  sintesis?: Sintesis;
};

export const SISTEMA_LECTURA = `Eres consultor de una agencia mexicana de marketing. Recibes una investigación de mercado ya hecha y la explicas al dueño del negocio, que no sabe nada de marketing.

Cómo escribes:
- Le hablas de tú, con frases cortas y una idea por frase.
- Tono seguro y concreto, como un consultor que explica sin presumir. Nada de rellenos, frases motivacionales ni signos de exclamación.
- Nunca usas estas palabras, ni en inglés ni en español: ${JERGA_PROHIBIDA.join(', ')}. Si una idea técnica es necesaria, la explicas con palabras de todos los días.

Reglas que no se rompen:
- No inventes nada. Usa solo lo que trae la investigación y conserva las cifras tal como vienen.
- Si un tema no tiene datos, no lo rellenes: menciónalo en faltaConfirmar.
- precio es null si la investigación no sustenta una recomendación de precio.
- Cada hallazgo se marca como a_favor (lo que ya juega a su favor), cuidar (un riesgo o error que corregir) u oportunidad.
- Los pasos son acciones concretas que el dueño puede entender y decidir, en orden de importancia.
- Responde solo con JSON válido, sin texto antes ni después.`;

const NOMBRES: Record<keyof PreviosLectura, string> = {
  competencia: 'Competencia',
  audiencia: 'Audiencia',
  canales: 'Canales',
  mercado: 'Mercado',
  sintesis: 'Síntesis estratégica',
};

// El esquema no viaja al modelo por sí solo: se le describe la forma exacta
// para que el primer intento ya cumpla y no se pague un reintento.
const FORMA = `{
  "portada": { "titular": "una frase, máx. 160 caracteres", "resumen": "2 o 3 frases, máx. 500" },
  "descubrimos": [ { "tipo": "a_favor | cuidar | oportunidad", "titulo": "máx. 100", "explicacion": "máx. 500" } ],   // 3 o 4
  "clienteIdeal": {
    "quienEs": "un párrafo, máx. 700",
    "lePreocupa": ["exactamente 3, máx. 200 cada uno"],
    "quiereLograr": ["exactamente 3, máx. 200 cada uno"],
    "perfiles": [ { "nombre": "máx. 50", "descripcion": "máx. 320", "comoHablarle": "máx. 320" } ]   // exactamente 2
  },
  "recomendamos": {
    "pasos": [ { "titulo": "máx. 100", "queHacer": "máx. 420", "porQue": "máx. 360" } ],   // 3 a 5
    "dondeAnunciarte": [ { "canal": "máx. 50", "porQue": "máx. 280" } ],   // 1 a 4
    "precio": "máx. 500, o null"
  },
  "faltaConfirmar": ["máx. 240 cada uno"]   // 0 a 5
}`;

export function armarEntradaLectura(ctx: string, previos: PreviosLectura): string {
  const claves = Object.keys(NOMBRES) as Array<keyof PreviosLectura>;
  const bloques = claves
    .filter((k) => previos[k])
    .map((k) => `### ${NOMBRES[k]}\n${JSON.stringify(previos[k], null, 2)}`)
    .join('\n\n');
  const faltantes = claves.filter((k) => !previos[k]).map((k) => `- ${NOMBRES[k]}`);

  const huecos = faltantes.length
    ? `\n\n## Temas sin datos\n${faltantes.join('\n')}\nNo los rellenes: menciónalos en faltaConfirmar.`
    : '';

  return `${ctx}\n\n## Lo que ya se investigó\n${bloques || '(nada)'}${huecos}\n\nDevuelve el JSON de la lectura para el cliente con esta forma:\n${FORMA}`;
}

export async function correrLectura(
  ctx: string,
  previos: PreviosLectura,
  onUso?: (e: number, s: number) => boolean,
) {
  return pedirJson<Lectura>({
    modelo: process.env.MODEL_SYNTHESIS || 'claude-opus-5',
    sistema: SISTEMA_LECTURA,
    usuario: armarEntradaLectura(ctx, previos),
    schema: lecturaSchema,
    buscarWeb: false,
    onUso,
    // En Opus 5 el razonamiento consume del mismo presupuesto que el texto.
    maxTokens: 24_000,
  });
}
```

- [ ] **Step 4: Ver que pasa**

Run: `npx vitest run tests/research/lectura-agente.test.ts`
Expected: PASS (6 tests). Luego `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/research/agents/lectura.ts tests/research/lectura-agente.test.ts
git commit -m "feat(investigación): agente que redacta la lectura para el cliente

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La lectura como sexta etapa del pipeline

**Files:**
- Modify: `src/research/pipeline.ts`
- Modify: `src/lib/ui/progreso.ts`
- Modify: `tests/research/pipeline.test.ts`
- Modify: `tests/lib/ui/progreso.test.ts`

**Interfaces:**
- Consumes: `correrLectura` (Task 2).
- Produces: `ETAPAS = ['competencia','audiencia','canales','mercado','sintesis','lectura']`; `hayDatosParaLectura(resultados: Record<string, unknown>): boolean`; etapa de UI `{ clave: 'lectura', titulo: 'Lectura para cliente', ... }`.

- [ ] **Step 1: Actualizar las pruebas**

En `tests/research/pipeline.test.ts`, importar `hayDatosParaLectura` junto a los imports existentes de `@/research/pipeline`. Cambiar el caso de estado vacío:
```ts
  it('con estado vacío corre las seis', () => {
    expect(decidirEtapasPendientes({})).toHaveLength(6);
  });
```
Añadir al final:
```ts
describe('lectura para cliente', () => {
  it('es la última etapa', () => {
    expect(ETAPAS[ETAPAS.length - 1]).toBe('lectura');
  });
  it('corre si al menos una etapa previa trajo datos', () => {
    expect(hayDatosParaLectura({ mercado: { datos: [] } })).toBe(true);
    expect(hayDatosParaLectura({ sintesis: {} })).toBe(true);
  });
  it('no corre sin datos previos', () => {
    expect(hayDatosParaLectura({})).toBe(false);
    expect(hayDatosParaLectura({ lectura: {} })).toBe(false);
  });
});
```
(Si `ETAPAS` no está importado en ese archivo, añadirlo al import.)

En `tests/lib/ui/progreso.test.ts`, cambiar la expectativa de investigación:
```ts
    expect(porcentaje({ competencia: 'ok', audiencia: 'fallo' }, 'research')).toBe(17);
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/research/pipeline.test.ts tests/lib/ui/progreso.test.ts`
Expected: FAIL (seis etapas, `hayDatosParaLectura` inexistente, 17 contra 20).

- [ ] **Step 3: Implementar en `pipeline.ts`**

Import:
```ts
import { correrLectura } from './agents/lectura';
```
Cambiar la constante:
```ts
export const ETAPAS = ['competencia','audiencia','canales','mercado','sintesis','lectura'] as const;
```
Añadir después de `superaTope`:
```ts
const PREVIAS_A_LECTURA = ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis'];

/** La lectura reescribe lo investigado: sin nada investigado no hay qué explicar. */
export function hayDatosParaLectura(resultados: Record<string, unknown>): boolean {
  return PREVIAS_A_LECTURA.some((k) => Boolean(resultados[k]));
}
```
En `corredores`, añadir:
```ts
    lectura:     () => correrLectura(ctx, resultados as any, vigilar(modeloSin)),
```
Cambiar el filtro de paralelas para excluir también la lectura:
```ts
  const paralelas = pendientes.filter((e) => e !== 'sintesis' && e !== 'lectura');
```
Justo después del bloque `if (pendientes.includes('sintesis')) { ... }` y antes de `// Se arma el resultado...`, añadir:
```ts
  // La lectura para el cliente espera a la síntesis y reescribe todo lo anterior.
  if (pendientes.includes('lectura') && hayDatosParaLectura(resultados)) {
    if (superaTope(gasto.valor, tope)) {
      estado.lectura = 'omitido_por_costo';
    } else {
      estado.lectura = 'corriendo';
      await db.update(researchJobs).set({ etapaActual: 'lectura', etapas: estado }).where(eq(researchJobs.id, jobId));
      try {
        const r = await corredores.lectura();
        resultados.lectura = r.datos;
        tIn += r.tokensEntrada; tOut += r.tokensSalida;
        estado.lectura = 'ok';
      } catch (e) {
        estado.lectura = 'fallo';
        console.error(`[${jobId}] lectura:`, e);
      }
    }
  }
```

- [ ] **Step 4: Implementar en `progreso.ts`**

En `src/lib/ui/progreso.ts`, añadir al final del arreglo `INVESTIGACION`:
```ts
  { clave: 'lectura', titulo: 'Lectura para cliente', detalle: 'Versión en lenguaje sencillo para tu cliente. Espera a la síntesis.' },
```

- [ ] **Step 5: Ver que pasan**

Run: `npx vitest run tests/research/pipeline.test.ts tests/lib/ui/progreso.test.ts`, luego `npm test` y `npm run build`.
Expected: todo en verde. La prueba existente de `etapasDe('research')` contra `ETAPAS` pasa porque ambas listas tienen seis etapas.

- [ ] **Step 6: Commit**

```bash
git add src/research/pipeline.ts src/lib/ui/progreso.ts tests/research/pipeline.test.ts tests/lib/ui/progreso.test.ts
git commit -m "feat(investigación): la lectura para cliente corre como sexta etapa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Conversión automática de investigaciones existentes

**Files:**
- Create: `src/research/convertir-lecturas.ts`
- Modify: `src/research/worker.ts`
- Test: `tests/research/convertir-lecturas.test.ts`

**Interfaces:**
- Consumes: `correrLectura`, `PreviosLectura` (Task 2); `armarContexto` de `./contexto`; `calcularCosto` de `@/lib/cost`.
- Produces: `necesitaLectura(datos: unknown): boolean`; `esRespuestaInvalida(error: unknown): boolean`; `previosDesde(datos: unknown): PreviosLectura`; `convertirLecturasPendientes(opciones?: { correr?; tope?: number; modelo?: string; log?: (m: string) => void }): Promise<{ convertidas: number; invalidas: number; pendientes: number; gasto: number }>`.

- [ ] **Step 1: Escribir la prueba**

`tests/research/convertir-lecturas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { necesitaLectura, esRespuestaInvalida, previosDesde } from '@/research/convertir-lecturas';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

const vacia = {
  competencia: { estado: 'vacio', razon: 'x' }, audiencia: { estado: 'vacio', razon: 'x' },
  canales: { estado: 'vacio', razon: 'x' }, mercado: { estado: 'vacio', razon: 'x' }, sintesis: { estado: 'vacio', razon: 'x' },
};

describe('necesitaLectura', () => {
  it('sí, si no tiene lectura y alguna etapa trae datos', () => {
    expect(necesitaLectura(completa)).toBe(true);
    expect(necesitaLectura(parcial)).toBe(true);
  });
  it('no, si ya tiene lectura, aunque sea vacía', () => {
    expect(necesitaLectura({ ...completa, lectura: { estado: 'ok', datos: {} } })).toBe(false);
    expect(necesitaLectura({ ...completa, lectura: { estado: 'vacio', razon: 'x' } })).toBe(false);
  });
  it('no, si ninguna etapa trajo datos o los datos no son objeto', () => {
    expect(necesitaLectura(vacia)).toBe(false);
    expect(necesitaLectura(null)).toBe(false);
    expect(necesitaLectura('x')).toBe(false);
  });
});

describe('esRespuestaInvalida', () => {
  it('distingue una respuesta que no cumplió el esquema', () => {
    expect(esRespuestaInvalida(new Error('El modelo no devolvió JSON válido tras dos intentos. Último error: jerga'))).toBe(true);
    expect(esRespuestaInvalida(new Error('El modelo declinó la petición (x).'))).toBe(true);
  });
  it('trata todo lo demás como error de API que se reintenta después', () => {
    expect(esRespuestaInvalida(new Error('400 credit balance is too low'))).toBe(false);
    expect(esRespuestaInvalida(new Error('fetch failed'))).toBe(false);
    expect(esRespuestaInvalida('texto')).toBe(false);
  });
});

describe('previosDesde', () => {
  it('toma solo los datos de las etapas ok', () => {
    const p = previosDesde(parcial);
    expect(Object.keys(p)).toEqual(['competencia']);
    expect(p.competencia).toEqual((parcial as any).competencia.datos);
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/research/convertir-lecturas.test.ts`
Expected: FAIL, no existe el módulo.

- [ ] **Step 3: Implementar**

`src/research/convertir-lecturas.ts`:
```ts
import { eq } from 'drizzle-orm';
import { db, researchResults, clients, clientLinks, clientFiles } from '@/db';
import { armarContexto } from './contexto';
import { correrLectura, type PreviosLectura } from './agents/lectura';
import { calcularCosto } from '@/lib/cost';

const ORIGINALES = ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis'] as const;

/**
 * Una fila se convierte si nunca tuvo lectura y hay algo que explicar. Una
 * lectura vacía ya es una decisión tomada: reintentarla gastaría en cada arranque.
 */
export function necesitaLectura(datos: unknown): boolean {
  if (!datos || typeof datos !== 'object') return false;
  const d = datos as Record<string, any>;
  if (d.lectura) return false;
  return ORIGINALES.some((k) => d[k]?.estado === 'ok');
}

/**
 * La respuesta llegó pero no sirve: no mejora reintentándola mañana. Cualquier
 * otro error (saldo, red, 5xx) sí puede resolverse solo, así que se reintenta.
 */
export function esRespuestaInvalida(error: unknown): boolean {
  const m = error instanceof Error ? error.message : '';
  return m.includes('no devolvió JSON válido') || m.includes('declinó');
}

export function previosDesde(datos: unknown): PreviosLectura {
  const d = (datos ?? {}) as Record<string, any>;
  return Object.fromEntries(
    ORIGINALES.filter((k) => d[k]?.estado === 'ok').map((k) => [k, d[k].datos]),
  ) as PreviosLectura;
}

export async function convertirLecturasPendientes(opciones: {
  correr?: typeof correrLectura;
  tope?: number;
  modelo?: string;
  log?: (m: string) => void;
} = {}) {
  const correr = opciones.correr ?? correrLectura;
  const tope = opciones.tope ?? Number(process.env.COST_LIMIT_CONVERSION_USD || 10);
  const modelo = opciones.modelo ?? (process.env.MODEL_SYNTHESIS || 'claude-opus-5');
  const log = opciones.log ?? ((m: string) => console.log(m));

  const filas = await db.select({ id: researchResults.id, clientId: researchResults.clientId, datos: researchResults.datos })
    .from(researchResults);
  const pendientes = filas.filter((f) => necesitaLectura(f.datos));

  let gasto = 0, convertidas = 0, invalidas = 0;

  for (const fila of pendientes) {
    if (gasto >= tope) break;

    const [cliente] = await db.select().from(clients).where(eq(clients.id, fila.clientId)).limit(1);
    if (!cliente) continue;
    const links = await db.select().from(clientLinks).where(eq(clientLinks.clientId, fila.clientId));
    const archivos = await db.select().from(clientFiles).where(eq(clientFiles.clientId, fila.clientId));
    const ctx = armarContexto(cliente, links, archivos);
    const datos = fila.datos as Record<string, unknown>;

    try {
      const r = await correr(ctx, previosDesde(datos), (e, s) => {
        gasto += calcularCosto(modelo, e, s);
        return gasto < tope;
      });
      await db.update(researchResults)
        .set({ datos: { ...datos, lectura: { estado: 'ok', datos: r.datos } } })
        .where(eq(researchResults.id, fila.id));
      convertidas++;
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (esRespuestaInvalida(e)) {
        await db.update(researchResults)
          .set({ datos: { ...datos, lectura: { estado: 'vacio', razon: 'No se pudo redactar la lectura para el cliente.' } } })
          .where(eq(researchResults.id, fila.id));
        invalidas++;
        log(`[lecturas] ${fila.id}: respuesta inválida, no se reintentará`);
        continue;
      }
      // Sin saldo o sin red no tiene caso seguir: se reintenta en el siguiente arranque.
      log(`[lecturas] se detiene: ${mensaje}`);
      break;
    }
  }

  const restantes = pendientes.length - convertidas - invalidas;
  log(`[lecturas] convertidas ${convertidas}, inválidas ${invalidas}, pendientes ${restantes}, gasto $${gasto.toFixed(2)} USD`);
  return { convertidas, invalidas, pendientes: restantes, gasto };
}
```

- [ ] **Step 4: Disparar desde el worker**

En `src/research/worker.ts`, añadir el import:
```ts
import { convertirLecturasPendientes } from './convertir-lecturas';
```
Dentro de `arrancarWorker()`, justo antes de `console.log('[worker] iniciado');`:
```ts
  // Las investigaciones anteriores a la lectura para cliente se convierten
  // solas. Espera a que termine el arranque y nunca corre sin llave.
  if (process.env.ANTHROPIC_API_KEY && process.env.CONVERTIR_LECTURAS !== '0') {
    setTimeout(() => {
      void convertirLecturasPendientes().catch((e) => console.error('[lecturas]', e));
    }, 15_000);
  }
```

- [ ] **Step 5: Ver que pasa**

Run: `npx vitest run tests/research/convertir-lecturas.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS (6 tests) y todo en verde.

- [ ] **Step 6: Commit**

```bash
git add src/research/convertir-lecturas.ts src/research/worker.ts tests/research/convertir-lecturas.test.ts
git commit -m "feat(investigación): convertir las investigaciones existentes al arrancar, con tope

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Base del documento continuo

**Files:**
- Create: `src/render/escapar.ts`
- Modify: `src/render/panels/comunes.ts` (reexporta `escapar`)
- Modify: `src/render/barra-operador.ts:1` (import)
- Modify: `src/render/growth/secciones/comunes.ts:1` (import)
- Create: `src/render/investigacion/comunes.ts`
- Create: `src/render/investigacion/estilos.ts`
- Test: `tests/render/investigacion-base.test.ts`

**Interfaces:**
- Produces: `escapar(s: unknown): string` en `@/render/escapar`; en `@/render/investigacion/comunes`: `fuente(f: Fuente): string`, `lista(items: string[]): string`, `tabla(encabezados: string[], filas: string[][]): string` (las celdas ya vienen como HTML seguro), `sinDatos(): string`; `ESTILOS_INVESTIGACION: string` en `@/render/investigacion/estilos`.

- [ ] **Step 1: Escribir la prueba**

`tests/render/investigacion-base.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { escapar } from '@/render/escapar';
import { fuente, lista, tabla, sinDatos } from '@/render/investigacion/comunes';
import { ESTILOS_INVESTIGACION } from '@/render/investigacion/estilos';

describe('comunes del documento', () => {
  it('escapar neutraliza HTML', () => {
    expect(escapar('<a href="x">\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
  });
  it('la fuente muestra el dominio y bloquea esquemas peligrosos', () => {
    const f = fuente({ url: 'https://www.inegi.org.mx/datos', consultado: '2026-08-10' });
    expect(f).toContain('href="https://www.inegi.org.mx/datos"');
    expect(f).toContain('>inegi.org.mx<');
    expect(fuente({ url: 'javascript:alert(1)', consultado: 'x' } as any)).toContain('href="#"');
  });
  it('la fuente escapa URL maliciosas', () => {
    expect(fuente({ url: 'https://x.com/"><script>alert(1)</script>', consultado: 'x' })).not.toContain('<script>');
  });
  it('lista y tabla escapan o respetan el HTML según corresponde', () => {
    expect(lista(['<b>'])).toContain('&lt;b&gt;');
    const t = tabla(['A'], [['<em>ok</em>']]);
    expect(t).toContain('<th>A</th>');
    expect(t).toContain('<em>ok</em>');
    expect(lista([])).toBe('');
  });
  it('sinDatos usa el texto del spec', () => {
    expect(sinDatos()).toContain('No se obtuvo información sobre este tema');
  });
});

describe('estilos del documento', () => {
  it('incrustan los tokens del Studio con sus dos temas', () => {
    expect(ESTILOS_INVESTIGACION).toContain('--rosa');
    expect(ESTILOS_INVESTIGACION).toContain(':root[data-tema="oscuro"]');
  });
  it('no traen restos del deck', () => {
    for (const c of ['.deck', '.panel{', '.dots', '.nav-bar']) expect(ESTILOS_INVESTIGACION).not.toContain(c);
  });
  it('fijan el ancho de lectura y reglas de impresión', () => {
    expect(ESTILOS_INVESTIGACION).toContain('760px');
    expect(ESTILOS_INVESTIGACION).toContain('@media print');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/render/investigacion-base.test.ts`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Mover `escapar`**

`src/render/escapar.ts`:
```ts
/** Toda cadena que venga del modelo pasa por aquí antes de tocar el HTML. */
export function escapar(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```
En `src/render/panels/comunes.ts`, borrar la función `escapar` local y en su lugar:
```ts
import { escapar } from '@/render/escapar';
export { escapar };
```
En `src/render/barra-operador.ts` y `src/render/growth/secciones/comunes.ts`, cambiar `import { escapar } from '@/render/panels/comunes';` por `import { escapar } from '@/render/escapar';`.

- [ ] **Step 4: Crear `investigacion/comunes.ts`**

```ts
import type { Fuente } from '@/research/schemas';
import { escapar } from '@/render/escapar';

export { escapar };

/** Enlace a la fuente con el dominio visible. El href también viene del modelo. */
export function fuente(f: Fuente): string {
  const seguro = /^https?:\/\//i.test(f.url) ? f.url : '#';
  let dominio = 'fuente';
  try {
    if (seguro !== '#') dominio = new URL(seguro).hostname.replace(/^www\./, '');
  } catch { /* URL mal formada: se queda «fuente» */ }
  return `<a class="fuente" href="${escapar(seguro)}" target="_blank" rel="noopener noreferrer">${escapar(dominio)}</a>`;
}

export function lista(items: string[]): string {
  if (!items.length) return '';
  return `<ul class="lista">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

/** Las celdas llegan ya como HTML seguro: quien llama escapa o usa fuente(). */
export function tabla(encabezados: string[], filas: string[][]): string {
  if (!filas.length) return '';
  return `<div class="tabla"><table><thead><tr>${encabezados.map((e) => `<th>${escapar(e)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function sinDatos(): string {
  return '<p class="sin-datos">No se obtuvo información sobre este tema.</p>';
}
```

- [ ] **Step 5: Crear `investigacion/estilos.ts`**

```ts
// Los mismos tokens que el Studio, incrustados como texto: el documento se
// descarga y se imprime suelto, sin la hoja del sitio.
import TOKENS_CSS from '@/styles/tokens.css?raw';

const DOCUMENTO = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:90px;}
body{font:var(--t-body);color:var(--texto);background:var(--fondo);transition:background-color .25s ease,color .25s ease;}
a{color:var(--rosa);}
h1,h2,h3{color:var(--tinta);letter-spacing:var(--tracking-titulo);}
h2{font:var(--t-h1);margin-bottom:18px;}
h3{font:var(--t-h3);letter-spacing:-0.01em;margin-bottom:8px;}
.eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.suave{color:var(--suave);font:var(--t-small);}

.doc-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;
  background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--linea);}
.doc-barra .logo{height:22px;width:auto;filter:brightness(0);}
:root[data-tema="oscuro"] .doc-barra .logo,:root[data-tema="oscuro"] .pie .logo{filter:none;}
.doc-barra .titulo{flex:1;min-width:0;font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.doc-barra .titulo b{color:var(--tinta);font-weight:600;}

.tema-switch{display:inline-flex;padding:3px;gap:2px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);}
.tema-switch button{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--suave);cursor:pointer;display:grid;place-items:center;}
.tema-switch svg{width:18px;height:18px;}
.tema-switch button[aria-checked="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:var(--sombra);}

.doc{max-width:760px;margin:0 auto;padding:40px 16px 64px;}
.doc section{margin-top:56px;}
.portada{margin-top:12px!important;}
.portada h1{font:var(--t-display);margin:12px 0 16px;}
.portada .resumen{font-size:1.08rem;line-height:1.65;color:var(--texto);}
.indice{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;}
.indice a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:var(--r-pill);
  background:var(--gris);border:1px solid var(--linea);color:var(--tinta);text-decoration:none;font:var(--t-small);font-weight:600;}
.indice a:hover{border-color:var(--rosa);color:var(--rosa);}

.tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:22px;box-shadow:var(--sombra);}
.tarjeta+.tarjeta{margin-top:14px;}
.etiqueta{display:inline-flex;font:var(--t-micro);letter-spacing:.04em;padding:5px 10px;border-radius:var(--r-pill);margin-bottom:10px;}
.etiqueta.a_favor{background:var(--verde-s);color:var(--verde);}
.etiqueta.cuidar{background:var(--amarillo-s);color:var(--amarillo);}
.etiqueta.oportunidad{background:var(--rosa-s);color:var(--rosa);}

.columnas{display:grid;gap:14px;grid-template-columns:1fr;margin-top:18px;}
@media (min-width:700px){.columnas{grid-template-columns:1fr 1fr;}}
.columnas .tarjeta+.tarjeta{margin-top:0;}
.lista{list-style:none;display:flex;flex-direction:column;gap:8px;}
.lista li{position:relative;padding-left:18px;}
.lista li::before{content:'';position:absolute;left:0;top:.7em;width:7px;height:7px;border-radius:50%;background:var(--rosa);}

.perfil{display:flex;gap:16px;align-items:flex-start;}
.avatar{flex-shrink:0;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-weight:700;background:var(--azul-s);color:var(--azul);}
.perfil:nth-child(odd) .avatar{background:var(--rosa-s);color:var(--rosa);}
.como-hablarle{margin-top:12px;padding:12px 14px;border-radius:var(--r-sm);background:var(--gris);font:var(--t-small);font-weight:400;}
.como-hablarle b{display:block;color:var(--tinta);margin-bottom:2px;}

.pasos{list-style:none;counter-reset:paso;display:flex;flex-direction:column;gap:14px;}
.paso{counter-increment:paso;display:flex;gap:16px;}
.paso::before{content:counter(paso);flex-shrink:0;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;
  background:var(--rosa);color:var(--sobre-acento);font-weight:700;}
.paso .cuerpo{flex:1;min-width:0;}
.paso dt{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);margin-top:10px;}
.paso dd{margin-top:2px;}
.bloque{margin-top:22px;}

.detalle{margin-top:64px;border-top:1px solid var(--linea);padding-top:24px;}
.detalle>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font:var(--t-h3);color:var(--tinta);list-style:none;}
.detalle>summary::before{content:'+';display:inline-grid;place-items:center;width:28px;height:28px;margin-right:10px;border-radius:50%;background:var(--gris);}
.detalle[open]>summary::before{content:'−';}
.detalle h3{margin-top:32px;}
.detalle h4{font:var(--t-small);font-weight:700;color:var(--tinta);margin:18px 0 8px;}
.tabla{overflow-x:auto;border:1px solid var(--linea);border-radius:var(--r-sm);}
table{width:100%;border-collapse:collapse;font:var(--t-small);font-weight:400;}
th{text-align:left;font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);background:var(--gris);padding:10px 12px;}
td{padding:10px 12px;border-top:1px solid var(--linea);vertical-align:top;}
.fuente{font-size:.8rem;white-space:nowrap;}
.sin-datos{color:var(--suave);font:var(--t-small);}
.cita{border-left:3px solid var(--rosa);padding-left:12px;margin:10px 0;}

.pie{max-width:760px;margin:0 auto;padding:24px 16px 48px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--linea);color:var(--suave);font:var(--t-small);}
.pie .logo{height:18px;width:auto;filter:brightness(0);}

:focus-visible{outline:none;box-shadow:var(--foco);border-radius:var(--r-sm);}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;}html{scroll-behavior:auto;}}
@media print{
  .doc-barra,.tema-switch,#barra-op{display:none!important;}
  body{padding-top:0!important;}
  .tarjeta{box-shadow:none;break-inside:avoid;}
  .doc section{break-inside:avoid-page;}
}
`;

export const ESTILOS_INVESTIGACION = `${TOKENS_CSS}\n${DOCUMENTO}`;
```

- [ ] **Step 6: Ver que pasa**

Run: `npx vitest run tests/render/investigacion-base.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS (8 tests) y todo en verde (las pruebas del deck siguen pasando porque `panels/comunes` reexporta `escapar`).

- [ ] **Step 7: Commit**

```bash
git add src/render/escapar.ts src/render/panels/comunes.ts src/render/barra-operador.ts src/render/growth/secciones/comunes.ts src/render/investigacion/comunes.ts src/render/investigacion/estilos.ts tests/render/investigacion-base.test.ts
git commit -m "feat(investigación): base del documento continuo con los tokens del Studio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Secciones y documento completo

**Files:**
- Create: `src/render/investigacion/lectura.ts`
- Create: `src/render/investigacion/detalle.ts`
- Create: `src/render/investigacion/documento.ts`
- Test: `tests/render/investigacion.test.ts`

**Interfaces:**
- Consumes: `escapar`, `fuente`, `lista`, `tabla`, `sinDatos`, `ESTILOS_INVESTIGACION` (Task 5); `Lectura` y tipos de `@/research/schemas`; `SCRIPT_TEMA`, `COLOR_BARRA` de `@/lib/ui/tema`; `iniciales` de `@/lib/ui/cliente-visual`; `LOGO_WOZIAL_SRC` de `@/render/marca`.
- Produces: `renderizarInvestigacion(inv: Investigacion, meta: { cliente: string; giro: string; fecha: string }, barraOperador?: string): string`; `SCRIPT_DOCUMENTO: string`.

- [ ] **Step 1: Escribir la prueba**

`tests/render/investigacion.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion, SCRIPT_DOCUMENTO } from '@/render/investigacion/documento';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';
import lectura from '../fixtures/lectura-ejemplo.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };
const conLectura = (l: any = lectura) => ({ ...(completa as any), lectura: { estado: 'ok', datos: l } });
const copia = () => JSON.parse(JSON.stringify(lectura));

describe('documento con lectura', () => {
  const html = renderizarInvestigacion(conLectura(), meta);

  it('trae las tres secciones con sus anclas y el índice', () => {
    for (const id of ['descubrimos', 'cliente-ideal', 'recomendamos']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
    }
  });

  it('muestra el contenido de la lectura con sus etiquetas', () => {
    expect(html).toContain((lectura as any).portada.titular);
    expect(html).toContain('A tu favor');
    expect(html).toContain('Hay que cuidar');
    expect(html).toContain('Oportunidad');
    expect(html).toContain('Cómo hablarle');
    expect(html).toContain('Dónde anunciarte');
    expect(html).toContain('Sobre tu precio');
    expect(html).toContain('Lo que falta confirmar');
  });

  it('pliega el detalle técnico', () => {
    expect(html).toMatch(/<details class="detalle">/);
    expect(html).toContain('Ver el detalle de la investigación');
  });

  it('es una página continua, sin restos del deck', () => {
    for (const r of ['class="panel', 'id="deck"', 'id="dots"', 'id="prev"']) expect(html).not.toContain(r);
  });

  it('trae el tema, el switch y el título', () => {
    expect(html).toContain('wozial-tema');
    expect(html).toContain('data-tema-valor="oscuro"');
    expect(html).toContain('<title>Investigación · Ana Villa · Cosmetología</title>');
  });

  it('omite precio y pendientes cuando no hay', () => {
    const l = copia();
    l.recomendamos.precio = null;
    l.faltaConfirmar = [];
    const h = renderizarInvestigacion(conLectura(l), meta);
    expect(h).not.toContain('Sobre tu precio');
    expect(h).not.toContain('Lo que falta confirmar');
  });

  it('escapa el texto de la lectura', () => {
    const l = copia();
    l.portada.titular = '<script>alert(1)</script>';
    const h = renderizarInvestigacion(conLectura(l), meta);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;');
  });
});

describe('documento sin lectura (respaldo)', () => {
  it('muestra la síntesis y el detalle abierto', () => {
    const h = renderizarInvestigacion(completa as any, meta);
    expect(h).not.toContain('id="descubrimos"');
    expect(h).toContain((completa as any).sintesis.datos.hallazgos[0].titulo);
    expect(h).toMatch(/<details class="detalle" open>/);
  });

  it('una lectura vacía también usa el respaldo', () => {
    const h = renderizarInvestigacion({ ...(completa as any), lectura: { estado: 'vacio', razon: 'x' } }, meta);
    expect(h).toMatch(/<details class="detalle" open>/);
  });

  it('declara los temas sin datos sin inventar', () => {
    const h = renderizarInvestigacion(parcial as any, meta);
    expect(h).toContain('No se obtuvo información sobre este tema');
    expect(h).toContain('Instituto Bellezza GDL');
  });

  it('escapa también las URL de las fuentes', () => {
    const c = JSON.parse(JSON.stringify(completa));
    c.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    expect(renderizarInvestigacion(c, meta)).not.toContain('<script>alert(1)</script>');
  });
});

describe('interacción', () => {
  it('el script del documento es JavaScript válido', () => {
    expect(() => new Function(SCRIPT_DOCUMENTO)).not.toThrow();
  });
  it('inyecta la barra de operador cuando se pasa', () => {
    expect(renderizarInvestigacion(completa as any, meta, '<div id="barra-op"></div>')).toContain('id="barra-op"');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/render/investigacion.test.ts`
Expected: FAIL, módulo inexistente.

- [ ] **Step 3: Implementar `lectura.ts`**

`src/render/investigacion/lectura.ts`:
```ts
import type { Lectura } from '@/research/schemas';
import { iniciales } from '@/lib/ui/cliente-visual';
import { escapar, lista } from './comunes';

const ETIQUETA: Record<Lectura['descubrimos'][number]['tipo'], string> = {
  a_favor: 'A tu favor',
  cuidar: 'Hay que cuidar',
  oportunidad: 'Oportunidad',
};

export function seccionPortada(eyebrow: string, titular: string, resumen: string, conIndice: boolean): string {
  const indice = conIndice
    ? `<nav class="indice" aria-label="Contenido">
        <a href="#descubrimos">Qué descubrimos</a>
        <a href="#cliente-ideal">Tu cliente ideal</a>
        <a href="#recomendamos">Qué te recomendamos</a>
      </nav>`
    : '';
  return `<section class="portada">
    <p class="eyebrow">${escapar(eyebrow)}</p>
    <h1>${escapar(titular)}</h1>
    <p class="resumen">${escapar(resumen)}</p>
    ${indice}
  </section>`;
}

export function seccionDescubrimos(l: Lectura): string {
  return `<section id="descubrimos">
    <h2>Qué descubrimos</h2>
    ${l.descubrimos.map((d) => `<article class="tarjeta">
      <span class="etiqueta ${d.tipo}">${ETIQUETA[d.tipo]}</span>
      <h3>${escapar(d.titulo)}</h3>
      <p>${escapar(d.explicacion)}</p>
    </article>`).join('')}
  </section>`;
}

export function seccionClienteIdeal(l: Lectura): string {
  const c = l.clienteIdeal;
  return `<section id="cliente-ideal">
    <h2>Tu cliente ideal</h2>
    <p>${escapar(c.quienEs)}</p>
    <div class="columnas">
      <div class="tarjeta"><h3>Lo que le preocupa</h3>${lista(c.lePreocupa)}</div>
      <div class="tarjeta"><h3>Lo que quiere lograr</h3>${lista(c.quiereLograr)}</div>
    </div>
    <div class="columnas">
      ${c.perfiles.map((p) => `<article class="tarjeta perfil">
        <span class="avatar" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>
        <div>
          <h3>${escapar(p.nombre)}</h3>
          <p>${escapar(p.descripcion)}</p>
          <p class="como-hablarle"><b>Cómo hablarle</b>${escapar(p.comoHablarle)}</p>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionRecomendamos(l: Lectura): string {
  const r = l.recomendamos;
  return `<section id="recomendamos">
    <h2>Qué te recomendamos</h2>
    <ol class="pasos">
      ${r.pasos.map((p) => `<li class="paso"><div class="cuerpo tarjeta">
        <h3>${escapar(p.titulo)}</h3>
        <dl>
          <dt>Qué hacer</dt><dd>${escapar(p.queHacer)}</dd>
          <dt>Por qué</dt><dd>${escapar(p.porQue)}</dd>
        </dl>
      </div></li>`).join('')}
    </ol>
    <div class="bloque tarjeta">
      <h3>Dónde anunciarte</h3>
      <ul class="lista">${r.dondeAnunciarte.map((d) => `<li><b>${escapar(d.canal)}.</b> ${escapar(d.porQue)}</li>`).join('')}</ul>
    </div>
    ${r.precio ? `<div class="bloque tarjeta"><h3>Sobre tu precio</h3><p>${escapar(r.precio)}</p></div>` : ''}
  </section>`;
}

export function seccionFaltaConfirmar(l: Lectura): string {
  if (!l.faltaConfirmar.length) return '';
  return `<section>
    <h3>Lo que falta confirmar</h3>
    <div class="suave">${lista(l.faltaConfirmar)}</div>
  </section>`;
}
```

- [ ] **Step 4: Implementar `detalle.ts`**

`src/render/investigacion/detalle.ts`:
```ts
import type { Investigacion, Competencia, Audiencia, Canales, Mercado, Sintesis, Competidor } from '@/research/schemas';
import { escapar, fuente, lista, tabla, sinDatos } from './comunes';

type Etapa<T> = { estado: 'ok'; datos: T } | { estado: 'vacio'; razon: string } | undefined;
const datos = <T>(e: Etapa<T>): T | null => (e && e.estado === 'ok' ? e.datos : null);

const filaCompetidor = (c: Competidor) =>
  [escapar(c.nombre), escapar(c.producto), escapar(c.precio), escapar(c.modalidad), escapar(c.aval), fuente(c.fuente)];

function competencia(c: Competencia | null): string {
  if (!c) return `<h3>Competencia</h3>${sinDatos()}`;
  const enc = ['Quién', 'Qué ofrece', 'Precio', 'Modalidad', 'Aval', 'Fuente'];
  return `<h3>Competencia</h3>
    ${c.directos.length ? `<h4>Directa</h4>${tabla(enc, c.directos.map(filaCompetidor))}` : ''}
    ${c.indirectos.length ? `<h4>Otras opciones que compiten por el mismo presupuesto</h4>${tabla(enc, c.indirectos.map(filaCompetidor))}` : ''}
    ${c.referentes.length ? `<h4>Cuentas de referencia</h4>${tabla(['Cuenta', 'Seguidores', 'País', 'Fuente'],
      c.referentes.map((r) => [escapar(r.cuenta), escapar(r.seguidores.toLocaleString('es-MX')), escapar(r.pais), fuente(r.fuente)]))}` : ''}
    ${c.hallazgos.length ? `<h4>Lo que muestra</h4>${lista(c.hallazgos)}` : ''}`;
}

function audiencia(a: Audiencia | null): string {
  if (!a) return `<h3>Audiencia</h3>${sinDatos()}`;
  const citas = (cs: Audiencia['dolores']) => cs.map((c) =>
    `<blockquote class="cita"><p>«${escapar(c.texto)}»</p><p class="suave">${escapar(c.contexto)} · ${fuente(c.fuente)}</p></blockquote>`).join('');
  return `<h3>Audiencia</h3>
    ${a.dolores.length ? `<h4>Lo que le duele, en sus palabras</h4>${citas(a.dolores)}` : ''}
    ${a.aspiraciones.length ? `<h4>Lo que desea</h4>${citas(a.aspiraciones)}` : ''}
    <h4>Lo que más la frena</h4><p><b>${escapar(a.miedoPrincipal.nombre)}.</b> ${escapar(a.miedoPrincipal.evidencia)} ${fuente(a.miedoPrincipal.fuente)}</p>
    <h4>Qué cree que está comprando</h4><p>${escapar(a.unidadDeCompra)}</p>`;
}

function canales(c: Canales | null): string {
  if (!c) return `<h3>Canales</h3>${sinDatos()}`;
  return `<h3>Canales</h3>
    ${tabla(['Plataforma', 'Alcance', 'Notas', 'Fuente'], c.plataformas.map((p) => [escapar(p.nombre), escapar(p.alcance), escapar(p.notas), fuente(p.fuente)]))}
    ${c.formatos.length ? `<h4>Formatos</h4>${lista(c.formatos)}` : ''}
    <h4>Horarios</h4><p>${escapar(c.horarios)}</p>
    ${c.tendencias.length ? `<h4>Tendencias</h4>${lista(c.tendencias)}` : ''}
    ${c.advertenciaRegulatoria ? `<h4>Advertencia</h4><p>${escapar(c.advertenciaRegulatoria)}</p>` : ''}`;
}

function mercado(m: Mercado | null): string {
  if (!m) return `<h3>Mercado</h3>${sinDatos()}`;
  return `<h3>Mercado</h3>
    ${tabla(['Dato', 'Valor', 'Fuente'], m.datos.map((d) => [escapar(d.etiqueta), escapar(d.valor), fuente(d.fuente)]))}
    ${m.salarios.length ? `<h4>Salarios</h4>${tabla(['Puesto', 'Rango', 'Fuente'], m.salarios.map((s) => [escapar(s.puesto), escapar(s.rango), fuente(s.fuente)]))}` : ''}
    ${m.regulacion.length ? `<h4>Regulación</h4>${tabla(['Norma', 'Qué implica', 'Fuente'], m.regulacion.map((r) => [escapar(r.norma), escapar(r.implicacion), fuente(r.fuente)]))}` : ''}
    ${m.crecimiento ? `<h4>Crecimiento</h4><p>${escapar(m.crecimiento)}</p>` : ''}`;
}

export function detalleInvestigacion(inv: Investigacion, abierto: boolean): string {
  return `<details class="detalle"${abierto ? ' open' : ''}>
    <summary>Ver el detalle de la investigación</summary>
    ${competencia(datos(inv.competencia))}
    ${audiencia(datos(inv.audiencia))}
    ${canales(datos(inv.canales))}
    ${mercado(datos(inv.mercado))}
  </details>`;
}

/** Respaldo cuando aún no hay lectura: la síntesis estratégica, en continuo. */
export function sintesisContinua(s: Sintesis | null): string {
  if (!s) return '';
  const tipos: Record<string, string> = { prioritario: 'Prioridad', expansion: 'Después', descartado: 'Descartado' };
  return `<section>
    <h2>Lo más importante</h2>
    ${s.hallazgos.map((h) => `<article class="tarjeta"><h3>${escapar(h.titulo)}</h3><p>${escapar(h.texto)}</p></article>`).join('')}
    <div class="bloque tarjeta"><h3>${escapar(s.posicionamiento.frase)}</h3><p>${escapar(s.posicionamiento.sustento)}</p></div>
    <div class="bloque">
      ${s.focos.map((f) => `<article class="tarjeta"><p class="eyebrow">${escapar(tipos[f.tipo] ?? f.tipo)}</p><h3>${escapar(f.nombre)}</h3><p>${escapar(f.razon)}</p></article>`).join('')}
    </div>
  </section>`;
}
```

- [ ] **Step 5: Implementar `documento.ts`**

`src/render/investigacion/documento.ts`:
```ts
import type { Investigacion, Sintesis } from '@/research/schemas';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { escapar } from './comunes';
import { ESTILOS_INVESTIGACION } from './estilos';
import {
  seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos, seccionFaltaConfirmar,
} from './lectura';
import { detalleInvestigacion, sintesisContinua } from './detalle';

export type MetaInvestigacion = { cliente: string; giro: string; fecha: string };

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

/**
 * Switch de tema e impresión. En ES5 y sin módulos: el documento se guarda y
 * se abre suelto, sin el bundle del sitio.
 */
export const SCRIPT_DOCUMENTO = `(function () {
  var botones = document.querySelectorAll('[data-tema-valor]');
  function sincronizar() {
    var actual = document.documentElement.dataset.tema;
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-checked', String(botones[i].getAttribute('data-tema-valor') === actual));
    }
  }
  for (var i = 0; i < botones.length; i++) {
    botones[i].addEventListener('click', function () {
      if (window.__wozialTema) window.__wozialTema.elegir(this.getAttribute('data-tema-valor'));
    });
  }
  document.addEventListener('wozial:tema', sincronizar);
  sincronizar();

  // Al imprimir: siempre claro y con el detalle desplegado; después se restaura.
  var previo = null, cerrados = [];
  window.addEventListener('beforeprint', function () {
    previo = document.documentElement.dataset.tema;
    document.documentElement.dataset.tema = 'claro';
    cerrados = [];
    var ds = document.querySelectorAll('details');
    for (var j = 0; j < ds.length; j++) { if (!ds[j].open) { cerrados.push(ds[j]); ds[j].open = true; } }
  });
  window.addEventListener('afterprint', function () {
    if (previo) document.documentElement.dataset.tema = previo;
    for (var k = 0; k < cerrados.length; k++) cerrados[k].open = false;
  });
})();`;

export function renderizarInvestigacion(inv: Investigacion, meta: MetaInvestigacion, barraOperador = ''): string {
  const lectura = inv.lectura?.estado === 'ok' ? inv.lectura.datos : null;
  const sintesis: Sintesis | null = inv.sintesis.estado === 'ok' ? inv.sintesis.datos : null;
  const eyebrow = `Investigación de mercado · ${meta.fecha}`;

  const cuerpo = lectura
    ? [
        seccionPortada(eyebrow, lectura.portada.titular, lectura.portada.resumen, true),
        seccionDescubrimos(lectura),
        seccionClienteIdeal(lectura),
        seccionRecomendamos(lectura),
        seccionFaltaConfirmar(lectura),
        detalleInvestigacion(inv, false),
      ].join('\n')
    : [
        seccionPortada(eyebrow, meta.cliente, meta.giro, false),
        sintesisContinua(sintesis),
        detalleInvestigacion(inv, true),
      ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Investigación · ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="theme-color" content="${COLOR_BARRA.claro}">
<script>${SCRIPT_TEMA}</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILOS_INVESTIGACION}</style>
</head><body>
${barraOperador}
<header class="doc-barra">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span class="titulo">Investigación · <b>${escapar(meta.cliente)}</b></span>
  <div class="tema-switch" role="radiogroup" aria-label="Tema de color">
    <button type="button" role="radio" aria-checked="false" data-tema-valor="claro" aria-label="Día">${SOL}</button>
    <button type="button" role="radio" aria-checked="false" data-tema-valor="oscuro" aria-label="Noche">${LUNA}</button>
  </div>
</header>
<main class="doc">
${cuerpo}
</main>
<footer class="pie">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span>Preparado por Wozial · ${escapar(meta.fecha)}</span>
</footer>
<script>${SCRIPT_DOCUMENTO}</script>
</body></html>`;
}
```

- [ ] **Step 6: Ver que pasa**

Run: `npx vitest run tests/render/investigacion.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS (13 tests) y todo en verde.

- [ ] **Step 7: Commit**

```bash
git add src/render/investigacion/lectura.ts src/render/investigacion/detalle.ts src/render/investigacion/documento.ts tests/render/investigacion.test.ts
git commit -m "feat(investigación): documento continuo con lectura, detalle plegado y respaldo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Conectar el documento nuevo y retirar el deck

**Files:**
- Modify: `src/pages/resultados/[id].astro`
- Modify: `src/lib/documento-publico.ts`
- Modify: `src/render/barra-operador.ts` (bloque `desplazamiento` de research)
- Modify: `tests/render/ejemplo.test.ts`
- Modify: `tests/render/base.test.ts`
- Delete: `src/render/presentation.ts`, `src/render/estilos.ts`, `src/render/navegacion.ts`, `src/render/panels/` (carpeta completa), `tests/render/presentation.test.ts`
- Test: `tests/render/barra-operador.test.ts`

**Interfaces:**
- Consumes: `renderizarInvestigacion` (Task 6), `escapar` (Task 5).

- [ ] **Step 1: Escribir la prueba de la barra**

`tests/render/barra-operador.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { barraOperador } from '@/render/barra-operador';

const base = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1', version: 1, tokenActivo: null, base: 'https://x',
};

describe('barra de operador', () => {
  it('en la investigación desplaza la cabecera del documento nuevo y usa los tokens', () => {
    const b = barraOperador({ ...base, tipo: 'research' });
    expect(b).toContain('.doc-barra{top:var(--barra-h);}');
    expect(b).toContain('var(--tarjeta)');
    expect(b).not.toContain('.deck{');
  });
  it('en el manual de Growth conserva su desplazamiento', () => {
    const b = barraOperador({ ...base, tipo: 'growth' });
    expect(b).toContain('.nav{top:var(--barra-h);}');
    expect(b).not.toContain('.doc-barra');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/render/barra-operador.test.ts`
Expected: FAIL en el caso de research.

- [ ] **Step 3: Actualizar la barra**

En `src/render/barra-operador.ts`, sustituir la rama de research de `desplazamiento` (la cadena que empieza por `.nav-bar{top:var(--barra-h);}`) por:
```ts
    : `.doc-barra{top:var(--barra-h);}
       body{padding-top:var(--barra-h);}
       /* El documento nuevo trae los tokens del Studio: la barra toma sus colores
          para no quedar como una franja negra sobre el tema claro. */
       #barra-op{background:color-mix(in srgb,var(--tarjeta) 94%,transparent);border-bottom-color:var(--linea);}
       #barra-op .bo-marca{color:var(--rosa);}
       #barra-op .bo-cliente,#barra-op .bo-estado{color:var(--suave);}
       #barra-op .bo-btn{color:var(--texto);border-color:var(--linea);}
       #barra-op .bo-btn:hover{color:var(--rosa);border-color:var(--rosa);}
       #barra-op .bo-primario{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}
       #barra-op .bo-peligro{color:var(--rojo);border-color:var(--rojo);}
       #barra-op input{background:var(--gris);border-color:var(--linea);color:var(--tinta);}
       #barra-op .bo-panel{background:var(--tarjeta);border-top-color:var(--linea);}
       @media (min-width:900px){ #barra-op .bo-panel{background:transparent;} }`;
```

- [ ] **Step 4: Usar el render nuevo en las dos rutas**

En `src/pages/resultados/[id].astro`, cambiar el import y la llamada:
```ts
import { renderizarInvestigacion } from '@/render/investigacion/documento';
```
```ts
const html = renderizarInvestigacion(
```
(el resto de argumentos queda igual).

En `src/lib/documento-publico.ts`, cambiar `import { renderizarPresentacion } from '@/render/presentation';` por `import { renderizarInvestigacion } from '@/render/investigacion/documento';`, y en la rama de research `renderizarPresentacion(` por `renderizarInvestigacion(`.

- [ ] **Step 5: Retirar el deck**

```bash
git rm -r src/render/presentation.ts src/render/estilos.ts src/render/navegacion.ts src/render/panels tests/render/presentation.test.ts
```
Comprobar que nada más los importa:
```bash
grep -rn "render/presentation\|render/estilos\|render/navegacion\|render/panels" src tests scripts
```
Expected: sin resultados.

- [ ] **Step 6: Ajustar las pruebas antiguas**

En `tests/render/base.test.ts`, borrar `import { ESTILOS } from '@/render/estilos';` y el caso `it('ESTILOS sigue componiendo base y deck, sin perder nada', ...)` completo. Los demás casos protegen la base que usa el manual de Growth y se quedan.

En `tests/render/ejemplo.test.ts`, cambiar el import a `import { renderizarInvestigacion } from '@/render/investigacion/documento';` y sustituir los casos `renderiza los 17 paneles` y `conserva las cifras que sostienen el argumento` por:
```ts
  it('renderiza el documento continuo con el detalle abierto (aún sin lectura)', () => {
    const html = renderizarInvestigacion(INVESTIGACION_EJEMPLO as any, {
      cliente: CLIENTE_EJEMPLO.nombre, giro: CLIENTE_EJEMPLO.giro, fecha: '2026-08-12',
    });
    expect(html).toMatch(/<details class="detalle" open>/);
    expect(html).not.toContain('class="panel');
  });

  it('conserva las cifras que sostienen el argumento', () => {
    const html = renderizarInvestigacion(INVESTIGACION_EJEMPLO as any, {
      cliente: CLIENTE_EJEMPLO.nombre, giro: CLIENTE_EJEMPLO.giro, fecha: '2026-08-12',
    });
    // El hallazgo central: el aval equivalente cuesta una décima parte.
    expect(html).toContain('$3,450');
    expect(html).toContain('$36,792');
    // La prueba que sí sostiene el ticket.
    expect(html).toContain('$6,480');
  });
```

- [ ] **Step 7: Verificar**

Run: `npm test` y `npm run build`.
Expected: todo en verde.

Luego, con el build: `PORT=4399 node --env-file=.env ./dist/server/entry.mjs` en segundo plano. Entrar con curl (`curl -s -c /tmp/wz.txt -H 'Origin: http://localhost:4399' -d 'email=studio@local.test&password=local-solo-para-probar-2026' http://localhost:4399/api/login -o /dev/null`) y pedir `/resultados/<id>` de una investigación (`docker exec wozial-pg psql -U wozial -d wozial_studio -Atc "select id from research_results limit 1"`). Expected: 200, contiene `class="doc-barra"`, `Ver el detalle de la investigación` e `id="barra-op"`, y no contiene `id="deck"`. Detener solo ese PID.

- [ ] **Step 8: Commit**

```bash
git add -A src/render src/pages/resultados src/lib/documento-publico.ts tests/render
git commit -m "feat(investigación): la investigación se sirve como página continua; se retira el deck

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Verificación final

**Files:** ninguno, salvo correcciones.

- [ ] **Step 1: Pruebas y build**

Run: `npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -3`
Expected: todo en verde.

- [ ] **Step 2: Sembrar una lectura local para verla (sin API)**

Solo en la base local, añadir la lectura de ejemplo a una investigación para ver ambos modos:
```bash
docker exec -i wozial-pg psql -U wozial -d wozial_studio -c "update research_results set datos = jsonb_set(datos::jsonb, '{lectura}', jsonb_build_object('estado','ok','datos', '$(cat tests/fixtures/lectura-ejemplo.json | tr -d '\n' | sed "s/'/''/g")'::jsonb)) where id = (select id from research_results order by created_at limit 1)"
```
Expected: `UPDATE 1`. La otra investigación local se queda sin lectura para ver el respaldo.

- [ ] **Step 3: Recorrido visual**

En el navegador del usuario (o el Browser pane para el link público `/p/...`, que no pide sesión), revisar las dos investigaciones en claro y oscuro, a 1440 y 390 px:
- Con lectura: portada, índice, tarjetas con etiqueta de color, perfiles, pasos numerados, detalle plegado que abre.
- Sin lectura: síntesis y detalle abierto.
- Imprimir (vista previa): sale en claro y con el detalle desplegado.

- [ ] **Step 4: Informe**

Resumir qué cambió, recordar que la conversión automática correrá al desplegar y necesita saldo en Anthropic, y que nada está subido.
