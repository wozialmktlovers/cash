import { describe, it, expect } from 'vitest';
import { validarCliente } from '@/lib/clientes';

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
