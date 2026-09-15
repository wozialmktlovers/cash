import { describe, it, expect } from 'vitest';
import { validarCliente, resumenCliente } from '@/lib/clientes';

describe('validarCliente', () => {
  it('acepta los tres campos obligatorios', () => {
    const r = validarCliente({ nombre: 'Ana Villa', giro: 'Cosmetología', producto: 'Diplomado' });
    expect(r.ok).toBe(true);
  });

  it('rechaza si falta el giro', () => {
    const r = validarCliente({ nombre: 'Ana Villa', producto: 'Diplomado' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(' ')).toContain('giro');
  });

  it('recorta espacios de los campos de texto', () => {
    const r = validarCliente({ nombre: '  Ana  ', giro: 'X', producto: 'Y' });
    if (r.ok) expect(r.datos.nombre).toBe('Ana');
  });
});

describe('resumenCliente', () => {
  it('expone solo id, nombre, giro y ciudad', () => {
    const r = resumenCliente({
      id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null,
      notas: 'privado', contacto: '33 0000 0000', producto: 'Diplomado',
    } as any);
    expect(r).toEqual({ id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null });
  });
});
