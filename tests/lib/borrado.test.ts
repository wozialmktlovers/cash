import { describe, it, expect } from 'vitest';
import { nombreConfirmado, itemsPerdida } from '@/lib/borrado';

/**
 * Reglas puras del borrado de un cliente (spec §2). Son las mismas que usan
 * el diálogo y el endpoint, así que lo que se fije aquí vale para los dos.
 */
describe('nombreConfirmado', () => {
  it('el nombre idéntico confirma', () => {
    expect(nombreConfirmado('Café Malinche', 'Café Malinche')).toBe(true);
  });

  it('las mayúsculas y minúsculas SÍ cuentan', () => {
    expect(nombreConfirmado('café malinche', 'Café Malinche')).toBe(false);
    expect(nombreConfirmado('CAFÉ MALINCHE', 'Café Malinche')).toBe(false);
  });

  it('los acentos SÍ cuentan', () => {
    expect(nombreConfirmado('Cafe Malinche', 'Café Malinche')).toBe(false);
  });

  it('los espacios de en medio SÍ cuentan', () => {
    expect(nombreConfirmado('Café  Malinche', 'Café Malinche')).toBe(false);
  });

  // Concesión 1: el nombre guardado ya viene recortado, así que un espacio en
  // los extremos es un pegado o un teclado de celular, no otro nombre.
  it('los espacios de los extremos no cuentan', () => {
    expect(nombreConfirmado('  Café Malinche ', 'Café Malinche')).toBe(true);
    expect(nombreConfirmado('\tCafé Malinche\n', 'Café Malinche')).toBe(true);
  });

  // Concesión 2: la misma letra escrita compuesta o descompuesta se ve igual
  // en pantalla; rechazarla dejaría a un admin sin forma de escribir el nombre.
  it('la misma letra en NFD y en NFC es la misma letra', () => {
    const compuesta = 'Café Malinche'.normalize('NFC');
    const descompuesta = 'Café Malinche'.normalize('NFD');
    expect(compuesta === descompuesta).toBe(false); // son distintas byte a byte
    expect(nombreConfirmado(descompuesta, compuesta)).toBe(true);
    expect(nombreConfirmado(compuesta, descompuesta)).toBe(true);
  });

  it('un campo vacío (o de puros espacios) nunca confirma', () => {
    expect(nombreConfirmado('', 'Café Malinche')).toBe(false);
    expect(nombreConfirmado('   ', 'Café Malinche')).toBe(false);
    expect(nombreConfirmado('', '')).toBe(false);
  });

  it('lo que no es texto nunca confirma', () => {
    for (const v of [undefined, null, 7, true, {}, ['Café Malinche']]) {
      expect(nombreConfirmado(v, 'Café Malinche')).toBe(false);
    }
  });
});

describe('itemsPerdida', () => {
  it('enumera siempre los cuatro renglones, aunque estén en cero', () => {
    const items = itemsPerdida({ entregables: 0, archivos: 0, cuentas: 0, enlaces: 0 });
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.cantidad === 0)).toBe(true);
  });

  it('respeta las cantidades y su orden', () => {
    const items = itemsPerdida({ entregables: 3, archivos: 5, cuentas: 2, enlaces: 4 });
    expect(items.map((i) => i.cantidad)).toEqual([3, 5, 2, 4]);
  });

  it('concuerda en singular y en plural', () => {
    const uno = itemsPerdida({ entregables: 1, archivos: 1, cuentas: 1, enlaces: 1 });
    expect(uno[0].texto).toContain('entregable (');
    expect(uno[1].texto).toContain('archivo subido');
    expect(uno[2].texto).toContain('cuenta de acceso');
    expect(uno[3].texto).toContain('enlace de la ficha');

    const varios = itemsPerdida({ entregables: 2, archivos: 2, cuentas: 2, enlaces: 2 });
    expect(varios[0].texto).toContain('entregables (');
    expect(varios[1].texto).toContain('archivos subidos');
    expect(varios[2].texto).toContain('cuentas de acceso');
    expect(varios[3].texto).toContain('enlaces de la ficha');
  });

  // Las cuentas de acceso son lo que más duele y lo que menos se espera: el
  // diálogo tiene que decirlo con todas sus letras (spec §2).
  it('avisa que las cuentas de acceso dejan de entrar al portal', () => {
    const items = itemsPerdida({ entregables: 0, archivos: 0, cuentas: 3, enlaces: 0 });
    expect(items[2].texto).toContain('portal');
  });
});
