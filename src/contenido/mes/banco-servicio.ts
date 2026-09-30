// Lo que el paso «Elegir los temas del mes» necesita leer de la base: el mapa
// de pilares vigente con el avance de su banco, las piezas del mes y los temas
// que el cliente ya usó en cualquier mes. Las reglas viven en ./propuesta.ts
// (puras); aquí solo se junta lo que hay que pasarles, y se escribe la
// selección en el lote. Lo usan la pantalla del mes, la API de temas, la de
// generar y el trabajo en segundo plano, para que los cuatro vean lo mismo.

import { desc, eq } from 'drizzle-orm';
import { db, contenidoLotes, contenidoPiezas, pilaresResults } from '@/db';
import { mapaUtil } from '@/lib/precheck';
import type { MapaPilares } from '@/pilares/schemas';
import { avanceDelMapa } from '@/pilares/avance-servicio';
import type { PiezaExistente } from './plan';
import { catalogoDeTemas, type TemaCatalogo } from './temas';
import type { SeleccionTemas } from './propuesta';

export type BancoDelMes = {
  mapaId: string;
  mapa: MapaPilares;
  catalogo: TemaCatalogo[];
  /** Las piezas de este mes, completas. */
  piezasLote: (PiezaExistente & { numero: number })[];
  /** Los temas de las piezas del cliente en cualquier mes (las de este incluidas), para saber cuáles están libres. */
  temasDelCliente: { id: string; temaId: string | null }[];
  /** Tema → mes (`AAAA-MM`) de OTRO lote donde ya se usó. Informativo: el selector lo avisa. */
  usadoEn: Map<string, string>;
};

/** El mapa de pilares más reciente CON temas de un cliente (`mapaUtil`), o `null` si no hay. */
export async function mapaVigente(clientId: string): Promise<{ id: string; datos: MapaPilares; version: number } | null> {
  const filas = await db.select({ id: pilaresResults.id, datos: pilaresResults.datos, version: pilaresResults.version })
    .from(pilaresResults).where(eq(pilaresResults.clientId, clientId)).orderBy(desc(pilaresResults.version));
  const m = mapaUtil(filas);
  return m ? { id: m.id, datos: m.datos as MapaPilares, version: m.version } : null;
}

/** Todo lo que hace falta para proponer y validar temas de un lote, o `null` si el cliente no tiene mapa con temas. */
export async function cargarBancoDelMes(clientId: string, loteId: string): Promise<BancoDelMes | null> {
  const mapa = await mapaVigente(clientId);
  if (!mapa) return null;

  const [avance, piezas] = await Promise.all([
    avanceDelMapa(mapa.id),
    db.select({ pieza: contenidoPiezas, loteId: contenidoLotes.id, periodo: contenidoLotes.periodo })
      .from(contenidoPiezas)
      .innerJoin(contenidoLotes, eq(contenidoLotes.id, contenidoPiezas.loteId))
      .where(eq(contenidoLotes.clientId, clientId)),
  ]);

  const usadoEn = new Map<string, string>();
  for (const { pieza, loteId: l, periodo } of piezas) {
    if (l !== loteId && pieza.temaId && !usadoEn.has(pieza.temaId)) usadoEn.set(pieza.temaId, periodo);
  }
  return {
    mapaId: mapa.id,
    mapa: mapa.datos,
    catalogo: catalogoDeTemas(mapa.datos, avance),
    piezasLote: piezas.filter((p) => p.loteId === loteId).map((p) => p.pieza as unknown as PiezaExistente & { numero: number })
      .sort((a, b) => a.numero - b.numero),
    temasDelCliente: piezas.map((p) => ({ id: p.pieza.id, temaId: p.pieza.temaId })),
    usadoEn,
  };
}

/** Escribe la selección en el lote (`null` la borra). No toca `contenido_actualizado_en`: elegir temas no cambia lo que el cliente vería. */
export async function guardarSeleccion(loteId: string, seleccion: SeleccionTemas | null, ahora: Date = new Date(), ejecutor: Pick<typeof db, 'update'> = db): Promise<void> {
  await ejecutor.update(contenidoLotes).set({ temasMes: seleccion, actualizadoEn: ahora }).where(eq(contenidoLotes.id, loteId));
}
