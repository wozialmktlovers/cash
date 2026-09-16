// Reglas puras del lote mensual de contenido y de su revisión (diseño §3, §4,
// §6). Sin base de datos y sin Astro: todo entra y sale por argumentos, para
// que la API, el worker y el entregable compartan un solo criterio.
//
// Los tipos de aquí son ligeros a propósito: describen lo que estas reglas
// necesitan leer de una pieza o de un lote, no las filas completas de
// `contenido_piezas` / `contenido_lotes`. Así el esquema puede crecer
// (arte, hashtags, autor de la revisión) sin tocar este archivo, y este
// archivo se puede probar sin levantar la base. Adaptar la fila al tipo
// ligero es trabajo del servicio (A3), no de estas funciones.
//
// La pieza y el lote hablan idiomas distintos, y no es un descuido: la pieza
// dice lo que el cliente opinó de ella (`EstadoRevision`) y el lote dice en qué
// estado está la etapa (`EstadoLote`). Manda el vocabulario de la base, que es
// donde se guardan los dos. `estadoLoteSegunPiezas` es el único puente.

import type { Estado } from '@/flujo/reglas';

/** Formatos de pieza del diseño §4. */
export const FORMATOS = ['post', 'carrusel', 'reel', 'historia'] as const;
export type Formato = (typeof FORMATOS)[number];

/** Dónde se publica una pieza. Espeja el enum `plataforma_pieza` del esquema.
 *  Vive aquí, con FORMATOS, para que los demás módulos del contenido mensual
 *  la importen en vez de repetirla: una copia que se desincronice aceptaría
 *  una plataforma que la base rechaza. */
export const PLATAFORMAS = ['facebook', 'instagram', 'ambas'] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

/**
 * Lo que el cliente dijo de una **pieza** al revisarla (diseño §6): el enum
 * `estado_revision_pieza` de `contenido_piezas.estado_cliente`.
 *
 * Es el vocabulario de la pieza y solo de la pieza. El lote no lo comparte
 * —ver `EstadoLote`—, aunque las tres palabras se parezcan.
 */
export const ESTADOS_REVISION = ['pendiente', 'aprobada', 'cambios'] as const;
export type EstadoRevision = (typeof ESTADOS_REVISION)[number];

/**
 * El estado de un **lote** es el de una etapa: `contenido_lotes.estado` reusa
 * el enum `estado_etapa` (ver el comentario de la tabla en `src/db/schema.ts`)
 * para que `sincronizarEtapa` copie el valor a `cliente_etapas` sin traducirlo.
 * Por eso el tipo se importa de `src/flujo/reglas.ts` en vez de redeclararse:
 * si algún día cambia allá, tiene que romper aquí.
 *
 * De los cinco estados, el lote usa cuatro: `en_proceso` al crearlo,
 * `en_revision` al compartirlo, `con_cambios` si el cliente pide cambios y
 * `aprobada` cuando todas sus piezas lo están. `no_iniciada` no, porque un lote
 * que existe ya es trabajo empezado.
 */
export type EstadoLote = Estado;

/**
 * Los estados de lote que se pueden deducir de las piezas
 * (`estadoLoteSegunPiezas`). Los otros dos dependen de lo que hizo el operador
 * —crear el lote, compartirlo—, no de lo que opinó el cliente.
 */
export type EstadoLoteSegunPiezas = Extract<EstadoLote, 'en_revision' | 'con_cambios' | 'aprobada'>;

/**
 * Los únicos esquemas de URL que puede llevar el enlace de un arte.
 *
 * El enlace de un arte lo escribe un operador o un admin, y acaba en el `href`
 * de «Ver el reel» y en el `src`/`poster` del visor del entregable que abre el
 * CLIENTE, en el origen del Studio y con su sesión. Un `javascript:` o un
 * `data:text/html,…` ahí es script del operador corriendo en la pestaña del
 * cliente, así que qué esquemas se admiten se decide aquí, en un solo sitio, y
 * no en cada sumidero.
 *
 * Vive en este archivo —puro, sin Zod y sin base— para que lo compartan los
 * tres que lo necesitan sin arrastrarse dependencias entre sí: el esquema de
 * alta y edición (`src/contenido/piezas.ts`, que se lo pasa a `z.url`), el
 * entregable (`src/render/contenido/datos.ts`) y la pantalla interna de React
 * (`src/components/PiezasEditor.tsx`), que importa de aquí en tiempo de
 * ejecución precisamente porque aquí no hay Zod que arrastrar al navegador.
 */
export const ESQUEMAS_ARTE = ['http:', 'https:'] as const;

/** Los mismos esquemas en la forma que pide `z.url({ protocol })`: sin los dos puntos. */
export const PROTOCOLO_ARTE = /^https?$/;

/**
 * El enlace tal cual si apunta a la web, o `null` si no.
 *
 * **Por qué el render también comprueba, si el esquema ya lo hace**
 * (`arteSchema`, src/contenido/piezas.ts): `contenido_piezas.arte` es `jsonb` y
 * nadie lo vuelve a validar al leerlo —`piezaVisibleJson` hace un `as Arte[]`,
 * no un `parse`—. Una fila guardada antes de esta regla, o por cualquier camino
 * que no pase por `validarNuevaPieza`/`validarCambioPieza` (un script, una
 * migración, una restauración de respaldo), llegaría intacta al documento. Y
 * ese documento se sirve también por el enlace público `/p/…`, que no caduca y
 * lo abre cualquiera: una sola fila mala seguiría disparando mucho después de
 * haber cerrado la entrada. Validar corta la entrada; esto corta la salida, y
 * cuesta una función.
 *
 * Se parsea con `URL` en vez de comparar el texto con una expresión regular
 * porque el parser es el mismo que aplicará el navegador al `href`: los tabs,
 * saltos de línea y espacios que el navegador ignora —el truco de
 * `jav&#9;ascript:`— los ignora también esta comprobación, en vez de dejarlos
 * pasar por no empezar literalmente por `http`. Se devuelve la cadena ORIGINAL
 * y no `u.href`: ya se sabe que su esquema es web, y normalizarla cambiaría el
 * enlace que el operador escribió.
 */
export function enlaceWeb(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || url === '') return null;
  try {
    return (ESQUEMAS_ARTE as readonly string[]).includes(new URL(url).protocol) ? url : null;
  } catch {
    // URL sin forma: no hay esquema que autorizar.
    return null;
  }
}

/** Lo que estas reglas necesitan saber de una pieza. */
export type PiezaRevisable = { formato: Formato; estadoCliente: EstadoRevision };

/** Lo que estas reglas necesitan saber de un lote. */
export type LoteRevisable = {
  compartidoEn: Date | null;
  limiteRevision: Date | null;
  estado: EstadoLote;
};

/** Cuántas piezas al mes lleva el cliente, por formato (diseño §3). */
export type Paquete = Partial<Record<Formato, number>>;

/** Diferencia entre lo pactado y lo que hay, por formato. `faltan` negativo = sobran. */
export type DiferenciaPaquete = { formato: Formato; esperadas: number; hay: number; faltan: number };

/** Avance de la revisión del cliente sobre un lote. */
export type AvanceRevision = { aprobadas: number; total: number; porcentaje: number };

/**
 * Los días hábiles se cuentan en el reloj de Ciudad de México, no en el del
 * servidor (que corre en UTC, ver `src/lib/ui/fecha.ts`). Dos razones:
 *
 * 1. El cliente ve la fecha límite y la cuenta regresiva en hora de México, y
 *    el plazo tiene que significar lo que dice la pantalla.
 * 2. Todo lo que se comparte después de las 18:00 de México ya cayó en el día
 *    siguiente UTC. Contando en UTC, un lote compartido el jueves por la noche
 *    contaría el viernes como día de reparto, y un viernes por la noche
 *    empezaría a contar en sábado.
 */
export const ZONA_MX = 'America/Mexico_City';

const DIA_MS = 86_400_000;

/**
 * Offset en minutos tal que `local = UTC + offset` para ese instante en esa
 * zona. Se deriva con Intl en vez de fijar −360, como ya hace
 * `src/lib/desempeno.ts`: México no observa horario de verano desde 2022,
 * pero si algún día vuelve a hacerlo, esto sigue siendo correcto.
 */
function offsetMinutos(instante: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instante);
  const obj: Record<string, string> = {};
  for (const p of partes) obj[p.type] = p.value;
  const comoUTC = Date.UTC(
    Number(obj.year),
    Number(obj.month) - 1,
    Number(obj.day),
    Number(obj.hour),
    Number(obj.minute),
    Number(obj.second),
  );
  // Intl no da milisegundos, así que se comparan segundos enteros: si no, los
  // .999 del último instante del día se colarían en el offset y moverían el
  // resultado casi un segundo.
  const enSegundos = Math.floor(instante.getTime() / 1000) * 1000;
  return (comoUTC - enSegundos) / 60_000;
}

/** Día civil (año, mes, día) que ese instante tiene en el calendario mexicano. */
function diaCivilMX(instante: Date): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_MX,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: valor('year'), mes: valor('month'), dia: valor('day') };
}

/** Instante UTC de una hora civil mexicana. */
function instanteMX(anio: number, mes: number, dia: number, h: number, m: number, s: number, ms: number): Date {
  const suposicion = Date.UTC(anio, mes - 1, dia, h, m, s, ms);
  // Una sola corrección basta: el offset se evalúa a pocas horas del instante
  // buscado y México no cambia de offset a mitad del año.
  return new Date(suposicion - offsetMinutos(new Date(suposicion), ZONA_MX) * 60_000);
}

/**
 * Fecha límite para que el cliente revise un lote, a partir de cuándo se le
 * compartió (diseño §6: el plazo cuenta desde que se comparte, no desde que se
 * crea).
 *
 * **Criterio, explícito porque de él depende que no se apruebe nada antes de
 * tiempo:** el día en que se comparte nunca cuenta, y el plazo vence al
 * **cerrar** (23:59:59.999 de México) el `diasHabiles`-ésimo día hábil
 * posterior. Un viernes a las 17:00 con 2 días hábiles vence el martes a las
 * 23:59:59, no el martes a las 17:00: el cliente no pierde la tarde del
 * viernes por haber recibido el lote tarde, y el martes lo tiene completo. Los
 * plazos en «días» se entienden en días enteros, y la auto-aprobación es
 * silenciosa e incómoda de deshacer, así que ante la duda el redondeo va a
 * favor del cliente.
 *
 * Salta sábados y domingos. **No contempla festivos**: el 16 de septiembre
 * cuenta como día hábil. Es deliberado — el calendario oficial mexicano
 * cambia, y una tabla de festivos desactualizada haría vencer plazos antes de
 * tiempo, que es justo lo que queremos evitar. Si algún día hace falta, se
 * agrega aquí y se refleja en la cuenta regresiva.
 *
 * `diasHabiles = 0` vence al cerrar el mismo día en que se comparte.
 */
/**
 * Días hábiles de revisión cuando el cliente no tiene los suyos (diseño §6).
 * `clients.dias_revision` es nulo por omisión justamente para que el valor
 * viva aquí y cambiarlo no obligue a migrar la base.
 */
export const DIAS_REVISION_POR_OMISION = 2;

export function limiteRevision(compartidoEn: Date, diasHabiles = DIAS_REVISION_POR_OMISION): Date {
  if (Number.isNaN(compartidoEn.getTime())) throw new RangeError('La fecha de compartido no es válida.');
  if (!Number.isInteger(diasHabiles) || diasHabiles < 0) {
    throw new RangeError('Los días hábiles deben ser un entero no negativo.');
  }

  const { anio, mes, dia } = diaCivilMX(compartidoEn);
  // Se avanza sobre el calendario civil usando medianoches UTC como simple
  // aritmética de días: aquí solo importa la sucesión de fechas y su día de la
  // semana, no el huso, que vuelve a entrar al construir el instante final.
  let cursor = Date.UTC(anio, mes - 1, dia);
  let restantes = diasHabiles;
  while (restantes > 0) {
    cursor += DIA_MS;
    const diaSemana = new Date(cursor).getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1;
  }

  const fin = new Date(cursor);
  return instanteMX(fin.getUTCFullYear(), fin.getUTCMonth() + 1, fin.getUTCDate(), 23, 59, 59, 999);
}

/**
 * ¿Al lote le venció el plazo sin que el cliente contestara? (diseño §6).
 *
 * Solo se auto-aprueba el **silencio**, y silencio en el vocabulario del lote
 * es `en_revision`: se le compartió al cliente y el cliente todavía no ha
 * contestado. Los demás estados no lo son, cada uno por su razón:
 *
 * - `con_cambios` ya tiene la respuesta del cliente y la pelota está del lado
 *   del operador, así que darlo por aprobado sería aprobar justo lo que el
 *   cliente devolvió.
 * - `en_proceso` es el lote que se está armando o que el operador reabrió para
 *   atender esos cambios: aún no le toca al cliente, y su `compartido_en` viejo
 *   no debería vencerle nada.
 * - `aprobada` ya está, y `no_iniciada` no le ocurre a un lote.
 *
 * El plan decía «compartido, no aprobado y vencido»; esto es más estrecho a
 * propósito.
 *
 * El instante exacto del límite todavía es del cliente: la comparación es
 * estricta.
 */
export function loteAutoAprobado(lote: LoteRevisable, ahora: Date): boolean {
  if (lote.compartidoEn === null || lote.limiteRevision === null) return false;
  if (lote.estado !== 'en_revision') return false;
  return ahora.getTime() > lote.limiteRevision.getTime();
}

/** «14 de 22 aprobadas» de la portada del entregable (diseño §7). */
export function avanceRevision(piezas: PiezaRevisable[]): AvanceRevision {
  const total = piezas.length;
  const aprobadas = piezas.filter((p) => p.estadoCliente === 'aprobada').length;
  return { aprobadas, total, porcentaje: total === 0 ? 0 : Math.round((aprobadas / total) * 100) };
}

/**
 * Compara el lote con el paquete contratado y devuelve las diferencias por
 * formato; lista vacía = cuadra.
 *
 * **Avisa, no bloquea** (diseño §3): un mes puede salirse de lo pactado y el
 * operador sabrá por qué. Por eso reporta igual lo que falta (`faltan > 0`) y
 * lo que sobra (`faltan < 0`), incluidos los formatos que el paquete no
 * contempla — entregar de más también es una desviación que conviene ver.
 *
 * El orden de salida sigue a `FORMATOS` para que el aviso no cambie de orden
 * entre recargas.
 */
export function cuadraConPaquete(piezas: PiezaRevisable[], paquete: Paquete): DiferenciaPaquete[] {
  const diferencias: DiferenciaPaquete[] = [];
  for (const formato of FORMATOS) {
    const esperadas = paquete[formato] ?? 0;
    const hay = piezas.filter((p) => p.formato === formato).length;
    if (esperadas !== hay) diferencias.push({ formato, esperadas, hay, faltan: esperadas - hay });
  }
  return diferencias;
}

/**
 * Estado del lote a partir de lo que el cliente dijo de sus piezas (diseño §6).
 *
 * Aquí se cruza de un vocabulario al otro, y en un solo lugar a propósito: lo
 * que sale es un `estado_etapa`, listo para escribirse en
 * `contenido_lotes.estado` y para que `sincronizarEtapa` lo copie tal cual. La
 * pieza `pendiente` es el lote `en_revision` (esperando al cliente) y la pieza
 * con `cambios` es el lote `con_cambios`.
 *
 * `con_cambios` gana sobre `en_revision`: en cuanto el cliente devuelve una
 * pieza, el lote vuelve al operador aunque queden piezas sin revisar. El plan
 * enumeraba primero «pendiente», pero el diseño dice que solicitar cambios
 * «pasa el lote a con cambios», sin esperar al resto.
 *
 * Un lote sin piezas queda `en_revision`: vacío no es aprobado.
 */
export function estadoLoteSegunPiezas(piezas: PiezaRevisable[]): EstadoLoteSegunPiezas {
  if (piezas.length === 0) return 'en_revision';
  if (piezas.some((p) => p.estadoCliente === 'cambios')) return 'con_cambios';
  if (piezas.some((p) => p.estadoCliente === 'pendiente')) return 'en_revision';
  return 'aprobada';
}

/** Periodo de un lote: `YYYY-MM` con mes 01–12, sin espacios ni día. */
export function periodoValido(texto: unknown): boolean {
  return typeof texto === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}
