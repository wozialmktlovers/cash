// Auto-aprobación del lote al vencer el plazo de revisión (diseño §6, tarea
// C3). La REGLA ya existe y no se toca: `loteAutoAprobado` en ./reglas.ts.
// Aquí vive solo el EFECTO —cambiar el estado, arrastrar las piezas, reflejar
// la etapa y dejar constancia— y la decisión de dónde corre.
//
// ── Dónde corre, y por qué así ────────────────────────────────────────────
//
// El worker (`src/research/worker.ts`) solo arranca cuando alguien visita el
// sitio: `arrancarWorker()` se llama desde `src/middleware.ts`, que Astro carga
// en la primera petición. Si nadie entra al Studio en todo el fin de semana, un
// plazo que vence el sábado no se enteraría hasta el lunes. Y la
// auto-aprobación no es un detalle interno: es una promesa escrita en el
// entregable («si no respondes en 2 días hábiles, se considera aprobado»).
//
// Se consideraron tres vías:
//
// 1. **Solo el worker.** Correcta mientras el proceso está vivo (barre cada
//    diez minutos), pero hereda el arranque perezoso: sin visitas, no hay
//    barrido. Además no cubre el caso de que el worker esté apagado por otra
//    razón (sin `DATABASE_URL`, o un despliegue recién reiniciado).
// 2. **Solo al leer.** Nunca se vería un lote vencido sin aprobar, porque
//    quien lo mira lo resuelve al mirarlo. Pero deja el efecto colgando de que
//    alguien mire: si nadie abre el lote, el aviso al operador no sale, el
//    tablero no se mueve y la etapa se queda `en_revision` para todo lo que
//    consulte la base sin pasar por esa pantalla. Y mete escrituras en un GET,
//    que es justo lo que hay que hacer con cuidado.
// 3. **Las dos, sobre el mismo efecto idempotente.** Es la que se implementó.
//
// El argumento para la combinación es que las dos vías fallan en momentos
// distintos: el worker falla cuando nadie entra, la lectura falla cuando nadie
// mira. Juntas, el único hueco es que no pase ninguna de las dos cosas, y
// entonces tampoco hay nadie a quien se le esté mintiendo. Y en cuanto vuelve a
// haber tráfico —el lunes por la mañana— las dos vías convergen en el mismo
// instante: esa primera petición arranca el worker, que barre de inmediato, y
// de paso la propia pantalla que se abrió resuelve su lote.
//
// **El hueco que queda es operativo, no de código, y se deja escrito:** para
// que el plazo venza en fin de semana sin depender de una visita basta apuntar
// un monitor de uptime (cualquiera gratuito) a la URL del Studio cada pocos
// minutos. No hace falta un endpoint nuevo ni tocar Railway: CUALQUIER petición
// levanta el middleware y con él el worker, que a partir de ahí barre solo.
// Está anotado también en el README, que es donde se busca esto.
//
// ── Por qué escribir desde una lectura es seguro aquí ─────────────────────
//
// `asegurarLotesAlDia` la llaman pantallas (GET). Tres cuidados:
//
// - **No escribe salvo que haya algo vencido.** El caso normal es una consulta
//   que devuelve cero filas y ni una escritura.
// - **La carrera la resuelve la base, no una bandera de proceso.** Dos pestañas
//   a la vez, o el worker y una pestaña, entran los dos: cada uno abre su
//   transacción, bloquea la fila del lote con `FOR UPDATE` y **vuelve a evaluar
//   la regla sobre la fila fresca**, igual que `guardarLectura` en
//   `src/research/convertir-lecturas.ts`. El segundo encuentra el lote ya
//   `aprobada`, `loteAutoAprobado` contesta `false` y no escribe nada ni avisa
//   por segunda vez. Deliberadamente NO hay un candado de módulo como el
//   `corriendo` del worker: Railway puede correr más de una instancia del
//   proceso y una bandera en memoria daría una seguridad falsa.
// - **Nunca tumba la pantalla.** Un fallo aquí se registra y la página sigue.

import { and, eq, isNotNull, lt, lte } from 'drizzle-orm';
import { db, clienteEtapas, clients, contenidoLotes, contenidoPiezas, etapaEventos } from '@/db';
import { loteAutoAprobado } from './reglas';
import { sincronizarEtapa, transicionarLote } from './servicio';
import { avisarLoteAutoAprobado } from '@/flujo/avisos';
import { fechaHora } from '@/lib/ui/fecha';
import { nombrePeriodo } from '@/lib/ui/periodo';

/**
 * `accion` del evento que queda en `etapa_eventos`. La columna es texto libre
 * —no el enum de acciones—, así que no hace falta migración para estrenar una:
 * mismo camino que `generado`, `edicion` o `restaurada`.
 */
export const ACCION_AUTO_APROBADA = 'auto_aprobada';

/**
 * Cada cuánto barre el worker. Diez minutos: el plazo vence a las 23:59:59 de
 * un día, así que la precisión al minuto no le hace falta a nadie, y a cambio
 * la consulta del barrido (una por vuelta, que en el caso normal no devuelve
 * filas) no se repite cada cinco segundos como el `tick`.
 */
export const INTERVALO_BARRIDO_MS = 10 * 60_000;

/** Lo que el barrido necesita de cada lote candidato, más lo que pide el aviso. */
type Candidato = {
  id: string;
  clientId: string;
  periodo: string;
  limiteRevision: Date | null;
  cliente: string;
  operadorId: string | null;
};

/**
 * La constancia que se guarda en `etapa_eventos.comentario`, en palabras y no
 * en un código: es lo que lee un humano en el historial de la ficha si el
 * cliente reclama que él nunca aprobó nada. Pura, para poder probarla.
 *
 * El evento se guarda con `usuario_id` nulo, y la ficha ya pinta eso como
 * «Sistema» (ver `src/pages/clientes/[id].astro`): quien mira el historial ve
 * «Desarrollo mensual · Aprobación automática — Sistema» y debajo esta frase
 * con el mes y la fecha límite exacta. Ninguna persona queda registrada como
 * autora de una aprobación que nadie hizo.
 */
export function textoConstancia(periodo: string, limiteRevision: Date | null): string {
  // `fechaHora` ya termina en punto («11:59 p.m.»), así que la frase no le
  // añade otro.
  const limite = limiteRevision ? ` El plazo venció el ${fechaHora(limiteRevision)}` : '';
  return (
    `Aprobación automática del lote de ${nombrePeriodo(periodo)}: el cliente no respondió dentro del plazo` +
    ` de revisión, así que se da por aprobado (diseño §6).${limite}` +
    ' No es una aprobación del cliente: nadie del lado del cliente revisó estas piezas.'
  );
}

/**
 * Aprueba un lote vencido, si al momento de bloquearlo la regla sigue diciendo
 * que sí. Devuelve `true` solo si esta llamada fue la que lo aprobó — de eso
 * depende que el aviso salga una vez y no una por pestaña abierta.
 *
 * Todo dentro de una transacción, y en este orden:
 *
 * 1. `SELECT ... FOR UPDATE` del lote y **la regla otra vez sobre esa fila
 *    fresca**. La lista de candidatos pudo armarse hace un rato; entre medias
 *    el cliente pudo haber pedido cambios o el operador haber reabierto el mes.
 *    La consulta que arma la lista es un prefiltro barato; quien decide es
 *    `loteAutoAprobado`, como en cualquier otro punto del sistema.
 * 2. El lote pasa a `aprobada`.
 * 3. **Las piezas `pendiente` pasan a `aprobada`**, con su `revisado_en`. Es la
 *    parte que conviene justificar: dejarlas pendientes dejaría un lote
 *    «aprobado» que el entregable describiría como «14 de 22 aprobadas»
 *    (`avanceRevision`), y, peor, `refrescarLote` desharía la aprobación en
 *    cuanto alguien diera de alta o borrara una pieza —devolviendo el mes al
 *    operador—, porque `estadoLoteSegunPiezas` seguiría deduciendo `en_revision`
 *    de esas piezas pendientes. Con esto, el lote y sus piezas dicen lo mismo y
 *    el estado es estable: mientras nadie toque las piezas, un mes aprobado se
 *    queda aprobado.
 *    **Las piezas con `cambios` no se tocan, y el `WHERE` lo deja por escrito.**
 *    Lo que el sistema garantiza —después de arreglar `compartirLote`— es que
 *    un lote `en_revision` no tiene ninguna: llega a ese estado por una de dos
 *    vías, y las dos lo dejan sin piezas devueltas. Compartir por primera vez
 *    un lote `en_proceso`, cuyas piezas nacen `pendiente` (por omisión de la
 *    columna) y nadie ha revisado; o recompartir uno `con_cambios`, que es la
 *    ronda nueva y **devuelve a `pendiente` las piezas que el cliente había
 *    devuelto**. Mientras haya una sola en `cambios`, el lote está
 *    `con_cambios` y `loteAutoAprobado` ya lo excluyó.
 *
 *    Conviene saber qué pasaría si esa garantía se rompiera otra vez, porque es
 *    la razón de que el `WHERE` sea estrecho y no un «todas las piezas del
 *    lote»: quedaría un mes `aprobada` con una pieza en `cambios`, el entregable
 *    diría «9 de 10 aprobadas» sobre un mes aprobado y la primera alta o borrado
 *    posterior desharía la aprobación. El `WHERE` no lo evita —es la
 *    máquina de estados la que tiene que impedirlo—, pero tampoco lo tapa
 *    aprobando de oficio lo que el cliente devolvió, que sería peor.
 * 4. `sincronizarEtapa`, que es quien refleja el lote activo en
 *    `cliente_etapas` (y de ahí salen la ficha, el portal y el tablero).
 * 5. La constancia en `etapa_eventos`, con `usuario_id` nulo.
 *
 * El evento se ata a la etapa, así que `de`/`a` son los estados de la ETAPA
 * —no los del lote—: si el cliente tiene además un lote más nuevo sin aprobar,
 * la etapa no queda `aprobada`, y escribir `a: aprobada` sería falso. El mes y
 * el porqué van en el texto, que es donde un humano los va a leer.
 */
async function aprobarLoteVencido(candidato: Candidato, ahora: Date): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [fresco] = await tx
      .select({
        estado: contenidoLotes.estado,
        compartidoEn: contenidoLotes.compartidoEn,
        limiteRevision: contenidoLotes.limiteRevision,
        contenidoActualizadoEn: contenidoLotes.contenidoActualizadoEn,
      })
      .from(contenidoLotes)
      .where(eq(contenidoLotes.id, candidato.id))
      .for('update')
      .limit(1);

    if (!fresco) return false; // el lote se borró mientras tanto.
    if (!loteAutoAprobado(fresco, ahora)) return false;

    // Por `transicionarLote` como todos los demás (./servicio.ts). Aquí la
    // invariante (1) no quita nada —`aprobada` es del lado del cliente y
    // CONSERVA la fecha—, y tiene que ser así: este mes se auto-aprobó porque su
    // plazo venció de verdad, en el turno del cliente, y esa fecha es la que
    // cierra la puerta (`aceptaDecision`) y la que se cita en la constancia.
    await transicionarLote({ ...fresco, id: candidato.id }, 'aprobada', {}, ahora, tx);

    await tx.update(contenidoPiezas)
      .set({ estadoCliente: 'aprobada', revisadoEn: ahora, actualizadoEn: ahora })
      .where(and(eq(contenidoPiezas.loteId, candidato.id), eq(contenidoPiezas.estadoCliente, 'pendiente')));

    const [previa] = await tx
      .select({ estado: clienteEtapas.estado })
      .from(clienteEtapas)
      .where(and(eq(clienteEtapas.clientId, candidato.clientId), eq(clienteEtapas.etapa, 'desarrollo_mensual')))
      .limit(1);

    const nuevo = await sincronizarEtapa(candidato.clientId, tx);

    const [etapa] = await tx
      .select({ id: clienteEtapas.id })
      .from(clienteEtapas)
      .where(and(eq(clienteEtapas.clientId, candidato.clientId), eq(clienteEtapas.etapa, 'desarrollo_mensual')))
      .limit(1);

    // `sincronizarEtapa` crea la fila si faltaba, así que aquí siempre hay
    // etapa; la guarda es por si algún día deja de crearla: la aprobación del
    // lote vale igual, y quedarse sin constancia es peor que no tenerla ligada.
    if (etapa) {
      await tx.insert(etapaEventos).values({
        etapaId: etapa.id,
        accion: ACCION_AUTO_APROBADA,
        de: previa?.estado ?? null,
        a: nuevo ?? 'aprobada',
        usuarioId: null,
        comentario: textoConstancia(candidato.periodo, fresco.limiteRevision),
      });
    }

    return true;
  });
}

/**
 * Los lotes que hoy podrían estar vencidos: `en_revision`, con fecha límite, con
 * la límite ya pasada y **con el contenido intacto desde que se compartió**.
 * Prefiltro en SQL del mismo criterio de `loteAutoAprobado`, para no traerse la
 * tabla entera; la palabra final la tiene la regla, dentro de la transacción y
 * sobre la fila bloqueada.
 *
 * `lt` y no `lte` para el límite porque el instante exacto todavía es del
 * cliente; `lte` para el contenido porque compartir el mes en el mismo instante
 * en que se guardó la última pieza es repartir esa pieza (ver `loteAutoAprobado`
 * para el porqué de esta condición).
 *
 * La comparación es entre dos columnas de la misma fila, así que la resuelve
 * Postgres sin parámetros: si `compartido_en` fuera nulo, el `<=` daría NULL y
 * la fila quedaría fuera, que es justo lo que se quiere —sin compartir no hay
 * plazo— y lo mismo que contesta la regla.
 *
 * Trae de paso el nombre del cliente y su operador, que es lo que necesita el
 * aviso: son los mismos lotes, y hacerlo después serían dos consultas más por
 * lote aprobado.
 */
async function candidatos(ahora: Date, clientId?: string): Promise<Candidato[]> {
  const condiciones = [
    eq(contenidoLotes.estado, 'en_revision'),
    isNotNull(contenidoLotes.limiteRevision),
    lt(contenidoLotes.limiteRevision, ahora),
    lte(contenidoLotes.contenidoActualizadoEn, contenidoLotes.compartidoEn),
  ];
  if (clientId) condiciones.push(eq(contenidoLotes.clientId, clientId));

  return db
    .select({
      id: contenidoLotes.id,
      clientId: contenidoLotes.clientId,
      periodo: contenidoLotes.periodo,
      limiteRevision: contenidoLotes.limiteRevision,
      cliente: clients.nombre,
      operadorId: clients.operadorId,
    })
    .from(contenidoLotes)
    .innerJoin(clients, eq(clients.id, contenidoLotes.clientId))
    .where(and(...condiciones));
}

/**
 * Aprueba todos los lotes a los que se les venció el plazo. Con `clientId`,
 * solo los de ese cliente (lo que hacen las pantallas); sin él, los de todos
 * (lo que hace el worker).
 *
 * Los avisos salen **fuera** de la transacción y sin esperarlos, con el
 * `void … .catch()` de la casa: el aviso es una consecuencia de la aprobación,
 * no un requisito, y un correo lento no debe retrasar una página ni un tick.
 */
export async function autoAprobarVencidos(
  opciones: { clientId?: string; ahora?: Date } = {},
): Promise<{ aprobados: number }> {
  const ahora = opciones.ahora ?? new Date();
  const lista = await candidatos(ahora, opciones.clientId);
  if (lista.length === 0) return { aprobados: 0 };

  let aprobados = 0;
  for (const candidato of lista) {
    if (!(await aprobarLoteVencido(candidato, ahora))) continue;
    aprobados++;
    void avisarLoteAutoAprobado({
      operadorId: candidato.operadorId,
      cliente: candidato.cliente,
      periodo: candidato.periodo,
      enlace: `/clientes/${candidato.clientId}/contenido/${candidato.periodo}`,
    }).catch((e) => console.error('[mensual] aviso de auto-aprobación:', e));
  }

  if (aprobados > 0) console.log(`[mensual] lotes auto-aprobados por vencimiento: ${aprobados}`);
  return { aprobados };
}

/**
 * Versión para pantallas: resuelve los vencimientos antes de que la página
 * lea, y **nunca lanza**. Que el barrido falle es un problema, pero no uno que
 * justifique dejar al operador sin su ficha.
 *
 * Se llama con el `clientId` de la pantalla siempre que se pueda (ficha,
 * pantalla del mes, portal): es una consulta acotada. Sin `clientId` barre
 * todo, que es lo que hace el tablero de inicio, donde se ven los estados de
 * todos los clientes a la vez.
 */
export async function asegurarLotesAlDia(clientId?: string): Promise<void> {
  try {
    await autoAprobarVencidos({ clientId });
  } catch (e) {
    console.error('[mensual] no se pudo revisar el vencimiento de los lotes:', e);
  }
}
