import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, clientFiles } from '@/db';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';
import { clienteVisible, esUuid } from '@/lib/visibilidad';

/**
 * Siempre la misma negativa. Un archivo que no existe, uno de otro cliente y
 * uno cuyo id ni siquiera tiene forma de UUID se contestan igual: si el de
 * otro cliente diera 403, bastaría con probar ids para saber cuáles existen
 * (mismo criterio que `POST /api/contenido/lotes` y que el DELETE de aquí al
 * lado).
 */
const noExiste = () =>
  new Response(JSON.stringify({ ok: false, errores: ['El archivo no existe'] }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * `GET /api/clientes/[id]/files/[fileId]`: devuelve un archivo subido, para el
 * equipo. Exige sesión —la pone el middleware— y que quien pregunta pueda ver
 * al cliente (`puedeVerCliente`, a través de `clienteVisible`): el admin
 * cualquiera, el operador los suyos, y el usuario del cliente los de su propia
 * ficha, que es lo que necesita el portal.
 *
 * Es «ver», no «operar», a propósito: subir y borrar son del operador
 * (`clienteOperable` en `files.ts`), pero mirar el arte de su mes también le
 * toca al cliente.
 *
 * Códigos: 200 con el archivo; 404 en todo lo demás.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const clientId = params.id!;
  const fileId = params.fileId!;

  // Un id que no es UUID no existe: se corta antes de llegar a Postgres, que
  // contestaría un 500 porque el tipo de la columna no calza (M2 punto 5).
  if (!esUuid(fileId)) return noExiste();

  if (!(await clienteVisible(locals.usuario, clientId))) return noExiste();

  const [archivo] = await db
    .select({ nombreOriginal: clientFiles.nombreOriginal, mime: clientFiles.mime, ruta: clientFiles.ruta })
    .from(clientFiles)
    // Las dos condiciones, no solo el id: el archivo tiene que ser del cliente
    // de la URL, que es el que pasó el permiso.
    .where(and(eq(clientFiles.id, fileId), eq(clientFiles.clientId, clientId)))
    .limit(1);
  if (!archivo) return noExiste();

  let contenido: Buffer;
  try {
    contenido = await leerArchivo(clientId, archivo.ruta);
  } catch (e) {
    // La fila está y el archivo no se puede leer: o se perdió en el disco, o
    // su `ruta` apunta fuera de la carpeta del cliente. Queda en el registro,
    // porque es un problema del sistema, pero afuera se ve como un 404.
    console.error(`[archivos] no se pudo leer ${archivo.ruta} del cliente ${clientId}:`, e);
    return noExiste();
  }

  // La respuesta depende de quién la pidió, y eso viaja en la cookie de
  // sesión: sin `Vary`, una caché podría dar el archivo de una persona a otra
  // del mismo navegador.
  return respuestaArchivo(contenido, archivo, { Vary: 'Cookie' });
};
