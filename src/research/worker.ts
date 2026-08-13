import { eq, or, asc } from 'drizzle-orm';
import { db, researchJobs } from '@/db';
import { ejecutarJob } from './pipeline';
import { ejecutarGrowth } from '@/growth/pipeline';
import { limpiarSesionesVencidas } from '@/lib/auth';

let corriendo = false;
let arrancado = false;

async function tick() {
  if (corriendo) return;

  const [siguiente] = await db.select().from(researchJobs)
    .where(or(eq(researchJobs.estado, 'encolado'), eq(researchJobs.estado, 'corriendo')))
    .orderBy(asc(researchJobs.createdAt)).limit(1);
  if (!siguiente) return;

  corriendo = true;
  try {
    // Una sola cola para los dos documentos: mismo worker, mismos estados,
    // misma contabilidad de costo. Lo único que cambia es qué pipeline corre.
    if (siguiente.tipo === 'growth') await ejecutarGrowth(siguiente.id);
    else await ejecutarJob(siguiente.id);
  } catch (e) {
    console.error('[worker] fallo no capturado:', e);
    await db.update(researchJobs)
      .set({ estado: 'fallido', error: e instanceof Error ? e.message : String(e), finishedAt: new Date() })
      .where(eq(researchJobs.id, siguiente.id));
  } finally {
    corriendo = false;
  }
}

export function arrancarWorker(): void {
  if (arrancado) return;

  // Sin base de datos no hay cola que atender. Esto además evita que el worker
  // intente arrancar durante `astro build`, donde DATABASE_URL no existe.
  if (!process.env.DATABASE_URL) {
    console.warn('[worker] sin DATABASE_URL: no se inicia');
    return;
  }

  arrancado = true;

  setInterval(() => {
    void tick().catch((e) => console.error('[worker] tick:', e));
  }, 5000);

  setInterval(() => {
    void limpiarSesionesVencidas().catch((e) => console.error('[worker] limpieza:', e));
  }, 6 * 60 * 60_000);

  console.log('[worker] iniciado');
}
