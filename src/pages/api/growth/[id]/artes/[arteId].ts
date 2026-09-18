import type { APIRoute } from 'astro';
import { arteParaEquipo, quitarArte } from '@/growth/artes';
import { leerArchivo } from '@/lib/files';
import { respuestaArchivo } from '@/lib/servir-archivo';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const noExiste = () => json({ ok: false, errores: ['El arte no existe'] }, 404);

/**
 * `GET /api/growth/[id]/artes/[arteId]`: el archivo de un arte, para la vista
 * interna del manual. Admin u operador asignado; el arte tiene que ser de ESE
 * manual. Todo lo demás, 404.
 */
export const GET: APIRoute = async ({ params, request, locals }) => {
  const a = await arteParaEquipo(locals.usuario, params.id!, params.arteId!);
  if (!a) return noExiste();
  let contenido: Buffer;
  try {
    contenido = await leerArchivo(a.clientId, a.ruta);
  } catch (e) {
    console.error(`[growth/artes] no se pudo leer ${a.ruta}:`, e);
    return noExiste();
  }
  // `Vary: Cookie`: la respuesta depende de la sesión (ver la del portal).
  return respuestaArchivo(contenido, a, { Vary: 'Cookie' }, request.headers.get('range'));
};

/** `DELETE /api/growth/[id]/artes/[arteId]`: quita el arte y borra su archivo. */
export const DELETE: APIRoute = async ({ params, locals }) => {
  const r = await quitarArte(locals.usuario, params.id!, params.arteId!);
  if (!r.ok) return json({ ok: false, errores: [r.error] }, r.status);
  return json({ ok: true, id: r.datos.id });
};
