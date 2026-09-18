import type { APIRoute } from 'astro';
import { eq, max } from 'drizzle-orm';
import { db, contenidoPiezas } from '@/db';
import { piezaVisibleJson, validarNuevaPieza } from '@/contenido/piezas';
import { marcarContenidoTocado, refrescarLote } from '@/contenido/servicio';
import { puedeOperarCliente } from '@/lib/permisos';
import { violaRestriccionUnica } from '@/lib/unicidad';
import { loteVisible } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Nombre de la restricción única de (lote, número) en la migración de la etapa 3. */
const RESTRICCION_NUMERO = 'contenido_piezas_lote_id_numero';

/**
 * `POST /api/contenido/lotes/[id]/piezas`: da de alta una pieza del mes
 * (diseño §4).
 *
 * Códigos:
 * - 404 el lote no existe, el id no tiene forma de UUID, o el lote es de un
 *   cliente que quien pregunta no opera. Los tres dan lo mismo a propósito:
 *   igual que en `PATCH /api/pilares/[id]/temas/[temaId]`, el permiso se
 *   resuelve por el cliente del lote y el 404 no delata qué existe;
 * - 400 cuerpo ilegible o campos inválidos;
 * - 409 ya hay una pieza con ese número en el lote;
 * - 201 creada.
 *
 * **El número es opcional.** Si no viene, se toma el siguiente libre
 * (`max(numero) + 1`, o 1 en el lote vacío), que es lo que el operador quiere
 * el 99% de las veces al ir armando el mes. Si viene, se respeta: renumerar a
 * mano es parte de planear. En los dos casos el 409 de número repetido lo
 * decide la restricción única de la base y no un `SELECT` previo —el `max` de
 * aquí es una comodidad, no un candado: dos altas simultáneas leerían el mismo
 * máximo, y la que pierda se llevará su 409 honesto en vez de pisar la pieza de
 * la otra.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const visible = await loteVisible(locals.usuario, params.id!);
  if (!visible || !puedeOperarCliente(locals.usuario, visible.cliente)) {
    return json({ ok: false, errores: ['El lote no existe'] }, 404);
  }

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const v = validarNuevaPieza(crudo);
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  const lote = visible.lote;
  let resultado;
  try {
    // El alta, la marca de contenido, el estado del lote y el de la etapa van
    // en la misma transacción: un lote ya compartido cambia de estado al recibir
    // una pieza nueva —si su ronda de revisión ya terminó, vuelve al lado del
    // operador con el plazo borrado; ver `refrescarLote`— y eso tiene que llegar
    // a la ficha, al Inicio y al portal de una pieza.
    const ahora = new Date();
    resultado = await db.transaction(async (tx) => {
      let numero = v.datos.numero;
      if (numero === undefined) {
        const [ultimo] = await tx
          .select({ numero: max(contenidoPiezas.numero) })
          .from(contenidoPiezas)
          .where(eq(contenidoPiezas.loteId, lote.id));
        numero = Number(ultimo?.numero ?? 0) + 1;
      }

      const [pieza] = await tx
        .insert(contenidoPiezas)
        .values({
          loteId: lote.id,
          numero,
          formato: v.datos.formato,
          plataforma: v.datos.plataforma,
          fechaPublicacion: v.datos.fechaPublicacion,
          temaId: v.datos.temaId,
          copy: v.datos.copy,
          cta: v.datos.cta,
          hashtags: v.datos.hashtags,
          briefVisual: v.datos.briefVisual,
          promptImagen: v.datos.promptImagen,
          guion: v.datos.guion,
          tarjetas: v.datos.tarjetas,
          arte: v.datos.arte,
        })
        .returning();

      // El mes tiene contenido que no estaba cuando se compartió, así que el
      // plazo de esa ronda deja de valer sobre él (`marcarContenidoTocado`,
      // src/contenido/servicio.ts). Va antes del recalculo por orden de
      // lectura, no por necesidad: las dos escrituras son de la misma
      // transacción y ninguna depende de la otra.
      await marcarContenidoTocado(lote.id, ahora, tx);

      const estadoLote = await refrescarLote(lote, ahora, tx);
      return { pieza, estadoLote };
    });
  } catch (e) {
    if (!violaRestriccionUnica(e, RESTRICCION_NUMERO)) throw e;
    return json({ ok: false, errores: ['Ya hay una pieza con ese número en el lote.'] }, 409);
  }

  return json({
    ok: true,
    pieza: piezaVisibleJson(resultado.pieza),
    estadoLote: resultado.estadoLote,
  }, 201);
};
