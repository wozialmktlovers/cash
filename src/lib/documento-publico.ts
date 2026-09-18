import { and, asc, eq, sql } from 'drizzle-orm';
import { db, researchResults, growthResults, pilaresResults, clients, clientLinks, clientFiles, contenidoLotes, contenidoPiezas } from '@/db';
import { leerShareLink, resolverShareLink, type DocumentoTipo } from '@/lib/share';
import { esUuid } from '@/lib/visibilidad';
import { DIAS_REVISION_POR_OMISION } from '@/contenido/reglas';
import { asegurarLotesAlDia } from '@/contenido/auto-aprobacion';
import { aceptaDecision } from '@/contenido/revision';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarManual } from '@/render/growth/manual';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarContenido, type PiezaEntregable } from '@/render/contenido/documento';
import type { Arte } from '@/contenido/piezas';
import { slugificar } from '@/lib/slug';

/**
 * Los tres documentos que viven en una tabla de resultados con su `datos`.
 * `contenido` no está aquí: el entregable del mes no es una fila con datos,
 * sino un lote con sus piezas, y se resuelve por su propio camino.
 */
type TipoResultado = Exclude<DocumentoTipo, 'contenido'>;

/**
 * La tabla de resultados que corresponde a cada tipo de documento. Se elige una
 * sola vez y se usa igual en el FROM y en la proyección: repartir el ternario
 * deja el SELECT apuntando a otra tabla y Drizzle revienta (ver el comentario
 * de `documentoVisible`, src/lib/visibilidad.ts).
 */
function tablaDe(tipo: TipoResultado) {
  return tipo === 'growth' ? growthResults : tipo === 'pilares' ? pilaresResults : researchResults;
}

/**
 * De dónde pide sus artes el entregable del mes: **relativo al propio
 * documento**.
 *
 * La página vive en `/p/{negocio}/{token}` y los artes en
 * `/p/{negocio}/{token}/archivo/{fileId}`. Resolver `{token}/archivo/{fileId}`
 * contra la URL de la página quita el último segmento (el token) y vuelve a
 * ponerlo, así que da exactamente esa ruta —sin que el documento tenga que
 * saber en qué dominio ni bajo qué prefijo lo están sirviendo—.
 *
 * Depende de que la página NO termine en barra, que es la forma canónica a la
 * que redirige `src/pages/p/[slug]/[token].astro`.
 */
function baseArchivosPublica(token: string): string {
  return `${encodeURIComponent(token)}/archivo/`;
}

/** Las piezas del lote, campo por campo, tal como las pinta el entregable. */
async function piezasDelLote(loteId: string): Promise<PiezaEntregable[]> {
  const filas = await db.select().from(contenidoPiezas)
    .where(eq(contenidoPiezas.loteId, loteId))
    .orderBy(asc(contenidoPiezas.numero));

  // Campo por campo, como `piezaVisibleJson`: así una columna nueva de
  // `contenido_piezas` nunca se cuela sola al documento que ve el cliente. El
  // brief visual se queda fuera a propósito — es la indicación para quien hace
  // el arte, trabajo interno, no algo que el cliente tenga que revisar.
  return filas.map((p) => ({
    id: p.id,
    numero: p.numero,
    formato: p.formato,
    plataforma: p.plataforma,
    fechaPublicacion: p.fechaPublicacion,
    copy: p.copy,
    cta: p.cta,
    hashtags: p.hashtags,
    arte: (Array.isArray(p.arte) ? p.arte : []) as Arte[],
    estadoCliente: p.estadoCliente,
    notaCliente: p.notaCliente,
  }));
}

/**
 * El entregable del mes de un lote compartido por su token.
 *
 * **De solo lectura, siempre** (C2): aquí no hay sesión —el enlace lo reenvía
 * quien sea a quien sea— así que una aprobación hecha desde esta página no
 * quedaría atribuida a nadie. El documento lo dice en la portada y manda al
 * portal; el argumento completo está en el tipo `Revision`
 * (src/render/contenido/datos.ts). Los controles los pone solo
 * `/portal/contenido/[loteId]`, con el cliente identificado.
 *
 * Antes de leer nada se resuelven los vencimientos del cliente (C3, diseño §6):
 * si no, podría abrir su enlace y encontrarse un mes «en revisión» con la
 * cuenta regresiva ya en cero, es decir, el mismo documento diciéndole dos
 * cosas distintas. En el caso normal es una consulta sin filas y ninguna
 * escritura, y `asegurarLotesAlDia` nunca lanza.
 */
async function entregableDelLote(loteId: string, token: string): Promise<{ html: string; slug: string } | null> {
  // Una lectura mínima primero, solo para saber de qué cliente resolver los
  // vencimientos; el lote se vuelve a leer después porque el barrido pudo
  // cambiarle el estado y las piezas.
  const [duenio] = await db.select({ clientId: contenidoLotes.clientId })
    .from(contenidoLotes).where(eq(contenidoLotes.id, loteId)).limit(1);
  if (!duenio) return null;
  await asegurarLotesAlDia(duenio.clientId);

  const [lote] = await db.select().from(contenidoLotes).where(eq(contenidoLotes.id, loteId)).limit(1);
  if (!lote) return null;

  const [c] = await db.select().from(clients).where(eq(clients.id, lote.clientId)).limit(1);
  if (!c) return null;

  const piezas = await piezasDelLote(lote.id);

  const html = renderizarContenido(piezas, {
    cliente: c.nombre,
    periodo: lote.periodo,
    fecha: (lote.compartidoEn ?? lote.creadoEn).toISOString().slice(0, 10),
    compartidoEn: lote.compartidoEn,
    limiteRevision: lote.limiteRevision,
    diasRevision: c.diasRevision ?? DIAS_REVISION_POR_OMISION,
    // Aquí no hay controles que apagar —este documento es de solo lectura
    // siempre—, pero el mensaje de la portada sí cambia: un mes cerrado no puede
    // seguir anunciando un plazo que ya terminó. La regla es la misma que usa el
    // portal y que contesta la API (`aceptaDecision`), y se pregunta después de
    // `asegurarLotesAlDia`, que es quien deja el estado al día.
    cerrado: !aceptaDecision(lote, new Date()),
  }, { baseArchivos: baseArchivosPublica(token) });

  return { html, slug: slugificar(c.nombre) };
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

  if (link.documentoTipo === 'contenido') {
    const entregable = await entregableDelLote(link.documentoId, token);
    return entregable ? { tipo: 'html', ...entregable } : { tipo: 'no-encontrado' };
  }

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
 * 2. **El token es de un entregable del mes.** Es el único documento que
 *    incrusta archivos; los otros tres se rinden desde su `datos` y no piden
 *    ninguno, así que su token no abre nada aquí.
 * 3. **El archivo es un arte de ESE lote.** Tiene que estar puesto como arte de
 *    alguna pieza del lote al que abre el token (`contenido_piezas.arte`), no
 *    de cualquier pieza del cliente y mucho menos de cualquier archivo suyo: en
 *    la ficha de un cliente se suben briefs, contratos y demás cosas que se
 *    guardan para trabajar, no para repartirlas.
 *
 * Esto cierra la holgura que quedaba anotada aquí: mientras
 * `share_links.documento_tipo` no tenía un valor para el lote, el filtro más
 * estrecho posible era «artes de ese cliente». Con `contenido` ya existiendo,
 * el filtro es el lote, que es lo que el token de verdad autoriza. Un mismo
 * cliente con el lote de agosto y el de septiembre compartidos por separado
 * tiene ahora dos enlaces que no se prestan las imágenes.
 *
 * Como en el resto del sistema, todo lo que falla devuelve lo mismo —`null`,
 * que quien llama traduce a 404—: un archivo de otro lote y un archivo que no
 * existe se contestan igual, para que nadie averigüe qué existe probando ids.
 */
export async function resolverArchivoPublico(
  token: string,
  fileId: string,
): Promise<ArchivoDeLote | null> {
  // La forma del id se mira antes de ir a la base: un `fileId` que no es UUID
  // nunca va a existir, así que ni siquiera hace falta resolver el token.
  if (!esUuid(fileId)) return null;

  const link = await leerShareLink(token);
  if (!link || link.documentoTipo !== 'contenido') return null;
  return resolverArchivoDelLote(link.documentoId, fileId);
}

/** Un archivo listo para servirse, y de qué cliente sacarlo del disco. */
export type ArchivoDeLote = { clientId: string; archivo: { nombreOriginal: string; mime: string; ruta: string } };

/**
 * Los puntos 3 y 4 de `resolverArchivoPublico`, sin el token: el archivo tiene
 * que ser del cliente del lote **y** estar puesto como arte de alguna pieza de
 * ESE lote.
 *
 * Aparte porque el portal del cliente (C2) pide sus artes por otra puerta
 * —tiene sesión, no token— y tiene que aplicar exactamente el mismo filtro. Es
 * el punto fino: un usuario cliente autenticado NO debe poder pedir cualquier
 * archivo de su propia ficha por su id. En la ficha se suben briefs, contratos y
 * material de trabajo que se guarda para trabajar, no para repartirlo; lo que el
 * mes autoriza son los artes del mes. Con una sola función, abrir un hueco de
 * más en el portal exigiría cambiar también el enlace público, que es donde más
 * se cuida.
 */
export async function resolverArchivoDelLote(loteId: string, fileId: string): Promise<ArchivoDeLote | null> {
  if (!esUuid(fileId) || !esUuid(loteId)) return null;

  const [lote] = await db.select({ id: contenidoLotes.id, clientId: contenidoLotes.clientId })
    .from(contenidoLotes).where(eq(contenidoLotes.id, loteId)).limit(1);
  if (!lote) return null;

  const [archivo] = await db
    .select({ nombreOriginal: clientFiles.nombreOriginal, mime: clientFiles.mime, ruta: clientFiles.ruta })
    .from(clientFiles)
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.clientId, lote.clientId)))
    .limit(1);
  if (!archivo) return null;

  if (!(await esArteDelLote(lote.id, fileId))) return null;

  return { clientId: lote.clientId, archivo };
}

/** ¿Este archivo está puesto como arte de alguna pieza de ESTE lote? */
async function esArteDelLote(loteId: string, fileId: string): Promise<boolean> {
  // `arte` es una lista de `{ tipo, fileId }` o `{ tipo, url }` (ver la
  // columna en src/db/schema.ts), así que la pregunta es de contención: ¿hay
  // en la lista un objeto con este `fileId`? Eso es `@>` en Postgres, que sabe
  // resolverlo sin traerse los artes de todas las piezas del lote.
  const [fila] = await db
    .select({ id: contenidoPiezas.id })
    .from(contenidoPiezas)
    .where(and(
      eq(contenidoPiezas.loteId, loteId),
      sql`${contenidoPiezas.arte} @> ${JSON.stringify([{ fileId }])}::jsonb`,
    ))
    .limit(1);
  return !!fila;
}
