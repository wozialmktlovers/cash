import { describe, it, expect } from 'vitest';
import { navegacionCompleta, itemsMenuMas } from '@/lib/ui/navegacion';

describe('navegacionCompleta · marcado por rol', () => {
  it('admin ve las seis secciones, incluida Usuarios', () => {
    const nav = navegacionCompleta('admin', 3);
    expect(nav.map((n) => n.clave)).toEqual(['inicio', 'clientes', 'entregables', 'pendientes', 'usuarios', 'desempeno']);
    expect(nav.find((n) => n.clave === 'pendientes')?.contador).toBe(3);
  });

  it('operador ve Pendientes y Desempeño, pero nunca Usuarios (regla de rutaPermitida: /admin/* es admin-only)', () => {
    const nav = navegacionCompleta('operador', 0);
    expect(nav.map((n) => n.clave)).toEqual(['inicio', 'clientes', 'entregables', 'pendientes', 'desempeno']);
    expect(nav.find((n) => n.clave === 'usuarios')).toBeUndefined();
  });

  it('cliente solo ve las tres secciones base: sin Pendientes, Usuarios ni Desempeño', () => {
    const nav = navegacionCompleta('cliente', 0);
    expect(nav.map((n) => n.clave)).toEqual(['inicio', 'clientes', 'entregables']);
  });
});

describe('itemsMenuMas · lo que va al menú «Más» del celular (item 4)', () => {
  it('admin: Pendientes, Usuarios y Desempeño (lo que no cabe en las 4 pestañas fijas)', () => {
    const items = itemsMenuMas(navegacionCompleta('admin', 2));
    expect(items.map((n) => n.clave)).toEqual(['pendientes', 'usuarios', 'desempeno']);
  });

  it('operador: Pendientes y Desempeño, sin Usuarios', () => {
    const items = itemsMenuMas(navegacionCompleta('operador', 0));
    expect(items.map((n) => n.clave)).toEqual(['pendientes', 'desempeno']);
  });

  it('cliente: el menú «Más» queda vacío de secciones (solo llevaría Salir, que arma el layout aparte)', () => {
    const items = itemsMenuMas(navegacionCompleta('cliente', 0));
    expect(items).toEqual([]);
  });

  it('nunca incluye las pestañas fijas de la barra inferior (Inicio, Clientes, Entregables)', () => {
    for (const rol of ['admin', 'operador', 'cliente'] as const) {
      const claves = itemsMenuMas(navegacionCompleta(rol, 0)).map((n) => n.clave);
      expect(claves).not.toContain('inicio');
      expect(claves).not.toContain('clientes');
      expect(claves).not.toContain('entregables');
    }
  });
});
