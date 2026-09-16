// Servicio del lote mensual de contenido (diseño §2): cuál es el lote activo
// de un cliente y cómo se refleja en su fila de `cliente_etapas`. Aquí sí hay
// acceso a base de datos; las reglas puras del lote y de la revisión viven en
// ./reglas.ts (A2) y no se tocan.
//
// Es la pieza que hace posible la decisión estructural del diseño: las otras
// tres etapas ocurren una vez, esta se repite cada mes, y `cliente_etapas`
// guarda un solo estado por etapa y cliente. Ese estado es el del lote
// ACTIVO, y quien lo mantiene al día es `sincronizarEtapa`.

import { and, desc, eq } from 'drizzle-orm';
import { db, clienteEtapas, contenidoLotes, contenidoPiezas } from '@/db';
import type { Estado } from '@/flujo/reglas';
import { DIAS_REVISION_POR_OMISION, estadoLoteSegunPiezas, limiteRevision } from './reglas';

/** Tipo del `tx` que entrega `db.transaction`; mismo truco que en `src/flujo/servicio.ts` para aceptar los dos ejecutores. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Ejecutor = Tx | typeof db;

/** Una fila de `contenido_lotes` tal como sale de la base. */
export type FilaLote = typeof contenidoLotes.$inferSelect;

/** Lo mínimo que hace falta para decidir cuál es el lote activo. */
export type LoteElegible = { periodo: string; estado: Estado };

/**
 * El lote activo de una lista, sin tocar la base (diseño §2): **el más
 * reciente sin aprobar; si todos están aprobados, el último**. `null` si la
 * lista viene vacía.
 *
 * Pura y separada de `loteActivo` para poder probar el criterio sin base de
 * datos, que es donde está el riesgo: el `ORDER BY` de la consulta es una
 * comodidad, no la regla. Por eso no supone ningún orden de entrada — ordena
 * por `periodo`, que al ser `YYYY-MM` se compara como texto exactamente igual
 * que cronológicamente, y que es único por cliente (restricción de la tabla),
 * así que nunca hay empate que desempatar.
 *
 * «Más reciente sin aprobar» se toma al pie de la letra: el máximo `periodo`
 * de entre los NO aprobados, aunque exista uno posterior ya aprobado. Es el
 * caso raro de abrir tarde el lote de un mes pasado, y ahí el mes que sigue
 * pendiente es justo el que el equipo tiene que atender.
 */
export function elegirLoteActivo<T extends LoteElegible>(lotes: T[]): T | null {
  if (lotes.length === 0) return null;
  const masReciente = (a: T | null, b: T): T => (a === null || b.periodo > a.periodo ? b : a);
  const sinAprobar = lotes.filter((l) => l.estado !== 'aprobada');
  return (sinAprobar.length > 0 ? sinAprobar : lotes).reduce<T | null>(masReciente, null);
}

/**
 * El lote activo de un cliente, leído de la base. `null` si el cliente no
 * tiene ningún lote todavía.
 *
 * Trae todos los lotes del cliente en una sola consulta y decide en memoria
 * con `elegirLoteActivo`. Son doce filas por año y por cliente, y el criterio
 * («el más reciente sin aprobar, o el último») necesitaría dos consultas para
 * resolverse en SQL: una para el pendiente y otra para el último. Traerlos
 * todos es más barato que ir dos veces, y deja el criterio en un solo lugar
 * probado.
 */
export async function loteActivo(clientId: string, ejecutor: Ejecutor = db): Promise<FilaLote | null> {
  const lotes = await ejecutor.select().from(contenidoLotes)
    .where(eq(contenidoLotes.clientId, clientId))
    .orderBy(desc(contenidoLotes.periodo));
  return elegirLoteActivo(lotes);
}

/**
 * Deja la fila de `cliente_etapas` de `desarrollo_mensual` en el estado del
 * lote activo. Se llama al crear, compartir, aprobar o pedir cambios en un
 * lote (fases B y C); acepta el `tx` de quien llama para correr dentro de esa
 * misma transacción.
 *
 * **No traduce nada**: `contenido_lotes.estado` reusa el enum `estado_etapa`
 * justo para esto (ver el comentario de la tabla en `src/db/schema.ts`). Lo
 * que la etapa muestra es, literalmente, el estado de su lote activo.
 *
 * Criterio en los dos bordes, que es donde el «un estado por etapa» se nota:
 *
 * - **Sin ningún lote** (`elegirLoteActivo` devuelve `null`): no escribe nada
 *   y devuelve `null`. La etapa contratada pero sin empezar ya se describe
 *   sola con el `no_iniciada` por omisión de la fila, así que no hay nada que
 *   reflejar. Escribir `no_iniciada` de todos modos sería, en el único camino
 *   que llega aquí sin lotes —borrar el último lote de un cliente—, deshacer
 *   en silencio un `iniciar` manual del operador; y esta función existe para
 *   espejar el lote activo, no para reponer estados por su cuenta. Si algún
 *   día borrar el último lote debe devolver la etapa a `no_iniciada`, que lo
 *   diga esa operación, que es la que sabe lo que pasó.
 * - **Al aprobar el último lote**: el activo sigue siendo ese (ya no hay
 *   ninguno sin aprobar) y la etapa queda `aprobada`. El mes cerró y el
 *   cliente ve su cuarto paso listo. Cuando se abra el lote del mes
 *   siguiente, el activo pasa a ser el nuevo y la etapa vuelve a
 *   `en_proceso` —y el % de avance del cliente baja—: es correcto y está
 *   previsto en el diseño §2, hay trabajo nuevo que hacer. Lo aprobado no se
 *   pierde: los meses anteriores siguen consultables desde el portal.
 *
 * La fila se crea si falta, contratada, con el mismo criterio de
 * `obtenerOCrearEtapaBloqueada` (src/flujo/servicio.ts): si hay un lote, hay
 * trabajo hecho para este cliente en esta etapa, y perderlo por un hueco en
 * `cliente_etapas` sería peor que la fila de más. Quien decide si la etapa se
 * puede trabajar es la API de lotes (B1), antes de llegar aquí.
 *
 * No registra evento en `etapa_eventos` a propósito: el historial de esta
 * etapa es el de sus lotes y sus piezas, no una tira de transiciones de
 * documento. Si el tablero de desempeño llega a querer contar los meses
 * aprobados, que los cuente de `contenido_lotes`, que es donde están.
 */
export async function sincronizarEtapa(clientId: string, ejecutor: Ejecutor = db): Promise<Estado | null> {
  const lote = await loteActivo(clientId, ejecutor);
  if (!lote) return null;

  await ejecutor.insert(clienteEtapas)
    .values({ clientId, etapa: 'desarrollo_mensual', contratada: true, interna: false })
    .onConflictDoNothing({ target: [clienteEtapas.clientId, clienteEtapas.etapa] });

  await ejecutor.update(clienteEtapas)
    .set({ estado: lote.estado, actualizadoEn: new Date() })
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, 'desarrollo_mensual')));

  return lote.estado;
}

/**
 * Lo mínimo que hace falta de un lote para refrescarlo tras tocar sus piezas.
 */
export type LoteRefrescable = { id: string; clientId: string; estado: Estado; compartidoEn: Date | null };

/**
 * Deja el lote y la etapa al día después de dar de alta o borrar una pieza
 * (B1). Devuelve el estado en que queda el lote.
 *
 * **Solo se deduce de las piezas un lote ya compartido.** Es el punto fino de
 * esta función, así que queda escrito:
 *
 * - Mientras el lote se arma (`compartido_en` nulo, estado `en_proceso`), las
 *   piezas van y vienen y ninguna de esas idas y venidas es una opinión del
 *   cliente. Aplicarles `estadoLoteSegunPiezas` mandaría el lote a
 *   `en_revision` —«esperando al cliente»— por el mero hecho de tener piezas
 *   pendientes, y la ficha anunciaría una revisión que nadie pidió. Así que se
 *   queda como está.
 * - Ya compartido, sí: la pieza nueva entra `pendiente` y devuelve el lote a
 *   `en_revision` aunque estuviera `aprobada`, que es lo correcto —hay
 *   contenido que el cliente no ha visto—, y la pieza borrada puede completar
 *   el `aprobada` que faltaba.
 *
 * **Borrar la última pieza** cae de ahí sin caso especial: un lote sin
 * compartir se queda `en_proceso` (existe, se está armando, y un lote vacío es
 * trabajo empezado, no aprobado); uno ya compartido queda `en_revision`, que es
 * lo que `estadoLoteSegunPiezas` contesta para la lista vacía, con el mismo
 * argumento: vacío no es aprobado. En ningún caso el lote se borra solo.
 *
 * `PATCH` de una pieza no pasa por aquí: los campos que edita el operador
 * —planeación, copy, cta, hashtags, arte— no entran en `estadoLoteSegunPiezas`,
 * que solo mira `estado_cliente`, así que no hay nada que recalcular.
 */
export async function refrescarLote(lote: LoteRefrescable, ejecutor: Ejecutor = db): Promise<Estado> {
  let estado = lote.estado;

  if (lote.compartidoEn !== null) {
    const piezas = await ejecutor
      .select({ formato: contenidoPiezas.formato, estadoCliente: contenidoPiezas.estadoCliente })
      .from(contenidoPiezas)
      .where(eq(contenidoPiezas.loteId, lote.id));
    const deducido = estadoLoteSegunPiezas(piezas);
    if (deducido !== estado) {
      await ejecutor.update(contenidoLotes)
        .set({ estado: deducido, actualizadoEn: new Date() })
        .where(eq(contenidoLotes.id, lote.id));
      estado = deducido;
    }
  }

  // Siempre, aunque el estado del lote no se haya movido: el lote activo del
  // cliente pudo cambiar por otra vía y `sincronizarEtapa` es barata.
  await sincronizarEtapa(lote.clientId, ejecutor);
  return estado;
}

/** Lo mínimo que hace falta de un lote para compartirlo con el cliente. */
export type LoteCompartible = {
  id: string;
  clientId: string;
  estado: Estado;
  compartidoEn: Date | null;
  limiteRevision: Date | null;
};

/** Cómo quedó el lote después de compartirlo. */
export type ResultadoCompartir = {
  estado: Estado;
  compartidoEn: Date | null;
  limiteRevision: Date | null;
  /** `true` solo si ESTA llamada arrancó el plazo de revisión. */
  arrancoElPlazo: boolean;
};

/**
 * Deja el lote listo para que el cliente lo revise: le estampa `compartido_en`
 * y `limite_revision` y lo pone `en_revision` (diseño §6, «el plazo cuenta
 * desde que el lote se comparte, no desde que se crea»).
 *
 * Es la mitad que faltaba de la auto-aprobación: `autoAprobarVencidos` busca
 * lotes `en_revision` con `limite_revision` pasada, y sin este paso no existe
 * ninguno, así que el plazo nunca vencía porque nunca empezaba.
 *
 * ── Compartir dos veces el mismo lote ─────────────────────────────────────
 *
 * **El plazo arranca solo cuando el mes está del lado del operador**
 * (`en_proceso`, el lote que se estaba armando, o `con_cambios`, el que vuelve
 * corregido). En los otros dos casos se crea el enlace pero no se toca ninguna
 * fecha:
 *
 * - **`en_revision`** (ya compartido, plazo corriendo): el segundo enlace casi
 *   siempre es el mismo mes reenviado a otra persona del cliente. Reiniciar el
 *   plazo movería una fecha límite que el cliente ya leyó en el propio
 *   entregable —y que ahí viene con cuenta regresiva—, y dejaría la
 *   auto-aprobación a merced de cuántas veces se pulse «Compartir»: bastaría
 *   con recompartir cada dos días para que el mes no venza nunca. El plazo lo
 *   arranca el reparto del mes, no cada copia del enlace.
 * - **`aprobada`**: compartir entrega una copia de lectura de un mes cerrado.
 *   Reabrir en silencio una aprobación —del cliente o por vencimiento— desde un
 *   botón que solo dice «Compartir» sería lo contrario de lo que espera quien
 *   lo pulsa. Si hay que rehacer un mes aprobado, se abre trabajo nuevo, no se
 *   recomparte.
 *
 * `con_cambios` sí reinicia, y es el caso que justifica la regla: el cliente ya
 * contestó, el operador rehízo lo que le pidieron y lo que se comparte es una
 * ronda nueva sobre contenido que el cliente no ha visto. Sin reiniciar, el mes
 * arrastraría el límite vencido de la ronda anterior y se auto-aprobaría en
 * cuanto alguien lo mirara.
 *
 * `diasRevision` es `clients.dias_revision`. Un valor imposible (negativo, o no
 * entero porque alguien tocó la columna a mano) cae a
 * `DIAS_REVISION_POR_OMISION` en vez de tumbar la petición: `limiteRevision`
 * lanza `RangeError` ante eso, y quedarse sin compartir el mes por un dato
 * sucio de la ficha es peor que usar el plazo de la casa.
 */
export async function compartirLote(
  lote: LoteCompartible,
  diasRevision: number | null,
  ahora: Date = new Date(),
  ejecutor: Ejecutor = db,
): Promise<ResultadoCompartir> {
  const arranca = lote.estado === 'en_proceso' || lote.estado === 'con_cambios';
  if (!arranca) {
    return {
      estado: lote.estado,
      compartidoEn: lote.compartidoEn,
      limiteRevision: lote.limiteRevision,
      arrancoElPlazo: false,
    };
  }

  const dias = Number.isInteger(diasRevision) && (diasRevision as number) >= 0
    ? (diasRevision as number)
    : DIAS_REVISION_POR_OMISION;
  const limite = limiteRevision(ahora, dias);

  await ejecutor.update(contenidoLotes)
    .set({ estado: 'en_revision', compartidoEn: ahora, limiteRevision: limite, actualizadoEn: ahora })
    .where(eq(contenidoLotes.id, lote.id));

  // El estado del lote se movió, así que la etapa tiene que decir lo mismo.
  await sincronizarEtapa(lote.clientId, ejecutor);

  return { estado: 'en_revision', compartidoEn: ahora, limiteRevision: limite, arrancoElPlazo: true };
}
