// La revisión del cliente, pieza por pieza (diseño §6, tarea C2). Es lo nuevo
// de esta etapa: en el portal, cada pieza tiene «Aprobar» o «Solicitar
// cambios» con nota, y lo que el cliente decide **se guarda en el servidor**,
// no en su navegador (diseño §7), para que lo vea el equipo, sobreviva a
// cambiar de dispositivo y quede registrado quién aprobó qué y cuándo.
//
// El reparto es el de siempre: `validarDecision` es pura y vive aquí arriba;
// `registrarRevision` toca la base y los avisos; la ruta
// (`POST /api/contenido/piezas/[id]/revision`) solo traduce el resultado a
// códigos HTTP. Las reglas del lote no se reimplementan: el estado en que
// queda el mes lo dice `estadoLoteSegunPiezas` (./reglas.ts) y quien lo refleja
// en `cliente_etapas` es `sincronizarEtapa` (./servicio.ts).

import { and, eq } from 'drizzle-orm';
import { db, clienteEtapas, comentarios, contenidoLotes, contenidoPiezas } from '@/db';
import { avisarComentarioCliente } from '@/flujo/avisos';
import { NOMBRE_ETAPA, type Estado } from '@/flujo/reglas';
import { rechazoPorLimite } from '@/flujo/servicio';
import { fechaHora } from '@/lib/ui/fecha';
import { piezaVisible } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';
import { asegurarLotesAlDia } from './auto-aprobacion';
import { avanceRevision, estadoLoteSegunPiezas, type AvanceRevision } from './reglas';
import { sincronizarEtapa } from './servicio';

/** Lo que el cliente puede decir de una pieza (diseño §6). */
export const DECISIONES = ['aprobar', 'cambios'] as const;
export type Decision = (typeof DECISIONES)[number];

/** Tope de la nota: el mismo que el de un comentario del portal, porque acaba siendo uno. */
export const LARGO_MAXIMO_NOTA = 2000;

/**
 * Siempre la misma negativa cuando la pieza no es de este cliente, no existe o
 * el id ni siquiera tiene forma de UUID. Confirmar cuál de las tres es le
 * diría a quien prueba ids qué piezas existen.
 */
const RAZON_PIEZA_INEXISTENTE = 'La pieza no existe';

export type ResultadoRevision =
  | {
      ok: true;
      pieza: { id: string; numero: number; estadoCliente: string; notaCliente: string | null; revisadoEn: Date | null };
      estadoLote: Estado;
      avance: AvanceRevision;
    }
  | { ok: false; status: 404 | 400 | 409 | 429; errores: string[] };

/**
 * Valida el cuerpo de una decisión. Pura.
 *
 * - `decision` tiene que ser `aprobar` o `cambios`, sin valor por omisión: una
 *   decisión que no se entiende no se adivina, porque las dos son escrituras
 *   que el cliente verá reflejadas.
 * - **`cambios` exige nota** (diseño §6: «Solicitar cambios con nota»). Sin
 *   ella el operador recibiría un aviso que no dice qué cambiar, y la pieza se
 *   quedaría en rojo sin explicación.
 * - En `aprobar` la nota se ignora: aprobar es aprobar, y una nota ahí no
 *   tendría dónde vivir —`nota_cliente` es «los cambios que pediste»— ni quién
 *   la leyera.
 */
export function validarDecision(crudo: unknown): { ok: true; decision: Decision; nota: string } | { ok: false; errores: string[] } {
  const cuerpo = (crudo ?? {}) as { decision?: unknown; nota?: unknown };
  const decision = cuerpo.decision;
  if (decision !== 'aprobar' && decision !== 'cambios') {
    return { ok: false, errores: ['La decisión tiene que ser «aprobar» o «cambios»'] };
  }

  const nota = typeof cuerpo.nota === 'string' ? cuerpo.nota.trim() : '';
  if (decision === 'aprobar') return { ok: true, decision, nota: '' };

  if (nota.length === 0) return { ok: false, errores: ['Escribe qué quieres que cambiemos'] };
  if (nota.length > LARGO_MAXIMO_NOTA) {
    return { ok: false, errores: [`La nota no puede pasar de ${LARGO_MAXIMO_NOTA} caracteres`] };
  }
  return { ok: true, decision, nota };
}

/**
 * El ancla del comentario que deja «solicitar cambios»: la pieza, por su id.
 *
 * Por el id y no por el número porque el número se puede renumerar mientras el
 * operador reordena el mes, y un comentario anclado a «la pieza 4» se quedaría
 * señalando a otra. El formato pasa el `ANCLA_RE` de
 * `src/flujo/comentarios.ts` (letras, dígitos, `_`, `:`, `.` y `-`).
 */
export function anclaDePieza(piezaId: string): string {
  return `pieza:${piezaId}`;
}

/**
 * El texto del comentario anclado. Lleva delante de qué pieza habla: en el
 * panel de comentarios de la vista interna se leen todos juntos, y «cambia el
 * color» sin más no le dice al operador dónde.
 */
export function textoComentarioCambios(numero: number, nota: string): string {
  return `Contenido ${String(numero).padStart(2, '0')} · ${nota}`;
}

/**
 * Por qué un lote ya no admite decisiones: **se le terminó el plazo** y el mes
 * quedó cerrado con todo aprobado (diseño §6). Se dice con la fecha exacta y sin
 * reproche —el plazo estaba anunciado en el propio entregable, con cuenta
 * regresiva— y con una salida: escribirle al equipo.
 *
 * **Lo que NO dice, y es deliberado: quién aprobó el mes.** A este estado se
 * llega por dos caminos y el texto tiene que ser cierto en los dos: el mes que
 * se auto-aprobó porque nadie contestó, y el mes que el cliente aprobó él mismo
 * pieza por pieza y cuyo plazo venció después. Decirle a este segundo que «el
 * contenido quedó aprobado» al terminar el plazo sería contarle su propia
 * aprobación como un vencimiento. Lo que cerró la puerta es el plazo, y eso es
 * lo único que se afirma.
 *
 * El caso sin fecha es defensa y no debería ocurrir: `aceptaDecision` admite
 * siempre un lote sin `limite_revision`, así que nunca llega aquí con `null`. Si
 * llegara, la frase se queda sin fecha en vez de inventar una.
 */
export function razonPlazoVencido(limite: Date | null): string {
  const cuando = limite ? ` el ${fechaHora(limite)}` : '';
  return `El plazo de revisión de este mes terminó${cuando} y el mes quedó cerrado, con todo aprobado.` +
    ' Si todavía necesitas cambiar algo, escríbele a tu equipo de Wozial y lo vemos.';
}

/** La `contenido_lotes` que esta operación necesita releer con la fila bloqueada. */
type LoteFresco = { estado: Estado; compartidoEn: Date | null; limiteRevision: Date | null };

/**
 * ¿Este lote sigue admitiendo una decisión del cliente?
 *
 * La regla, en una línea: **el cliente puede retractarse de una pieza mientras
 * su plazo siga vivo.** Lo que cierra la puerta es el plazo, no el estado: un
 * lote `aprobada` es un mes con todas sus piezas aprobadas, y eso no dice nada
 * de si al cliente todavía le corre el reloj. Los tres casos, que es lo que
 * fija `tests/contenido/plazo-mes-aprobado.test.ts`:
 *
 * - **Límite en el futuro:** acepta. Es el cierre del riesgo de C3 hecho al
 *   revés: el cliente que aprobó todo por su cuenta y se arrepiente de una pieza
 *   dentro de su plazo sigue a tiempo, y `estadoTrasComentarioCliente`
 *   (src/flujo/reglas.ts) ya dice que en esta etapa una observación del cliente
 *   reabre lo aprobado. El mes vuelve al estado que le toque por sus piezas.
 * - **Límite vencido:** no acepta. Es el riesgo que C3 dejó abierto —un mes
 *   auto-aprobado por vencimiento no admite cambios a destiempo— y también el
 *   mes que el cliente aprobó entero y cuyo plazo venció después. En los dos, el
 *   plazo se acabó de verdad; `razonPlazoVencido` lo dice sin atribuirle a nadie
 *   una aprobación que no hizo.
 * - **Límite nulo:** acepta. Un lote sin fecha es uno al que `registrarRevision`
 *   le APAGÓ el plazo porque se consumió mientras el mes esperaba al operador
 *   (ver la explicación larga de abajo). Ese reloj se detuvo a favor del cliente
 *   y nunca venció para él, así que oponérselo sería cobrarle una espera ajena.
 *
 * **Sí: un mes aprobado sin fecha queda reabrible mientras no la tenga, y es lo
 * correcto.** No es un descuido ni un estado al que se llegue solo: se llega
 * porque el equipo dejó correr el reloj en su turno, y mientras eso no se
 * arregle el cliente conserva su derecho a opinar. El arreglo es del equipo y ya
 * existe: **volver a compartir el mes** le pone fecha nueva y, cuando esa fecha
 * pasa, la puerta se cierra sola por el caso de arriba (`compartirLote`,
 * ./servicio.ts, sabe arrancar un plazo también desde este estado).
 *
 * Quien llama tiene que haber corrido antes `asegurarLotesAlDia`: es lo que
 * convierte un `en_revision` vencido en el `aprobada` que esto mira.
 */
export function aceptaDecision(lote: LoteFresco, ahora: Date): boolean {
  if (lote.estado !== 'aprobada') return true;
  if (lote.limiteRevision === null) return true;
  return ahora.getTime() <= lote.limiteRevision.getTime();
}

/**
 * Registra lo que el cliente decidió de una pieza y deja al día el lote, la
 * etapa y, si pidió cambios, el comentario anclado y el aviso al operador.
 *
 * El orden importa y va explicado, porque de él dependen dos cosas que el
 * diseño promete:
 *
 * 1. **Primero se resuelve el vencimiento** (`asegurarLotesAlDia` con el
 *    cliente de la sesión). Si el plazo ya venció, el lote se auto-aprueba
 *    ahora mismo y la decisión que llega tarde se rechaza con su razón, en vez
 *    de colarse sobre un estado viejo. Sin esto, el cliente que abre el portal
 *    un minuto después del límite podría pedir cambios sobre un mes que el
 *    sistema ya dio por aprobado —y el operador recibiría dos señales que se
 *    contradicen—.
 * 2. **Todo lo que escribe va en una transacción**, con la fila del lote
 *    bloqueada (`FOR UPDATE`) y la regla revaluada sobre esa fila fresca: es el
 *    mismo patrón de `aprobarLoteVencido` (./auto-aprobacion.ts), y aquí cubre
 *    la carrera real —el worker auto-aprobando el lote justo mientras el
 *    cliente aprieta «Solicitar cambios»—.
 * 3. **El aviso sale fuera de la transacción y sin esperarlo**, con el
 *    `void … .catch()` de la casa: un correo lento no debe retrasar la
 *    respuesta que el cliente está esperando en su pantalla.
 *
 * El estado del lote no se inventa: se recalcula con `estadoLoteSegunPiezas`
 * sobre TODAS sus piezas, así que el lote queda `aprobada` cuando todas lo
 * están y vuelve a `con_cambios` en cuanto una se devuelve, sin esperar al
 * resto. Después, `sincronizarEtapa` copia ese estado a `cliente_etapas`.
 *
 * ── El lote puede salir de `con_cambios` por aquí, y el plazo se apaga ────
 *
 * Hay un caso en que este recálculo saca el lote de `con_cambios` sin que medie
 * un reparto: el cliente **se retracta** y aprueba él mismo la pieza que había
 * devuelto, de modo que no queda ninguna en `cambios`. El destino depende de lo
 * que quede sin mirar: con piezas pendientes, `en_revision`; sin ninguna,
 * `aprobada`. Si el plazo de aquella ronda ya venció —y suele haber vencido,
 * porque un mes `con_cambios` no se auto-aprueba y el reloj corrió igual—, el
 * lote se quedaba con una fecha límite muerta, y eso hacía daño por los dos
 * destinos: el `en_revision` dejaba que el siguiente barrido aprobara en el acto
 * las piezas que el cliente aún no había mirado, con constancia de que «no
 * respondió» justo cuando acababa de responder; y el `aprobada` le cerraba la
 * puerta a golpe de `aceptaDecision`, con un mensaje que le contaba su propia
 * aprobación como un vencimiento.
 *
 * Buena parte de esos casos ya no llegan hasta aquí: si el operador atendió la
 * petición, al hacerlo marcó `contenido_actualizado_en`
 * (`marcarContenidoTocado`, ./servicio.ts), el plazo de la ronda anterior dejó
 * de valer sobre lo que el cliente tiene delante y `loteAutoAprobado` no lo
 * toca. Lo cubre `tests/contenido/plazo-contenido-tocado.test.ts`.
 *
 * Pero si el operador **no tocó nada**, el contenido sí es el que se compartió,
 * esa invariante contesta que el plazo vale y el vencido vuelve a correr. Y no
 * debería, porque lo que falla no es «¿es este el contenido que se compartió?»
 * sino **«¿corrió el reloj mientras era mi turno?»**: el mes estuvo esperando al
 * operador y el plazo se consumió con la pelota del otro lado.
 *
 * Así que ahí el plazo se apaga: el lote se queda con `limite_revision`
 * **nulo**, vaya a `en_revision` o a `aprobada`. Un lote sin fecha no se
 * auto-aprueba —`loteAutoAprobado` lo descarta en su primera línea, y el
 * prefiltro de `autoAprobarVencidos` ni lo trae— y `aceptaDecision` lo sigue
 * admitiendo, así que el cliente continúa opinando: sobre las piezas que le
 * quedan si las hay, o retractándose de una que aprobó si ya no queda ninguna.
 * Para que el mes vuelva a tener fecha hay que repartirlo otra vez, que es quien
 * arranca un plazo (`compartirLote`, ./servicio.ts, sabe hacerlo desde los dos
 * estados).
 *
 * Se descartó la alternativa —devolver el mes a `en_proceso` con el plazo
 * limpio, como hace `refrescarLote`—: es coherente, pero le quita el mes de las
 * manos justo a quien acaba de demostrar que está trabajando en él. Apagar el
 * plazo es lo menos intrusivo que sigue siendo seguro: nada se aprueba solo.
 * Lo cubre `tests/contenido/plazo-turno-ajeno.test.ts`.
 */
export async function registrarRevision(o: {
  piezaId: string;
  usuario: UsuarioSesion;
  decision: Decision;
  nota: string;
  ahora?: Date;
}): Promise<ResultadoRevision> {
  const { usuario } = o;
  const ahora = o.ahora ?? new Date();

  // Esta ruta es solo del cliente: el operador no aprueba sus propias piezas
  // (`PATCH /api/contenido/piezas/[id]` rechaza a propósito cualquier intento
  // de escribir `estado_cliente`). Un usuario interno que llegue aquí recibe la
  // misma negativa que un extraño.
  if (usuario.rol !== 'cliente' || !usuario.clientId) {
    return { ok: false, status: 404, errores: [RAZON_PIEZA_INEXISTENTE] };
  }

  await asegurarLotesAlDia(usuario.clientId);

  const visible = await piezaVisible(usuario, o.piezaId);
  if (!visible) return { ok: false, status: 404, errores: [RAZON_PIEZA_INEXISTENTE] };

  const { pieza, lote, cliente } = visible;

  // Un lote que todavía no se le compartió al cliente no es suyo para
  // revisarlo: se está armando. No debería llegar aquí —el portal no lo
  // enseña— pero la ruta no se apoya en eso.
  if (lote.compartidoEn === null) {
    return { ok: false, status: 409, errores: ['Este mes todavía no está listo para revisar.'] };
  }

  if (!aceptaDecision(lote, ahora)) {
    return { ok: false, status: 409, errores: [razonPlazoVencido(lote.limiteRevision)] };
  }

  // El tope de observaciones solo cuenta para «cambios», que es lo que escribe
  // un comentario y manda un aviso. Aprobar no le cuesta nada a nadie. Va
  // después de las comprobaciones de visibilidad (una pieza ajena sigue siendo
  // 404, nunca 429) y antes de escribir nada.
  if (o.decision === 'cambios') {
    const limite = await rechazoPorLimite(usuario.id);
    if (limite) return { ok: false, status: 429, errores: [limite.razon] };
  }

  const estadoPieza = o.decision === 'aprobar' ? 'aprobada' : 'cambios';

  const resultado = await db.transaction(async (tx) => {
    const [fresco] = await tx
      .select({
        estado: contenidoLotes.estado,
        compartidoEn: contenidoLotes.compartidoEn,
        limiteRevision: contenidoLotes.limiteRevision,
      })
      .from(contenidoLotes)
      .where(eq(contenidoLotes.id, lote.id))
      .for('update')
      .limit(1);

    if (!fresco) return null;
    if (!aceptaDecision(fresco, ahora)) {
      return { tarde: true as const, limiteRevision: fresco.limiteRevision };
    }

    const [actualizada] = await tx.update(contenidoPiezas)
      .set({
        estadoCliente: estadoPieza,
        // Aprobar borra la nota anterior: la pieza ya no tiene cambios
        // pendientes, y dejarla la seguiría pintando en la tarjeta como si
        // los tuviera.
        notaCliente: o.decision === 'cambios' ? o.nota : null,
        revisadoEn: ahora,
        actualizadoEn: ahora,
      })
      .where(eq(contenidoPiezas.id, pieza.id))
      .returning();
    if (!actualizada) return null;

    const piezas = await tx
      .select({ formato: contenidoPiezas.formato, estadoCliente: contenidoPiezas.estadoCliente })
      .from(contenidoPiezas)
      .where(eq(contenidoPiezas.loteId, lote.id));

    const estadoLote = estadoLoteSegunPiezas(piezas);

    // El plazo que se consumió mientras el mes era del operador no revive con
    // la retractación del cliente (ver la explicación larga de arriba). La
    // condición es estrecha a propósito: solo la SALIDA de `con_cambios` —el
    // único estado que tiene la pelota del lado del operador y del que se sale
    // por aquí, sin pasar por un reparto— y solo si la fecha que arrastra ya
    // está vencida. Si todavía corre, es el plazo de esta misma ronda y sigue
    // siendo bueno. La comparación es estricta, como la de `loteAutoAprobado`:
    // el instante exacto del límite todavía es del cliente.
    //
    // **Los dos destinos cuentan, y el segundo es la puerta hermana.** Si al
    // retractarse el cliente quedan piezas pendientes, el mes vuelve a
    // `en_revision`; si no queda ninguna, `estadoLoteSegunPiezas` deduce
    // `aprobada`. Mirar solo el primero dejaba el segundo `aprobada` con el
    // límite muerto, y a partir de ahí `aceptaDecision` le cerraba la puerta
    // diciéndole que el mes «quedó aprobado» al vencer el plazo: ni se
    // auto-aprobó —lo aprobó él, pieza por pieza, un minuto antes— ni ese plazo
    // venció en su turno. El reloj se detuvo a su favor en los dos casos, así
    // que se apaga en los dos. Lo cubre `tests/contenido/plazo-mes-aprobado.test.ts`.
    const plazoConsumidoEnTurnoAjeno = (estadoLote === 'en_revision' || estadoLote === 'aprobada')
      && fresco.estado === 'con_cambios'
      && fresco.limiteRevision !== null
      && ahora.getTime() > fresco.limiteRevision.getTime();

    if (estadoLote !== fresco.estado) {
      await tx.update(contenidoLotes)
        .set({
          estado: estadoLote,
          ...(plazoConsumidoEnTurnoAjeno ? { limiteRevision: null } : {}),
          actualizadoEn: ahora,
        })
        .where(eq(contenidoLotes.id, lote.id));
    }

    // Siempre, aunque el estado del lote no se haya movido: `sincronizarEtapa`
    // es barata y el lote activo del cliente pudo cambiar por otra vía.
    await sincronizarEtapa(cliente.id, tx);

    if (o.decision === 'cambios') {
      // El comentario anclado va DESPUÉS de `sincronizarEtapa` porque es ella
      // quien crea la fila de `cliente_etapas` si faltaba, y `comentarios`
      // cuelga de esa fila. Si aun así no hay etapa, el comentario se omite y
      // la decisión vale igual: perder la nota es malo, perder la revisión del
      // cliente es peor.
      const [etapa] = await tx
        .select({ id: clienteEtapas.id })
        .from(clienteEtapas)
        .where(and(eq(clienteEtapas.clientId, cliente.id), eq(clienteEtapas.etapa, 'desarrollo_mensual')))
        .limit(1);

      if (etapa) {
        await tx.insert(comentarios).values({
          etapaId: etapa.id,
          // El «documento» de esta etapa es el LOTE (ver src/lib/share.ts): el
          // entregable del mes no es una fila con `datos` ni tiene versiones,
          // así que `version_numero` —que la columna exige— va en 1 y no
          // significa nada más que «la única que hay».
          documentoTipo: 'contenido',
          documentoId: lote.id,
          versionNumero: 1,
          ancla: anclaDePieza(pieza.id),
          texto: textoComentarioCambios(actualizada.numero, o.nota),
          autorId: usuario.id,
          autorRol: 'cliente',
        });
      }
    }

    return {
      tarde: false as const,
      pieza: actualizada,
      estadoLote,
      avance: avanceRevision(piezas.map((p) => ({ formato: p.formato, estadoCliente: p.estadoCliente }))),
    };
  });

  if (!resultado) return { ok: false, status: 404, errores: [RAZON_PIEZA_INEXISTENTE] };
  if (resultado.tarde) {
    return { ok: false, status: 409, errores: [razonPlazoVencido(resultado.limiteRevision)] };
  }

  if (o.decision === 'cambios') {
    void avisarComentarioCliente({
      actorId: usuario.id,
      clientId: cliente.id,
      operadorId: cliente.operadorId,
      cliente: cliente.nombre,
      etapa: NOMBRE_ETAPA.desarrollo_mensual,
      enlace: `/clientes/${cliente.id}/contenido/${lote.periodo}`,
    }).catch((e) => console.error('[mensual] aviso de cambios pedidos por el cliente:', e));
  }

  return {
    ok: true,
    pieza: {
      id: resultado.pieza.id,
      numero: resultado.pieza.numero,
      estadoCliente: resultado.pieza.estadoCliente,
      notaCliente: resultado.pieza.notaCliente,
      revisadoEn: resultado.pieza.revisadoEn,
    },
    estadoLote: resultado.estadoLote,
    avance: resultado.avance,
  };
}
