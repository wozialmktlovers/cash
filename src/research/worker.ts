import { eq, or, asc } from 'drizzle-orm';
import { db, researchJobs, clients } from '@/db';
import { ejecutarJob } from './pipeline';
import { ejecutarGrowth } from '@/growth/pipeline';
import { ejecutarPilares } from '@/pilares/pipeline';
import { limpiarSesionesVencidas } from '@/lib/auth';
import { convertirLecturasPendientes } from './convertir-lecturas';
import { NOMBRE_ETAPA, etapaDeTipo } from '@/flujo/reglas';
import { avisarJob } from '@/flujo/avisos';

let corriendo = false;
let arrancado = false;

/**
 * Job fallido (spec §3, Avisos): avisa a quien lo lanzó. Los pipelines
 * marcan `fallido` ellos mismos cuando ninguna etapa produjo datos (sin
 * lanzar), y el `catch` de abajo lo hace para un fallo no capturado; en
 * ambos casos se revisa aquí el estado final, después de que ya quedó
 * guardado, para no avisar dos veces ni antes de tiempo.
 */
async function avisarSiJobFallido(job: typeof researchJobs.$inferSelect): Promise<void> {
  if (!job.creadoPor) return;
  const [fresco] = await db.select({ estado: researchJobs.estado }).from(researchJobs).where(eq(researchJobs.id, job.id)).limit(1);
  if (fresco?.estado !== 'fallido') return;

  const [cliente] = await db.select({ nombre: clients.nombre }).from(clients).where(eq(clients.id, job.clientId)).limit(1);
  void avisarJob({
    evento: 'job_fallido',
    creadoPor: job.creadoPor,
    cliente: cliente?.nombre ?? 'Cliente',
    etapa: NOMBRE_ETAPA[etapaDeTipo(job.tipo)],
    enlace: `/jobs/${job.id}`,
  }).catch((e) => console.error('[avisos] job_fallido:', e));
}

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
    else if (siguiente.tipo === 'pilares') await ejecutarPilares(siguiente.id);
    else await ejecutarJob(siguiente.id);
  } catch (e) {
    console.error('[worker] fallo no capturado:', e);
    await db.update(researchJobs)
      .set({ estado: 'fallido', error: e instanceof Error ? e.message : String(e), finishedAt: new Date() })
      .where(eq(researchJobs.id, siguiente.id));
  } finally {
    corriendo = false;
  }

  await avisarSiJobFallido(siguiente);
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

  // Las investigaciones anteriores a la lectura para cliente se convierten
  // solas. Espera a que termine el arranque y nunca corre sin llave.
  if (process.env.ANTHROPIC_API_KEY && process.env.CONVERTIR_LECTURAS !== '0') {
    setTimeout(() => {
      void convertirLecturasPendientes().catch((e) => console.error('[lecturas]', e));
    }, 15_000);
  }

  console.log('[worker] iniciado');
}
