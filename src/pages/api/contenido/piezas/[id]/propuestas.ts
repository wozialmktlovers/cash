// POST /api/contenido/piezas/[id]/propuestas — tres opciones de copy para UNA
// pieza (diseño §5, tarea B2).
//
// No guarda nada. Devuelve las tres opciones y el operador elige, edita y
// guarda con la API de piezas: generar ideas no puede pisar el copy que
// alguien ya trabajó.
//
// Una pieza por petición, con su propio tope de gasto. No existe la ruta que
// genere el lote entero, y es una decisión, no una carencia: el costo se
// reparte, el operador mantiene el control y un fallo no tumba el mes.

import type { APIRoute } from 'astro';
import { desc, eq } from 'drizzle-orm';
import { db, clients, clientFiles, clientLinks, contenidoLotes, contenidoPiezas, pilaresResults } from '@/db';
import { puedeOperarCliente } from '@/lib/permisos';
import { esUuid } from '@/lib/visibilidad';
import { armarContexto, generarPropuestas, temaDelMapa } from '@/contenido/agentes';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const NO_EXISTE = { ok: false, errores: ['La pieza no existe.'] };

export const POST: APIRoute = async ({ params, request, locals }) => {
  const id = params.id ?? '';
  // Un id con otra forma nunca va a existir: cortar aquí evita que Postgres
  // conteste 500 porque el tipo de la columna no calza con lo que llegó.
  if (!esUuid(id)) return json(NO_EXISTE, 404);

  // La pieza, su lote y su cliente de una vez: sin el cliente no hay permiso
  // que comprobar ni contexto que armar.
  const [fila] = await db
    .select({ pieza: contenidoPiezas, cliente: clients })
    .from(contenidoPiezas)
    .innerJoin(contenidoLotes, eq(contenidoLotes.id, contenidoPiezas.loteId))
    .innerJoin(clients, eq(clients.id, contenidoLotes.clientId))
    .where(eq(contenidoPiezas.id, id))
    .limit(1);

  // Mismo 404 para «no existe» y «no te toca», como en el resto de la API: a
  // quien no puede operar este cliente no se le confirma que la pieza existe.
  // El usuario cliente nunca entra aquí: `puedeOperarCliente` lo descarta por
  // rol, y el copy se genera del lado del operador.
  if (!fila || !puedeOperarCliente(locals.usuario, fila.cliente)) return json(NO_EXISTE, 404);

  // El cuerpo es opcional: sin él se usa el tema que la pieza ya tiene
  // guardado. Se acepta uno en el cuerpo para poder pedir propuestas con el
  // tema que el operador acaba de elegir en pantalla, antes de guardarlo.
  let crudo: { temaId?: unknown } = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try { crudo = await request.json(); } catch { return json({ ok: false, errores: ['El cuerpo no es JSON válido.'] }, 400); }
  }
  const temaId = String((crudo?.temaId ?? fila.pieza.temaId) ?? '').trim();
  if (!temaId) {
    return json({ ok: false, errores: ['Elige primero un tema del mapa de pilares: el copy sale de ahí.'] }, 400);
  }

  // Todas las versiones del mapa, de la más nueva a la más vieja: una pieza
  // puede venir de un mapa anterior (ver `temaDelMapa`).
  const mapas = await db.select({ datos: pilaresResults.datos })
    .from(pilaresResults)
    .where(eq(pilaresResults.clientId, fila.cliente.id))
    .orderBy(desc(pilaresResults.version));
  const tema = temaDelMapa(mapas, temaId);
  if (!tema) {
    return json({ ok: false, errores: [`El tema ${temaId} no está en el mapa de pilares de este cliente.`] }, 409);
  }

  const [links, archivos] = await Promise.all([
    db.select({ tipo: clientLinks.tipo, url: clientLinks.url }).from(clientLinks).where(eq(clientLinks.clientId, fila.cliente.id)),
    db.select({ nombreOriginal: clientFiles.nombreOriginal, textoExtraido: clientFiles.textoExtraido }).from(clientFiles).where(eq(clientFiles.clientId, fila.cliente.id)),
  ]);
  const ctx = armarContexto(fila.cliente, links, archivos);

  try {
    const r = await generarPropuestas(ctx, tema, {
      formato: fila.pieza.formato,
      plataforma: fila.pieza.plataforma,
      fechaPublicacion: fila.pieza.fechaPublicacion,
    });
    // El costo viaja con la respuesta: la pieza se genera de una en una y quien
    // la pidió tiene derecho a ver lo que costó, en vez de que quede en un log.
    return json({ ok: true, temaId: tema.id, ...r });
  } catch (e) {
    console.error(`[contenido] propuestas de la pieza ${id}:`, e);
    const detalle = e instanceof Error ? e.message : 'Error desconocido.';
    return json({ ok: false, errores: [`No se pudieron generar las propuestas. ${detalle}`] }, 502);
  }
};
