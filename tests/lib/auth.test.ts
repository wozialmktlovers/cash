import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generarToken } from '@/lib/auth';

describe('auth', () => {
  it('el hash no es la contraseña en texto plano', async () => {
    const h = await hashPassword('Secreta123!');
    expect(h).not.toBe('Secreta123!');
    expect(h.startsWith('$argon2id$')).toBe(true);
  });

  it('verifica una contraseña correcta', async () => {
    const h = await hashPassword('Secreta123!');
    expect(await verifyPassword(h, 'Secreta123!')).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const h = await hashPassword('Secreta123!');
    expect(await verifyPassword(h, 'otra')).toBe(false);
  });

  it('genera tokens únicos y suficientemente largos', () => {
    const a = generarToken(), b = generarToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(43);
  });
});
