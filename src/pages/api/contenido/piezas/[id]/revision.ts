import type { APIRoute } from 'astro';
import { registrarRevision, validarDecision } from '@/contenido/revision';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * `POST /api/contenido/piezas/[id]/revision` `{ decision: 'aprobar' | 'cambios', nota? }`:
 * lo que el cliente dice de una pieza de su mes (diseño §6, tarea C2).
 *
 * **Es la única ruta de `/api/contenido/…` abierta al rol `cliente`**, y está
 * abierta una por una en `RUTAS_CLIENTE` (src/lib/permisos.ts) con un patrón
 * que solo casa con este camino exacto: el resto de la API de contenido —altas,
 * ediciones, borrados, propuestas del agente— sigue siendo trabajo interno y el
 * middleware la corta con 403 antes de llegar aquí. Quien opera el mes no
 * aprueba sus propias piezas y quien lo revisa no lo edita.
 *
 * La ruta no decide nada: valida el cuerpo y traduce el resultado de
 * `registrarRevision` (src/contenido/revision.ts), donde están el permiso, el
 * vencimiento del plazo, el estado en que queda el lote, el comentario anclado
 * y el aviso al operador.
 *
 * Códigos:
 * - 400 cuerpo ilegible, decisión desconocida o «cambios» sin nota;
 * - 404 la pieza no existe, el id no tiene forma de UUID, o es de otro cliente
 *   —y también si quien pregunta no es un usuario cliente—;
 * - 409 el mes todavía no se comparte, o su plazo ya venció y quedó aprobado;
 * - 429 el cliente pasó el tope de observaciones (el mismo del portal);
 * - 200 registrada, con el estado del lote y el avance de la revisión para que
 *   la pantalla se actualice sin recargar.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }

  const v = validarDecision(crudo);
  if (!v.ok) return json({ ok: false, errores: v.errores }, 400);

  const r = await registrarRevision({
    piezaId: params.id!,
    usuario: locals.usuario,
    decision: v.decision,
    nota: v.nota,
  });

  if (!r.ok) return json({ ok: false, errores: r.errores }, r.status);
  return json({ ok: true, pieza: r.pieza, estadoLote: r.estadoLote, avance: r.avance });
};
