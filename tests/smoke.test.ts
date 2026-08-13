import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('carga variables de entorno de ejemplo', () => {
    expect(typeof process.env.NODE_ENV).toBe('string');
  });
});
