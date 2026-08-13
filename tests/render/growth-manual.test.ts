import { describe, it, expect } from 'vitest';
import { renderizarManual } from '@/render/growth/manual';
import completo from '../fixtures/growth-completo.json';

const meta = {
  cliente: 'Yessica Villa', producto: 'Diplomado en Cosmiatría', fecha: '2026-08-13',
  destino: 'https://ejemplo.mx/registro', ciudad: 'Guadalajara',
  creadoEn: new Date('2026-08-13T00:00:00Z'),
};
const clonar = () => JSON.parse(JSON.stringify(completo));

describe('manual de campaña', () => {
  it('produce las nueve secciones', () => {
    const html = renderizarManual(completo as any, meta);
    expect((html.match(/class="sec"/g) ?? []).length).toBe(9);
  });

  it('trae las nueve anclas del nav, una por sección', () => {
    const html = renderizarManual(completo as any, meta);
    for (const id of ['setup','meta','creativos','prompts','google','rsa','traza','tecnico','seguimiento']) {
      expect(html, `falta el ancla ${id}`).toContain(`id="${id}"`);
      expect(html, `falta el enlace a ${id}`).toContain(`href="#${id}"`);
    }
  });

  it('deriva los contadores de portada, no los escribe a mano', () => {
    const html = renderizarManual(completo as any, meta);
    expect(html).toContain('3+5');
    expect(html).toContain('>9<');
    expect(html).toContain('>14<');
  });

  it('un cambio de semanas se refleja en la portada', () => {
    const g = clonar(); g.semanas = 7;
    expect(renderizarManual(g, meta)).toContain('>7<');
  });

  it('rinde los nueve huecos de creativo con su ratio aunque falten los copys', () => {
    const g = clonar();
    delete g.creativos;
    g._huecos = { creativos: 'El agente no devolvió datos válidos tras dos intentos.' };
    const html = renderizarManual(g, meta);
    // 3 grupos × (1 imagen + 5 tarjetas de carrusel + 2 del video) = 24 archivos
    expect((html.match(/class="slot ar-/g) ?? []).length).toBe(24);
    expect(html).toContain('ar-1x1');
    expect(html).toContain('ar-9x16');
    expect(html).toMatch(/no devolvió datos/i);
  });

  it('no inventa URLs cuando falta el destino', () => {
    const html = renderizarManual(completo as any, { ...meta, destino: undefined });
    expect(html).toContain('Las 0 URLs');
  });

  it('escapa el HTML de los textos generados', () => {
    const g = clonar();
    g.creativos[0].copyA = '<script>alert(1)</script>';
    g.bloqueantes[0] = '<img src=x onerror=alert(1)>';
    const html = renderizarManual(g, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa también las URLs de la tabla de trazabilidad', () => {
    const html = renderizarManual(completo as any, {
      ...meta, destino: 'https://ejemplo.mx/r?x="><script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('avisa cuando la investigación de origen venía parcial', () => {
    const html = renderizarManual(completo as any, { ...meta, investigacionParcial: true });
    expect(html).toMatch(/investigación de origen venía incompleta/i);
  });

  it('con todo vacío sigue produciendo nueve secciones y ningún dato inventado', () => {
    const html = renderizarManual({ _huecos: { estructura: 'No se ejecutó.', creativos: 'No se ejecutó.' } }, meta);
    expect((html.match(/class="sec"/g) ?? []).length).toBe(9);
    expect((html.match(/Sin datos/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('marca en rojo un titular que se pasa del límite de Google', () => {
    const g = clonar();
    g.rsa.titulares[0] = 'x'.repeat(35);
    const html = renderizarManual(g, meta);
    expect(html).toContain('35/30');
    expect(html).toContain('badge b-pink">35/30');
  });

  it('el manual y el deck son documentos distintos: aquí no hay deck ni paneles', () => {
    const html = renderizarManual(completo as any, meta);
    expect(html).not.toContain('class="panel"');
    expect(html).not.toContain('id="deck"');
  });
});
