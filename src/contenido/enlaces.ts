// Los enlaces públicos de un lote mensual: cuáles siguen vivos y qué pasa con
// el mes cuando se retira uno.
//
// Vive aparte de `./servicio.ts` —que es quien sabe de lotes y etapas— porque
// lo que aquí se mezcla es otra cosa: `share_links`, que no es del lote sino
// del sistema de enlaces públicos, con la consecuencia que retirar el último
// tiene sobre el plazo de revisión. Esa consecuencia es la razón de ser del
// archivo y está argumentada en `retirarEnlaceDelLote`.
//
// Por qué hace falta poder retirar: cada vez que se pulsa «Compartir el mes»,
// `POST /api/share` crea OTRO token (a propósito: el mismo mes reenviado a otra
// persona del cliente no debe reiniciar el plazo, ver `compartirLote`). Sin una
// pantalla que los liste, un enlace mandado por WhatsApp al contacto equivocado
// no se podía cerrar: `DELETE /api/share` sabía revocarlo desde que existe la
// rama de `contenido`, pero no había forma de llegar a él.

import { and, desc, eq } from 'drizzle-orm';
import { db, contenidoLotes, shareLinks } from '@/db';
import type { Estado } from '@/flujo/reglas';
import { sincronizarEtapa, transicionarLote, type Ejecutor } from './servicio';

/** Un enlace del mes tal como lo ve el operador en la pantalla del lote. */
export type EnlaceLote = {
  token: string;
  creadoEn: Date;
  visitas: number;
  revocado: boolean;
};

/**
 * Todos los enlaces del lote, los vivos primero por fecha de creación
 * descendente. Se traen también los retirados porque la pantalla los necesita
 * para una sola cosa: distinguir «este mes nunca se compartió» de «a este mes
 * se le retiraron los enlaces», que se ven igual en el lote (`compartido_en`
 * nulo en los dos casos) y significan cosas opuestas para el operador.
 *
 * El filtro por `documento_tipo` no sobra aunque el id del lote sea un UUID
 * propio: `share_links.documento_id` no tiene clave foránea —apunta a cuatro
 * tablas distintas según el tipo— así que es el tipo, y no el id, lo que dice
 * que un enlace es de un mes.
 */
export async function enlacesDelLote(loteId: string, ejecutor: Ejecutor = db): Promise<EnlaceLote[]> {
  return ejecutor
    .select({
      token: shareLinks.token,
      creadoEn: shareLinks.createdAt,
      visitas: shareLinks.visitas,
      revocado: shareLinks.revocado,
    })
    .from(shareLinks)
    .where(and(eq(shareLinks.documentoId, loteId), eq(shareLinks.documentoTipo, 'contenido')))
    .orderBy(desc(shareLinks.createdAt));
}

/** Lo mínimo que hace falta de un lote para retirarle un enlace. */
export type LoteConEnlaces = { id: string; clientId: string };

/** Cómo quedó el mes después de retirar el enlace. */
export type ResultadoRetiro = {
  /** `false` si el token no existía, no era de este lote o ya estaba revocado. */
  retirado: boolean;
  /** Cuántos enlaces vivos le quedan al mes después de esto. */
  activosRestantes: number;
  /** `true` solo si ESTA llamada detuvo el plazo de revisión. */
  detuvoElPlazo: boolean;
  /** El estado en que queda el lote. */
  estado: Estado;
};

/**
 * Retira un enlace del mes y, si era el último vivo, **detiene el plazo de
 * revisión**: el lote vuelve a `en_proceso` con `compartido_en` y
 * `limite_revision` limpios, y la etapa se sincroniza.
 *
 * ── Por qué el plazo se detiene ───────────────────────────────────────────
 *
 * La auto-aprobación es una promesa escrita en el entregable: «si no respondes
 * en 2 días hábiles, se considera aprobado». Esa promesa solo es honesta
 * mientras el cliente PUEDA mirar. Retirar el último enlace le quita el acceso
 * —el público devuelve 404 desde `leerShareLink`, y el del portal también,
 * porque `/portal/contenido/[loteId]` exige `compartido_en`—, así que dejar el
 * reloj corriendo acabaría aprobando un mes que nadie del lado del cliente
 * pudo abrir, y dejando en `etapa_eventos` una constancia diciendo que no
 * respondió. Sería mentira, y de la peor clase: la que el sistema firma solo.
 *
 * La alternativa era avisar y no tocar nada («el operador sabrá lo que hace»).
 * Se descartó porque el aviso no arregla el hecho: el plazo seguiría venciendo
 * en fin de semana, con el operador dormido, sobre un mes cerrado. Y porque no
 * hay ninguna lectura razonable de «retirar el acceso» que incluya «y que se
 * apruebe solo mientras tanto».
 *
 * No es una regla nueva, es la de la casa aplicada al otro lado: `refrescarLote`
 * (./servicio.ts) ya devuelve el mes al operador, con el plazo borrado, cuando
 * las piezas cambian después de compartirlo, y lo resume en una frase que sirve
 * igual aquí — **un plazo solo corre sobre material que se le compartió al
 * cliente**. Retirar el enlace es dejar de compartirlo.
 *
 * ── Y por qué solo desde `en_revision` ────────────────────────────────────
 *
 * Es el único estado en el que hay reloj: `loteAutoAprobado` (./reglas.ts) no
 * auto-aprueba ningún otro. Los demás se dejan como están, y cada uno por su
 * razón:
 *
 * - **`aprobada`**: el mes cerró. Reabrirlo en silencio desde un botón que dice
 *   «Retirar» sería lo contrario de lo que espera quien lo pulsa — el mismo
 *   argumento con el que `compartirLote` se niega a reabrir un mes aprobado
 *   desde un botón que solo dice «Compartir». Retirar el enlace de un mes
 *   aprobado es exactamente eso: cerrar una copia de lectura.
 * - **`con_cambios`**: el cliente ya contestó y la pelota es del operador. No
 *   hay plazo que detener, y el mes sigue visible en el portal para que el
 *   cliente pueda releer lo que pidió.
 * - **`en_proceso`**: no hay nada que detener.
 *
 * No se registra evento en `etapa_eventos`, por lo mismo que no lo registran
 * `compartirLote` ni `refrescarLote`: el historial de esta etapa es el de sus
 * lotes y sus piezas (ver `sincronizarEtapa`). Lo que sí queda para siempre es
 * la fila del enlace con `revocado = true`, que es donde se ve qué se retiró y
 * cuántas visitas alcanzó a tener.
 *
 * Todo en una transacción, y releyendo el lote con `FOR UPDATE` antes de
 * decidir: entre que la pantalla pintó la lista y el operador pulsó, el mes
 * pudo haberse auto-aprobado o el cliente haber pedido cambios. Igual que en
 * `aprobarLoteVencido` (./auto-aprobacion.ts), la lista es un prefiltro y quien
 * decide es la fila fresca.
 *
 * Las piezas **no se tocan**: lo que el cliente ya aprobó sigue aprobado, como
 * en cualquier otra reapertura (`refrescarLote`). Si el mes se vuelve a
 * compartir, `compartirLote` decide qué empieza de nuevo.
 */
export async function retirarEnlaceDelLote(
  lote: LoteConEnlaces,
  token: string,
  ahora: Date = new Date(),
  ejecutor: Ejecutor = db,
): Promise<ResultadoRetiro> {
  const correr = async (tx: Ejecutor): Promise<ResultadoRetiro> => {
    const [fresco] = await tx
      .select({
        estado: contenidoLotes.estado,
        compartidoEn: contenidoLotes.compartidoEn,
        limiteRevision: contenidoLotes.limiteRevision,
        contenidoActualizadoEn: contenidoLotes.contenidoActualizadoEn,
      })
      .from(contenidoLotes)
      .where(eq(contenidoLotes.id, lote.id))
      .for('update')
      .limit(1);

    if (!fresco) return { retirado: false, activosRestantes: 0, detuvoElPlazo: false, estado: 'en_proceso' };

    // Solo se revoca lo que está vivo Y es de este lote: sin la segunda
    // condición, un token de otro mes (o de otro cliente) se revocaría desde
    // la pantalla de este, que ya pasó el permiso de ESTE lote.
    const revocados = await tx
      .update(shareLinks)
      .set({ revocado: true })
      .where(and(
        eq(shareLinks.token, token),
        eq(shareLinks.documentoId, lote.id),
        eq(shareLinks.documentoTipo, 'contenido'),
        eq(shareLinks.revocado, false),
      ))
      .returning({ token: shareLinks.token });

    const todos = await enlacesDelLote(lote.id, tx);
    const activosRestantes = todos.filter((e) => !e.revocado).length;

    // Detener el plazo es consecuencia de quedarse sin enlaces, no de esta
    // llamada en particular: si el token ya venía revocado no se «retira» nada,
    // pero tampoco tiene sentido dejar corriendo un plazo sin acceso. Por eso
    // la condición mira `activosRestantes`, no `revocados`.
    const detener = activosRestantes === 0 && fresco.estado === 'en_revision';

    if (detener) {
      // Por `transicionarLote` (./servicio.ts) como todo cambio de estado del
      // lote: el mes vuelve al equipo, así que la invariante (1) le apaga el
      // plazo sin que esto tenga que pedirlo. Retirar el último enlace deja al
      // cliente sin acceso, y un plazo corriendo sobre un mes que ya no puede
      // abrir sería justo lo que la regla existe para impedir.
      await transicionarLote({ ...fresco, id: lote.id }, 'en_proceso', { retirarReparto: true }, ahora, tx);
      await sincronizarEtapa(lote.clientId, tx);
    }

    return {
      retirado: revocados.length > 0,
      activosRestantes,
      detuvoElPlazo: detener,
      estado: detener ? 'en_proceso' : fresco.estado,
    };
  };

  // Con el `db` de siempre se abre transacción; si quien llama ya trae un `tx`
  // (o el doble de las pruebas), se corre dentro del suyo.
  return ejecutor === db ? db.transaction((tx) => correr(tx)) : correr(ejecutor);
}
