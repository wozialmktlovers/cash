import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, contenidoPiezas } from '@/db';
import { piezaVisibleJson, validarCambioPieza } from '@/contenido/piezas';
import { marcarContenidoTocado, refrescarLote } from '@/contenido/servicio';
import { puedeOperarCliente } from '@/lib/permisos';
import { violaRestriccionUnica } from '@/lib/unicidad';
import { piezaVisible } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Nombre de la restricción única de (lote, número) en la migración de la etapa 3. */
const RESTRICCION_NUMERO = 'contenido_piezas_lote_id_numero';

/**
 * `PATCH /api/contenido/piezas/[id]`: edita la planeación (número, formato,
 * plataforma, fecha, tema), el copy, el llamado a la acción, los hashtags, el
 * brief visual y el arte de una pieza (diseño §4 y §5). Todos los campos son
 * sueltos; los que no vengan no se tocan.
 *
 * Códigos:
 * - 404 la pieza no existe, el id no tiene forma de UUID, o es de un cliente
 *   que quien pregunta no opera;
 * - 400 cuerpo ilegible, campos inválidos, nada que actualizar, o un intento de
 *   escribir el estado de revisión (eso es del cliente y de su ruta, C2);
 * - 409 el número que se pide ya lo tiene otra pieza del mismo lote;
 * - 200 guardada.
 *
 * **No recalcula el estado del lote**, y no es un olvido: lo que se edita aquí
 * no entra en `estadoLoteSegunPiezas`, que solo mira `estado_cliente` —y este
 * cuerpo tiene prohibido tocarlo—. Mover el copy de una pieza no cambia en qué
 * estado está el mes. Ver `refrescarLote` (src/contenido/servicio.ts).
 *
 * **Sí marca que el contenido del mes se movió** (`marcarContenidoTocado`), y
 * esa era la puerta que quedaba abierta: editar una pieza de un lote que el
 * cliente está revisando no cambia ningún estado, así que el mes seguía
 * `en_revision` con su plazo corriendo y al vencer daba por aprobado un texto
 * que el cliente no llegó a leer. Con la marca, ese plazo deja de valer y para
 * volver a arrancarlo hay que repartir el mes otra vez (`compartirLote`).
 *
 * La edición y la marca van en la misma transacción: si se fueran por separado
 * y fallara la segunda, quedaría contenido nuevo bajo un plazo viejo, que es
 * exactamente lo que esto viene a impedir.
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const visible = await piezaVisible(locals.usuario, params.id!);
  if (!visible || !puedeOperarCliente(locals.usuario, visible.cliente)) {
    return json({ ok: false, errores: ['La pieza no existe'] }, 404);
  }

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const v = validarCambioPieza(crudo);
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  const ahora = new Date();
  let filas;
  try {
    filas = await db.transaction(async (tx) => {
      const actualizadas = await tx
        .update(contenidoPiezas)
        .set({ ...v.datos, actualizadoEn: ahora })
        .where(eq(contenidoPiezas.id, visible.pieza.id))
        .returning();
      if (actualizadas.length > 0) await marcarContenidoTocado(visible.lote.id, ahora, tx);
      return actualizadas;
    });
  } catch (e) {
    // Igual que en el alta: el choque de números lo canta la restricción única
    // de la base, no un `SELECT` previo que otra petición podría dejar viejo.
    if (!violaRestriccionUnica(e, RESTRICCION_NUMERO)) throw e;
    return json({ ok: false, errores: ['Ya hay una pieza con ese número en el lote.'] }, 409);
  }

  const [pieza] = filas;
  if (!pieza) return json({ ok: false, errores: ['La pieza no existe'] }, 404);
  return json({ ok: true, pieza: piezaVisibleJson(pieza) });
};

/**
 * `DELETE /api/contenido/piezas/[id]`: quita una pieza del lote.
 *
 * Códigos: 404 como en `PATCH`; 200 con el estado en que queda el lote.
 *
 * **Borrar la última pieza no borra el lote** ni lo deja en un estado inventado:
 * un lote que todavía se arma se queda `en_proceso` (existe y es trabajo
 * empezado), y uno ya compartido vuelve al lado del operador —también
 * `en_proceso`, y con el plazo borrado—, porque vacío no es aprobado pero
 * tampoco es una revisión que el cliente esté haciendo. El criterio entero, con
 * su porqué, está en `refrescarLote`.
 *
 * Tampoco se devuelve la etapa a `no_iniciada`: eso solo tendría sentido al
 * borrar el último LOTE del cliente, y esta versión de la API no borra lotes
 * (ver el comentario de `sincronizarEtapa`). Cuando exista `DELETE
 * /api/contenido/lotes/[id]`, será esa operación —la que sabe que ya no queda
 * ningún lote— la que lo diga.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const visible = await piezaVisible(locals.usuario, params.id!);
  if (!visible || !puedeOperarCliente(locals.usuario, visible.cliente)) {
    return json({ ok: false, errores: ['La pieza no existe'] }, 404);
  }

  const lote = visible.lote;
  // El borrado y el estado del lote van juntos: si la pieza se fuera y el
  // recálculo fallara, el lote podría quedarse `en_revision` esperando a una
  // pieza que ya no existe.
  const resultado = await db.transaction(async (tx) => {
    const borradas = await tx
      .delete(contenidoPiezas)
      .where(eq(contenidoPiezas.id, visible.pieza.id))
      .returning({ id: contenidoPiezas.id });
    if (borradas.length === 0) return null;
    // Quitar una pieza también es mover el contenido del mes: lo que queda ya no
    // es lo que se compartió.
    await marcarContenidoTocado(lote.id, new Date(), tx);
    return { id: borradas[0].id, estadoLote: await refrescarLote(lote, tx) };
  });

  if (!resultado) return json({ ok: false, errores: ['La pieza no existe'] }, 404);
  return json({ ok: true, id: resultado.id, estadoLote: resultado.estadoLote });
};
