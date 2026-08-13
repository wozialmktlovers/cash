import { describe, it, expect } from 'vitest';
import { TOKENS, CSS_COMUN } from '@/render/base';
import { ESTILOS } from '@/render/estilos';

describe('base de render compartida', () => {
  it('los tokens traen la escala de videollamada y los grises', () => {
    expect(TOKENS).toContain('--esc');
    expect(TOKENS).toContain('--dim');
    expect(TOKENS).toContain('--mid');
    expect(TOKENS).toContain('font-size:calc(16px * var(--esc))');
  });

  it('las clases comunes están en la base, no en el envase del deck', () => {
    for (const c of ['.card', '.tbl', '.lst', '.badge', '.blob', '.wrap', '.guia', '.grad', '.alert', '.stat']) {
      expect(CSS_COMUN, `falta ${c} en la base`).toContain(c);
    }
  });

  it('el envase del deck no se cuela en la base: es lo que no comparte con el Growth', () => {
    expect(CSS_COMUN).not.toContain('.deck{');
    expect(CSS_COMUN).not.toContain('.panel{');
    expect(CSS_COMUN).not.toContain('.dots{');
    expect(CSS_COMUN).not.toContain('.mas{');
  });

  it('ESTILOS sigue componiendo base y deck, sin perder nada', () => {
    expect(ESTILOS).toContain('--esc');       // de tokens
    expect(ESTILOS).toContain('.card{');      // de comunes
    expect(ESTILOS).toContain('.deck{');      // del deck
    expect(ESTILOS).toContain('.panel{');
  });
});
