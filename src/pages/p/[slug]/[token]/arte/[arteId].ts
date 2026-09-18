import type { APIRoute } from 'astro';
import { arteParaEnlace } from '@/growth/artes';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';

const noExiste = () => new Response('No encontrado', { status: 404 });

/**
 * `GET /p/{negocio}/{token}/arte/{arteId}`: el arte de un anuncio del manual
 * de campaña que el cliente abre sin sesión.
 *
 * Cuelga del documento por la misma razón que `.../archivo/` del mes: el
 * token que abre el manual es lo único que autoriza su arte, y el manual lo
 * pide con una ruta relativa a sí mismo. Qué exige ese token, en
 * `arteParaEnlace`: vigente, de un manual, y el arte de ESE manual.
 */
export const GET: APIRoute = async ({ params, request }) => {
  const a = await arteParaEnlace(params.token!, params.arteId!);
  if (!a) return noExiste();
  let contenido: Buffer;
  try {
    contenido = await leerArchivo(a.clientId, a.ruta);
  } catch (e) {
    console.error(`[growth/artes] no se pudo leer ${a.ruta} para un enlace público:`, e);
    return noExiste();
  }
  return respuestaArchivo(contenido, a, {}, request.headers.get('range'));
};
