// El avance de los temas del banco de pilares escrito desde fuera del banco:
// la generación del mes con IA (src/contenido/mes/pipeline.ts) marca los temas
// que usó. Es el mismo mecanismo que el botón del banco (`PATCH
// /api/pilares/[id]/temas/[temaId]`): la misma tabla `pilares_temas` y el mismo
// upsert por (mapa, tema), así que mueve el mismo contador de uso —«en uso» es
// todo tema que dejó de estar pendiente (src/render/pilares/banco.ts)—.

import { eq } from 'drizzle-orm';
import { db, pilaresTemas } from '@/db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Ejecutor = Tx | typeof db;

/**
 * Pasa a «En desarrollo» los temas que el mes acaba de usar.
 *
 * Solo sube, nunca baja: un tema que el equipo ya marcó como desarrollado o
 * publicado se queda así (la condición del `ON CONFLICT` solo pisa filas
 * `pendiente`), y uno sin fila —pendiente por omisión— la estrena. La nota que
 * tuviera el tema no se toca.
 */
export async function marcarTemasEnDesarrollo(
  resultId: string,
  temaIds: string[],
  usuarioId: string | null,
  ahora: Date = new Date(),
  ejecutor: Ejecutor = db,
): Promise<void> {
  const ids = [...new Set(temaIds)];
  if (ids.length === 0) return;
  await ejecutor.insert(pilaresTemas)
    .values(ids.map((temaId) => ({ resultId, temaId, estado: 'en_desarrollo', actualizadoPor: usuarioId, actualizadoEn: ahora })))
    .onConflictDoUpdate({
      target: [pilaresTemas.resultId, pilaresTemas.temaId],
      set: { estado: 'en_desarrollo', actualizadoPor: usuarioId, actualizadoEn: ahora },
      setWhere: eq(pilaresTemas.estado, 'pendiente'),
    });
}

/** El avance del banco de un mapa, como `{ temaId: estado }`. */
export async function avanceDelMapa(resultId: string, ejecutor: Ejecutor = db): Promise<Map<string, string>> {
  const filas = await ejecutor.select({ temaId: pilaresTemas.temaId, estado: pilaresTemas.estado })
    .from(pilaresTemas).where(eq(pilaresTemas.resultId, resultId));
  return new Map(filas.map((f) => [f.temaId, f.estado]));
}
