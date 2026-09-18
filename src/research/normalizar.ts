import type { ZodType } from 'zod';

/**
 * Normalización de lo que devuelve el modelo en las etapas con búsqueda web.
 *
 * Nace del incidente de «Mar de miel» (15.70 USD, una sola etapa entregada):
 * el modelo mandaba `horarios` como arreglo, cada término de `jerga` como
 * objeto `{ termino, significado }` y competidores sin `duracion` ni `aval`
 * (no es un negocio educativo). Los esquemas exigían `string` a secas, así que
 * zod rechazaba respuestas con contenido perfectamente útil y la etapa entera
 * —búsquedas web incluidas— se tiraba. Aquí se convierte la forma en vez de
 * rechazarla: un arreglo se une en texto, un objeto se lee como «clave: valor»,
 * lo que falta queda vacío.
 */

/** Cualquier valor a texto legible. `null`/`undefined` dan cadena vacía. */
export function aTexto(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(aTexto).filter((t) => t.trim() !== '').join('; ');
  if (typeof v === 'object') {
    const valores = Object.values(v as Record<string, unknown>).map(aTexto).filter((t) => t.trim() !== '');
    if (valores.length <= 1) return valores[0] ?? '';
    // `{ termino: 'x', significado: 'y', ejemplo: 'z' }` → «x: y; z». El
    // primer valor suele ser el nombre de la cosa y el resto su explicación.
    return `${valores[0]}: ${valores.slice(1).join('; ')}`;
  }
  return String(v);
}

/** Texto o `null`: vacío, `"null"` y `"n/a"` cuentan como «no aplica». */
export function aTextoONulo(v: unknown): string | null {
  const t = aTexto(v).trim();
  return t === '' || /^(null|n\/?a|no aplica|ninguna?)$/i.test(t) ? null : t;
}

/** Cualquier valor a arreglo: `null` da `[]` y un valor suelto se envuelve. */
export function aArreglo(v: unknown): unknown[] {
  if (v === null || v === undefined || v === '') return [];
  return Array.isArray(v) ? v : [v];
}

/** Arreglo de textos sin vacíos. */
export function aListaDeTextos(v: unknown): string[] {
  return aArreglo(v).map(aTexto).filter((t) => t.trim() !== '');
}

/**
 * Número entero de seguidores. Acepta «12,400», «1.2M», «15 mil», «850K».
 * Lo que no se entiende se devuelve tal cual para que zod lo rechace y el
 * referente se descarte, en vez de inventarle una cifra.
 */
export function aEntero(v: unknown): unknown {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : v;
  if (typeof v !== 'string') return v;
  const m = v.trim().toLowerCase().replace(/,/g, '').match(/^([\d.]+)\s*(k|m|mil|millones?)?\b/);
  if (!m) return v;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return v;
  const factor = m[2] === 'k' || m[2] === 'mil' ? 1_000 : m[2] ? 1_000_000 : 1;
  return Math.round(base * factor);
}

type Ruta = PropertyKey[];

function leer(raiz: unknown, ruta: Ruta): unknown {
  let actual: any = raiz;
  for (const k of ruta) {
    if (actual === null || typeof actual !== 'object') return undefined;
    actual = actual[k as any];
  }
  return actual;
}

/**
 * Quita de `raiz` el nodo en `ruta`. Si el nodo es un elemento de arreglo, lo
 * saca del arreglo; si es una propiedad, la borra (y el `default` del esquema
 * la rellena en el siguiente intento). Devuelve false si no había nada que
 * quitar.
 */
function quitar(raiz: unknown, ruta: Ruta): boolean {
  if (!ruta.length) return false;
  const padre = leer(raiz, ruta.slice(0, -1)) as any;
  const clave = ruta[ruta.length - 1];
  if (padre === null || typeof padre !== 'object') return false;
  if (Array.isArray(padre) && typeof clave === 'number') {
    if (clave >= padre.length) return false;
    padre.splice(clave, 1);
    return true;
  }
  if (!(clave in padre)) return false;
  delete padre[clave as any];
  return true;
}

/**
 * Recorta un texto a `max` caracteres con elipsis, por palabra completa si no
 * se pierde demasiado. El resultado, elipsis incluida, cabe en `max`.
 */
export function recortar(t: string, max: number): string {
  if (t.length <= max) return t;
  if (max <= 1) return t.slice(0, max);
  const corte = t.slice(0, max - 1);
  const espacio = corte.lastIndexOf(' ');
  const base = espacio >= max * 0.6 ? corte.slice(0, espacio) : corte;
  return `${base.replace(/[\s,;:.\-–—]+$/u, '')}…`;
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

/** «Prueba social» → «prueba_social» si esa es una de las opciones válidas. */
function opcionParecida(v: unknown, opciones: unknown[]): unknown {
  if (typeof v !== 'string') return undefined;
  const clave = sinAcentos(v).replace(/[\s-]+/g, '_');
  return opciones.find((o) => typeof o === 'string' && sinAcentos(o).replace(/[\s-]+/g, '_') === clave);
}

function escribir(raiz: unknown, ruta: Ruta, valor: unknown): boolean {
  if (!ruta.length) return false;
  const padre = leer(raiz, ruta.slice(0, -1)) as any;
  if (padre === null || typeof padre !== 'object') return false;
  padre[ruta[ruta.length - 1] as any] = valor;
  return true;
}

/**
 * Ajusta en el sitio lo que no cumple el esquema pero tiene arreglo obvio.
 * Devuelve la lista de ajustes hechos en esta pasada (vacía si no hubo).
 */
function ajustarUnaPasada(schema: ZodType<unknown>, obj: unknown): string[] | null {
  const r = schema.safeParse(obj);
  if (r.success) return null;
  const ajustes: string[] = [];
  const recortesDeArreglo: Array<{ ruta: Ruta; max: number }> = [];

  for (const issue of r.error.issues as any[]) {
    const ruta: Ruta = [...issue.path];
    if (!ruta.length) continue; // p. ej. un superRefine de todo el objeto: no es de forma
    const valor = leer(obj, ruta);
    const donde = ruta.join('.');
    // Un campo que falta no se rellena aquí: con un "" o un [] genérico,
    // cualquier respuesta vacía pasaría por buena. Lo que puede faltar lo
    // declara cada esquema (los de investigación, por ejemplo) como opcional.
    if (valor === undefined) continue;

    if (issue.code === 'too_big' && issue.origin === 'string' && typeof valor === 'string') {
      escribir(obj, ruta, recortar(valor, issue.maximum));
      ajustes.push(`${donde}: recortado a ${issue.maximum} caracteres`);
    } else if (issue.code === 'too_big' && issue.origin === 'array' && Array.isArray(valor)) {
      recortesDeArreglo.push({ ruta, max: issue.maximum });
    } else if (issue.code === 'invalid_type' && issue.expected === 'string') {
      escribir(obj, ruta, aTexto(valor));
      ajustes.push(`${donde}: convertido a texto`);
    } else if (issue.code === 'invalid_type' && issue.expected === 'array') {
      escribir(obj, ruta, aArreglo(valor));
      ajustes.push(`${donde}: convertido a lista`);
    } else if (issue.code === 'invalid_type' && issue.expected === 'number') {
      const n = aEntero(valor);
      if (typeof n === 'number' && Number.isFinite(n)) {
        escribir(obj, ruta, n);
        ajustes.push(`${donde}: convertido a número`);
      }
    } else if (issue.code === 'invalid_type' && issue.expected === 'boolean' && typeof valor === 'string') {
      const b = /^(true|s[ií]|yes|1)$/i.test(valor.trim()) ? true : /^(false|no|0)$/i.test(valor.trim()) ? false : undefined;
      if (b !== undefined) {
        escribir(obj, ruta, b);
        ajustes.push(`${donde}: convertido a sí/no`);
      }
    } else if (issue.code === 'invalid_value' && Array.isArray(issue.values)) {
      const opcion = opcionParecida(valor, issue.values);
      if (opcion !== undefined) {
        escribir(obj, ruta, opcion);
        ajustes.push(`${donde}: «${valor}» → «${opcion}»`);
      }
    }
  }

  // Los recortes de arreglo van al final: cambian índices que otros issues usan.
  for (const { ruta, max } of recortesDeArreglo) {
    const arr = leer(obj, ruta);
    if (Array.isArray(arr) && arr.length > max) {
      arr.length = max;
      ajustes.push(`${ruta.join('.')}: se quedaron los primeros ${max}`);
    }
  }
  return ajustes;
}

/**
 * Normalizador compartido de `pedirJson`, para todos los agentes: ajusta la
 * respuesta del modelo al esquema en vez de rechazarla por forma.
 *
 * - Texto que excede su `max` → se recorta con elipsis. Los límites siguen en
 *   el prompt como guía; un «funcion» de 131 caracteres no debe tumbar la
 *   estrategia entera del mapa de pilares (Mar de miel, 0.24 USD perdidos).
 * - Más elementos de los permitidos → se quedan los primeros.
 * - Arreglo u objeto donde va texto → texto legible; texto donde va lista →
 *   lista de uno. Lo que FALTA no se inventa aquí: lo decide cada esquema
 *   (los de investigación lo aceptan vacío; el resto lo pide en el reintento).
 * - Número escrito como texto («12.4K») → número; opción de un enum escrita
 *   con otra forma («Prueba social») → la opción válida.
 *
 * Lo que no tiene arreglo obvio (faltan elementos, reglas de negocio de un
 * `superRefine`, URLs inválidas) se deja: eso sí lo corrige el reintento o
 * lo descarta el rescate. No toca `crudo`: trabaja sobre una copia.
 */
export function ajustarAlEsquema(
  schema: ZodType<unknown>,
  crudo: unknown,
  maxPasadas = 8,
): { valor: unknown; ajustes: string[] } {
  if (crudo === null || typeof crudo !== 'object') return { valor: crudo, ajustes: [] };
  const valor = structuredClone(crudo);
  const ajustes: string[] = [];
  for (let i = 0; i < maxPasadas; i++) {
    const hechos = ajustarUnaPasada(schema, valor);
    if (!hechos || !hechos.length) break;
    ajustes.push(...hechos);
  }
  return { valor, ajustes };
}

/**
 * Último recurso cuando ni la respuesta ni su corrección cumplen el esquema:
 * se descarta lo que no valida, en vez de la etapa entera.
 *
 * Por cada problema que reporta zod se quita el elemento de arreglo más
 * profundo que lo contiene (un competidor sin fuente, una cita con URL rota),
 * o la propiedad si no está dentro de un arreglo. Si quitar la propiedad no
 * basta (el esquema la exige), se sube un nivel. Se detiene al validar, o si ya
 * no queda nada que quitar sin tocar la raíz: en ese caso devuelve `null` y la
 * etapa falla como antes.
 */
export function rescatarParcial<T>(
  schema: ZodType<T>,
  crudo: unknown,
  maxRondas = 60,
): { datos: T; descartes: string[] } | null {
  if (crudo === null || typeof crudo !== 'object') return null;
  const copia = structuredClone(crudo);
  const descartes: string[] = [];

  for (let ronda = 0; ronda < maxRondas; ronda++) {
    // Quitar un elemento puede dejar al descubierto algo que sí se ajusta.
    for (let i = 0; i < 8 && ajustarUnaPasada(schema as ZodType<unknown>, copia)?.length; i++);
    const r = schema.safeParse(copia);
    if (r.success) return { datos: r.data, descartes };

    // Un problema por ronda: quitar un elemento de arreglo desplaza los
    // índices de los demás, así que las rutas del resto ya no valen.
    const issue = r.error.issues[0];
    let ruta: Ruta = [...issue.path];
    // Dentro de un arreglo, se descarta el elemento completo.
    const ultimoIndice = ruta.map((k) => typeof k === 'number').lastIndexOf(true);
    if (ultimoIndice >= 0) ruta = ruta.slice(0, ultimoIndice + 1);

    let quitado = false;
    while (ruta.length && !quitado) {
      quitado = quitar(copia, ruta);
      if (quitado) descartes.push(`${ruta.join('.')} (${issue.message})`);
      else ruta = ruta.slice(0, -1);
    }
    if (!quitado) return null;
  }
  return null;
}
