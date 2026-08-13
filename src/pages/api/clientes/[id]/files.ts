import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, clientFiles, clients } from '@/db';
import { guardarArchivo, borrarArchivo, mimePermitido, MAX_BYTES } from '@/lib/files';
import { extraerTexto, recortarTexto } from '@/lib/extract';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const POST: APIRoute = async ({ params, request }) => {
  const clientId = params.id!;

  const [cliente] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!cliente) return json({ ok: false, errores: ['El cliente no existe'] }, 404);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, errores: ['Se esperaba multipart/form-data'] }, 400);
  }

  const archivo = form.get('archivo');
  if (!(archivo instanceof File)) {
    return json({ ok: false, errores: ['Falta el campo «archivo»'] }, 400);
  }

  const mime = archivo.type || 'application/octet-stream';
  if (!mimePermitido(mime)) {
    return json({ ok: false, errores: [`Tipo no permitido: ${mime}`] }, 400);
  }
  if (archivo.size > MAX_BYTES) {
    return json({ ok: false, errores: ['El archivo supera 25 MB'] }, 400);
  }

  const buf = Buffer.from(await archivo.arrayBuffer());

  let ruta: string;
  try {
    ({ ruta } = await guardarArchivo(clientId, archivo.name, buf, mime));
  } catch (e) {
    return json({ ok: false, errores: [e instanceof Error ? e.message : 'No se pudo guardar'] }, 400);
  }

  const { texto, estado } = await extraerTexto(buf, mime);

  const [creado] = await db
    .insert(clientFiles)
    .values({
      clientId,
      nombreOriginal: archivo.name,
      ruta,
      mime,
      bytes: buf.byteLength,
      textoExtraido: texto ? recortarTexto(texto) : null,
      estadoExtraccion: estado === 'ok' ? 'ok' : estado === 'no_aplica' ? 'no_aplica' : 'fallo',
    })
    .returning({
      id: clientFiles.id,
      nombreOriginal: clientFiles.nombreOriginal,
      mime: clientFiles.mime,
      bytes: clientFiles.bytes,
      estadoExtraccion: clientFiles.estadoExtraccion,
    });

  return json({ ok: true, archivo: creado }, 201);
};

export const DELETE: APIRoute = async ({ params, url }) => {
  const clientId = params.id!;
  const fileId = url.searchParams.get('fileId');
  if (!fileId) return json({ ok: false, errores: ['Falta fileId'] }, 400);

  const [borrado] = await db
    .delete(clientFiles)
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.clientId, clientId)))
    .returning({ id: clientFiles.id, ruta: clientFiles.ruta });

  if (!borrado) return json({ ok: false, errores: ['El archivo no existe'] }, 404);

  // El registro ya no está; si el borrado en disco falla, no se revierte:
  // un archivo huérfano molesta menos que una fila que apunta a la nada.
  try {
    await borrarArchivo(borrado.ruta);
  } catch (e) {
    console.error(`[files] no se pudo borrar ${borrado.ruta}:`, e);
  }

  return json({ ok: true, id: borrado.id });
};
