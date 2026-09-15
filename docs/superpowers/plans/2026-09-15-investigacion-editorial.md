# Investigación · Revisión editorial · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la página de la investigación con diseño editorial web y acortar la lectura. La página pasa a ocupar el 85% del ancho, con portada de cifras, secciones numeradas, índice lateral, columnas, desplegables, pestañas y gráficas en el detalle.

**Architecture:** La lectura gana `cifras`, `resumen` y `detalle` por hallazgo, y `frase` por perfil, con límites más cortos. Una validación extra exige que cada cifra aparezca en la investigación. El render de `src/render/investigacion/` se reescribe con rejillas basadas en `gap`, sin márgenes entre hermanos. Las gráficas salen de montos leídos con `parsearMontos`. La interacción es ES5 en línea: pestañas, índice activo, apariciones e impresión. Sin JavaScript todo queda visible.

**Tech Stack:** Astro 7.2.1 SSR, TypeScript, Zod 4.4.3, Vitest 4.1.10.

**Spec:** `docs/superpowers/specs/2026-09-15-investigacion-cliente-design.md` (§2 esquema revisado, §4 diseño editorial)

**Parte de:** este plan continúa `docs/superpowers/plans/2026-09-15-investigacion-cliente.md` (Tareas 1–7 hechas). Sustituye su Tarea 8.

## Global Constraints

- Rama `feat/rediseno`. **Nunca `git push` ni despliegue** sin visto bueno explícito.
- `node_modules` es un enlace a `node_modules.nosync/`. **Nunca correr `npm ci` ni `npm install`.**
- El usuario tiene `astro dev` en el puerto 4321: no detenerlo ni correr `astro dev stop`.
- Nunca llamar a la API de Anthropic, ni hacer POST a `/api/jobs`, ni imprimir o editar `.env`.
- Comentarios en español, explicando el porqué. Cada commit termina con una línea en blanco y `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `npm test` y `npm run build` deben pasar al final de cada tarea.
- Todo texto del modelo pasa por `escapar`. Las URL de fuente que no sean http(s) se sustituyen por `#`.
- Ancho: `width: min(85%, 1600px)` en escritorio (≥ 900 px); en celular, ancho completo con 16 px de margen.
- Sin márgenes entre hermanos del tipo `.a + .a`: la separación va con `gap` en rejillas y flex. Ya causó dos errores de especificidad.
- Áreas táctiles de al menos 44 px; `prefers-reduced-motion` desactiva animaciones; foco visible.
- Jerga prohibida y reglas de tono: las mismas del plan anterior (`src/research/jerga.ts`).

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/research/jerga.ts` | Modificar | Exportar `recogerTextos` |
| `src/research/schemas.ts` | Modificar | `lecturaSchema` v2 |
| `src/research/cifras-lectura.ts` | Crear | `cifrasSinRespaldo` |
| `src/research/agents/lectura.ts` | Modificar | Forma v2, reglas de brevedad, `lecturaSchemaPara` |
| `tests/fixtures/lectura-ejemplo.json` | Reescribir | Lectura v2 |
| `src/render/investigacion/montos.ts` | Crear | `parsearMontos`, `formatearMonto` |
| `src/render/investigacion/graficas.ts` | Crear | Filas, barras y rangos |
| `src/render/investigacion/comunes.ts` | Modificar | Quitar `tabla`; añadir `encabezadoSeccion` |
| `src/render/investigacion/estilos.ts` | Reescribir | CSS editorial |
| `src/render/investigacion/lectura.ts` | Reescribir | Portada con cifras y secciones 01–03 |
| `src/render/investigacion/detalle.ts` | Reescribir | Sección 04 con pestañas y respaldo |
| `src/render/investigacion/documento.ts` | Reescribir | Marco, índice lateral e interacción |
| `src/render/barra-operador.ts` | Modificar | Desfase del scroll y del índice con la barra |

---

### Task R1: Lectura más corta con cifras verificables

**Files:**
- Modify: `src/research/jerga.ts`
- Modify: `src/research/schemas.ts` (bloque `lecturaSchema`)
- Create: `src/research/cifras-lectura.ts`
- Modify: `src/research/agents/lectura.ts`
- Rewrite: `tests/fixtures/lectura-ejemplo.json`
- Modify: `tests/research/lectura-schema.test.ts`, `tests/research/lectura-agente.test.ts`
- Test: `tests/research/cifras-lectura.test.ts`

**Interfaces:**
- Produces:
  - `recogerTextos(valor: unknown): string[]`, que incluye números como texto.
  - `lecturaSchema` v2 con `cifras: { valor, etiqueta, tono: 'a_favor'|'cuidar'|'neutral' }[]`, `descubrimos[].resumen` y `.detalle`, y `perfiles[].frase`.
  - `cifrasSinRespaldo(lectura: { cifras: { valor: string }[] }, fuente: unknown): string[]`.
  - `lecturaSchemaPara(previos: PreviosLectura)`.

- [ ] **Step 1: Reescribir el fixture**

`tests/fixtures/lectura-ejemplo.json`:
```json
{
  "portada": {
    "titular": "Tu diplomado vale lo que cuesta, pero hoy se explica con el argumento equivocado",
    "resumen": "Revisamos a tu competencia, a tus posibles alumnas y el mercado laboral. No vendas el diploma: vende lo que tus egresadas pueden llegar a ganar."
  },
  "cifras": [
    { "valor": "$36,792", "etiqueta": "Lo que cuesta tu diplomado", "tono": "neutral" },
    { "valor": "$3,450", "etiqueta": "Un diplomado en línea con avales oficiales", "tono": "cuidar" },
    { "valor": "$18,000", "etiqueta": "Lo que puede ganar al mes con empleo formal", "tono": "a_favor" }
  ],
  "descubrimos": [
    { "tipo": "cuidar", "titulo": "El diploma no puede ser tu argumento principal", "resumen": "Hay opciones con avales oficiales por una décima parte de tu precio.", "detalle": "Un diplomado en línea con avales oficiales cuesta $3,450 y el tuyo $36,792. Si solo hablas del papel, la persona interesada encontrará algo parecido por mucho menos." },
    { "tipo": "a_favor", "titulo": "Lo que ganan tus egresadas sí justifica el precio", "resumen": "Un empleo formal paga casi el triple que el promedio del sector.", "detalle": "El sector paga $6,480 al mes en promedio, pero los empleos formales que piden una cosmiatra certificada pagan de $10,000 a $18,000. Esa diferencia se comprueba con datos oficiales." },
    { "tipo": "cuidar", "titulo": "Tus planes de pago premian al que paga más lento", "resumen": "Pagar en 12 meses sale más barato que pagar en 8.", "detalle": "La diferencia es de $1,416 a favor del plan largo. Eso anima justo la opción con más riesgo de pagos atrasados." },
    { "tipo": "oportunidad", "titulo": "Nadie en México enseña a conseguir clientas", "resumen": "Todas enseñan la técnica; ninguna, a llenar la agenda.", "detalle": "Ninguna escuela mexicana enseña a llenar la agenda y cobrar bien. Ese lugar está libre y encaja con lo que tus alumnas quieren lograr." }
  ],
  "clienteIdeal": {
    "quienEs": "Mujer de 28 a 45 años que ya trabaja en belleza. Tiene ingresos propios, pero siente que llegó a su techo y quiere cobrar más.",
    "lePreocupa": ["Invertir mucho y no recuperarlo", "Que el diploma no le traiga mejores clientas", "No tener tiempo para estudiar"],
    "quiereLograr": ["Cobrar más por cada servicio", "Que la vean como profesional seria", "Tener la agenda llena sin descuentos"],
    "perfiles": [
      { "nombre": "Mariana", "descripcion": "34 años. Trabaja en cabina y tiene clientas fijas, pero sus ingresos no crecen desde hace años.", "frase": "Ya sé hacer el trabajo; lo que quiero es que me lo paguen mejor.", "comoHablarle": "Muéstrale con números cuánto más puede cobrar y en cuánto tiempo recupera lo que invierte." },
      { "nombre": "Laura", "descripcion": "27 años. Terminó un curso corto y todavía no tiene clientas constantes.", "frase": "No sé si otro curso me va a servir o si solo voy a gastar.", "comoHablarle": "Háblale de acompañamiento y de cómo conseguir sus primeras clientas." }
    ]
  },
  "recomendamos": {
    "pasos": [
      { "titulo": "Cambia el mensaje principal", "queHacer": "Presenta el diplomado como el camino para ganar de $10,000 a $18,000 al mes, no como un papel.", "porQue": "Es lo que la competencia barata no puede igualar." },
      { "titulo": "Empieza por quienes ya te siguen", "queHacer": "Ofrécelo primero a quienes ya siguen tu trabajo y asisten a tus clases gratuitas.", "porQue": "Ya confían en ti, así que deciden más rápido." },
      { "titulo": "Ajusta los planes de pago", "queHacer": "Haz que pagar en menos mensualidades sea la opción más conveniente.", "porQue": "Hoy el plan más lento es el más barato." },
      { "titulo": "Enseña a conseguir clientas", "queHacer": "Agrega una parte sobre cómo llenar la agenda y fijar precios.", "porQue": "Nadie en México lo ofrece." }
    ],
    "dondeAnunciarte": [
      { "canal": "Instagram", "porQue": "Ahí está tu comunidad y ahí muestran su trabajo las profesionales de belleza." },
      { "canal": "Facebook", "porQue": "Llega a mujeres de 28 a 45 años que ya trabajan en el oficio." }
    ],
    "precio": "Mantén el precio de $36,792 y justifícalo con lo que tus egresadas pueden ganar, no con el diploma."
  },
  "faltaConfirmar": [
    "Los dos perfiles salen de datos del mercado; conviene confirmarlos con 5 a 8 alumnas actuales.",
    "Las cifras de redes sociales son de 2024 y pueden haber cambiado."
  ]
}
```

- [ ] **Step 2: Actualizar y escribir las pruebas**

En `tests/research/lectura-schema.test.ts`:
- Importar `parcial from '../fixtures/investigacion-parcial.json'`.
- Cambiar el caso `rechaza textos demasiado largos` para usar `l.portada.titular = 'a'.repeat(91);`.
- Añadir dentro de `describe('lecturaSchema', ...)`:
```ts
  it('exige de 3 a 4 cifras con tono válido', () => {
    const l = copia();
    l.cifras = l.cifras.slice(0, 2);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.cifras[0].tono = 'rojo';
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('cada hallazgo trae resumen y detalle, y cada perfil su frase', () => {
    const l = copia();
    delete l.descubrimos[0].resumen;
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    delete m.clienteIdeal.perfiles[0].frase;
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });
```
- Añadir dentro de `describe('investigacionSchema con lectura', ...)`:
```ts
  it('valida también el fixture parcial', () => {
    expect(investigacionSchema.safeParse(parcial).success).toBe(true);
  });
```

En `tests/research/lectura-agente.test.ts`, en el caso `describe la forma exacta del JSON`, añadir a la lista de campos: `'cifras'`, `'tono'`, `'resumen'`, `'detalle'`, `'frase'`. Añadir al final:
```ts
import { lecturaSchemaPara } from '@/research/agents/lectura';
import lectura from '../fixtures/lectura-ejemplo.json';
import { INVESTIGACION_EJEMPLO } from '../../scripts/datos-ejemplo.mjs';

describe('esquema con cifras verificadas', () => {
  const ej = INVESTIGACION_EJEMPLO as any;
  const previos = { competencia: ej.competencia.datos, mercado: ej.mercado.datos, sintesis: ej.sintesis.datos };

  it('acepta cifras que están en la investigación', () => {
    expect(lecturaSchemaPara(previos).safeParse(lectura).success).toBe(true);
  });

  it('rechaza una cifra inventada y la nombra', () => {
    const l = JSON.parse(JSON.stringify(lectura));
    l.cifras[0].valor = '$99,991';
    const r = lecturaSchemaPara(previos).safeParse(l);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('$99,991');
  });
});
```
(Juntar los imports nuevos con los existentes al inicio del archivo.)

`tests/research/cifras-lectura.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cifrasSinRespaldo } from '@/research/cifras-lectura';

const fuente = { precios: ['$28,500 MXN', 'de $10,000 a $18,000'], seguidores: 16400, nota: '82% informal' };
const con = (...valores: string[]) => ({ cifras: valores.map((valor) => ({ valor })) });

describe('cifrasSinRespaldo', () => {
  it('acepta cifras cuyos dígitos aparecen en la fuente, con otro formato', () => {
    expect(cifrasSinRespaldo(con('$28,500', '18 mil', '82%'), fuente)).toEqual([]);
  });
  it('lee números sueltos de la fuente', () => {
    expect(cifrasSinRespaldo(con('16,400'), fuente)).toEqual([]);
  });
  it('rechaza las que no aparecen', () => {
    expect(cifrasSinRespaldo(con('$28,500', '$31,000'), fuente)).toEqual(['$31,000']);
  });
  it('rechaza valores sin ningún dígito', () => {
    expect(cifrasSinRespaldo(con('Mucho'), fuente)).toEqual(['Mucho']);
  });
});
```

- [ ] **Step 3: Ver que fallan**

Run: `npx vitest run tests/research/lectura-schema.test.ts tests/research/lectura-agente.test.ts tests/research/cifras-lectura.test.ts`
Expected: FAIL (el fixture nuevo no cumple el esquema viejo, falta `cifras-lectura`, falta `lecturaSchemaPara`).

- [ ] **Step 4: `jerga.ts` exporta el recolector**

En `src/research/jerga.ts`, sustituir la función privada `textos` por:
```ts
/** Todos los textos de un valor anidado. Los números cuentan como texto: una cifra también es contenido. */
export function recogerTextos(valor: unknown, salida: string[] = []): string[] {
  if (typeof valor === 'string') salida.push(valor);
  else if (typeof valor === 'number') salida.push(String(valor));
  else if (Array.isArray(valor)) valor.forEach((v) => recogerTextos(v, salida));
  else if (valor && typeof valor === 'object') Object.values(valor).forEach((v) => recogerTextos(v, salida));
  return salida;
}
```
Y en `detectarJerga`, cambiar `textos(valor)` por `recogerTextos(valor)`.

- [ ] **Step 5: Esquema v2**

En `src/research/schemas.ts`, reemplazar el objeto de `lecturaSchema` (conservando su `.superRefine` de jerga) por:
```ts
export const lecturaSchema = z.object({
  portada: z.object({ titular: texto(90), resumen: texto(240) }),
  cifras: z.array(z.object({
    valor: texto(20),
    etiqueta: texto(60),
    tono: z.enum(['a_favor', 'cuidar', 'neutral']),
  })).min(3).max(4),
  descubrimos: z.array(z.object({
    tipo: z.enum(['a_favor', 'cuidar', 'oportunidad']),
    titulo: texto(80),
    resumen: texto(140),
    detalle: texto(400),
  })).min(3).max(4),
  clienteIdeal: z.object({
    quienEs: texto(320),
    lePreocupa: z.array(texto(120)).length(3),
    quiereLograr: z.array(texto(120)).length(3),
    perfiles: z.array(z.object({
      nombre: texto(40),
      descripcion: texto(200),
      frase: texto(140),
      comoHablarle: texto(200),
    })).length(2),
  }),
  recomendamos: z.object({
    pasos: z.array(z.object({ titulo: texto(60), queHacer: texto(200), porQue: texto(160) })).min(3).max(5),
    dondeAnunciarte: z.array(z.object({ canal: texto(40), porQue: texto(140) })).min(1).max(4),
    precio: texto(280).nullable(),
  }),
  faltaConfirmar: z.array(texto(160)).max(5),
})
```
Actualizar el comentario de `lecturaSchema`: *«Límites cortos a propósito: la primera versión tenía demasiado texto para leerse en tarjetas.»*

- [ ] **Step 6: `cifras-lectura.ts`**

```ts
import { recogerTextos } from './jerga';

const digitos = (t: string) => t.replace(/\D/g, '');

/**
 * Cifras de la portada que no salen de la investigación. Se comparan solo los
 * dígitos: «$18,000» y «18 mil» no se parecen como texto, pero una portada con
 * un número que nadie investigó sería peor que una portada sin número.
 */
export function cifrasSinRespaldo(lectura: { cifras: { valor: string }[] }, fuente: unknown): string[] {
  const disponibles = recogerTextos(fuente).map(digitos).filter(Boolean);
  return lectura.cifras
    .filter((c) => {
      const d = digitos(c.valor);
      return !d || !disponibles.some((f) => f.includes(d));
    })
    .map((c) => c.valor);
}
```
Nota: «18 mil» da dígitos «18», que aparecen dentro de «18000». Es la tolerancia buscada.

- [ ] **Step 7: Agente v2**

En `src/research/agents/lectura.ts`:
- Importar `import { cifrasSinRespaldo } from '@/research/cifras-lectura';`.
- En `SISTEMA_LECTURA`, sustituir la línea «Le hablas de tú, con frases cortas y una idea por frase.» por estas dos líneas:
```
- Le hablas de tú. Escribes muy poco: cada texto tiene que caber en una tarjeta. Una idea por frase.
- En cifras eliges 3 o 4 números que resumen el caso y los copias tal como aparecen en la investigación.
```
- Añadir a «Reglas que no se rompen»: `- frase es lo que diría esa persona, en primera persona y sin datos que no estén en la investigación.`
- Reemplazar `FORMA` por:
```ts
const FORMA = `{
  "portada": { "titular": "una frase, máx. 90 caracteres", "resumen": "máx. 240" },
  "cifras": [ { "valor": "la cifra tal cual, máx. 20", "etiqueta": "qué es, máx. 60", "tono": "a_favor | cuidar | neutral" } ],   // 3 o 4
  "descubrimos": [ { "tipo": "a_favor | cuidar | oportunidad", "titulo": "máx. 80", "resumen": "una línea, máx. 140", "detalle": "máx. 400" } ],   // 3 o 4
  "clienteIdeal": {
    "quienEs": "máx. 320",
    "lePreocupa": ["exactamente 3, máx. 120 cada uno"],
    "quiereLograr": ["exactamente 3, máx. 120 cada uno"],
    "perfiles": [ { "nombre": "máx. 40", "descripcion": "máx. 200", "frase": "lo que diría, máx. 140", "comoHablarle": "máx. 200" } ]   // exactamente 2
  },
  "recomendamos": {
    "pasos": [ { "titulo": "máx. 60", "queHacer": "máx. 200", "porQue": "máx. 160" } ],   // 3 a 5
    "dondeAnunciarte": [ { "canal": "máx. 40", "porQue": "máx. 140" } ],   // 1 a 4
    "precio": "máx. 280, o null"
  },
  "faltaConfirmar": ["máx. 160 cada uno"]   // 0 a 5
}`;
```
- Añadir antes de `correrLectura`:
```ts
/** El esquema de la lectura más la regla de que ninguna cifra salga de la nada. */
export function lecturaSchemaPara(previos: PreviosLectura) {
  return lecturaSchema.superRefine((lectura, ctx) => {
    const sinRespaldo = cifrasSinRespaldo(lectura, previos);
    if (sinRespaldo.length) {
      ctx.addIssue({
        code: 'custom',
        message: `Estas cifras no aparecen en la investigación: ${sinRespaldo.join(', ')}. Usa solo cifras que estén en los datos.`,
      });
    }
  });
}
```
- En `correrLectura`, cambiar `schema: lecturaSchema,` por `schema: lecturaSchemaPara(previos),`.

- [ ] **Step 8: Ver que pasan**

Run: `npx vitest run tests/research/lectura-schema.test.ts tests/research/lectura-agente.test.ts tests/research/cifras-lectura.test.ts tests/research/convertir-lecturas.test.ts`, luego `npm test` y `npm run build`.
Expected: todo en verde. Si alguna prueba de render existente falla por los campos nuevos (por ejemplo, `explicacion` ya no existe), actualizarla solo lo mínimo para usar `resumen`: las Tareas R3 y R4 reescriben esas pruebas.

- [ ] **Step 9: Commit**

```bash
git add src/research tests/research tests/fixtures/lectura-ejemplo.json tests/render
git commit -m "feat(investigación): lectura más corta con cifras de portada verificadas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task R2: Lectura de montos y gráficas

**Files:**
- Create: `src/render/investigacion/montos.ts`
- Create: `src/render/investigacion/graficas.ts`
- Test: `tests/render/graficas.test.ts`

**Interfaces:**
- Produces:
  - `parsearMontos(texto: string): number[]` y `formatearMonto(n: number): string`.
  - `type FilaGrafica = { nombre: string; min: number; max: number; destacada: boolean }`.
  - `filasGrafica<T>(items: T[], nombre: (t: T) => string, texto: (t: T) => string, destacar?: (t: T) => boolean): FilaGrafica[]`.
  - `graficaBarras(filas: FilaGrafica[], leyenda: string): string` y `graficaRangos(filas: FilaGrafica[], leyenda: string): string`. Las dos devuelven `''` con menos de dos filas.

- [ ] **Step 1: Escribir la prueba**

`tests/render/graficas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parsearMontos, formatearMonto } from '@/render/investigacion/montos';
import { filasGrafica, graficaBarras, graficaRangos } from '@/render/investigacion/graficas';

describe('parsearMontos', () => {
  it('lee dinero con separador de miles y moneda', () => {
    expect(parsearMontos('$28,500 MXN')).toEqual([28500]);
  });
  it('lee rangos', () => {
    expect(parsearMontos('de $10,000 a $18,000 al mes')).toEqual([10000, 18000]);
  });
  it('con signo de pesos ignora los números que no son dinero', () => {
    expect(parsearMontos('12 mensualidades de $3,066')).toEqual([3066]);
  });
  it('lee K y M sin confundir MXN', () => {
    expect(parsearMontos('16.4K seguidores')).toEqual([16400]);
    expect(parsearMontos('$1.2M')).toEqual([1200000]);
  });
  it('sin número devuelve vacío', () => {
    expect(parsearMontos('Gratis')).toEqual([]);
  });
  it('formatea en pesos mexicanos', () => {
    expect(formatearMonto(36792)).toBe('$36,792');
  });
});

describe('gráficas', () => {
  const items = [
    { n: 'IMNAS', p: '$3,450' },
    { n: 'Tu diplomado (el cliente)', p: '$36,792' },
    { n: 'Sin precio', p: 'Consultar' },
  ];
  const filas = filasGrafica(items, (i) => i.n, (i) => i.p, (i) => i.n.includes('(el cliente)'));

  it('solo toma filas con monto legible', () => {
    expect(filas.map((f) => f.nombre)).toEqual(['IMNAS', 'Tu diplomado (el cliente)']);
    expect(filas[1]).toEqual({ nombre: 'Tu diplomado (el cliente)', min: 36792, max: 36792, destacada: true });
  });

  it('barras proporcionales al máximo, con la destacada marcada y el texto escapado', () => {
    const html = graficaBarras([...filas, { nombre: '<b>', min: 18396, max: 18396, destacada: false }], 'Precio');
    expect((html.match(/class="barra-fila/g) ?? []).length).toBe(3);
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
    expect(html).toContain('barra-fila destacada');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('$36,792');
  });

  it('no dibuja con menos de dos filas', () => {
    expect(graficaBarras(filas.slice(0, 1), 'x')).toBe('');
    expect(graficaRangos([], 'x')).toBe('');
  });

  it('rangos dibujan de mínimo a máximo y un valor único como punto', () => {
    const html = graficaRangos([
      { nombre: 'Promedio', min: 6480, max: 6480, destacada: false },
      { nombre: 'Formal', min: 10000, max: 18000, destacada: false },
    ], 'Ingreso');
    expect(html).toContain('rango-punto');
    expect(html).toContain('left:56%;width:44%');
    expect(html).toContain('$10,000 – $18,000');
  });
});
```

- [ ] **Step 2: Ver que falla**

Run: `npx vitest run tests/render/graficas.test.ts`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar `montos.ts`**

```ts
// Número con miles separados por coma o número simple, con K/M opcional.
// La letra no puede ir seguida de otra letra: así «MXN» no se lee como millones.
const PATRON = /(\$\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*([kKmM])(?![A-Za-zÀ-ÿ]))?/g;

/**
 * Montos legibles de un texto libre del modelo. Si el texto trae signo de
 * pesos, solo cuentan los números con signo: «12 mensualidades de $3,066»
 * habla de $3,066, no de 12.
 */
export function parsearMontos(texto: string): number[] {
  const hallados = [...texto.matchAll(PATRON)];
  const conSigno = texto.includes('$');
  return hallados
    .filter((m) => !conSigno || m[1])
    .map((m) => {
      let n = Number(m[2].replace(/,/g, ''));
      if (m[3]) n *= /k/i.test(m[3]) ? 1_000 : 1_000_000;
      return Math.round(n);
    });
}

export function formatearMonto(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
```
Nota: se formatea con `en-US` porque en `es-MX` Node puede usar un separador distinto según su ICU; la coma es la convención mexicana que ya usan los datos.

- [ ] **Step 4: Implementar `graficas.ts`**

```ts
import { escapar } from '@/render/escapar';
import { parsearMontos, formatearMonto } from './montos';

export type FilaGrafica = { nombre: string; min: number; max: number; destacada: boolean };

export function filasGrafica<T>(
  items: T[],
  nombre: (t: T) => string,
  texto: (t: T) => string,
  destacar: (t: T) => boolean = () => false,
): FilaGrafica[] {
  return items.flatMap((item) => {
    const montos = parsearMontos(texto(item));
    if (!montos.length) return [];
    return [{ nombre: nombre(item), min: Math.min(...montos), max: Math.max(...montos), destacada: destacar(item) }];
  });
}

const pct = (n: number, tope: number) => Math.round((n / tope) * 100);

/** Barras horizontales. Con una sola fila no hay nada que comparar. */
export function graficaBarras(filas: FilaGrafica[], leyenda: string): string {
  if (filas.length < 2) return '';
  const tope = Math.max(...filas.map((f) => f.max));
  return `<figure class="grafica">
    <figcaption>${escapar(leyenda)}</figcaption>
    ${filas.map((f) => `<div class="barra-fila${f.destacada ? ' destacada' : ''}">
      <span class="barra-nombre">${escapar(f.nombre)}</span>
      <span class="barra-pista"><span class="barra-relleno" style="width:${pct(f.max, tope)}%"></span></span>
      <span class="barra-valor">${formatearMonto(f.max)}</span>
    </div>`).join('')}
  </figure>`;
}

/** Rangos de mínimo a máximo; un valor único se dibuja como punto. */
export function graficaRangos(filas: FilaGrafica[], leyenda: string): string {
  if (filas.length < 2) return '';
  const tope = Math.max(...filas.map((f) => f.max));
  return `<figure class="grafica">
    <figcaption>${escapar(leyenda)}</figcaption>
    ${filas.map((f) => {
      const unico = f.min === f.max;
      const izquierda = pct(f.min, tope);
      const marca = unico
        ? `<span class="rango-punto" style="left:${izquierda}%"></span>`
        : `<span class="rango-tramo" style="left:${izquierda}%;width:${pct(f.max, tope) - izquierda}%"></span>`;
      const valor = unico ? formatearMonto(f.max) : `${formatearMonto(f.min)} – ${formatearMonto(f.max)}`;
      return `<div class="barra-fila${f.destacada ? ' destacada' : ''}">
        <span class="barra-nombre">${escapar(f.nombre)}</span>
        <span class="barra-pista">${marca}</span>
        <span class="barra-valor">${valor}</span>
      </div>`;
    }).join('')}
  </figure>`;
}
```

- [ ] **Step 5: Ver que pasa**

Run: `npx vitest run tests/render/graficas.test.ts`, luego `npm test` y `npm run build`.
Expected: PASS (10 tests) y todo en verde.

- [ ] **Step 6: Commit**

```bash
git add src/render/investigacion/montos.ts src/render/investigacion/graficas.ts tests/render/graficas.test.ts
git commit -m "feat(investigación): lectura de montos y gráficas de barras y rangos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task R3: Estilos editoriales, portada y secciones 01–03

**Files:**
- Modify: `src/render/investigacion/comunes.ts`
- Rewrite: `src/render/investigacion/estilos.ts`
- Rewrite: `src/render/investigacion/lectura.ts`
- Modify: `tests/render/investigacion-base.test.ts`
- Test: `tests/render/investigacion-lectura.test.ts`

**Interfaces:**
- Consumes: `Lectura` v2 (R1); `escapar`, `fuente`, `lista`, `sinDatos` (existentes).
- Produces:
  - `encabezadoSeccion(num: string, titulo: string, entrada: string): string` en `comunes.ts`.
  - `ESTILOS_INVESTIGACION` editorial.
  - En `lectura.ts`: `seccionPortada(o: { eyebrow: string; titular: string; resumen: string; cifras: Lectura['cifras']; conIndice: boolean }): string`, `seccionDescubrimos(l: Lectura): string`, `seccionClienteIdeal(l: Lectura): string` y `seccionRecomendamos(l: Lectura): string`. Esta última incluye «Lo que falta confirmar».

- [ ] **Step 1: Escribir y ajustar pruebas**

En `tests/render/investigacion-base.test.ts`:
- Quitar `tabla` del import y la aserción de `tabla` en el caso de lista y tabla, que se renombra a `'lista escapa y omite listas vacías'`.
- Cambiar `expect(ESTILOS_INVESTIGACION).toContain('760px');` por:
```ts
    expect(ESTILOS_INVESTIGACION).toContain('min(85%,1600px)');
```
- Añadir:
```ts
  it('no usa márgenes entre hermanos, que ya causaron errores de especificidad', () => {
    expect(ESTILOS_INVESTIGACION).not.toMatch(/\.[\w-]+\s*\+\s*\.[\w-]+\s*\{/);
  });
  it('encabezadoSeccion escapa y numera', () => {
    const h = encabezadoSeccion('01', '<Qué>', 'Entrada');
    expect(h).toContain('class="seccion-num">01<');
    expect(h).toContain('&lt;Qué&gt;');
  });
```
(Añadir `encabezadoSeccion` al import de `@/render/investigacion/comunes`.)

`tests/render/investigacion-lectura.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos,
} from '@/render/investigacion/lectura';
import lectura from '../fixtures/lectura-ejemplo.json';

const l = () => JSON.parse(JSON.stringify(lectura));

describe('portada', () => {
  it('muestra titular, resumen, cifras con tono e índice', () => {
    const h = seccionPortada({ eyebrow: 'Investigación · 2026', titular: 'T', resumen: 'R', cifras: (lectura as any).cifras, conIndice: true });
    expect(h).toContain('class="portada');
    expect((h.match(/class="cifra-tarjeta/g) ?? []).length).toBe(3);
    expect(h).toContain('cifra-tarjeta a_favor');
    expect(h).toContain('$36,792');
    expect(h).toContain('href="#detalle"');
  });
  it('sin cifras ni índice no deja contenedores vacíos', () => {
    const h = seccionPortada({ eyebrow: 'e', titular: 'T', resumen: 'R', cifras: [], conIndice: false });
    expect(h).not.toContain('cifras');
    expect(h).not.toContain('class="accesos"');
  });
});

describe('secciones de la lectura', () => {
  it('01 descubrimos: tarjetas con resumen visible y detalle desplegable', () => {
    const h = seccionDescubrimos(l());
    expect(h).toContain('id="descubrimos"');
    expect(h).toContain('class="seccion-num">01<');
    expect((h.match(/<details class="mas"/g) ?? []).length).toBe(4);
    expect(h).toContain('Ver más');
    expect(h).toContain('Hay que cuidar');
  });

  it('02 cliente ideal: tres columnas, perfiles con frase y cómo hablarle', () => {
    const h = seccionClienteIdeal(l());
    expect(h).toContain('id="cliente-ideal"');
    expect(h).toContain('rejilla tres');
    expect(h).toContain('Ya sé hacer el trabajo');
    expect(h).toContain('Cómo hablarle');
  });

  it('03 recomendamos: pasos numerados, canales, precio y pendientes', () => {
    const h = seccionRecomendamos(l());
    expect(h).toContain('id="recomendamos"');
    expect((h.match(/class="paso /g) ?? []).length).toBe(4);
    expect(h).toContain('Dónde anunciarte');
    expect(h).toContain('Sobre tu precio');
    expect(h).toContain('Lo que falta confirmar');
  });

  it('omite precio y pendientes cuando no hay', () => {
    const x = l();
    x.recomendamos.precio = null;
    x.faltaConfirmar = [];
    const h = seccionRecomendamos(x);
    expect(h).not.toContain('Sobre tu precio');
    expect(h).not.toContain('Lo que falta confirmar');
  });

  it('escapa el texto del modelo', () => {
    const x = l();
    x.descubrimos[0].titulo = '<script>alert(1)</script>';
    expect(seccionDescubrimos(x)).not.toContain('<script>alert(1)</script>');
  });
});
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/render/investigacion-base.test.ts tests/render/investigacion-lectura.test.ts`
Expected: FAIL.

- [ ] **Step 3: `comunes.ts`**

Borrar la función `tabla`. Añadir:
```ts
/** Número grande, título y una línea de entrada: la jerarquía que faltaba entre secciones. */
export function encabezadoSeccion(num: string, titulo: string, entrada: string): string {
  return `<header class="seccion-cabeza aparece">
    <span class="seccion-num">${escapar(num)}</span>
    <div><h2>${escapar(titulo)}</h2><p class="entrada">${escapar(entrada)}</p></div>
  </header>`;
}
```

- [ ] **Step 4: `estilos.ts` editorial**

```ts
// Los mismos tokens que el Studio, incrustados como texto: el documento se
// descarga y se imprime suelto, sin la hoja del sitio.
import TOKENS_CSS from '@/styles/tokens.css?raw';

// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
const DOCUMENTO = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:96px;}
body{font:var(--t-body);color:var(--texto);background:var(--fondo);}
a{color:var(--rosa);}
h1,h2,h3,h4{color:var(--tinta);letter-spacing:var(--tracking-titulo);}
h2{font:var(--t-h1);}
h3{font:var(--t-h3);letter-spacing:-0.01em;}
p{max-width:68ch;}
.eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.suave{color:var(--suave);font:var(--t-small);}

.doc-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px max(16px,7.5vw);
  background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--linea);}
.doc-barra .logo{height:22px;width:auto;filter:brightness(0);}
:root[data-tema="oscuro"] .logo{filter:none!important;}
.doc-barra .titulo{flex:1;min-width:0;font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.doc-barra .titulo b{color:var(--tinta);font-weight:600;}
.tema-switch{display:inline-flex;padding:3px;gap:2px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);}
.tema-switch button{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--suave);cursor:pointer;display:grid;place-items:center;}
.tema-switch svg{width:18px;height:18px;}
.tema-switch button[aria-checked="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:var(--sombra);}

.pagina{width:auto;margin:0 16px;}
.marco{display:block;}
.indice-lateral{display:none;}
@media (min-width:900px){
  .pagina{width:min(85%,1600px);margin:0 auto;}
  .marco{display:grid;grid-template-columns:190px minmax(0,1fr);gap:56px;}
  .indice-lateral{display:block;position:sticky;top:96px;align-self:start;padding-top:48px;}
}
.indice-lateral ol{list-style:none;display:flex;flex-direction:column;gap:4px;border-left:2px solid var(--linea);}
.indice-lateral a{display:flex;gap:10px;align-items:baseline;min-height:44px;padding:10px 14px;margin-left:-2px;border-left:2px solid transparent;
  color:var(--suave);text-decoration:none;font:var(--t-small);}
.indice-lateral a span{font-weight:700;}
.indice-lateral a:hover,.indice-lateral a.activo{color:var(--tinta);border-left-color:var(--rosa);}
.indice-lateral a.activo span{color:var(--rosa);}

.portada{min-height:70vh;display:grid;align-content:center;gap:32px;padding:56px 0;}
.portada-texto{display:grid;gap:20px;}
@media (min-width:1100px){.portada-texto{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:end;gap:48px;}}
.portada h1{font:var(--t-display);font-size:clamp(34px,4.6vw,64px);line-height:1.04;}
.portada .resumen{font-size:1.12rem;line-height:1.6;}
.cifras{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}
.cifra-tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:22px;display:grid;gap:6px;box-shadow:var(--sombra);}
.cifra-valor{font:700 clamp(30px,3.2vw,44px)/1 var(--fuente);letter-spacing:var(--tracking-titulo);color:var(--tinta);}
.cifra-tarjeta.a_favor .cifra-valor{color:var(--verde);}
.cifra-tarjeta.cuidar .cifra-valor{color:var(--amarillo);}
.cifra-etiqueta{font:var(--t-small);color:var(--texto);}
.accesos{display:flex;flex-wrap:wrap;gap:8px;}
.accesos a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);
  color:var(--tinta);text-decoration:none;font:var(--t-small);font-weight:600;}
.accesos a:hover{border-color:var(--rosa);color:var(--rosa);}

.seccion{padding:72px 0;display:grid;gap:36px;}
.seccion.alterna{background:var(--gris);box-shadow:0 0 0 100vmax var(--gris);clip-path:inset(0 -100vmax);}
.seccion-cabeza{display:flex;gap:24px;align-items:flex-start;}
.seccion-num{font:700 clamp(44px,5vw,76px)/.9 var(--fuente);color:var(--linea);letter-spacing:-0.04em;}
:root[data-tema="oscuro"] .seccion-num{color:var(--suave);opacity:.45;}
.seccion-cabeza h2{font-size:clamp(28px,3vw,42px);}
.entrada{color:var(--suave);margin-top:6px;}
.subtitulo{font:var(--t-h3);color:var(--tinta);}

.rejilla{display:grid;gap:18px;grid-template-columns:1fr;}
@media (min-width:700px){.rejilla.dos,.rejilla.tres,.rejilla.cuatro{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (min-width:1100px){.rejilla.tres{grid-template-columns:repeat(3,minmax(0,1fr));}.rejilla.cuatro{grid-template-columns:repeat(4,minmax(0,1fr));}}
.pila{display:grid;gap:14px;align-content:start;}

.tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;box-shadow:var(--sombra);display:grid;gap:10px;align-content:start;}
.etiqueta{justify-self:start;display:inline-flex;font:var(--t-micro);letter-spacing:.04em;padding:5px 10px;border-radius:var(--r-pill);}
.etiqueta.a_favor{background:var(--verde-s);color:var(--verde);}
.etiqueta.cuidar{background:var(--amarillo-s);color:var(--amarillo);}
.etiqueta.oportunidad{background:var(--rosa-s);color:var(--rosa);}
.hallazgo h3{font-size:1.2rem;}
.mas summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--rosa);font:var(--t-small);font-weight:600;}
.mas summary::after{content:'+';font-weight:700;}
.mas[open] summary::after{content:'−';}
.mas summary::-webkit-details-marker{display:none;}

.lista{list-style:none;display:grid;gap:10px;}
.lista li{position:relative;padding-left:20px;}
.lista li::before{content:'';position:absolute;left:0;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--rosa);}

.perfil{display:grid;gap:14px;grid-template-columns:auto minmax(0,1fr);align-items:start;}
.avatar{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-weight:700;font-size:1.1rem;background:var(--azul-s);color:var(--azul);}
.perfil.primero .avatar{background:var(--rosa-s);color:var(--rosa);}
.perfil .cuerpo{display:grid;gap:10px;}
.cita{font:600 1.15rem/1.45 var(--fuente);color:var(--tinta);border-left:3px solid var(--rosa);padding-left:14px;}
.como-hablarle{padding:14px;border-radius:var(--r-sm);background:var(--gris);font:var(--t-small);font-weight:400;display:grid;gap:4px;}
.seccion.alterna .como-hablarle{background:var(--fondo);}
.como-hablarle b{color:var(--tinta);}

.pasos{list-style:none;display:grid;gap:18px;counter-reset:paso;}
@media (min-width:1100px){.pasos{grid-template-columns:repeat(auto-fit,minmax(0,1fr));grid-auto-flow:column;}}
.paso{counter-increment:paso;position:relative;display:grid;gap:10px;align-content:start;padding-top:60px;}
.paso::before{content:counter(paso);position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
  background:var(--rosa);color:var(--sobre-acento);font-weight:700;z-index:1;}
@media (min-width:1100px){.paso::after{content:'';position:absolute;top:21px;left:44px;right:-18px;height:2px;background:var(--linea);}.paso:last-child::after{display:none;}}
.paso dl{display:grid;gap:4px;}
.paso dt{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.destacado{background:var(--rosa-s);border:0;box-shadow:none;}
.destacado h3{color:var(--rosa);}

.pestanas{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--linea);scrollbar-width:none;}
.pestanas [role="tab"]{flex-shrink:0;min-height:48px;padding:0 20px;border:0;background:transparent;cursor:pointer;
  font:var(--t-small);font-weight:600;color:var(--suave);border-bottom:3px solid transparent;margin-bottom:-1px;}
.pestanas [role="tab"][aria-selected="true"]{color:var(--rosa);border-bottom-color:var(--rosa);}
.panel-tema{display:grid;gap:28px;padding-top:28px;}
.panel-titulo{font:var(--t-h2);}
html.js .panel-titulo{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
.grafica{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;display:grid;gap:12px;}
.grafica figcaption{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.barra-fila{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) auto;gap:14px;align-items:center;font:var(--t-small);}
.barra-nombre{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.barra-pista{position:relative;height:14px;border-radius:var(--r-pill);background:var(--gris);}
.barra-relleno{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--azul);}
.rango-tramo{position:absolute;top:0;bottom:0;border-radius:inherit;background:var(--verde);}
.rango-punto{position:absolute;top:-3px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--amarillo);}
.barra-fila.destacada{font-weight:700;color:var(--tinta);}
.barra-fila.destacada .barra-relleno{background:var(--rosa);}
.barra-valor{font-variant-numeric:tabular-nums;font-weight:600;color:var(--tinta);}
@media (max-width:699px){.barra-fila{grid-template-columns:1fr auto;}.barra-pista{grid-column:1/-1;grid-row:2;}}
.dato-grande{font:700 clamp(24px,2.4vw,34px)/1.1 var(--fuente);color:var(--tinta);}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;}
.chips li{padding:6px 12px;border-radius:var(--r-pill);background:var(--gris);font:var(--t-small);}
.fuente{font-size:.78rem;color:var(--suave);}
.sin-datos{color:var(--suave);font:var(--t-small);}

.pie{width:min(85%,1600px);margin:0 auto;padding:28px 0 56px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--linea);color:var(--suave);font:var(--t-small);}
@media (max-width:899px){.pie{width:auto;margin:0 16px;}}
.pie .logo{height:18px;width:auto;filter:brightness(0);}

html.js .aparece{opacity:0;translate:0 18px;transition:opacity .5s ease,translate .5s ease;}
html.js .aparece.visible{opacity:1;translate:0 0;}
:focus-visible{outline:none;box-shadow:var(--foco);border-radius:var(--r-sm);}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto;}
  html.js .aparece{opacity:1;translate:none;transition:none;}
}
@media print{
  .doc-barra,.indice-lateral,.pestanas,.accesos,#barra-op{display:none!important;}
  body{padding-top:0!important;}
  .pagina,.pie{width:auto;margin:0;}
  .marco{display:block;}
  .panel-tema[hidden]{display:grid!important;}
  html.js .panel-titulo{position:static;width:auto;height:auto;clip:auto;}
  html.js .aparece{opacity:1!important;translate:none!important;}
  .tarjeta,.grafica{box-shadow:none;break-inside:avoid;}
  .seccion.alterna{box-shadow:none;clip-path:none;}
}
`;

export const ESTILOS_INVESTIGACION = `${TOKENS_CSS}\n${DOCUMENTO}`;
```

Nota: `body{padding-top:0!important}` en impresión anula el desplazamiento que añade la barra de operador en la vista interna.

- [ ] **Step 5: `lectura.ts` editorial**

```ts
import type { Lectura } from '@/research/schemas';
import { iniciales } from '@/lib/ui/cliente-visual';
import { escapar, lista, encabezadoSeccion } from './comunes';

const ETIQUETA: Record<Lectura['descubrimos'][number]['tipo'], string> = {
  a_favor: 'A tu favor',
  cuidar: 'Hay que cuidar',
  oportunidad: 'Oportunidad',
};

export function seccionPortada(o: {
  eyebrow: string; titular: string; resumen: string; cifras: Lectura['cifras']; conIndice: boolean;
}): string {
  const cifras = o.cifras.length
    ? `<div class="cifras">${o.cifras.map((c) => `<div class="cifra-tarjeta ${c.tono} aparece">
        <span class="cifra-valor">${escapar(c.valor)}</span>
        <span class="cifra-etiqueta">${escapar(c.etiqueta)}</span>
      </div>`).join('')}</div>`
    : '';
  const accesos = o.conIndice
    ? `<nav class="accesos" aria-label="Ir a">
        <a href="#descubrimos">Qué descubrimos</a><a href="#cliente-ideal">Tu cliente ideal</a>
        <a href="#recomendamos">Qué te recomendamos</a><a href="#detalle">Detalle</a>
      </nav>`
    : '';
  return `<section class="portada" id="inicio">
    <div class="portada-texto">
      <div class="pila"><p class="eyebrow">${escapar(o.eyebrow)}</p><h1>${escapar(o.titular)}</h1></div>
      <p class="resumen">${escapar(o.resumen)}</p>
    </div>
    ${cifras}
    ${accesos}
  </section>`;
}

export function seccionDescubrimos(l: Lectura): string {
  return `<section class="seccion" id="descubrimos" data-seccion>
    ${encabezadoSeccion('01', 'Qué descubrimos', 'Lo más importante de la investigación, en pocas palabras.')}
    <div class="rejilla dos">
      ${l.descubrimos.map((d) => `<article class="tarjeta hallazgo aparece">
        <span class="etiqueta ${d.tipo}">${ETIQUETA[d.tipo]}</span>
        <h3>${escapar(d.titulo)}</h3>
        <p>${escapar(d.resumen)}</p>
        <details class="mas"><summary>Ver más</summary><p>${escapar(d.detalle)}</p></details>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionClienteIdeal(l: Lectura): string {
  const c = l.clienteIdeal;
  return `<section class="seccion alterna" id="cliente-ideal" data-seccion>
    ${encabezadoSeccion('02', 'Tu cliente ideal', 'A quién le vendes y qué la mueve.')}
    <div class="rejilla tres">
      <div class="tarjeta aparece"><h3>Quién es</h3><p>${escapar(c.quienEs)}</p></div>
      <div class="tarjeta aparece"><h3>Lo que le preocupa</h3>${lista(c.lePreocupa)}</div>
      <div class="tarjeta aparece"><h3>Lo que quiere lograr</h3>${lista(c.quiereLograr)}</div>
    </div>
    <div class="rejilla dos">
      ${c.perfiles.map((p, i) => `<article class="tarjeta perfil${i === 0 ? ' primero' : ''} aparece">
        <span class="avatar" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>
        <div class="cuerpo">
          <h3>${escapar(p.nombre)}</h3>
          <p class="suave">${escapar(p.descripcion)}</p>
          <blockquote class="cita">«${escapar(p.frase)}»</blockquote>
          <p class="como-hablarle"><b>Cómo hablarle</b>${escapar(p.comoHablarle)}</p>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionRecomendamos(l: Lectura): string {
  const r = l.recomendamos;
  const pendientes = l.faltaConfirmar.length
    ? `<div class="pila aparece"><h3 class="subtitulo">Lo que falta confirmar</h3><div class="suave">${lista(l.faltaConfirmar)}</div></div>`
    : '';
  return `<section class="seccion" id="recomendamos" data-seccion>
    ${encabezadoSeccion('03', 'Qué te recomendamos', 'Qué hacer, en orden de importancia.')}
    <ol class="pasos">
      ${r.pasos.map((p) => `<li class="paso aparece">
        <h3>${escapar(p.titulo)}</h3>
        <dl><dt>Qué hacer</dt><dd>${escapar(p.queHacer)}</dd></dl>
        <dl><dt>Por qué</dt><dd class="suave">${escapar(p.porQue)}</dd></dl>
      </li>`).join('')}
    </ol>
    <div class="pila">
      <h3 class="subtitulo">Dónde anunciarte</h3>
      <div class="rejilla cuatro">
        ${r.dondeAnunciarte.map((d) => `<div class="tarjeta aparece"><p class="dato-grande">${escapar(d.canal)}</p><p class="suave">${escapar(d.porQue)}</p></div>`).join('')}
      </div>
    </div>
    ${r.precio ? `<div class="tarjeta destacado aparece"><h3>Sobre tu precio</h3><p>${escapar(r.precio)}</p></div>` : ''}
    ${pendientes}
  </section>`;
}
```

- [ ] **Step 6: Ver que pasan**

Run: `npx vitest run tests/render/investigacion-base.test.ts tests/render/investigacion-lectura.test.ts`
Expected: PASS. `tests/render/investigacion.test.ts` puede fallar porque `documento.ts` aún llama a las firmas viejas. Si el build o la suite fallan solo por eso, adaptar las llamadas de `documento.ts` a las firmas nuevas de lo mínimo (`seccionPortada({ ... })`, sin `seccionFaltaConfirmar`), dejando la reescritura completa para R4. Correr `npm run build`.

- [ ] **Step 7: Commit**

```bash
git add src/render/investigacion tests/render
git commit -m "feat(investigación): estilos editoriales al 85%, portada con cifras y secciones numeradas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task R4: Detalle con pestañas y gráficas, marco con índice lateral e interacción

**Files:**
- Rewrite: `src/render/investigacion/detalle.ts`
- Rewrite: `src/render/investigacion/documento.ts`
- Modify: `src/render/barra-operador.ts` (rama research de `desplazamiento`)
- Rewrite: `tests/render/investigacion.test.ts`
- Modify: `tests/render/barra-operador.test.ts`

**Interfaces:**
- Consumes: R2 (`filasGrafica`, `graficaBarras`, `graficaRangos`), R3 (secciones, `encabezadoSeccion`, `ESTILOS_INVESTIGACION`), `normalizar` de `@/lib/ui/buscar`.
- Produces:
  - `seccionDetalle(inv: Investigacion, cliente: string): string` y `sintesisEditorial(s: Sintesis | null): string`.
  - `renderizarInvestigacion(inv, meta, barraOperador?)` y `SCRIPT_DOCUMENTO`, con las mismas firmas.

- [ ] **Step 1: Escribir las pruebas**

`tests/render/investigacion.test.ts` (reemplazo completo):
```ts
import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion, SCRIPT_DOCUMENTO } from '@/render/investigacion/documento';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';
import lectura from '../fixtures/lectura-ejemplo.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };
const conLectura = () => ({ ...(completa as any), lectura: { estado: 'ok', datos: lectura } });

describe('documento con lectura', () => {
  const html = renderizarInvestigacion(conLectura() as any, meta);

  it('arma el marco editorial con índice lateral y las cuatro secciones numeradas', () => {
    expect(html).toContain('class="pagina"');
    expect(html).toContain('class="indice-lateral"');
    for (const [num, id] of [['01', 'descubrimos'], ['02', 'cliente-ideal'], ['03', 'recomendamos'], ['04', 'detalle']]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`class="seccion-num">${num}<`);
    }
  });

  it('pone las cifras en la portada', () => {
    expect((html.match(/class="cifra-tarjeta/g) ?? []).length).toBe(3);
  });

  it('el detalle tiene cuatro pestañas accesibles, todas visibles sin JS', () => {
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(4);
    expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(4);
    expect(html).not.toMatch(/role="tabpanel"[^>]*hidden/);
  });

  it('sin restos del deck ni del detalle plegado', () => {
    for (const r of ['class="panel', 'id="deck"', '<details class="detalle"']) expect(html).not.toContain(r);
  });

  it('trae el tema, el título y marca js antes de pintar', () => {
    expect(html).toContain('wozial-tema');
    expect(html).toContain("classList.add('js')");
    expect(html).toContain('<title>Investigación · Ana Villa · Cosmetología</title>');
  });
});

describe('detalle', () => {
  it('declara los temas sin datos y conserva los que sí tienen', () => {
    const h = renderizarInvestigacion(parcial as any, meta);
    expect((h.match(/No se obtuvo información sobre este tema/g) ?? []).length).toBe(3);
    expect(h).toContain('Instituto Bellezza GDL');
    expect(h).toContain('6 meses');
  });

  it('dibuja la gráfica de precios cuando hay al menos dos montos legibles', () => {
    const c = JSON.parse(JSON.stringify(completa));
    const d = c.competencia.datos.directos;
    const legibles = [...d, ...c.competencia.datos.indirectos].filter((x: any) => /\d/.test(x.precio)).length;
    const h = renderizarInvestigacion(c, meta);
    if (legibles >= 2) expect(h).toContain('class="grafica"');
    else expect(h).not.toContain('Precio de cada opción');
  });

  it('escapa las URL de las fuentes', () => {
    const c = JSON.parse(JSON.stringify(completa));
    c.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    expect(renderizarInvestigacion(c, meta)).not.toContain('<script>alert(1)</script>');
  });
});

describe('respaldo sin lectura', () => {
  it('muestra la síntesis con el mismo diseño y el detalle en pestañas, sin cifras de portada', () => {
    const h = renderizarInvestigacion(completa as any, meta);
    expect(h).not.toContain('id="descubrimos"');
    expect(h).not.toContain('class="cifra-tarjeta');
    expect(h).toContain((completa as any).sintesis.datos.hallazgos[0].titulo);
    expect(h).toContain('role="tablist"');
  });
  it('una lectura vacía también usa el respaldo', () => {
    const h = renderizarInvestigacion({ ...(completa as any), lectura: { estado: 'vacio', razon: 'x' } }, meta);
    expect(h).not.toContain('id="descubrimos"');
  });
});

describe('interacción', () => {
  it('el script del documento es JavaScript válido', () => {
    expect(() => new Function(SCRIPT_DOCUMENTO)).not.toThrow();
  });
  it('maneja pestañas con flechas, índice activo, apariciones e impresión', () => {
    for (const s of ['ArrowRight', 'IntersectionObserver', 'beforeprint', 'afterprint']) expect(SCRIPT_DOCUMENTO).toContain(s);
  });
  it('inyecta la barra de operador cuando se pasa', () => {
    expect(renderizarInvestigacion(completa as any, meta, '<div id="barra-op"></div>')).toContain('id="barra-op"');
  });
});
```

En `tests/render/barra-operador.test.ts`, añadir al caso de research:
```ts
    expect(b).toContain('scroll-padding-top:calc(var(--barra-h) + 96px)');
    expect(b).toContain('.indice-lateral{top:calc(var(--barra-h) + 96px);}');
```

- [ ] **Step 2: Ver que fallan**

Run: `npx vitest run tests/render/investigacion.test.ts tests/render/barra-operador.test.ts`
Expected: FAIL.

- [ ] **Step 3: `detalle.ts`**

```ts
import type { Investigacion, Competencia, Audiencia, Canales, Mercado, Sintesis, Competidor } from '@/research/schemas';
import { normalizar } from '@/lib/ui/buscar';
import { escapar, fuente, lista, sinDatos, encabezadoSeccion } from './comunes';
import { filasGrafica, graficaBarras, graficaRangos } from './graficas';

type Etapa<T> = { estado: 'ok'; datos: T } | { estado: 'vacio'; razon: string } | undefined;
const datos = <T>(e: Etapa<T>): T | null => (e && e.estado === 'ok' ? e.datos : null);

function tarjetaCompetidor(c: Competidor): string {
  return `<article class="tarjeta">
    <h4>${escapar(c.nombre)}</h4>
    <p class="dato-grande">${escapar(c.precio)}</p>
    <p>${escapar(c.producto)}</p>
    <ul class="chips"><li>${escapar(c.duracion)}</li><li>${escapar(c.modalidad)}</li><li>${escapar(c.aval)}</li></ul>
    ${fuente(c.fuente)}
  </article>`;
}

function panelCompetencia(c: Competencia | null, cliente: string): string {
  if (!c) return sinDatos();
  const clienteN = normalizar(cliente);
  const todos = [...c.directos, ...c.indirectos];
  const filas = filasGrafica(todos, (x) => x.nombre, (x) => x.precio,
    (x) => /\(el cliente\)/i.test(x.nombre) || (clienteN.length > 0 && normalizar(x.nombre).includes(clienteN)));
  return `${graficaBarras(filas, 'Precio de cada opción')}
    ${c.directos.length ? `<div class="pila"><h4>Competencia directa</h4><div class="rejilla tres">${c.directos.map(tarjetaCompetidor).join('')}</div></div>` : ''}
    ${c.indirectos.length ? `<div class="pila"><h4>Otras opciones que compiten por el mismo presupuesto</h4><div class="rejilla tres">${c.indirectos.map(tarjetaCompetidor).join('')}</div></div>` : ''}
    ${c.referentes.length ? `<div class="pila"><h4>Cuentas de referencia</h4><div class="rejilla cuatro">${c.referentes.map((r) => `<div class="tarjeta">
      <p class="dato-grande">${escapar(r.seguidores.toLocaleString('en-US'))}</p><p>${escapar(r.cuenta)} · ${escapar(r.pais)}</p>${fuente(r.fuente)}</div>`).join('')}</div></div>` : ''}
    ${c.hallazgos.length ? `<div class="tarjeta"><h4>Lo que muestra</h4>${lista(c.hallazgos)}</div>` : ''}`;
}

function panelAudiencia(a: Audiencia | null): string {
  if (!a) return sinDatos();
  const citas = (cs: Audiencia['dolores']) => cs.map((c) => `<article class="tarjeta">
    <blockquote class="cita">«${escapar(c.texto)}»</blockquote>
    <p class="suave">${escapar(c.contexto)}</p>${fuente(c.fuente)}</article>`).join('');
  return `<div class="tarjeta destacado"><h3>Lo que más la frena: ${escapar(a.miedoPrincipal.nombre)}</h3>
      <p>${escapar(a.miedoPrincipal.evidencia)}</p>${fuente(a.miedoPrincipal.fuente)}</div>
    <div class="rejilla dos">
      <div class="pila"><h4>Lo que le duele, en sus palabras</h4>${citas(a.dolores) || sinDatos()}</div>
      <div class="pila"><h4>Lo que desea</h4>${citas(a.aspiraciones) || sinDatos()}</div>
    </div>
    <div class="tarjeta"><h4>Qué cree que está comprando</h4><p>${escapar(a.unidadDeCompra)}</p></div>`;
}

function panelCanales(c: Canales | null): string {
  if (!c) return sinDatos();
  return `<div class="rejilla tres">${c.plataformas.map((p) => `<article class="tarjeta">
      <h4>${escapar(p.nombre)}</h4><p class="dato-grande">${escapar(p.alcance)}</p><p class="suave">${escapar(p.notas)}</p>${fuente(p.fuente)}</article>`).join('')}</div>
    <div class="rejilla dos">
      ${c.formatos.length ? `<div class="tarjeta"><h4>Formatos que funcionan</h4><ul class="chips">${c.formatos.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul></div>` : ''}
      ${c.tendencias.length ? `<div class="tarjeta"><h4>Tendencias</h4><ul class="chips">${c.tendencias.map((t) => `<li>${escapar(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="tarjeta"><h4>Horarios</h4><p>${escapar(c.horarios)}</p></div>
      ${c.advertenciaRegulatoria ? `<div class="tarjeta destacado"><h4>Advertencia</h4><p>${escapar(c.advertenciaRegulatoria)}</p></div>` : ''}
    </div>`;
}

function panelMercado(m: Mercado | null): string {
  if (!m) return sinDatos();
  const rangos = filasGrafica(m.salarios, (s) => s.puesto, (s) => s.rango);
  return `<div class="rejilla cuatro">${m.datos.map((d) => `<div class="tarjeta">
      <p class="dato-grande">${escapar(d.valor)}</p><p>${escapar(d.etiqueta)}</p>${fuente(d.fuente)}</div>`).join('')}</div>
    ${graficaRangos(rangos, 'Ingreso mensual')}
    ${m.salarios.length ? `<div class="rejilla tres">${m.salarios.map((s) => `<div class="tarjeta"><h4>${escapar(s.puesto)}</h4><p class="dato-grande">${escapar(s.rango)}</p>${fuente(s.fuente)}</div>`).join('')}</div>` : ''}
    ${m.regulacion.length ? `<div class="pila"><h4>Regulación</h4><div class="rejilla dos">${m.regulacion.map((r) => `<div class="tarjeta"><h4>${escapar(r.norma)}</h4><p>${escapar(r.implicacion)}</p>${fuente(r.fuente)}</div>`).join('')}</div></div>` : ''}
    ${m.crecimiento ? `<div class="tarjeta destacado"><h3>Crecimiento</h3><p>${escapar(m.crecimiento)}</p></div>` : ''}`;
}

const TEMAS = [
  { clave: 'competencia', nombre: 'Competencia' },
  { clave: 'audiencia', nombre: 'Tu cliente' },
  { clave: 'canales', nombre: 'Canales' },
  { clave: 'mercado', nombre: 'Mercado' },
] as const;

export function seccionDetalle(inv: Investigacion, cliente: string): string {
  const contenido: Record<(typeof TEMAS)[number]['clave'], string> = {
    competencia: panelCompetencia(datos(inv.competencia), cliente),
    audiencia: panelAudiencia(datos(inv.audiencia)),
    canales: panelCanales(datos(inv.canales)),
    mercado: panelMercado(datos(inv.mercado)),
  };
  // Sin JS los cuatro paneles quedan visibles uno tras otro; el script oculta los no elegidos.
  return `<section class="seccion alterna" id="detalle" data-seccion>
    ${encabezadoSeccion('04', 'Detalle de la investigación', 'Los datos que sostienen todo lo anterior, con sus fuentes.')}
    <div>
      <div class="pestanas" role="tablist" aria-label="Detalle por tema">
        ${TEMAS.map((t, i) => `<button type="button" role="tab" id="tab-${t.clave}" aria-controls="panel-${t.clave}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.nombre}</button>`).join('')}
      </div>
      ${TEMAS.map((t) => `<div class="panel-tema" role="tabpanel" id="panel-${t.clave}" aria-labelledby="tab-${t.clave}">
        <h3 class="panel-titulo">${t.nombre}</h3>
        ${contenido[t.clave]}
      </div>`).join('')}
    </div>
  </section>`;
}

/** Respaldo cuando aún no hay lectura: la síntesis, con el mismo diseño. */
export function sintesisEditorial(s: Sintesis | null): string {
  if (!s) return '';
  const tipos: Record<string, string> = { prioritario: 'Prioridad', expansion: 'Después', descartado: 'Descartado' };
  return `<section class="seccion" id="sintesis" data-seccion>
    ${encabezadoSeccion('01', 'Lo más importante', 'La síntesis estratégica de la investigación.')}
    <div class="rejilla dos">${s.hallazgos.map((h) => `<article class="tarjeta aparece"><h3>${escapar(h.titulo)}</h3><p>${escapar(h.texto)}</p></article>`).join('')}</div>
    <div class="tarjeta destacado aparece"><h3>${escapar(s.posicionamiento.frase)}</h3><p>${escapar(s.posicionamiento.sustento)}</p></div>
    <div class="rejilla tres">${s.focos.map((f) => `<article class="tarjeta aparece"><p class="eyebrow">${escapar(tipos[f.tipo] ?? f.tipo)}</p><h3>${escapar(f.nombre)}</h3><p>${escapar(f.razon)}</p></article>`).join('')}</div>
  </section>`;
}
```

- [ ] **Step 4: `documento.ts`**

```ts
import type { Investigacion, Sintesis } from '@/research/schemas';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { escapar } from './comunes';
import { ESTILOS_INVESTIGACION } from './estilos';
import { seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos } from './lectura';
import { seccionDetalle, sintesisEditorial } from './detalle';

export type MetaInvestigacion = { cliente: string; giro: string; fecha: string };

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

/**
 * Interacción del documento, en ES5 y sin módulos: se guarda y se abre suelto.
 * Todo lo que hace es mejora: sin este script el contenido completo ya se lee.
 */
export const SCRIPT_DOCUMENTO = `(function () {
  var raiz = document.documentElement;

  // Tema
  var botonesTema = document.querySelectorAll('[data-tema-valor]');
  function sincronizarTema() {
    for (var i = 0; i < botonesTema.length; i++) {
      botonesTema[i].setAttribute('aria-checked', String(botonesTema[i].getAttribute('data-tema-valor') === raiz.getAttribute('data-tema')));
    }
  }
  for (var i = 0; i < botonesTema.length; i++) {
    botonesTema[i].addEventListener('click', function () {
      if (window.__wozialTema) window.__wozialTema.elegir(this.getAttribute('data-tema-valor'));
    });
  }
  document.addEventListener('wozial:tema', sincronizarTema);
  sincronizarTema();

  // Pestañas del detalle
  var pestanas = document.querySelectorAll('[role="tab"]');
  function elegir(tab, enfocar) {
    for (var j = 0; j < pestanas.length; j++) {
      var activa = pestanas[j] === tab;
      pestanas[j].setAttribute('aria-selected', String(activa));
      pestanas[j].setAttribute('tabindex', activa ? '0' : '-1');
      var panel = document.getElementById(pestanas[j].getAttribute('aria-controls'));
      if (panel) panel.hidden = !activa;
    }
    if (enfocar) tab.focus();
  }
  for (var k = 0; k < pestanas.length; k++) {
    (function (indice) {
      pestanas[indice].addEventListener('click', function () { elegir(pestanas[indice], false); });
      pestanas[indice].addEventListener('keydown', function (e) {
        var paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!paso) return;
        e.preventDefault();
        elegir(pestanas[(indice + paso + pestanas.length) % pestanas.length], true);
      });
    })(k);
  }
  if (pestanas.length) elegir(pestanas[0], false);

  // Índice activo y apariciones
  var enlaces = document.querySelectorAll('.indice-lateral a');
  var aparece = document.querySelectorAll('.aparece');
  if ('IntersectionObserver' in window) {
    var visor = new IntersectionObserver(function (entradas) {
      for (var m = 0; m < entradas.length; m++) {
        if (!entradas[m].isIntersecting) continue;
        var id = entradas[m].target.id;
        for (var n = 0; n < enlaces.length; n++) {
          enlaces[n].classList.toggle('activo', enlaces[n].getAttribute('href') === '#' + id);
        }
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    var secciones = document.querySelectorAll('[data-seccion]');
    for (var p = 0; p < secciones.length; p++) visor.observe(secciones[p]);

    var revela = new IntersectionObserver(function (entradas) {
      for (var q = 0; q < entradas.length; q++) {
        if (entradas[q].isIntersecting) { entradas[q].target.classList.add('visible'); revela.unobserve(entradas[q].target); }
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (var r = 0; r < aparece.length; r++) revela.observe(aparece[r]);
  } else {
    for (var s = 0; s < aparece.length; s++) aparece[s].classList.add('visible');
  }

  // Impresión: claro, todo visible y los desplegables abiertos; después se restaura.
  var temaPrevio = null, cerrados = [];
  window.addEventListener('beforeprint', function () {
    temaPrevio = raiz.getAttribute('data-tema');
    raiz.setAttribute('data-tema', 'claro');
    cerrados = [];
    var ds = document.querySelectorAll('details');
    for (var t = 0; t < ds.length; t++) { if (!ds[t].open) { cerrados.push(ds[t]); ds[t].open = true; } }
    for (var u = 0; u < aparece.length; u++) aparece[u].classList.add('visible');
  });
  window.addEventListener('afterprint', function () {
    if (temaPrevio) raiz.setAttribute('data-tema', temaPrevio);
    for (var v = 0; v < cerrados.length; v++) cerrados[v].open = false;
  });
})();`;

export function renderizarInvestigacion(inv: Investigacion, meta: MetaInvestigacion, barraOperador = ''): string {
  const lectura = inv.lectura?.estado === 'ok' ? inv.lectura.datos : null;
  const sintesis: Sintesis | null = inv.sintesis.estado === 'ok' ? inv.sintesis.datos : null;
  const eyebrow = `Investigación de mercado · ${meta.fecha}`;

  const indice = lectura
    ? [['01', 'descubrimos', 'Qué descubrimos'], ['02', 'cliente-ideal', 'Tu cliente ideal'], ['03', 'recomendamos', 'Qué te recomendamos'], ['04', 'detalle', 'Detalle']]
    : [...(sintesis ? [['01', 'sintesis', 'Lo más importante']] : []), ['04', 'detalle', 'Detalle']];

  const cuerpo = lectura
    ? [
        seccionPortada({ eyebrow, titular: lectura.portada.titular, resumen: lectura.portada.resumen, cifras: lectura.cifras, conIndice: true }),
        seccionDescubrimos(lectura),
        seccionClienteIdeal(lectura),
        seccionRecomendamos(lectura),
        seccionDetalle(inv, meta.cliente),
      ].join('\n')
    : [
        seccionPortada({ eyebrow, titular: meta.cliente, resumen: meta.giro, cifras: [], conIndice: false }),
        sintesisEditorial(sintesis),
        seccionDetalle(inv, meta.cliente),
      ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Investigación · ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="theme-color" content="${COLOR_BARRA.claro}">
<script>${SCRIPT_TEMA}</script>
<script>document.documentElement.classList.add('js');</script>
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
<div class="pagina"><div class="marco">
  <nav class="indice-lateral" aria-label="Secciones">
    <ol>${indice.map(([num, id, nombre]) => `<li><a href="#${id}"><span>${num}</span>${nombre}</a></li>`).join('')}</ol>
  </nav>
  <main>
${cuerpo}
  </main>
</div></div>
<footer class="pie">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span>Preparado por Wozial · ${escapar(meta.fecha)}</span>
</footer>
<script>${SCRIPT_DOCUMENTO}</script>
</body></html>`;
}
```

Nota: `html.js` se marca en el `<head>` y no al final del cuerpo. Si se marcara al final, el contenido aparecería, se ocultaría y volvería a aparecer.

- [ ] **Step 5: Barra de operador**

En `src/render/barra-operador.ts`, dentro de la rama research de `desplazamiento`, justo después de `body{padding-top:var(--barra-h);}`, añadir:
```css
       /* La barra fija se suma a la cabecera del documento: sin esto, las anclas
          del índice dejan el título de la sección debajo de las dos barras. */
       html{scroll-padding-top:calc(var(--barra-h) + 96px);}
       .indice-lateral{top:calc(var(--barra-h) + 96px);}
```

- [ ] **Step 6: Ver que pasan**

Run: `npx vitest run tests/render`, luego `npm test` y `npm run build`.
Expected: todo en verde, incluido `tests/render/ejemplo.test.ts` (sigue conteniendo `$3,450`, `$36,792` y `$6,480`). Si `ejemplo.test.ts` busca `<details class="detalle" open>`, cambiar esa aserción por `expect(html).toContain('role="tablist"');`.

- [ ] **Step 7: Commit**

```bash
git add src/render tests/render
git commit -m "feat(investigación): detalle en pestañas con gráficas, índice lateral e interacción

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task R5: Verificación visual

**Files:** ninguno, salvo correcciones.

- [ ] **Step 1: Pruebas y build**

Run: `npm test 2>&1 | tail -6 && npm run build 2>&1 | tail -3`
Expected: todo en verde.

- [ ] **Step 2: Resembrar la lectura local v2 (sin API)**

Solo en la base local, sustituir la lectura de la única investigación por el fixture nuevo:
```bash
python3 -c "
import json
d=json.load(open('tests/fixtures/lectura-ejemplo.json'))
j=json.dumps({'estado':'ok','datos':d},ensure_ascii=False).replace(\"'\",\"''\")
print(\"update research_results set datos = jsonb_set(datos::jsonb, '{lectura}', '\"+j+\"'::jsonb) where id=(select id from research_results order by created_at limit 1);\")
" | docker exec -i wozial-pg psql -U wozial -d wozial_studio
```
Expected: `UPDATE 1`.

- [ ] **Step 3: Recorrido**

En el Browser pane, abrir el link público de esa investigación (`select token from share_links where documento_tipo='research' and not revocado limit 1` → `http://localhost:4321/p/x/<token>`) y revisar:
- A 1440 px en claro: el contenido ocupa ~85% (medir con `document.querySelector('.pagina').getBoundingClientRect().width / innerWidth`, ≈ 0.85), el índice lateral marca la sección, las cifras de portada, «Ver más», pasos en fila, pestañas que cambian con clic y con flechas, gráfica de precios.
- A 375 px en oscuro: una columna, sin desbordamiento horizontal (`document.documentElement.scrollWidth <= innerWidth`) y pasos en vertical.

- [ ] **Step 4: Informe**

Resumir para el usuario qué cambió y pedirle que revise `/resultados/<id>` con su sesión.
