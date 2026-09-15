import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion, SCRIPT_DOCUMENTO } from '@/render/investigacion/documento';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';
import lectura from '../fixtures/lectura-ejemplo.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };
const conLectura = (l: any = lectura) => ({ ...(completa as any), lectura: { estado: 'ok', datos: l } });
const copia = () => JSON.parse(JSON.stringify(lectura));

describe('documento con lectura', () => {
  const html = renderizarInvestigacion(conLectura(), meta);

  it('trae las tres secciones con sus anclas y el índice', () => {
    for (const id of ['descubrimos', 'cliente-ideal', 'recomendamos']) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
    }
  });

  it('muestra el contenido de la lectura con sus etiquetas', () => {
    expect(html).toContain((lectura as any).portada.titular);
    expect(html).toContain('A tu favor');
    expect(html).toContain('Hay que cuidar');
    expect(html).toContain('Oportunidad');
    expect(html).toContain('Cómo hablarle');
    expect(html).toContain('Dónde anunciarte');
    expect(html).toContain('Sobre tu precio');
    expect(html).toContain('Lo que falta confirmar');
  });

  it('pliega el detalle técnico', () => {
    expect(html).toMatch(/<details class="detalle">/);
    expect(html).toContain('Ver el detalle de la investigación');
  });

  it('es una página continua, sin restos del deck', () => {
    for (const r of ['class="panel', 'id="deck"', 'id="dots"', 'id="prev"']) expect(html).not.toContain(r);
  });

  it('trae el tema, el switch y el título', () => {
    expect(html).toContain('wozial-tema');
    expect(html).toContain('data-tema-valor="oscuro"');
    expect(html).toContain('<title>Investigación · Ana Villa · Cosmetología</title>');
  });

  it('omite precio y pendientes cuando no hay', () => {
    const l = copia();
    l.recomendamos.precio = null;
    l.faltaConfirmar = [];
    const h = renderizarInvestigacion(conLectura(l), meta);
    expect(h).not.toContain('Sobre tu precio');
    expect(h).not.toContain('Lo que falta confirmar');
  });

  it('escapa el texto de la lectura', () => {
    const l = copia();
    l.portada.titular = '<script>alert(1)</script>';
    const h = renderizarInvestigacion(conLectura(l), meta);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;');
  });
});

describe('documento sin lectura (respaldo)', () => {
  it('muestra la síntesis y el detalle abierto', () => {
    const h = renderizarInvestigacion(completa as any, meta);
    expect(h).not.toContain('id="descubrimos"');
    expect(h).toContain((completa as any).sintesis.datos.hallazgos[0].titulo);
    expect(h).toMatch(/<details class="detalle" open>/);
  });

  it('una lectura vacía también usa el respaldo', () => {
    const h = renderizarInvestigacion({ ...(completa as any), lectura: { estado: 'vacio', razon: 'x' } }, meta);
    expect(h).toMatch(/<details class="detalle" open>/);
  });

  it('declara los temas sin datos sin inventar', () => {
    const h = renderizarInvestigacion(parcial as any, meta);
    expect(h).toContain('No se obtuvo información sobre este tema');
    expect(h).toContain('Instituto Bellezza GDL');
  });

  it('escapa también las URL de las fuentes', () => {
    const c = JSON.parse(JSON.stringify(completa));
    c.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    expect(renderizarInvestigacion(c, meta)).not.toContain('<script>alert(1)</script>');
  });
});

describe('interacción', () => {
  it('el script del documento es JavaScript válido', () => {
    expect(() => new Function(SCRIPT_DOCUMENTO)).not.toThrow();
  });
  it('inyecta la barra de operador cuando se pasa', () => {
    expect(renderizarInvestigacion(completa as any, meta, '<div id="barra-op"></div>')).toContain('id="barra-op"');
  });
});
