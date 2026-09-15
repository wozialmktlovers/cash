import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion, SCRIPT_DOCUMENTO } from '@/render/investigacion/documento';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';
import lectura from '../fixtures/lectura-ejemplo.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };
const conLectura = () => ({ ...(completa as any), lectura: { estado: 'ok', datos: lectura } });

describe('documento con lectura', () => {
  const html = renderizarInvestigacion(conLectura() as any, meta);

  it('arma el marco editorial con índice lateral y las cuatro secciones numeradas', () => {
    expect(html).toContain('class="pagina"');
    expect(html).toContain('class="indice-lateral"');
    for (const [num, id] of [['01', 'descubrimos'], ['02', 'cliente-ideal'], ['03', 'recomendamos'], ['04', 'detalle']]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`class="seccion-num">${num}<`);
    }
  });

  it('pone las cifras en la portada', () => {
    expect((html.match(/class="cifra-tarjeta/g) ?? []).length).toBe(3);
  });

  it('el detalle tiene cuatro pestañas accesibles, todas visibles sin JS', () => {
    expect(html).toContain('role="tablist"');
    // El HTML del brief coincide con `[role="tab"]` como selector en el <style> y en el
    // <script> (para las pestañas), así que contar la subcadena literal 'role="tab"' da 7,
    // no 4: exigimos que la comilla vaya seguida de espacio o '>' para contar solo atributos
    // reales de elemento, no selectores CSS/JS entre corchetes.
    expect((html.match(/role="tab"(?=[\s>])/g) ?? []).length).toBe(4);
    expect((html.match(/role="tabpanel"/g) ?? []).length).toBe(4);
    expect(html).not.toMatch(/role="tabpanel"[^>]*hidden/);
  });

  it('sin restos del deck ni del detalle plegado', () => {
    // El detalle editorial usa a propósito las clases "panel-tema" y "panel-titulo",
    // que la subcadena literal 'class="panel' también detecta como falso positivo:
    // se exige un límite de palabra (comilla o espacio) para que solo dispare con el
    // resto exacto del viejo deck (`class="panel"`).
    expect(html).not.toMatch(/class="panel["\s]/);
    for (const r of ['id="deck"', '<details class="detalle"']) expect(html).not.toContain(r);
  });

  it('trae el tema, el título y marca js antes de pintar', () => {
    expect(html).toContain('wozial-tema');
    expect(html).toContain("classList.add('js')");
    expect(html).toContain('<title>Investigación · Ana Villa · Cosmetología</title>');
  });
});

describe('detalle', () => {
  it('declara los temas sin datos y conserva los que sí tienen', () => {
    const h = renderizarInvestigacion(parcial as any, meta);
    expect((h.match(/No se obtuvo información sobre este tema/g) ?? []).length).toBe(3);
    expect(h).toContain('Instituto Bellezza GDL');
    expect(h).toContain('6 meses');
  });

  it('dibuja la gráfica de precios cuando hay al menos dos montos legibles', () => {
    const c = JSON.parse(JSON.stringify(completa));
    const d = c.competencia.datos.directos;
    const legibles = [...d, ...c.competencia.datos.indirectos].filter((x: any) => /\d/.test(x.precio)).length;
    const h = renderizarInvestigacion(c, meta);
    if (legibles >= 2) expect(h).toContain('class="grafica"');
    else expect(h).not.toContain('Precio de cada opción');
  });

  it('escapa las URL de las fuentes', () => {
    const c = JSON.parse(JSON.stringify(completa));
    c.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    expect(renderizarInvestigacion(c, meta)).not.toContain('<script>alert(1)</script>');
  });
});

describe('respaldo sin lectura', () => {
  it('muestra la síntesis con el mismo diseño y el detalle en pestañas, sin cifras de portada', () => {
    const h = renderizarInvestigacion(completa as any, meta);
    expect(h).not.toContain('id="descubrimos"');
    expect(h).not.toContain('class="cifra-tarjeta');
    expect(h).toContain((completa as any).sintesis.datos.hallazgos[0].titulo);
    expect(h).toContain('role="tablist"');
  });
  it('una lectura vacía también usa el respaldo', () => {
    const h = renderizarInvestigacion({ ...(completa as any), lectura: { estado: 'vacio', razon: 'x' } }, meta);
    expect(h).not.toContain('id="descubrimos"');
  });
});

describe('interacción', () => {
  it('el script del documento es JavaScript válido', () => {
    expect(() => new Function(SCRIPT_DOCUMENTO)).not.toThrow();
  });
  it('maneja pestañas con flechas, índice activo, apariciones e impresión', () => {
    for (const s of ['ArrowRight', 'IntersectionObserver', 'beforeprint', 'afterprint']) expect(SCRIPT_DOCUMENTO).toContain(s);
  });
  it('con opciones de operador, la cabecera trae el botón Compartir; sin ellas, no', () => {
    const operador = {
      clienteId: 'c1', clienteNombre: 'Ana Villa', clienteSlug: 'ana-villa', documentoId: 'd1',
      version: 1, tipo: 'research' as const, tokenActivo: null, base: 'https://x.test',
    };
    expect(renderizarInvestigacion(completa as any, meta, operador)).toContain('Compartir');
    expect(renderizarInvestigacion(completa as any, meta)).not.toContain('Compartir');
  });
  it('no quedan restos de las barras viejas', () => {
    const h = renderizarInvestigacion(completa as any, meta);
    expect(h).not.toContain('id="barra-op"');
    expect(h).not.toContain('class="doc-barra"');
  });
});
