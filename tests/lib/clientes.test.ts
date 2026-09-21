import { describe, it, expect } from 'vitest';
import { validarCliente, resumenCliente, OBJETIVOS_MAX } from '@/lib/clientes';

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

describe('validarCliente · objetivos', () => {
  const minimos = { nombre: 'Ana', giro: 'X', producto: 'Y' };

  it('son opcionales: sin el campo no se tocan', () => {
    const r = validarCliente(minimos);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.objetivos).toBeUndefined();
  });

  it('recorta espacios y normaliza los saltos de línea', () => {
    const r = validarCliente({ ...minimos, objetivos: '  Abrir en Monterrey.\r\nEvitar a X.  ' });
    expect(r.ok && r.datos.objetivos).toBe('Abrir en Monterrey.\nEvitar a X.');
  });

  it('vacío o solo espacios se guarda como null (así se borran desde la ficha)', () => {
    for (const vacio of ['', '   ', null]) {
      const r = validarCliente({ ...minimos, objetivos: vacio });
      expect(r.ok && r.datos.objetivos).toBeNull();
    }
  });

  it(`admite exactamente ${OBJETIVOS_MAX} caracteres y rechaza uno más`, () => {
    expect(OBJETIVOS_MAX).toBe(2000);
    expect(validarCliente({ ...minimos, objetivos: 'a'.repeat(OBJETIVOS_MAX) }).ok).toBe(true);
    const r = validarCliente({ ...minimos, objetivos: 'a'.repeat(OBJETIVOS_MAX + 1) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(' ')).toMatch(/objetivos.*2000/);
  });

  it('el tope cuenta después de recortar y de pasar CRLF a LF, como el contador del navegador', () => {
    const conCrlf = `${'a'.repeat(999)}\r\n${'b'.repeat(1000)}`; // 2001 crudos, 2000 normalizados
    expect(validarCliente({ ...minimos, objetivos: `  ${conCrlf}  ` }).ok).toBe(true);
  });

  it('rechaza lo que no es texto', () => {
    expect(validarCliente({ ...minimos, objetivos: 42 }).ok).toBe(false);
  });
});

describe('resumenCliente', () => {
  it('expone solo id, nombre, giro y ciudad', () => {
    const r = resumenCliente({
      id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null,
      notas: 'privado', objetivos: 'interno', contacto: '33 0000 0000', producto: 'Diplomado',
    } as any);
    expect(r).toEqual({ id: 'c1', nombre: 'Yessica Villa', giro: 'Cosmetología', ciudad: null });
  });
});
