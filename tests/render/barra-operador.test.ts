import { describe, it, expect } from 'vitest';
import { barraOperador } from '@/render/barra-operador';

const base = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1', version: 1, tokenActivo: null, base: 'https://x',
};

describe('barra de operador', () => {
  it('en la investigación desplaza la cabecera del documento nuevo y usa los tokens', () => {
    const b = barraOperador({ ...base, tipo: 'research' });
    expect(b).toContain('.doc-barra{top:var(--barra-h);}');
    expect(b).toContain('var(--tarjeta)');
    expect(b).not.toContain('.deck{');
    expect(b).toContain('scroll-padding-top:calc(var(--barra-h) + 96px)');
    expect(b).toContain('.indice-lateral{top:calc(var(--barra-h) + 96px);}');
  });
  it('en el manual de Growth conserva su desplazamiento', () => {
    const b = barraOperador({ ...base, tipo: 'growth' });
    expect(b).toContain('.nav{top:var(--barra-h);}');
    expect(b).not.toContain('.doc-barra');
  });
});
