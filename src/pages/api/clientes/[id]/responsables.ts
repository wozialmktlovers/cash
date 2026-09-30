import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db, clienteEtapas, etapaResponsables } from '@/db';
import { clienteVisible, esUuid } from '@/lib/visibilidad';
import { PUESTOS, NOMBRE_ETAPA, type Puesto } from '@/flujo/reglas';
import { asignarResponsable } from '@/flujo/responsables';
import { avisarAsignacionResponsable } from '@/flujo/avisos';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * `PUT /api/clientes/[id]/responsables` — cuerpo `{ etapaId, puesto, usuarioId }`.
 * Solo el admin asigna (como antes solo él elegía operador). Pone (o quita,
 * con `usuarioId: null`) al responsable de UN puesto de UNA etapa del cliente;
 * `asignarResponsable` valida que el puesto le corresponda a la etapa y que la
 * persona sea un operador activo de ese puesto (nadie asigna un strategist a
 * `pilares`). Avisa al nuevo responsable si de verdad cambió.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
  const usuario = locals.usuario;
  if (usuario.rol !== 'admin') return json({ ok: false, error: 'prohibido' }, 403);

  const cliente = await clienteVisible(usuario, params.id!);
  if (!cliente) return json({ ok: false, error: 'no-existe' }, 404);

  let crudo: unknown;
  try { crudo = await request.json(); } catch { return json({ ok: false, error: 'json-invalido' }, 400); }
  const { etapaId, puesto, usuarioId } = (crudo ?? {}) as { etapaId?: unknown; puesto?: unknown; usuarioId?: unknown };

  if (typeof etapaId !== 'string' || !esUuid(etapaId)) return json({ ok: false, error: 'etapa-invalida' }, 400);
  if (typeof puesto !== 'string' || !(PUESTOS as readonly string[]).includes(puesto)) return json({ ok: false, error: 'puesto-invalido' }, 400);
  if (usuarioId !== null && (typeof usuarioId !== 'string' || !esUuid(usuarioId))) return json({ ok: false, error: 'usuario-invalido' }, 400);

  // La etapa tiene que ser de ESTE cliente.
  const [etapa] = await db.select().from(clienteEtapas)
    .where(and(eq(clienteEtapas.id, etapaId), eq(clienteEtapas.clientId, cliente.id))).limit(1);
  if (!etapa) return json({ ok: false, error: 'etapa-invalida' }, 404);

  const [actual] = await db.select({ usuarioId: etapaResponsables.usuarioId }).from(etapaResponsables)
    .where(and(eq(etapaResponsables.etapaId, etapa.id), eq(etapaResponsables.puesto, puesto as Puesto))).limit(1);
  // Sin cambio real no hay nada que asignar ni que avisar.
  if ((actual?.usuarioId ?? null) === usuarioId) return json({ ok: true });

  const r = await asignarResponsable({
    etapaId: etapa.id, etapa: etapa.etapa, puesto: puesto as Puesto, usuarioId: usuarioId as string | null, asignadoPor: usuario.id,
  });
  if (!r.ok) return json({ ok: false, error: 'asignacion-invalida', razon: r.razon }, 400);

  if (usuarioId) {
    void avisarAsignacionResponsable({
      actorId: usuario.id, nuevoResponsableId: usuarioId as string, cliente: cliente.nombre,
      etapa: NOMBRE_ETAPA[etapa.etapa], enlace: `/clientes/${cliente.id}`,
    }).catch((e) => console.error('[avisos] responsable_asignado:', e));
  }
  return json({ ok: true });
};
