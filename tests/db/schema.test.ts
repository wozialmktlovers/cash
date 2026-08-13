import { describe, it, expect } from 'vitest';
import * as schema from '@/db/schema';

describe('esquema', () => {
  it('define las ocho tablas', () => {
    const tablas = ['users','sessions','clients','clientLinks','clientFiles','researchJobs','researchResults','shareLinks'];
    for (const t of tablas) expect(schema).toHaveProperty(t);
  });

  it('los estados de trabajo incluyen los cinco valores', () => {
    expect(schema.jobEstado.enumValues).toEqual(
      ['encolado','corriendo','completado','fallido','cancelado']
    );
  });
});

describe('esquema del Growth', () => {
  it('existe growth_results, espejo de research_results', async () => {
    const { growthResults } = await import('@/db/schema');
    expect(growthResults).toBeDefined();
  });

  it('los jobs distinguen investigación de manual de campaña', async () => {
    const { researchJobs } = await import('@/db/schema');
    expect(researchJobs.tipo).toBeDefined();
  });

  it('share_links apunta a un documento con su tipo, no solo a una investigación', async () => {
    const { shareLinks } = await import('@/db/schema');
    expect(shareLinks.documentoId).toBeDefined();
    expect(shareLinks.documentoTipo).toBeDefined();
  });

  it('conserva result_id para no perder el dato si la migración sale mal', async () => {
    // La columna queda huérfana a propósito: dejarla nullable y sin usar hace
    // la migración reversible sin necesitar un respaldo de la tabla, que no se
    // puede tomar sin abrirle red pública a la base.
    const { shareLinks } = await import('@/db/schema');
    expect(shareLinks.resultId).toBeDefined();
  });
});
