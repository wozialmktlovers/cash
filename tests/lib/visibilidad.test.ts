import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { condicionClientes, esUuid } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, rol, clientId: null, activo: true, ...extra });

describe('esUuid', () => {
  it('acepta un UUID válido, mayúsculas incluidas', () => {
    expect(esUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(esUuid('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rechaza lo que no tiene forma de UUID', () => {
    expect(esUuid('')).toBe(false);
    expect(esUuid('nuevo')).toBe(false);
    expect(esUuid('550e8400-e29b-41d4-a716')).toBe(false);
    expect(esUuid('550e8400-e29b-41d4-a716-446655440000; DROP TABLE clients')).toBe(false);
  });
});

describe('condicionClientes', () => {
  it('admin sin condición', () => {
    expect(condicionClientes(u('admin'))).toBeUndefined();
  });

  it('operador filtra por su id', () => {
    const cond = condicionClientes(u('operador', { id: 'op1' }));
    expect(cond).toBeDefined();
    const { params } = new PgDialect().sqlToQuery(cond!);
    expect(params).toContain('op1');
  });

  it('cliente filtra por su clientId', () => {
    const cond = condicionClientes(u('cliente', { clientId: 'c1' }));
    expect(cond).toBeDefined();
    const { params } = new PgDialect().sqlToQuery(cond!);
    expect(params).toContain('c1');
  });
});
