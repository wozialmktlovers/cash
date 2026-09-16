import type { APIRoute } from 'astro';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';
import { resolverArchivoDelLote } from '@/lib/documento-publico';
import { loteVisible } from '@/lib/visibilidad';

/** Una negativa seca, como la página del mes: sin decir por qué. */
const noExiste = () => new Response('No encontrado', { status: 404 });

/**
 * `GET /portal/contenido/{loteId}/archivo/{fileId}`: las imágenes y los videos
 * del mes que el cliente abre desde su portal (C2).
 *
 * Cuelga de la misma URL que la página del mes —igual que la del enlace público
 * cuelga de la suya— porque es el mismo permiso: quien puede ver ese mes puede
 * ver sus artes. Vivir bajo `/portal/` es además lo que la deja alcanzable para
 * el rol `cliente` sin tocar `RUTAS_CLIENTE`.
 *
 * Dos filtros, y los dos hacen falta:
 *
 * 1. **`loteVisible`**: el lote tiene que ser de un cliente que quien pregunta
 *    puede ver. Para un usuario `cliente` eso es exactamente su propia empresa.
 * 2. **`resolverArchivoDelLote`**: el archivo tiene que estar puesto como arte
 *    de alguna pieza de ESE lote. Sin esto, un cliente autenticado podría pedir
 *    por id cualquier archivo de su ficha —briefs, contratos, material interno
 *    que se sube para trabajar, no para repartir—. Es el mismo filtro que
 *    aplica el enlace público, en la misma función, a propósito.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const visible = await loteVisible(locals.usuario, params.loteId!);
  if (!visible) return noExiste();

  const r = await resolverArchivoDelLote(visible.lote.id, params.fileId!);
  if (!r) return noExiste();

  let contenido: Buffer;
  try {
    contenido = await leerArchivo(r.clientId, r.archivo.ruta);
  } catch (e) {
    console.error(`[archivos] no se pudo leer ${r.archivo.ruta} desde el portal:`, e);
    return noExiste();
  }

  // `Vary: Cookie`: aquí la respuesta SÍ depende de la sesión (a diferencia de
  // la del enlace público, que depende del token de la URL). La caché ya es
  // privada, pero esto evita que un intermediario reuse la respuesta entre dos
  // sesiones distintas del mismo navegador.
  return respuestaArchivo(contenido, r.archivo, { Vary: 'Cookie' });
};
