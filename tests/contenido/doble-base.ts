// Una base de datos en miniatura para las pruebas del lote mensual.
//
// No es el doble de siempre —el de `servicio.test.ts` y `auto-aprobacion.test.ts`,
// que devuelve filas fijas y solo apunta los `set`— y la diferencia importa: lo
// que estas pruebas siguen son **secuencias** de escrituras donde cada paso lee
// lo que escribió el anterior (compartir → pedir cambios → recompartir → dar de
// alta una pieza → que venza el plazo). Con filas fijas esa clase de error es
// literalmente invisible, porque el segundo paso nunca ve lo que hizo el
// primero.
//
// Por eso este doble **guarda filas y respeta el `WHERE`**: las condiciones de
// Drizzle se interpretan (solo `eq`, `and`, `isNotNull`, `lt` y `lte`, que es
// todo lo que usan los módulos bajo prueba; cualquier otra revienta en vez de
// pasar de largo). Eso es lo que permite afirmar que una escritura toca las
// filas que dice tocar y no las demás.
//
// `lte` se entiende también **entre dos columnas** (`lte(a, b)`, sin valor de
// por medio), que es como el prefiltro de `autoAprobarVencidos` pregunta si el
// contenido del lote se tocó después de compartirlo. Se emula con la semántica
// de SQL y no con la de JavaScript: si cualquiera de los dos lados es nulo, la
// comparación no es cierta y la fila queda fuera —en SQL daría NULL—, en vez de
// colarse por un `undefined <= fecha`.
//
// Vive en su propio archivo —y no dentro de un `.test.ts`— para que lo compartan
// los archivos que lo necesitan sin copiarlo: dos copias de un doble se
// desincronizan, y un doble que entiende menos `WHERE` que el código real da
// pruebas en verde sobre escrituras que en producción tocan otras filas. El
// `include` de `vitest.config.ts` es `tests/**/*.test.ts`, así que este archivo
// no se ejecuta como suite.

import { Column, getTableColumns } from 'drizzle-orm';

export type Fila = Record<string, unknown>;

/**
 * Las tablas que el doble conoce. Quien lo usa estrena estos arrays en cada
 * prueba (`beforeEach`), así que el doble **lee el espía por su nombre de
 * propiedad en cada operación** y nunca se guarda la referencia de un array:
 * quedarse con la del primer `beforeEach` haría que las escrituras fueran a una
 * tabla que ya nadie lee.
 */
export type Espia = {
  lotes: Fila[];
  piezas: Fila[];
  etapas: Fila[];
  eventos: Fila[];
  /**
   * Opcional porque solo la necesita quien ejerce `registrarRevision` de
   * verdad: pedir cambios deja un comentario anclado a la pieza. Quien no la
   * declara y aun así escribe en `comentarios` se lleva un error del doble, que
   * es lo que queremos —mejor que una escritura que se pierde en silencio—.
   */
  comentarios?: Fila[];
  /**
   * Los enlaces públicos (`share_links`), con la misma regla: opcional porque
   * solo la necesita quien ejerce `retirarEnlaceDelLote` (src/contenido/enlaces.ts).
   */
  enlaces?: Fila[];
};

/** El `@/db` real, tal como lo entrega `importarReal` dentro del `vi.mock`. */
type ModuloDb = typeof import('@/db');

/**
 * Arma el `db` falso sobre `espia`. Se le pasa el módulo real porque de él salen
 * los objetos de tabla con los que Drizzle marca cada consulta, que es cómo el
 * doble sabe a qué lista escribir.
 */
export function dobleDeBase(real: ModuloDb, espia: Espia) {
  const tablas = new Map<unknown, keyof Espia>([
    [real.contenidoLotes, 'lotes'],
    [real.contenidoPiezas, 'piezas'],
    [real.clienteEtapas, 'etapas'],
    [real.etapaEventos, 'eventos'],
    [real.comentarios, 'comentarios'],
    [real.shareLinks, 'enlaces'],
  ]);

  const filasDe = (tabla: unknown): Fila[] => {
    const nombre = tablas.get(tabla);
    if (!nombre) throw new Error('El doble de la base no conoce esa tabla.');
    const filas = espia[nombre];
    if (!filas) throw new Error(`El espía no declara la tabla «${nombre}».`);
    return filas;
  };

  /** Nombre de la propiedad de la fila que corresponde a esa columna. */
  const clave = (tabla: unknown, columna: unknown): string => {
    for (const [nombre, col] of Object.entries(getTableColumns(tabla as never))) {
      if (col === columna) return nombre;
    }
    throw new Error('El doble de la base no reconoce esa columna.');
  };

  type Operador = '=' | '<' | '<=';

  /** Compara como lo haría Postgres: con un lado nulo, la condición no es cierta. */
  const compara = (op: Operador, izq: unknown, der: unknown): boolean => {
    if (op === '=') return izq === der;
    if (izq == null || der == null) return false;
    return op === '<' ? (izq as number) < (der as number) : (izq as number) <= (der as number);
  };

  /**
   * Traduce una condición de Drizzle a un predicado sobre la fila. Entiende
   * `eq`, `and`, `isNotNull`, `lt` y `lte` —este último también entre dos
   * columnas—; ante cualquier otra cosa lanza, para que un `WHERE` que este
   * doble no sepa evaluar no se ignore en silencio.
   */
  const predicado = (tabla: unknown, condicion: unknown): ((fila: Fila) => boolean) => {
    if (condicion === undefined || condicion === null) return () => true;
    const partes: ((fila: Fila) => boolean)[] = [];
    let columna: unknown = null;
    let operador: Operador | null = null;

    const recorrer = (sql: any) => {
      for (const trozo of sql?.queryChunks ?? []) {
        if (trozo?.queryChunks) { recorrer(trozo); continue; }
        if (trozo instanceof Column) {
          // Una segunda columna con operador pendiente es el lado derecho de
          // una comparación entre columnas (`lte(a, b)`), no una condición nueva.
          if (columna !== null && operador !== null) {
            const kIzq = clave(tabla, columna), kDer = clave(tabla, trozo), op = operador;
            partes.push((fila) => compara(op, fila[kIzq], fila[kDer]));
            columna = null; operador = null;
            continue;
          }
          columna = trozo;
          continue;
        }
        if (trozo && typeof trozo === 'object' && 'encoder' in trozo) {
          const col = columna, op = operador;
          if (col === null || op === null) throw new Error('Valor sin columna ni operador.');
          const k = clave(tabla, col), v = (trozo as { value: unknown }).value;
          partes.push((fila) => compara(op, fila[k], v));
          columna = null; operador = null;
          continue;
        }
        const texto = (Array.isArray(trozo?.value) ? trozo.value.join('') : String(trozo ?? '')).trim();
        if (texto === '' || texto === '(' || texto === ')' || texto === 'and') continue;
        if (texto === '=' || texto === '<' || texto === '<=') { operador = texto as Operador; continue; }
        if (texto === 'is not null') {
          const col = columna;
          if (col === null) throw new Error('«is not null» sin columna.');
          const k = clave(tabla, col);
          partes.push((fila) => fila[k] != null);
          columna = null;
          continue;
        }
        throw new Error(`El doble de la base solo entiende eq/and/isNotNull/lt/lte; encontró «${texto}».`);
      }
    };

    recorrer(condicion);
    return (fila) => partes.every((p) => p(fila));
  };

  const consulta = () => {
    let tabla: unknown = null;
    let filtro: (fila: Fila) => boolean = () => true;
    const q: Record<string, unknown> = {
      from(t: unknown) { tabla = t; return q; },
      // El `innerJoin` con `clients` solo sirve para traer el nombre del
      // cliente al aviso; las decisiones no lo miran, así que no se emula.
      innerJoin() { return q; },
      where(c: unknown) { filtro = predicado(tabla, c); return q; },
      orderBy() { return q; },
      for() { return q; },
      limit() { return q; },
      then(resolver: (v: unknown) => unknown, rechazar: (e: unknown) => unknown) {
        try {
          // Copias: quien lee no debe poder mutar la tabla sin pasar por un UPDATE.
          return Promise.resolve(filasDe(tabla).filter(filtro).map((f) => ({ ...f }))).then(resolver, rechazar);
        } catch (e) {
          return Promise.reject(e).then(resolver, rechazar);
        }
      },
    };
    return q;
  };

  const escritura = (tabla: unknown) => {
    let cambio: Fila = {};
    const w: Record<string, unknown> = {
      set(c: Fila) { cambio = c; return w; },
      where(c: unknown) {
        const filtro = predicado(tabla, c);
        const tocadas = filasDe(tabla).filter(filtro);
        for (const fila of tocadas) Object.assign(fila, cambio);
        return { then: (r: (v: unknown) => unknown) => Promise.resolve(tocadas.map((f) => ({ ...f }))).then(r),
                 returning: () => Promise.resolve(tocadas.map((f) => ({ ...f }))) };
      },
    };
    return w;
  };

  const alta = (tabla: unknown) => {
    let fila: Fila = {};
    const guardar = (evitarDuplicado: boolean) => {
      const filas = filasDe(tabla);
      if (evitarDuplicado && filas.some((f) => f.clientId === fila.clientId && f.etapa === fila.etapa)) return;
      filas.push({ id: `fila-${filas.length + 1}`, ...fila });
    };
    const a: Record<string, unknown> = {
      values(f: Fila) { fila = f; return a; },
      onConflictDoNothing() { return { then: (r: (v: unknown) => unknown) => { guardar(true); return Promise.resolve(undefined).then(r); } }; },
      then(r: (v: unknown) => unknown) { guardar(false); return Promise.resolve(undefined).then(r); },
    };
    return a;
  };

  const falso = {
    select: () => consulta(),
    update: (tabla: unknown) => escritura(tabla),
    insert: (tabla: unknown) => alta(tabla),
    transaction: async (fn: (tx: unknown) => unknown) => fn(falso),
  };

  return falso;
}
