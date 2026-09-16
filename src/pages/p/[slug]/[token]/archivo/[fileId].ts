import type { APIRoute } from 'astro';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';
import { resolverArchivoPublico } from '@/lib/documento-publico';

/** Igual que la página del documento: una negativa seca, sin decir por qué. */
const noExiste = () => new Response('No encontrado', { status: 404 });

/**
 * `GET /p/{negocio}/{token}/archivo/{fileId}`: las imágenes del entregable que
 * el cliente abre sin sesión.
 *
 * Cuelga de la misma URL que el documento (`/p/{negocio}/{token}`) porque es el
 * mismo permiso: quien tiene el enlace ve el entregable, y las imágenes son
 * parte del entregable. Así el token viaja en la ruta de cada arte sin
 * inventarle al cliente una segunda llave que cuidar, y el documento las pide
 * con una ruta relativa a sí mismo.
 *
 * Qué autoriza exactamente ese token —y qué NO— está en
 * `resolverArchivoPublico` (src/lib/documento-publico.ts). Aquí solo se traduce
 * su `null` a 404.
 *
 * El nombre del negocio se ignora. En la página se redirige a la forma
 * canónica cuando no coincide, porque ahí el nombre es lo que lee el cliente;
 * una imagen no lo lee nadie, y un 301 por arte serían dos docenas de viajes
 * de más en cada carga.
 */
export const GET: APIRoute = async ({ params }) => {
  const r = await resolverArchivoPublico(params.token!, params.fileId!);
  if (!r) return noExiste();

  let contenido: Buffer;
  try {
    contenido = await leerArchivo(r.clientId, r.archivo.ruta);
  } catch (e) {
    console.error(`[archivos] no se pudo leer ${r.archivo.ruta} para un enlace público:`, e);
    return noExiste();
  }

  // Sin `Vary: Cookie`: aquí la respuesta no depende de ninguna sesión, solo
  // del token de la URL. La caché sigue siendo privada (ver `respuestaArchivo`).
  return respuestaArchivo(contenido, r.archivo);
};
