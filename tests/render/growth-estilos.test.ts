import { describe, it, expect } from 'vitest';
import { ESTILOS_GROWTH } from '@/render/growth/estilos';
import { NAVEGACION_GROWTH } from '@/render/growth/navegacion';

describe('estilos del manual de campaña', () => {
  it('hereda la base de videollamada', () => {
    expect(ESTILOS_GROWTH).toContain('--esc');
    expect(ESTILOS_GROWTH).toContain('--dim');
    expect(ESTILOS_GROWTH).toContain('.card{');
  });

  it('no deja ni un tamaño de letra en px, y ninguno por debajo de 0.75rem', () => {
    const sinRaiz = ESTILOS_GROWTH.replace(/html\s*\{[^}]*\}/g, '');
    const px = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(px, `quedan px sueltos: ${px.join(', ')}`).toEqual([]);
    const rem = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(rem.length).toBeGreaterThan(15);
    expect(Math.min(...rem)).toBeGreaterThanOrEqual(0.75);
  });

  it('trae las clases propias del machote', () => {
    for (const c of ['.sec', '.slot', '.slots-car', '.ar-1x1', '.ar-4x5', '.ar-9x16',
                     '.copy', '.kv', '.chips', '.chip-k', '.utm', '.shead', '.pre', '.fmt', '.grp']) {
      expect(ESTILOS_GROWTH, `falta ${c}`).toContain(c);
    }
  });

  it('trae el envase propio: nav de anclas y progreso de lectura', () => {
    expect(ESTILOS_GROWTH).toContain('.nav-links');
    expect(ESTILOS_GROWTH).toContain('.prog-fill');
  });

  it('no arrastra el envase del deck', () => {
    expect(ESTILOS_GROWTH).not.toContain('.deck{');
    expect(ESTILOS_GROWTH).not.toContain('.panel{');
    expect(ESTILOS_GROWTH).not.toContain('.dots{');
  });
});

describe('navegación del manual', () => {
  it('es JavaScript sintácticamente válido', () => {
    expect(() => new Function(NAVEGACION_GROWTH)).not.toThrow();
  });

  it('trae scroll-spy, progreso y los controles de videollamada', () => {
    expect(NAVEGACION_GROWTH).toContain('escala');
    expect(NAVEGACION_GROWTH).toContain('pantalla');
    expect(NAVEGACION_GROWTH).toContain('requestFullscreen');
    expect(NAVEGACION_GROWTH).toContain('--esc');
  });

  it('no escribe la escala mientras se teclea en un campo', () => {
    expect(NAVEGACION_GROWTH).toContain('INPUT|TEXTAREA');
  });
});
