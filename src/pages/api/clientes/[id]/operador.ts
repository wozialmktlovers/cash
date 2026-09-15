import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, clients, users } from '@/db';
import { clienteOperable } from '@/lib/visibilidad';
import { avisarReasignacion } from '@/flujo/avisos';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Solo el admin reasigna al responsable de un cliente.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const usuario = locals.usuario;
  if (usuario.rol !== 'admin') return json({ ok: false, error: 'prohibido' }, 403);

  const id = params.id!;
  const cliente = await clienteOperable(usuario, id);
  if (!cliente) return json({ ok: false, error: 'no-existe' }, 404);

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, error: 'json-invalido' }, 400);
  }

  const { operadorId } = (crudo ?? {}) as { operadorId?: unknown };
  // Forma inválida se rechaza antes de tocar la base: un id que no es UUID
  // haría fallar la columna con un 500 en vez de un 400 claro.
  if (typeof operadorId !== 'string' || !UUID_RE.test(operadorId)) {
    return json({ ok: false, error: 'operador-invalido' }, 400);
  }

  const [operador] = await db.select({ id: users.id, rol: users.rol, activo: users.activo }).from(users).where(eq(users.id, operadorId)).limit(1);
  if (!operador || !operador.activo || (operador.rol !== 'admin' && operador.rol !== 'operador')) {
    return json({ ok: false, error: 'operador-invalido' }, 400);
  }

  await db.update(clients).set({ operadorId, updatedAt: new Date() }).where(eq(clients.id, id));

  // El aviso va después del UPDATE y sin esperarlo: un fallo aquí no debe romper la reasignación.
  void avisarReasignacion({
    actorId: usuario.id,
    nuevoOperadorId: operadorId,
    cliente: cliente.nombre,
    enlace: `/clientes/${id}`,
  }).catch((e) => console.error('[avisos] cliente_reasignado:', e));

  return json({ ok: true });
};
