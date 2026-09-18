import { describe, it, expect } from 'vitest';
import { TOKENS, CSS_COMUN } from '@/render/base';

describe('base de render compartida', () => {
  // Los grises (--dim/--mid) y el resto de la paleta ya no se declaran aquí:
  // vienen de los tokens del Studio (src/styles/tokens.css, vía
  // ESTILOS_EDITORIAL), que es lo que le dio modo noche al manual. Lo que
  // queda en TOKENS es la escala de videollamada, y tiene que mover también
  // la escala tipográfica del Studio, que viene en px y no en rem.
  it('los tokens traen la escala de videollamada, y esa escala mueve el tipo', () => {
    expect(TOKENS).toContain('--esc');
    expect(TOKENS).toContain('font-size:calc(16px * var(--esc))');
    expect(TOKENS).toMatch(/--t-body:[^;]*var\(--esc\)/);
    expect(TOKENS).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('las clases comunes están en la base, no en el envase del documento', () => {
    for (const c of ['.card', '.tbl', '.lst', '.badge', '.blob', '.wrap', '.guia', '.grad', '.alert', '.stat']) {
      expect(CSS_COMUN, `falta ${c} en la base`).toContain(c);
    }
  });

  it('ni un color fijo: la paleta entera sale de los tokens del Studio', () => {
    // Era el diagnóstico del manual: negros y rosas escritos a mano que no
    // sabían nada del tema y dejaban el documento sin modo noche.
    expect(CSS_COMUN).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS_COMUN).not.toMatch(/\brgba?\(/);
  });

  it('el envase no se cuela en la base: aquí solo vive lo que dibuja el contenido', () => {
    expect(CSS_COMUN).not.toContain('.deck{');
    expect(CSS_COMUN).not.toContain('.panel{');
    expect(CSS_COMUN).not.toContain('.dots{');
    expect(CSS_COMUN).not.toContain('.mas{');
  });
});
