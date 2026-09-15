import type { APIRoute } from 'astro';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db, researchResults, growthResults, pilaresResults, documentoVersiones, etapaEventos, clienteEtapas, users } from '@/db';
import { documentoVisible, type DocumentoTipo } from '@/lib/visibilidad';
import { puedeOperarCliente } from '@/lib/permisos';
import { nombreVisible } from '@/lib/usuarios';
import { estadoTrasGenerar } from '@/flujo/reglas';
import { validarDocumento, puedeEditar } from '@/flujo/edicion';
import { guardarVersion, etapaDelDocumento } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const TABLAS = { research: researchResults, growth: growthResults, pilares: pilaresResults } as const;

function tipoValido(t: string | undefined): t is DocumentoTipo {
  return t === 'research' || t === 'growth' || t === 'pilares';
}

/** `GET /api/documentos/[tipo]/[id]/versiones`: historial sin los datos (numero, motivo, autor, creadoEn). Solo quien opera al cliente. */
export const GET: APIRoute = async ({ params, locals }) => {
  const tipoParam = params.tipo;
  const id = params.id!;
  if (!tipoValido(tipoParam)) return json({ ok: false, errores: ['El documento no existe'] }, 404);

  const doc = await documentoVisible(locals.usuario, tipoParam, id);
  if (!doc || !puedeOperarCliente(locals.usuario, doc.cliente)) {
    return json({ ok: false, errores: ['El documento no existe'] }, 404);
  }

  const filas = await db
    .select({ numero: documentoVersiones.numero, motivo: documentoVersiones.motivo, creadoEn: documentoVersiones.creadoEn, autorNombre: users.nombre, autorApellido: users.apellido, autorEmail: users.email })
    .from(documentoVersiones)
    .leftJoin(users, eq(users.id, documentoVersiones.autorId))
    .where(and(eq(documentoVersiones.documentoTipo, tipoParam), eq(documentoVersiones.documentoId, id)))
    .orderBy(desc(documentoVersiones.numero));

  // El texto del autor sale ya resuelto del servidor (`nombreVisible`): el
  // panel del historial solo lo pinta, y así la regla de «nombre apellido, o
  // el correo» no se repite en el navegador.
  const versiones = filas.map((f) => ({
    numero: f.numero,
    motivo: f.motivo,
    autor: nombreVisible({ nombre: f.autorNombre, apellido: f.autorApellido, email: f.autorEmail ?? 'Wozial' }),
    creadoEn: f.creadoEn,
  }));

  return json({ ok: true, versiones });
};

const cuerpoSchema = z.object({ numero: z.number().int().positive() });

/**
 * `POST /api/documentos/[tipo]/[id]/versiones`: restaura una versión (spec
 * §3, «Historial»). Mismo permiso que editar (`puedeEditar`): sin él, 409 con
 * la razón en español. Guarda los datos ACTUALES como versión `restaurada`
 * (el punto al que se podría volver de este restaurar), valida los datos de
 * la versión pedida y los deja como vigentes, todo en una transacción con
 * `SELECT ... FOR UPDATE` sobre la fila del resultado Y sobre la etapa (la
 * autorización se repite ahí, sobre la fila ya bloqueada — igual que en el
 * PATCH, B6 ronda de arreglos 1, punto 4). Un documento aprobado que se
 * restaura deja de estarlo, igual que al editar, y solo si es el vigente de
 * su etapa (punto 5).
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  const tipoParam = params.tipo;
  const id = params.id!;
  if (!tipoValido(tipoParam)) return json({ ok: false, errores: ['El documento no existe'] }, 404);

  const doc = await documentoVisible(locals.usuario, tipoParam, id);
  if (!doc || !puedeOperarCliente(locals.usuario, doc.cliente)) {
    return json({ ok: false, errores: ['El documento no existe'] }, 404);
  }

  let crudo: unknown;
  try {
    crudo = await request.json();
  } catch {
    return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
  }
  const r = cuerpoSchema.safeParse(crudo);
  if (!r.success) return json({ ok: false, errores: r.error.issues.map((i) => i.message) }, 400);

  // Primer chequeo, fuera de la transacción (salida rápida); la definitiva
  // se repite abajo sobre la etapa ya bloqueada.
  const etapa = await etapaDelDocumento(doc.cliente.id, tipoParam, id);
  if (!etapa) return json({ ok: false, errores: ['El documento no existe'] }, 404);

  const esOperadorAsignado = doc.cliente.operadorId === locals.usuario.id;
  if (!puedeEditar(locals.usuario.rol, esOperadorAsignado, etapa.estado)) {
    return json({ ok: false, errores: ['El documento está en revisión; espera la decisión del administrador'] }, 409);
  }

  const tabla = TABLAS[tipoParam];

  const resultado = await db.transaction(async (tx) => {
    const [actual] = await tx.select({ datos: tabla.datos }).from(tabla).where(eq(tabla.id, id)).for('update').limit(1);
    if (!actual) return { ok: false as const, status: 404 as const, errores: ['El documento no existe'] };

    const [etapaFresca] = await tx.select().from(clienteEtapas).where(eq(clienteEtapas.id, etapa.id)).for('update').limit(1);
    if (!etapaFresca) return { ok: false as const, status: 404 as const, errores: ['El documento no existe'] };
    if (!puedeEditar(locals.usuario.rol, esOperadorAsignado, etapaFresca.estado)) {
      return { ok: false as const, status: 409 as const, errores: ['El documento está en revisión; espera la decisión del administrador'] };
    }

    const [versionPedida] = await tx
      .select({ datos: documentoVersiones.datos })
      .from(documentoVersiones)
      .where(and(eq(documentoVersiones.documentoTipo, tipoParam), eq(documentoVersiones.documentoId, id), eq(documentoVersiones.numero, r.data.numero)))
      .limit(1);
    if (!versionPedida) return { ok: false as const, status: 404 as const, errores: ['La versión no existe'] };

    // La versión que se restaura se valida contra el documento ACTUAL (antes
    // de reemplazarlo): si `lectura` ya venía rota, restaurar no debe
    // bloquearse por eso (mismo criterio que editar — punto 6).
    const validado = validarDocumento(tipoParam, versionPedida.datos, actual.datos);
    if (!validado.ok) return { ok: false as const, status: 400 as const, errores: validado.errores };

    const version = await guardarVersion(tipoParam, id, actual.datos, 'restaurada', locals.usuario.id, tx);
    await tx.update(tabla).set({ datos: versionPedida.datos }).where(eq(tabla.id, id));

    const esVigente = etapaFresca.documentoTipo === tipoParam && etapaFresca.documentoId === id;
    if (esVigente) {
      const nuevoEstado = estadoTrasGenerar(etapaFresca.estado);
      if (nuevoEstado !== etapaFresca.estado) {
        await tx.update(clienteEtapas).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(clienteEtapas.id, etapaFresca.id));
        await tx.insert(etapaEventos).values({
          etapaId: etapaFresca.id, accion: 'restaurada', de: etapaFresca.estado, a: nuevoEstado, usuarioId: locals.usuario.id, comentario: null,
        });
      }
    }

    return { ok: true as const, version: version.numero };
  });

  if (!resultado.ok) return json({ ok: false, errores: resultado.errores }, resultado.status);
  return json({ ok: true, version: resultado.version });
};
