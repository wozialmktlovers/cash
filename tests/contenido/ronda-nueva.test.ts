import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * La **segunda ronda de revisión**: qué pasa con las piezas que el cliente
 * devolvió cuando el operador las corrige y vuelve a compartir el mes
 * (diseño §6, «una ronda nueva sobre contenido que el cliente no ha visto»).
 *
 * Es el único archivo de pruebas de contenido que necesita una base de verdad
 * en miniatura y no el doble de siempre. La razón está en lo que se prueba: la
 * secuencia completa —compartir, pedir cambios, recompartir, dar de alta una
 * pieza— es una cadena de escrituras donde **cada paso lee lo que escribió el
 * anterior**. Los dobles de `servicio.test.ts` y `auto-aprobacion.test.ts`
 * devuelven filas fijas y solo apuntan los `set`, así que no pueden encadenar:
 * con ellos el error de esta secuencia es literalmente invisible.
 *
 * Por eso el doble de aquí guarda filas y **respeta el `WHERE`**: las
 * condiciones de Drizzle se interpretan (solo `eq`, `and`, `isNotNull` y `lt`,
 * que es todo lo que usan los módulos bajo prueba; cualquier otra revienta en
 * vez de pasar de largo). Eso es lo que permite afirmar que una escritura toca
 * las piezas que dice tocar y no las demás.
 */

type Fila = Record<string, unknown>;

const espia = vi.hoisted(() => ({
  lotes: [] as Fila[],
  piezas: [] as Fila[],
  etapas: [] as Fila[],
  eventos: [] as Fila[],
}));

vi.mock('@/flujo/avisos', async (importarReal) => ({
  ...(await importarReal<typeof import('@/flujo/avisos')>()),
  avisarLoteAutoAprobado: vi.fn(async () => {}),
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const { Column, getTableColumns } = await import('drizzle-orm');

  // Se guarda el NOMBRE de la lista, no la lista: cada prueba estrena arrays
  // en `beforeEach`, y quedarse con la referencia de la primera haría que las
  // escrituras fueran a una tabla que ya nadie lee.
  const tablas = new Map<unknown, keyof typeof espia>([
    [real.contenidoLotes, 'lotes'],
    [real.contenidoPiezas, 'piezas'],
    [real.clienteEtapas, 'etapas'],
    [real.etapaEventos, 'eventos'],
  ]);

  const filasDe = (tabla: unknown): Fila[] => {
    const nombre = tablas.get(tabla);
    if (!nombre) throw new Error('El doble de la base no conoce esa tabla.');
    return espia[nombre];
  };

  /** Nombre de la propiedad de la fila que corresponde a esa columna. */
  const clave = (tabla: unknown, columna: unknown): string => {
    for (const [nombre, col] of Object.entries(getTableColumns(tabla as never))) {
      if (col === columna) return nombre;
    }
    throw new Error('El doble de la base no reconoce esa columna.');
  };

  /**
   * Traduce una condición de Drizzle a un predicado sobre la fila. Entiende
   * `eq`, `and`, `isNotNull` y `lt`; ante cualquier otra cosa lanza, para que
   * un `WHERE` que esta prueba no sepa evaluar no se ignore en silencio.
   */
  const predicado = (tabla: unknown, condicion: unknown): ((fila: Fila) => boolean) => {
    if (condicion === undefined || condicion === null) return () => true;
    const partes: ((fila: Fila) => boolean)[] = [];
    let columna: unknown = null;
    let operador: '=' | '<' | null = null;

    const recorrer = (sql: any) => {
      for (const trozo of sql?.queryChunks ?? []) {
        if (trozo?.queryChunks) { recorrer(trozo); continue; }
        if (trozo instanceof Column) { columna = trozo; continue; }
        if (trozo && typeof trozo === 'object' && 'encoder' in trozo) {
          const col = columna, op = operador;
          if (col === null || op === null) throw new Error('Valor sin columna ni operador.');
          const k = clave(tabla, col), v = (trozo as { value: unknown }).value;
          partes.push(op === '='
            ? (fila) => fila[k] === v
            : (fila) => fila[k] != null && (fila[k] as number) < (v as number));
          columna = null; operador = null;
          continue;
        }
        const texto = (Array.isArray(trozo?.value) ? trozo.value.join('') : String(trozo ?? '')).trim();
        if (texto === '' || texto === '(' || texto === ')' || texto === 'and') continue;
        if (texto === '=' || texto === '<') { operador = texto as '=' | '<'; continue; }
        if (texto === 'is not null') {
          const col = columna;
          if (col === null) throw new Error('«is not null» sin columna.');
          const k = clave(tabla, col);
          partes.push((fila) => fila[k] != null);
          columna = null;
          continue;
        }
        throw new Error(`El doble de la base solo entiende eq/and/isNotNull/lt; encontró «${texto}».`);
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

  return { ...real, db: falso };
});

import { autoAprobarVencidos } from '@/contenido/auto-aprobacion';
import { avanceRevision, estadoLoteSegunPiezas, limiteRevision } from '@/contenido/reglas';
import { compartirLote, refrescarLote, type LoteCompartible } from '@/contenido/servicio';

const CLIENTE = '00000000-0000-4000-8000-0000000000c1';
const LOTE = '00000000-0000-4000-8000-00000000010e';

/** Jueves de septiembre de 2026, a media mañana de México. */
const RONDA_1 = new Date('2026-09-10T16:00:00.000Z');
/** El viernes siguiente: el operador ya corrigió lo que el cliente pidió. */
const RONDA_2 = new Date('2026-09-11T16:00:00.000Z');

const piezaDe = (n: number): Fila => ({
  id: `pieza-${n}`,
  loteId: LOTE,
  numero: n,
  formato: 'post',
  estadoCliente: 'pendiente',
  notaCliente: null,
  revisadoEn: null,
});

const filaLote = (): Fila => espia.lotes[0]!;

/** El lote tal como lo lee `compartirLote` desde la ruta de compartir. */
const comoCompartible = (): LoteCompartible => {
  const l = filaLote();
  return {
    id: l.id as string,
    clientId: l.clientId as string,
    estado: l.estado as LoteCompartible['estado'],
    compartidoEn: (l.compartidoEn ?? null) as Date | null,
    limiteRevision: (l.limiteRevision ?? null) as Date | null,
  };
};

/** El lote tal como lo lee `refrescarLote` desde el alta o el borrado de una pieza. */
const comoRefrescable = () => {
  const l = filaLote();
  return {
    id: l.id as string,
    clientId: l.clientId as string,
    estado: l.estado as LoteCompartible['estado'],
    compartidoEn: (l.compartidoEn ?? null) as Date | null,
  };
};

/**
 * Lo que hace `registrarRevision` cuando el cliente pide cambios en una pieza,
 * reducido a sus dos escrituras: la pieza queda `cambios` con su nota, y el
 * lote se recalcula con `estadoLoteSegunPiezas`, que es la misma función que
 * usa la ruta de verdad. No se llama a `registrarRevision` porque arrastra
 * sesión, permisos, visibilidad y tope de observaciones, nada de lo cual
 * interviene en lo que aquí se prueba.
 */
const clientePideCambios = (numero: number, nota: string, cuando: Date) => {
  const pieza = espia.piezas.find((p) => p.numero === numero)!;
  Object.assign(pieza, { estadoCliente: 'cambios', notaCliente: nota, revisadoEn: cuando });
  filaLote().estado = estadoLoteSegunPiezas(
    espia.piezas.map((p) => ({ formato: p.formato as 'post', estadoCliente: p.estadoCliente as 'cambios' })),
  );
};

const estados = () => espia.piezas.map((p) => p.estadoCliente);

beforeEach(async () => {
  espia.lotes = [{ id: LOTE, clientId: CLIENTE, periodo: '2026-09', estado: 'en_proceso', compartidoEn: null, limiteRevision: null }];
  espia.piezas = [piezaDe(1), piezaDe(2), piezaDe(3)];
  espia.etapas = [];
  espia.eventos = [];
});

/** Ronda 1 completa: se comparte el mes y el cliente devuelve la pieza 3. */
async function hastaLaRonda2() {
  await compartirLote(comoCompartible(), 2, RONDA_1);
  clientePideCambios(3, 'Cambien la foto por una del consultorio nuevo.', RONDA_1);
  expect(filaLote().estado).toBe('con_cambios');
  // El operador corrige la pieza 3 —`PATCH` no puede tocar `estado_cliente`,
  // a propósito— y vuelve a compartir el mes.
  return compartirLote(comoCompartible(), 2, RONDA_2);
}

describe('recompartir un lote con cambios', () => {
  it('reinicia el plazo Y devuelve a pendiente las piezas que el cliente había devuelto', async () => {
    const r = await hastaLaRonda2();

    expect(r.arrancoElPlazo).toBe(true);
    expect(filaLote().estado).toBe('en_revision');
    expect(filaLote().limiteRevision).toEqual(limiteRevision(RONDA_2, 2));
    // Lo que faltaba: la pieza 3 empieza la ronda 2 sin la respuesta que el
    // cliente dio a la ronda 1.
    expect(estados()).toEqual(['pendiente', 'pendiente', 'pendiente']);
  });

  it('no toca las piezas que el cliente ya había aprobado', async () => {
    espia.piezas[0]!.estadoCliente = 'aprobada';
    espia.piezas[0]!.revisadoEn = RONDA_1;
    await hastaLaRonda2();

    // Aprobado sigue aprobado: la ronda nueva es sobre lo que se corrigió, no
    // un borrón y cuenta nueva del mes entero.
    expect(estados()).toEqual(['aprobada', 'pendiente', 'pendiente']);
    expect(espia.piezas[0]!.revisadoEn).toEqual(RONDA_1);
  });

  it('la nota de la ronda anterior no viaja a la ronda nueva', async () => {
    await hastaLaRonda2();

    const pieza3 = espia.piezas[2]!;
    expect(pieza3.notaCliente).toBeNull();
    expect(pieza3.revisadoEn).toBeNull();
  });

  it('compartir un lote que no reinicia el plazo tampoco toca ninguna pieza', async () => {
    await compartirLote(comoCompartible(), 2, RONDA_1);
    clientePideCambios(3, 'Otra foto, por favor.', RONDA_1);
    // `en_revision` no reinicia (es el enlace reenviado a otra persona): para
    // probarlo hace falta un lote en ese estado, así que se fuerza la fila.
    filaLote().estado = 'en_revision';

    const r = await compartirLote(comoCompartible(), 2, RONDA_2);
    expect(r.arrancoElPlazo).toBe(false);
    expect(estados()).toEqual(['pendiente', 'pendiente', 'cambios']);
  });
});

describe('la ronda nueva deja la máquina de estados otra vez en marcha', () => {
  it('dar de alta una pieza después de recompartir NO saca al lote de en_revision', async () => {
    await hastaLaRonda2();

    // El alta de una pieza (B1) mete la fila y refresca el lote.
    espia.piezas.push(piezaDe(4));
    const estado = await refrescarLote(comoRefrescable());

    // Con la pieza 3 arrastrando su `cambios`, esto deducía `con_cambios`: el
    // lote salía de `en_revision` y su plazo ya no vencía nunca.
    expect(estado).toBe('en_revision');
    expect(filaLote().estado).toBe('en_revision');
  });

  it('al vencer el plazo de la ronda nueva el mes queda aprobado entero', async () => {
    await hastaLaRonda2();

    const despues = new Date(limiteRevision(RONDA_2, 2).getTime() + 60_000);
    expect(await autoAprobarVencidos({ clientId: CLIENTE, ahora: despues })).toEqual({ aprobados: 1 });

    expect(filaLote().estado).toBe('aprobada');
    // Ninguna pieza se queda fuera de la aprobación: el entregable diría
    // «2 de 3 aprobadas» sobre un mes aprobado, y el cliente ya no podría
    // arreglarlo (la ruta de revisión contesta 409).
    expect(estados()).toEqual(['aprobada', 'aprobada', 'aprobada']);
    const avance = avanceRevision(espia.piezas.map((p) => ({ formato: 'post', estadoCliente: p.estadoCliente as 'aprobada' })));
    expect(avance).toEqual({ aprobadas: 3, total: 3, porcentaje: 100 });
  });

  it('y esa aprobación no se deshace sola al tocar otra pieza del mes', async () => {
    await hastaLaRonda2();
    const despues = new Date(limiteRevision(RONDA_2, 2).getTime() + 60_000);
    await autoAprobarVencidos({ clientId: CLIENTE, ahora: despues });

    // Borrar una pieza de un mes ya aprobado: el lote sigue aprobado porque
    // las que quedan lo están. (Un ALTA sí lo devuelve a `en_revision`, y eso
    // es lo correcto: hay contenido que el cliente no ha visto.)
    espia.piezas.splice(1, 1);
    expect(await refrescarLote(comoRefrescable())).toBe('aprobada');
    expect(espia.etapas[0]?.estado).toBe('aprobada');
  });
});
