import { describe, it, expect } from 'vitest';
import { FORMA_SINTESIS } from '@/research/agents/sintesis';
import { sintesisSchema } from '@/research/schemas';

// En producción la síntesis falló entera porque el pedido no describía la
// forma del JSON y el modelo inventó sus propias llaves.
describe('FORMA_SINTESIS', () => {
  it('nombra cada llave de primer nivel del esquema de síntesis', () => {
    for (const llave of Object.keys(sintesisSchema.shape)) {
      expect(FORMA_SINTESIS).toContain(`"${llave}"`);
    }
  });
});
