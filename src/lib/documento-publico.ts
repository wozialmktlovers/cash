import { and, eq, sql } from 'drizzle-orm';
import { db, researchResults, growthResults, pilaresResults, clients, clientLinks, clientFiles, contenidoLotes, contenidoPiezas } from '@/db';
import { leerShareLink, resolverShareLink, type DocumentoTipo } from '@/lib/share';
import { esUuid } from '@/lib/visibilidad';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarManual } from '@/render/growth/manual';
import { renderizarPilares } from '@/render/pilares/documento';
import { slugificar } from '@/lib/slug';

/**
 * La tabla de resultados que corresponde a cada tipo de documento. Se elige una
 * sola vez y se usa igual en el FROM y en la proyección: repartir el ternario
 * deja el SELECT apuntando a otra tabla y Drizzle revienta (ver el comentario
 * de `documentoVisible`, src/lib/visibilidad.ts).
 */
function tablaDe(tipo: DocumentoTipo) {
  return tipo === 'growth' ? growthResults : tipo === 'pilares' ? pilaresResults : researchResults;
}

/**
 * Resuelve un token público y rinde su documento.
 *
 * Compartido por las dos rutas: la antigua `/p/<token>` y la nueva
 * `/p/<negocio>/<token>`. La primera se conserva porque puede haber links ya
 * repartidos, y redirige a la forma con nombre.
 */
export async function resolverDocumentoPublico(token: string): Promise<
  | { tipo: 'html'; html: string; slug: string }
  | { tipo: 'no-encontrado' }
> {
  // Un token revocado o inexistente devuelve lo mismo: confirmar que existió
  // filtraría información a quien solo está probando tokens.
  const link = await resolverShareLink(token);
  if (!link) return { tipo: 'no-encontrado' };

  const tabla = tablaDe(link.documentoTipo);
  const [r] = await db.select().from(tabla).where(eq(tabla.id, link.documentoId)).limit(1);
  if (!r) return { tipo: 'no-encontrado' };

  const [c] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  if (!c) return { tipo: 'no-encontrado' };

  const fecha = r.createdAt.toISOString().slice(0, 10);

  const [sitio] = link.documentoTipo === 'growth'
    ? await db.select().from(clientLinks)
        .where(and(eq(clientLinks.clientId, c.id), eq(clientLinks.tipo, 'sitio'))).limit(1)
    : [undefined];

  // El link público nunca lleva barra de operador: es lo que ve el cliente.
  const html = link.documentoTipo === 'growth'
    ? renderizarManual(r.datos as any, {
        cliente: c.nombre, producto: c.producto, fecha,
        ciudad: c.ciudad ?? undefined,
        destino: sitio?.url,
        creadoEn: r.createdAt,
      })
    : link.documentoTipo === 'pilares'
    ? renderizarPilares(r.datos as any, { cliente: c.nombre, fecha })
    : renderizarInvestigacion(r.datos as any, { cliente: c.nombre, giro: c.giro, fecha });

  return { tipo: 'html', html, slug: slugificar(c.nombre) };
}

/**
 * Resuelve un archivo pedido desde un enlace público: `/p/{negocio}/{token}/archivo/{fileId}`.
 *
 * El entregable que ve el cliente no tiene sesión, así que el token que abre el
 * documento es también lo único que autoriza sus imágenes. Para que ese token
 * no sea una llave del almacén entero, un archivo se entrega solo si pasa las
 * tres:
 *
 * 1. **El token vale.** Existe y no está revocado. No cuenta visita
 *    (`leerShareLink`): las imágenes cuelgan de una visita ya contada.
 * 2. **Es del mismo cliente que el documento.** El token lleva a un documento,
 *    el documento a su cliente, y el archivo tiene que ser de ESE cliente.
 *    Nunca sirve nada de otro, que es lo que había que impedir.
 * 3. **Es un arte, no un archivo cualquiera del cliente.** Tiene que estar
 *    puesto como arte de alguna pieza (`contenido_piezas.arte`). Sin esto, el
 *    enlace de una investigación abriría también el brief, el contrato o lo que
 *    el equipo haya subido a la ficha de ese cliente: cosas que se suben al
 *    Studio para trabajar, no para repartirlas.
 *
 * Queda una holgura conocida, y es de hoy: un token abre los artes de su
 * cliente, no solo los de SU documento. Es que hoy no puede ser de otra forma:
 * `share_links.documento_tipo` solo tiene `research | growth | pilares`, y
 * ninguno de esos tres documentos incrusta archivos —se rinden desde su
 * `datos`—. Cuando el entregable del mes (fase C) tenga su propio tipo de
 * enlace, el filtro se estrecha a las piezas de ESE lote cambiando la condición
 * de `esArteDelCliente` por el `lote_id` del documento, y nada más.
 *
 * Como en el resto del sistema, todo lo que falla devuelve lo mismo —`null`,
 * que quien llama traduce a 404—: un archivo de otro cliente y un archivo que
 * no existe se contestan igual, para que nadie averigüe qué existe probando ids.
 */
export async function resolverArchivoPublico(
  token: string,
  fileId: string,
): Promise<{ clientId: string; archivo: { nombreOriginal: string; mime: string; ruta: string } } | null> {
  if (!esUuid(fileId)) return null;

  const link = await leerShareLink(token);
  if (!link) return null;

  const tabla = tablaDe(link.documentoTipo);
  const [documento] = await db.select().from(tabla).where(eq(tabla.id, link.documentoId)).limit(1);
  if (!documento) return null;

  const [archivo] = await db
    .select({ nombreOriginal: clientFiles.nombreOriginal, mime: clientFiles.mime, ruta: clientFiles.ruta })
    .from(clientFiles)
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.clientId, documento.clientId)))
    .limit(1);
  if (!archivo) return null;

  if (!(await esArteDelCliente(documento.clientId, fileId))) return null;

  return { clientId: documento.clientId, archivo };
}

/** ¿Este archivo está puesto como arte de alguna pieza de este cliente? */
async function esArteDelCliente(clientId: string, fileId: string): Promise<boolean> {
  // `arte` es una lista de `{ tipo, fileId }` o `{ tipo, url }` (ver la
  // columna en src/db/schema.ts), así que la pregunta es de contención: ¿hay
  // en la lista un objeto con este `fileId`? Eso es `@>` en Postgres, que sabe
  // resolverlo sin traerse los artes de todas las piezas del cliente.
  const [fila] = await db
    .select({ id: contenidoPiezas.id })
    .from(contenidoPiezas)
    .innerJoin(contenidoLotes, eq(contenidoLotes.id, contenidoPiezas.loteId))
    .where(and(
      eq(contenidoLotes.clientId, clientId),
      sql`${contenidoPiezas.arte} @> ${JSON.stringify([{ fileId }])}::jsonb`,
    ))
    .limit(1);
  return !!fila;
}
