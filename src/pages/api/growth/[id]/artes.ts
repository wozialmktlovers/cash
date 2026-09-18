import type { APIRoute } from 'astro';
import { subirArte, type Subida } from '@/growth/artes';
import { MAX_BYTES } from '@/lib/files';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/** Un entero escrito en un campo del formulario; `null` si viene vacío, `NaN` si no es número. */
function entero(v: FormDataEntryValue | null): number | null {
  if (v === null || (typeof v === 'string' && v.trim() === '')) return null;
  return typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
}

/**
 * `POST /api/growth/[id]/artes`: sube o enlaza el arte de un anuncio del
 * manual de campaña (multipart/form-data).
 *
 * Campos: `creativo` (el índice `N` de `creativos.N`), `orden` (el hueco del
 * anuncio; vacío en un carrusel es «agregar tarjeta») y, uno de dos,
 * `archivo` (PNG, JPEG o MP4, hasta 25 MB) o `url` (http/https).
 *
 * Solo admin u operador asignado (`puedeOperarCliente`); a cualquier otro, 404
 * como si el manual no existiera. No toca la etapa ni crea versión: el arte
 * vive fuera del documento (ver `growthArtes`, src/db/schema.ts).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  // Antes de leer el cuerpo: un archivo de 300 MB no tiene por qué cargarse
  // en memoria para saber que no cabe. El margen cubre los demás campos.
  const largo = Number(request.headers.get('content-length') ?? 0);
  if (largo > MAX_BYTES + 64 * 1024) return json({ ok: false, errores: ['El archivo supera 25 MB.'] }, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, errores: ['Se esperaba multipart/form-data'] }, 400);
  }

  const creativo = entero(form.get('creativo'));
  const orden = entero(form.get('orden'));
  if (creativo === null || Number.isNaN(creativo) || Number.isNaN(orden)) {
    return json({ ok: false, errores: ['Falta indicar el anuncio.'] }, 400);
  }

  const archivo = form.get('archivo');
  const url = form.get('url');
  let subida: Subida;
  if (archivo instanceof File && archivo.size > 0) {
    if (typeof url === 'string' && url.trim()) {
      return json({ ok: false, errores: ['Manda un archivo o un enlace, no los dos.'] }, 400);
    }
    if (archivo.size > MAX_BYTES) return json({ ok: false, errores: ['El archivo supera 25 MB.'] }, 400);
    subida = { creativo, orden, archivo: { nombre: archivo.name, buf: Buffer.from(await archivo.arrayBuffer()) } };
  } else if (typeof url === 'string' && url.trim()) {
    subida = { creativo, orden, url };
  } else {
    return json({ ok: false, errores: ['Falta el archivo o el enlace.'] }, 400);
  }

  const r = await subirArte(locals.usuario, params.id!, subida);
  if (!r.ok) return json({ ok: false, errores: [r.error] }, r.status);
  return json({ ok: true, arte: r.datos }, 201);
};
