import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { etapasDeClientes } from '@/flujo/servicio';

/**
 * Mismo truco que `tests/api/ids-no-uuid.test.ts`: sin `DATABASE_URL`
 * cualquier consulta lanza «Falta DATABASE_URL». Si `etapasDeClientes` se
 * atreviera a consultar con la lista vacía, la promesa se rechazaría y la
 * prueba fallaría.
 */
let urlPrevia: string | undefined;
beforeEach(() => { urlPrevia = process.env.DATABASE_URL; delete process.env.DATABASE_URL; });
afterEach(() => { if (urlPrevia !== undefined) process.env.DATABASE_URL = urlPrevia; });

describe('etapasDeClientes', () => {
  it('con la lista vacía devuelve un Map vacío sin tocar la base', async () => {
    const porCliente = await etapasDeClientes([]);
    expect(porCliente).toBeInstanceOf(Map);
    expect(porCliente.size).toBe(0);
  });

  it('con clientes sí consulta: sin DATABASE_URL revienta, que es la prueba de que la de arriba no consultó', async () => {
    await expect(etapasDeClientes(['00000000-0000-4000-8000-0000000000aa'])).rejects.toThrow('Falta DATABASE_URL');
  });
});
