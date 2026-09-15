import type { APIRoute } from 'astro';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, researchResults, growthResults, pilaresResults, etapaEventos, clienteEtapas } from '@/db';
import { documentoVisible, type DocumentoTipo } from '@/lib/visibilidad';
import { puedeOperarCliente } from '@/lib/permisos';
import { estadoTrasGenerar } from '@/flujo/reglas';
import { aplicarCambios, validarDocumento, puedeEditar, MAX_CAMBIOS } from '@/flujo/edicion';
import { guardarVersion, etapaDelDocumento } from '@/flujo/servicio';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const cambioSchema = z.object({ ruta: z.string().min(1).max(500), valor: z.string().max(2000) });
const cuerpoSchema = z.object({ cambios: z.array(cambioSchema).min(1).max(MAX_CAMBIOS) });

const TABLAS = { research: researchResults, growth: growthResults, pilares: pilaresResults } as const;

const RAZON_EN_REVISION = 'El documento está en revisión; espera la decisión del administrador';

/**
 * `PATCH /api/documentos/[tipo]/[id]`: edita textos del documento (spec §3,
 * «Guardar»). Sin permiso de ver el documento (u operarlo), 404; con permiso
 * pero sin poder editar (operador y la etapa está `en_revision`), 409 con la
 * razón en español; cambios inválidos o que no pasan el esquema, 400.
 *
 * Lee el `datos` actual, aplica los cambios y valida, guarda la versión
 * `edicion` con los datos ANTERIORES y actualiza `datos`, todo en una sola
 * transacción con `SELECT ... FOR UPDATE` sobre la fila del resultado: dos
 * ediciones concurrentes nunca se pisan (la segunda espera a que la primera
 * cierre su transacción y lee ya el `datos` actualizado).
 */
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const tipoParam = params.tipo;
  const id = params.id!;
  if (tipoParam !== 'research' && tipoParam !== 'growth' && tipoParam !== 'pilares') {
    return json({ ok: false, errores: ['El documento no existe'] }, 404);
  }
  const tipo = tipoParam as DocumentoTipo;

  const doc = await documentoVisible(locals.usuario, tipo, id);
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

  const etapa = await etapaDelDocumento(doc.cliente.id, tipo, id);
  if (!etapa) return json({ ok: false, errores: ['El documento no existe'] }, 404);

  const esOperadorAsignado = doc.cliente.operadorId === locals.usuario.id;
  if (!puedeEditar(locals.usuario.rol, esOperadorAsignado, etapa.estado)) {
    return json({ ok: false, errores: [RAZON_EN_REVISION] }, 409);
  }

  const tabla = TABLAS[tipo];

  const resultado = await db.transaction(async (tx) => {
    const [actual] = await tx.select({ datos: tabla.datos }).from(tabla).where(eq(tabla.id, id)).for('update').limit(1);
    if (!actual) return { ok: false as const, status: 404 as const, errores: ['El documento no existe'] };

    const aplicado = aplicarCambios(actual.datos, r.data.cambios);
    if (!aplicado.ok) return { ok: false as const, status: 400 as const, errores: aplicado.errores };

    const validado = validarDocumento(tipo, aplicado.datos);
    if (!validado.ok) return { ok: false as const, status: 400 as const, errores: validado.errores };

    // La versión guardada lleva los datos ANTERIORES: es el punto al que se
    // podría volver si esta edición resulta un error.
    const version = await guardarVersion(tipo, id, actual.datos, 'edicion', locals.usuario.id, tx);
    await tx.update(tabla).set({ datos: aplicado.datos }).where(eq(tabla.id, id));

    // Un documento aprobado que se edita deja de estarlo: hay que
    // reautorizarlo, igual que cuando el pipeline genera un entregable nuevo
    // encima (spec §3, «Alcance de edición»; ruling del controlador B6).
    const nuevoEstado = estadoTrasGenerar(etapa.estado);
    if (nuevoEstado !== etapa.estado) {
      await tx.update(clienteEtapas).set({ estado: nuevoEstado, actualizadoEn: new Date() }).where(eq(clienteEtapas.id, etapa.id));
      await tx.insert(etapaEventos).values({
        etapaId: etapa.id, accion: 'edicion', de: etapa.estado, a: nuevoEstado, usuarioId: locals.usuario.id, comentario: null,
      });
    }

    return { ok: true as const, version: version.numero };
  });

  if (!resultado.ok) return json({ ok: false, errores: resultado.errores }, resultado.status);
  return json({ ok: true, version: resultado.version });
};
