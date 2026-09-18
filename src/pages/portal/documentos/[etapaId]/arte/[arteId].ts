import type { APIRoute } from 'astro';
import { arteParaPortal } from '@/growth/artes';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';

const noExiste = () => new Response('No encontrado', { status: 404 });

/**
 * `GET /portal/documentos/{etapaId}/arte/{arteId}`: el arte de un anuncio del
 * manual autorizado, desde el portal del cliente.
 *
 * Cuelga de la misma URL que el documento, como los artes del mes
 * (`/portal/contenido/{loteId}/archivo/...`): es el mismo permiso, y vivir
 * bajo `/portal/` es lo que la deja al alcance del rol `cliente` sin abrirle
 * ninguna ruta de la API. Quién puede exactamente, en `arteParaPortal`.
 */
export const GET: APIRoute = async ({ params, request, locals, url }) => {
  const a = await arteParaPortal(locals.usuario, url.searchParams, params.etapaId!, params.arteId!);
  if (!a) return noExiste();
  let contenido: Buffer;
  try {
    contenido = await leerArchivo(a.clientId, a.ruta);
  } catch (e) {
    console.error(`[growth/artes] no se pudo leer ${a.ruta} desde el portal:`, e);
    return noExiste();
  }
  return respuestaArchivo(contenido, a, { Vary: 'Cookie' }, request.headers.get('range'));
};
