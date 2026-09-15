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
});
