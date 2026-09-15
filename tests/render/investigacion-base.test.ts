import { describe, it, expect } from 'vitest';
import { escapar } from '@/render/escapar';
import { fuente, lista, tabla, sinDatos } from '@/render/investigacion/comunes';
import { ESTILOS_INVESTIGACION } from '@/render/investigacion/estilos';

describe('comunes del documento', () => {
  it('escapar neutraliza HTML', () => {
    expect(escapar('<a href="x">\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
  });
  it('la fuente muestra el dominio y bloquea esquemas peligrosos', () => {
    const f = fuente({ url: 'https://www.inegi.org.mx/datos', consultado: '2026-08-10' });
    expect(f).toContain('href="https://www.inegi.org.mx/datos"');
    expect(f).toContain('>inegi.org.mx<');
    expect(fuente({ url: 'javascript:alert(1)', consultado: 'x' } as any)).toContain('href="#"');
  });
  it('la fuente escapa URL maliciosas', () => {
    expect(fuente({ url: 'https://x.com/"><script>alert(1)</script>', consultado: 'x' })).not.toContain('<script>');
  });
  it('lista y tabla escapan o respetan el HTML según corresponde', () => {
    expect(lista(['<b>'])).toContain('&lt;b&gt;');
    const t = tabla(['A'], [['<em>ok</em>']]);
    expect(t).toContain('<th>A</th>');
    expect(t).toContain('<em>ok</em>');
    expect(lista([])).toBe('');
  });
  it('sinDatos usa el texto del spec', () => {
    expect(sinDatos()).toContain('No se obtuvo información sobre este tema');
  });
});

describe('estilos del documento', () => {
  it('incrustan los tokens del Studio con sus dos temas', () => {
    expect(ESTILOS_INVESTIGACION).toContain('--rosa');
    expect(ESTILOS_INVESTIGACION).toContain(':root[data-tema="oscuro"]');
  });
  it('no traen restos del deck', () => {
    for (const c of ['.deck', '.panel{', '.dots', '.nav-bar']) expect(ESTILOS_INVESTIGACION).not.toContain(c);
  });
  it('fijan el ancho de lectura y reglas de impresión', () => {
    expect(ESTILOS_INVESTIGACION).toContain('760px');
    expect(ESTILOS_INVESTIGACION).toContain('@media print');
  });
});
