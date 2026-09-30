// POST /api/contenido/lotes/[id]/generar — «Autorizar temas y generar contenido»:
// paso 2 de la generación del mes con IA (el paso 1, elegir los temas, es
// `…/temas`).
//
// Aquí se AUTORIZA la selección de temas (quién y cuándo quedan guardados en
// el lote) y recién entonces se encola el trabajo de IA. No genera nada en
// esta petición: encola un job `contenido` que corre el worker en segundo
// plano (src/contenido/mes/pipeline.ts), con su progreso en /jobs/[id], su tope
// de gasto y su aviso en la campana al terminar. El agente recibe los temas
// autorizados y no elige ninguno.
//
// Quién puede: los responsables de la etapa (contenido y diseño) y el admin.
// Sin investigación y mapa de pilares no se genera (dependencia dura).
//
// Cuerpo:
// - `filas` (opcional): la selección que el usuario está viendo,
//   `[{ ref, formato, fecha, temaId }]`. Sin ellas se autoriza el borrador
//   guardado por el paso 1. Sin ninguna de las dos, 409: primero hay que elegir.
// - `modo`: `completar` o `reemplazar`, obligatorio si el lote ya tiene piezas
//   (la API no adivina). `incluirConArte`: con `reemplazar`, confirma de forma
//   explícita que también se reemplazan las piezas sin revisar que ya tienen
//   arte. Nunca se toca una pieza aprobada ni con cambios pedidos.
// - `confirmarDesajuste`: si la selección ya no cuadra con el paquete (se
//   cambiaron formatos), hay que aceptarlo de forma explícita.
//
// Códigos:
// - 404 el lote no existe o quien pregunta no lo ve; 403 no es responsable;
// - 400 cuerpo ilegible, o falta elegir el modo;
// - 409 el lote no está en proceso, falta paquete, investigación o mapa, el
//   mes ya cuadra, no hay selección, la selección es inválida o no cuadra con
//   el paquete sin confirmar, o el cliente ya tiene un trabajo en curso;
// - 201 encolado, con el id del job.

import type { APIRoute } from 'astro';
import { and, eq, or } from 'drizzle-orm';
import { db, contenidoLotes, researchJobs } from '@/db';
import type { ParametrosMes } from '@/contenido/mes/plan';
import { totalDe } from '@/contenido/mes/plan';
import { contextoDeMes, json, leerCuerpo, leerFilas } from '@/contenido/mes/contexto-api';
import { leerSeleccion, validarSeleccion, type FilaTema, type SeleccionTemas } from '@/contenido/mes/propuesta';
import { nombreVisible } from '@/lib/usuarios';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const cuerpo = await leerCuerpo(request);
  if (cuerpo instanceof Response) return cuerpo;
  const ctx = await contextoDeMes(locals.usuario, params.id!, cuerpo);
  if (ctx instanceof Response) return ctx;
  const { lote, cliente, banco, situacion } = ctx;

  const total = totalDe(situacion.esperadas);
  if (total === 0) {
    return json({ ok: false, errores: ['El mes ya cuadra con el paquete: no hay piezas que generar.'] }, 409);
  }

  // La selección: la que el usuario manda desde pantalla o, sin ella, el borrador guardado.
  let filas: FilaTema[] | null = null;
  if (cuerpo.filas !== undefined) {
    filas = leerFilas(cuerpo.filas);
    if (!filas) return json({ ok: false, errores: ['Las filas de la selección no tienen la forma esperada.'] }, 400);
  } else {
    const guardada = leerSeleccion(lote.temasMes);
    if (guardada && !guardada.autorizada && guardada.modo === ctx.modo && guardada.incluirConArte === ctx.incluirConArte) filas = guardada.filas;
  }
  if (!filas) {
    return json({ ok: false, errores: ['Primero elige los temas del mes: propónlos, revísalos y autorízalos para que la IA escriba sobre ellos.'] }, 409);
  }

  const v = validarSeleccion({
    filas, periodo: lote.periodo, catalogo: banco.catalogo,
    bloqueados: situacion.bloqueados, esperadas: situacion.esperadas, exigirTemas: true,
  });
  if (v.errores.length) return json({ ok: false, errores: v.errores }, 409);
  if (v.desajuste && cuerpo.confirmarDesajuste !== true) {
    return json({ ok: false, errores: v.avisos, requiereConfirmar: true, desajuste: v.desajuste }, 409);
  }

  // Un solo trabajo por cliente a la vez, como la investigación, el mapa y el manual.
  const [enCurso] = await db.select({ id: researchJobs.id }).from(researchJobs)
    .where(and(eq(researchJobs.clientId, cliente.id), or(eq(researchJobs.estado, 'encolado'), eq(researchJobs.estado, 'corriendo'))))
    .limit(1);
  if (enCurso) {
    return json({ ok: false, errores: ['Este cliente ya tiene un trabajo en curso. Espera a que termine.'], jobId: enCurso.id }, 409);
  }

  const ahora = new Date();
  const autorizada = { usuarioId: locals.usuario.id, nombre: nombreVisible(locals.usuario), en: ahora.toISOString() };
  const previa = leerSeleccion(lote.temasMes);
  const seleccion: SeleccionTemas = {
    modo: ctx.modo, incluirConArte: ctx.incluirConArte, filas,
    propuestaEn: previa?.propuestaEn || ahora.toISOString(), propuestaPor: previa?.propuestaPor ?? locals.usuario.id, autorizada,
  };
  const parametros: ParametrosMes = {
    loteId: lote.id, periodo: lote.periodo, modo: ctx.modo, incluirConArte: ctx.incluirConArte,
    planeadas: situacion.reemplazar.map((p) => p.id),
    temas: filas.map((f) => ({ ref: f.ref, formato: f.formato, fecha: f.fecha, temaId: f.temaId! })),
    autorizadaPor: locals.usuario.id, autorizadaEn: autorizada.en,
  };

  // Autorizar y encolar van juntos: una autorización sin trabajo (o un trabajo
  // sin constancia de quién lo autorizó) dejaría al mes contando algo falso.
  const creado = await db.transaction(async (tx) => {
    await tx.update(contenidoLotes).set({ temasMes: seleccion, actualizadoEn: ahora }).where(eq(contenidoLotes.id, lote.id));
    const [job] = await tx.insert(researchJobs)
      .values({ clientId: cliente.id, tipo: 'contenido', estado: 'encolado', etapas: {}, parametros, creadoPor: locals.usuario.id })
      .returning({ id: researchJobs.id });
    return job;
  });

  return json({ ok: true, id: creado.id, piezas: total, porFormato: situacion.esperadas, reemplaza: situacion.reemplazar.length }, 201);
};
