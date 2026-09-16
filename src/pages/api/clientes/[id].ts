import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';
import { db, clients, clientFiles, clientLinks, users, shareLinks, documentoVersiones, researchResults, growthResults, pilaresResults } from '@/db';
import { validarCliente } from '@/lib/clientes';
import { nombreConfirmado } from '@/lib/borrado';
import { borrarArchivo, borrarCarpetaCliente } from '@/lib/files';
import { clienteOperable } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;

  if (!(await clienteOperable(locals.usuario, id))) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const r = validarCliente(crudo);
  if (!r.ok) return json({ ok: false, errores: r.errores }, 400);

  const [actualizado] = await db
    .update(clients)
    .set({ ...r.datos, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning({ id: clients.id });

  if (!actualizado) return json({ ok: false, errores: ['El cliente no existe'] }, 404);
  return json({ ok: true, id: actualizado.id });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const id = params.id!;

  // Solo el admin borra clientes (regla del dueño: el operador crea, modifica
  // y solicita autorizaciones, nunca borra). Mismo criterio que ya usa PATCH
  // .../operador para una acción exclusiva de admin: el rol se revisa ANTES
  // de tocar la base, con 403 — no 404, porque a diferencia de `clienteOperable`
  // esto no depende de qué cliente sea, sino de quién pregunta.
  if (locals.usuario.rol !== 'admin') return json({ ok: false, errores: ['Solo un administrador puede eliminar un cliente'] }, 403);

  const cliente = await clienteOperable(locals.usuario, id);
  if (!cliente) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // El nombre tecleado se vuelve a comprobar aquí (spec §2): que el diálogo ya
  // lo haya hecho no vale de nada, porque a esta ruta se puede llegar sin
  // pasar por la pantalla. La comparación es la misma función que usa el
  // diálogo para habilitar el botón, para que no puedan discrepar.
  let crudo: unknown = null;
  try {
    crudo = await request.json();
  } catch {
    // Un cuerpo ilegible es, para esto, un nombre que no coincide.
  }
  if (!nombreConfirmado((crudo as { nombre?: unknown } | null)?.nombre, cliente.nombre)) {
    return json({ ok: false, errores: ['El nombre no coincide con el del cliente'] }, 400);
  }

  // `documento_versiones` no tiene FK hacia research/growth/pilares_results
  // (ver comentario en el schema), así que borrar el cliente en cascada deja
  // esas versiones huérfanas si no se limpian a mano. Lo mismo pasa con
  // `share_links`, que apunta al documento por (tipo, id) sin clave foránea —y
  // ese huérfano es el peor de todos, porque un enlace público que sobrevive
  // al cliente sigue sirviendo su documento a quien tenga la URL—. Pero el
  // orden importa: `cliente_etapas.version_aprobada_id` SÍ tiene FK (NO ACTION)
  // hacia `documento_versiones`, así que borrar las versiones ANTES que el
  // cliente revienta con una violación de esa FK en cualquier cliente con una
  // etapa aprobada. Por eso: se capturan los pares (tipo, id) primero, se borra
  // el cliente (la cascada se lleva `cliente_etapas` y con ella esa
  // referencia), y solo entonces se borran versiones y enlaces públicos —
  // filtrando por (documentoTipo, documentoId) juntos, no por documentoId a
  // secas, porque un mismo uuid nunca debería cruzar tipos pero la tabla no
  // tiene forma de impedirlo.
  const borrado = await db.transaction(async (tx) => {
    const [investigaciones, manuales, pilares, archivos, cuentas, enlaces] = await Promise.all([
      tx.select({ id: researchResults.id }).from(researchResults).where(eq(researchResults.clientId, id)),
      tx.select({ id: growthResults.id }).from(growthResults).where(eq(growthResults.clientId, id)),
      tx.select({ id: pilaresResults.id }).from(pilaresResults).where(eq(pilaresResults.clientId, id)),
      tx.select({ ruta: clientFiles.ruta }).from(clientFiles).where(eq(clientFiles.clientId, id)),
      tx.select({ id: users.id }).from(users).where(eq(users.clientId, id)),
      tx.select({ id: clientLinks.id }).from(clientLinks).where(eq(clientLinks.clientId, id)),
    ]);
    const pares = [
      ...investigaciones.map((r) => ({ tipo: 'research' as const, id: r.id })),
      ...manuales.map((r) => ({ tipo: 'growth' as const, id: r.id })),
      ...pilares.map((r) => ({ tipo: 'pilares' as const, id: r.id })),
    ];
    const rutas = archivos.map((a) => a.ruta);

    // Lo único que va a quedar de este cliente. Se escribe ANTES de borrar
    // (spec §2), para que exista aunque la transacción se caiga a la mitad.
    console.info(
      `[clientes] eliminando "${cliente.nombre}" (${cliente.id}) · lo pide ${locals.usuario.email} (${locals.usuario.id})` +
        ` · entregables=${pares.length} archivos=${rutas.length} cuentas=${cuentas.length} enlaces=${enlaces.length}`,
    );

    const filasBorradas = await tx.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
    if (filasBorradas.length === 0) return { filas: filasBorradas, rutas: [] as string[] };

    if (pares.length > 0) {
      await tx.delete(documentoVersiones).where(
        or(...pares.map((p) => and(eq(documentoVersiones.documentoTipo, p.tipo), eq(documentoVersiones.documentoId, p.id)))),
      );
      await tx.delete(shareLinks).where(
        or(...pares.map((p) => and(eq(shareLinks.documentoTipo, p.tipo), eq(shareLinks.documentoId, p.id)))),
      );
    }

    return { filas: filasBorradas, rutas };
  });

  if (borrado.filas.length === 0) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  // Orden: primero la base, después el disco. La transacción de arriba es
  // atómica —o se va el cliente entero o no se va nada—, mientras que el disco
  // se borra archivo por archivo y cualquiera de esos borrados puede fallar.
  // Al revés (disco primero) el peor caso es un cliente VIVO con filas en
  // `client_files` que apuntan a archivos que ya no están: la ficha lista
  // documentos que no se pueden abrir, la investigación cree tener fuentes que
  // no existen, y no hay forma de recuperarlos. Así, el peor caso son bytes en
  // el disco que ya no referencia nadie: invisibles, inofensivos y
  // recuperables barriendo DATA_DIR. Por eso un fallo aquí no aborta ni
  // devuelve error: se registra y se sigue (spec §2).
  for (const ruta of borrado.rutas) {
    try {
      await borrarArchivo(ruta);
    } catch (e) {
      console.error(`[clientes] no se pudo borrar ${ruta}:`, e);
    }
  }
  try {
    await borrarCarpetaCliente(cliente.id);
  } catch (e) {
    console.error(`[clientes] no se pudo borrar la carpeta de ${cliente.id}:`, e);
  }

  return json({ ok: true, id: borrado.filas[0].id });
};
