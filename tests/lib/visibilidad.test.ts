import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { condicionClientes } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, rol, clientId: null, activo: true, ...extra });

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
