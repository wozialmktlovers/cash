// /api/contenido/lotes/[id]/temas — el paso «Elegir los temas del mes».
//
// - `POST` propone: el sistema calcula, SIN IA y sin costo, qué tema del mapa
//   de pilares va en cada pieza (./propuesta.ts, `proponerTemas`) y lo guarda
//   como borrador en el lote (`temas_mes`). Cuerpo: `{ modo?, incluirConArte? }`.
//   Volver a llamarlo regenera la propuesta completa y descarta lo editado.
// - `PUT` guarda lo que el equipo editó (tema, fecha y formato de cada fila):
//   `{ modo?, incluirConArte?, filas }`. Es un borrador: recargar la página no
//   lo pierde. Editar deshace una autorización previa — lo autorizado es lo que
//   se mandó a generar, no lo que se está cambiando ahora.
//
// Autorizar y lanzar la IA es `POST …/generar`; aquí nunca se escribe nada en
// las piezas ni se llama al modelo.
//
// Códigos: 400 cuerpo mal formado o falta el modo, 403 no es responsable de la
// etapa ni admin, 404 el lote no existe o no es de quien pregunta, 409 lote no
// abierto, sin paquete, sin investigación o mapa, o selección inválida
// (tema repetido, fecha fuera del mes, conteo distinto), 200 con la selección.

import type { APIRoute } from 'astro';
import { contextoDeMes, json, leerCuerpo, leerFilas, type ContextoMes } from '@/contenido/mes/contexto-api';
import { guardarSeleccion } from '@/contenido/mes/banco-servicio';
import { proponerTemas, validarSeleccion, type SeleccionTemas } from '@/contenido/mes/propuesta';
import { totalDe } from '@/contenido/mes/plan';
import { periodoActual } from '@/lib/ui/periodo';

export const POST: APIRoute = async ({ params, request, locals }) => {
  const cuerpo = await leerCuerpo(request);
  if (cuerpo instanceof Response) return cuerpo;
  const ctx = await contextoDeMes(locals.usuario, params.id!, cuerpo);
  if (ctx instanceof Response) return ctx;

  if (totalDe(ctx.situacion.esperadas) === 0) {
    return json({ ok: false, errores: ['El mes ya cuadra con el paquete: no hay piezas que generar.'] }, 409);
  }

  const ahora = new Date();
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const filas = proponerTemas({
    periodo: ctx.lote.periodo,
    paquete: ctx.paquete,
    modo: ctx.modo,
    incluirConArte: ctx.incluirConArte,
    piezasLote: ctx.banco.piezasLote,
    temasDelCliente: ctx.banco.temasDelCliente,
    catalogo: ctx.banco.catalogo,
    mix: ctx.banco.mapa.estrategia?.mix,
    // Si el mes ya empezó, se publica de hoy en adelante (ver `diasParaPublicar`).
    desde: ctx.lote.periodo === periodoActual(ahora) ? hoy : undefined,
  });

  const seleccion: SeleccionTemas = {
    modo: ctx.modo, incluirConArte: ctx.incluirConArte, filas,
    propuestaEn: ahora.toISOString(), propuestaPor: locals.usuario.id, autorizada: null,
  };
  await guardarSeleccion(ctx.lote.id, seleccion, ahora);
  return json({ ok: true, seleccion, ...resumen(ctx, filas) });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  const cuerpo = await leerCuerpo(request);
  if (cuerpo instanceof Response) return cuerpo;
  const filas = leerFilas(cuerpo.filas);
  if (!filas) return json({ ok: false, errores: ['Faltan las filas de la selección.'] }, 400);

  const ctx = await contextoDeMes(locals.usuario, params.id!, cuerpo);
  if (ctx instanceof Response) return ctx;

  const v = validarSeleccion({
    filas, periodo: ctx.lote.periodo, catalogo: ctx.banco.catalogo,
    bloqueados: ctx.situacion.bloqueados, esperadas: ctx.situacion.esperadas, exigirTemas: false,
  });
  if (v.errores.length) return json({ ok: false, errores: v.errores }, 409);

  const previa = ctx.lote.temasMes as { propuestaEn?: string; propuestaPor?: string | null } | null;
  const ahora = new Date();
  const seleccion: SeleccionTemas = {
    modo: ctx.modo, incluirConArte: ctx.incluirConArte, filas,
    propuestaEn: previa?.propuestaEn ?? ahora.toISOString(), propuestaPor: previa?.propuestaPor ?? locals.usuario.id, autorizada: null,
  };
  await guardarSeleccion(ctx.lote.id, seleccion, ahora);
  return json({ ok: true, seleccion, avisos: v.avisos, desajuste: v.desajuste });
};

function resumen(ctx: ContextoMes, filas: SeleccionTemas['filas']) {
  const v = validarSeleccion({
    filas, periodo: ctx.lote.periodo, catalogo: ctx.banco.catalogo,
    bloqueados: ctx.situacion.bloqueados, esperadas: ctx.situacion.esperadas, exigirTemas: false,
  });
  return { avisos: v.avisos, desajuste: v.desajuste };
}
