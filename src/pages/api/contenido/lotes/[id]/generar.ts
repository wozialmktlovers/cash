// POST /api/contenido/lotes/[id]/generar — lanza la generación del mes con IA.
//
// No genera nada aquí: encola un job `contenido` que corre el worker en segundo
// plano (src/contenido/mes/pipeline.ts), con su progreso en /jobs/[id], su tope
// de gasto y su aviso en la campana al terminar. Esta ruta solo decide si se
// puede lanzar y con qué parámetros.
//
// Cuerpo (opcional si el lote está vacío):
// - `modo`: `completar` (agrega lo que falta del paquete, no toca nada) o
//   `reemplazar` (cambia las piezas sin revisar por piezas nuevas). Obligatorio
//   si el lote ya tiene piezas: la pantalla lo pregunta, y la API no adivina.
// - `incluirConArte`: con `reemplazar`, confirma de forma explícita que también
//   se reemplazan las piezas sin revisar que ya tienen arte. Sin él, esas se quedan.
//
// Códigos:
// - 404 el lote no existe o quien pregunta no opera a su cliente (el cliente,
//   un operador ajeno);
// - 400 cuerpo ilegible, o falta elegir el modo;
// - 409 el lote no está en proceso, el cliente no tiene paquete o mapa, el mes
//   ya cuadra, o el cliente ya tiene un trabajo en curso;
// - 201 encolado, con el id del job.

import type { APIRoute } from 'astro';
import { and, desc, eq, or } from 'drizzle-orm';
import { db, contenidoPiezas, pilaresResults, researchJobs } from '@/db';
import { leerPaquete } from '@/contenido/paquete';
import { MODOS, faltantes, separarPiezas, totalDe, type Modo, type ParametrosMes } from '@/contenido/mes/plan';
import type { MapaPilares } from '@/pilares/schemas';
import { puedeOperarCliente } from '@/lib/permisos';
import { loteVisible } from '@/lib/visibilidad';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export const POST: APIRoute = async ({ params, request, locals }) => {
  const visible = await loteVisible(locals.usuario, params.id!);
  if (!visible || !puedeOperarCliente(locals.usuario, visible.cliente)) {
    return json({ ok: false, errores: ['El lote no existe'] }, 404);
  }
  const { lote, cliente } = visible;

  let crudo: Record<string, unknown> = {};
  const texto = await request.text();
  if (texto.trim()) {
    try {
      const v = JSON.parse(texto);
      if (v && typeof v === 'object' && !Array.isArray(v)) crudo = v;
    } catch {
      return json({ ok: false, errores: ['El cuerpo no es JSON válido'] }, 400);
    }
  }

  if (lote.estado !== 'en_proceso') {
    return json({ ok: false, errores: ['Solo se genera un mes abierto y en proceso. Este ya se compartió o se aprobó.'] }, 409);
  }

  const paquete = leerPaquete(cliente.paquete);
  if (!paquete) {
    return json({
      ok: false,
      errores: ['Este cliente no tiene paquete mensual. Defínelo primero en su ficha: la IA genera exactamente ese paquete.'],
      enlace: `/clientes/${cliente.id}#paquete`,
    }, 409);
  }

  const [mapa] = await db.select({ datos: pilaresResults.datos }).from(pilaresResults)
    .where(eq(pilaresResults.clientId, cliente.id)).orderBy(desc(pilaresResults.version)).limit(1);
  if (!(mapa?.datos as MapaPilares | undefined)?.pilares?.some((p) => p.estado === 'ok')) {
    return json({ ok: false, errores: ['Este cliente no tiene un mapa de pilares con temas. El mes sale de ahí.'] }, 409);
  }

  const piezas = await db.select().from(contenidoPiezas).where(eq(contenidoPiezas.loteId, lote.id));
  let modo: Modo = 'completar';
  if (piezas.length > 0) {
    if (!(MODOS as readonly unknown[]).includes(crudo.modo)) {
      return json({ ok: false, errores: ['El mes ya tiene piezas: elige si completar lo que falta del paquete o reemplazar las piezas sin revisar.'] }, 400);
    }
    modo = crudo.modo as Modo;
  }
  const incluirConArte = modo === 'reemplazar' && crudo.incluirConArte === true;

  const { quedan, reemplazar } = separarPiezas(piezas, modo, incluirConArte);
  const porGenerar = faltantes(paquete, quedan);
  const total = totalDe(porGenerar);
  if (total === 0) {
    return json({ ok: false, errores: ['El mes ya cuadra con el paquete: no hay piezas que generar.'] }, 409);
  }

  // Un solo trabajo por cliente a la vez, como la investigación, el mapa y el manual.
  const [enCurso] = await db.select({ id: researchJobs.id }).from(researchJobs)
    .where(and(eq(researchJobs.clientId, cliente.id), or(eq(researchJobs.estado, 'encolado'), eq(researchJobs.estado, 'corriendo'))))
    .limit(1);
  if (enCurso) {
    return json({ ok: false, errores: ['Este cliente ya tiene un trabajo en curso. Espera a que termine.'], jobId: enCurso.id }, 409);
  }

  const parametros: ParametrosMes = {
    loteId: lote.id, periodo: lote.periodo, modo, incluirConArte, planeadas: reemplazar.map((p) => p.id),
  };
  const [creado] = await db.insert(researchJobs)
    .values({ clientId: cliente.id, tipo: 'contenido', estado: 'encolado', etapas: {}, parametros, creadoPor: locals.usuario.id })
    .returning({ id: researchJobs.id });

  return json({ ok: true, id: creado.id, piezas: total, porFormato: porGenerar, reemplaza: reemplazar.length }, 201);
};
