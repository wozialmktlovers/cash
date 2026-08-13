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
