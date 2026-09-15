import { describe, it, expect } from 'vitest';
import { barraOperador } from '@/render/barra-operador';

const base = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1', version: 1, tokenActivo: null, base: 'https://x',
};

describe('barra de operador', () => {
  it('en el manual de Growth desplaza su navegación y no trae restos del documento nuevo', () => {
    const b = barraOperador({ ...base, tipo: 'growth' });
    expect(b).toContain('.nav{top:var(--barra-h);}');
    expect(b).not.toContain('.doc-barra');
    expect(b).not.toContain('.indice-lateral');
  });

  it('operador sin permiso de compartir (M2 punto 1): la razón en lugar de «Crear link público»', () => {
    const b = barraOperador({ ...base, tipo: 'growth', razonNoCompartir: 'Solo aprobados' });
    expect(b).not.toContain('Crear link público');
    expect(b).toMatch(/id="bo-razon"(?![^>]*hidden)/);
    expect(b).toContain('Solo aprobados');
  });

  it('sin razón sigue el botón de crear y la razón no aparece', () => {
    const b = barraOperador({ ...base, tipo: 'growth' });
    expect(b).toContain('Crear link público');
    expect(b).not.toContain('id="bo-razon"');
  });

  it('el script no truena sin botón de crear y muestra el error del servidor', () => {
    const b = barraOperador({ ...base, tipo: 'growth', razonNoCompartir: 'x' });
    expect(b).toContain('if(crear)');
    expect(b).toContain('b.errores');
  });
});
