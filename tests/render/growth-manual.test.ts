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
  // Ocho y no diez: las secciones de creativos y de prompts salieron del
  // manual. Sus copys, ángulos y briefs se leen y se editan en la de anuncios.
  it('produce las ocho secciones: portada, anuncios y las seis del detalle', () => {
    const html = renderizarManual(completo as any, meta);
    expect((html.match(/class="sec"/g) ?? []).length).toBe(8);
  });

  it('trae las ocho anclas del nav, una por sección, y ya no las de creativos ni prompts', () => {
    const html = renderizarManual(completo as any, meta);
    for (const id of ['setup','anuncios','meta','google','rsa','traza','tecnico','seguimiento']) {
      expect(html, `falta el ancla ${id}`).toContain(`id="${id}"`);
      expect(html, `falta el enlace a ${id}`).toContain(`href="#${id}"`);
    }
    for (const id of ['creativos', 'prompts']) {
      expect(html).not.toContain(`id="${id}"`);
      expect(html).not.toContain(`href="#${id}"`);
    }
  });

  it('numera seguido, sin huecos, y el índice dice lo mismo que las placas', () => {
    for (const datos of [completo, { ...clonar(), tecnico: undefined }]) {
      const html = renderizarManual(datos as any, meta);
      const indice = [...html.matchAll(/<li><a href="#[a-z]+"><span>([^<]+)<\/span>/g)].map((m) => m[1]);
      expect(indice).toEqual(['00', 'A', '01', '02', '03', '04', '05', '06']);
      // La placa de cada sección (la portada no lleva): el mismo numeral, en
      // el mismo orden, con o sin arquitectura de medición.
      const placas = [...html.matchAll(/class="shead-n"><span class="grad">([^<]+)</g)].map((m) => m[1]);
      expect(placas).toEqual(indice.slice(1));
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

  it('con todo vacío sigue produciendo ocho secciones y ningún dato inventado', () => {
    const html = renderizarManual({ _huecos: { estructura: 'No se ejecutó.', creativos: 'No se ejecutó.' } }, meta);
    expect((html.match(/class="sec"/g) ?? []).length).toBe(8);
    expect((html.match(/Sin datos/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('marca en rojo un titular que se pasa del límite de Google', () => {
    const g = clonar();
    g.googleAmpliado.campanas[0].titulares[0] = 'x'.repeat(35);
    const html = renderizarManual(g, meta);
    expect(html).toContain('badge b-pink">35/30');
  });

  it('los títulos y descripciones van por campaña, no en una bolsa común', () => {
    const html = renderizarManual(completo as any, meta);
    for (const g of ['G1 · Marca', 'G3 · Precio', 'G5 · Contenido']) {
      expect(html, `falta ${g}`).toContain(g);
    }
  });

  it('rinde extensiones y estacionalidad, no solo anuncios adaptables', () => {
    const html = renderizarManual(completo as any, meta);
    expect(html).toContain('Extensiones y estacionalidad');
    expect(html).toContain('Estacionalidad');
    expect(html).toContain('Diciembre');
  });

  it('rinde la matriz de medición con sus identificadores', () => {
    const html = renderizarManual(completo as any, meta);
    expect(html).toContain('Arquitectura de medición');
    expect(html).toContain('GTM-XXXXXXX');
    expect(html).toContain('Etiquetas a crear en GTM');
    expect(html).toContain('generate_lead');
  });

  it('rinde la hoja de captura de Meta completa', () => {
    const html = renderizarManual(completo as any, meta);
    for (const b of ['Perfil del target', 'Configuración por campaña', 'Segmentación detallada',
                     'Lo que NO hay que segmentar', 'Audiencias personalizadas', 'Geografía']) {
      expect(html, `falta el bloque ${b}`).toContain(b);
    }
  });

  it('el manual y el deck son documentos distintos: aquí no hay deck ni paneles', () => {
    const html = renderizarManual(completo as any, meta);
    expect(html).not.toContain('class="panel"');
    expect(html).not.toContain('id="deck"');
  });
});

describe('URL etiquetada de cada pieza', () => {
  // Antes esto se comprobaba en la sección de creativos, que rendía la URL
  // junto a cada pieza. Esa sección salió del manual; las nueve URLs de Meta
  // siguen en la tabla de trazabilidad, que es donde viven todas.
  it('cada creativo de Meta tiene su URL de grupo y formato en trazabilidad', () => {
    const html = renderizarManual(completo as any, meta);
    const seccion = html.slice(html.indexOf('id="traza"'), html.indexOf('id="tecnico"'));
    for (const c of ['ga_imagen', 'gb_video', 'gc_carrusel']) {
      expect(seccion, `falta la URL de ${c} en trazabilidad`).toContain(`utm_content=${c}`);
    }
    // Nueve piezas, nueve URLs, sin repetir ninguna.
    const encontradas = [...seccion.matchAll(/utm_content=(g[abc]_[a-z]+)/g)].map((m) => m[1]);
    expect(new Set(encontradas).size).toBe(9);
  });

  it('cada campaña de Google lleva su URL final', () => {
    const html = renderizarManual(completo as any, meta);
    const seccion = html.slice(html.indexOf('id="google"'), html.indexOf('id="rsa"'));
    for (const c of ['g1_marca', 'g3_precio', 'g5_contenido']) {
      expect(seccion, `falta la URL de ${c}`).toContain(`utm_content=${c}`);
    }
  });

  it('sin destino no inventa URLs junto a las piezas', () => {
    const html = renderizarManual(completo as any, { ...meta, destino: undefined });
    expect(html).not.toContain('utm_content=');
  });
});

describe('anuncios por campaña (sección A)', () => {
  const seccionA = (html: string) => {
    const ini = html.indexOf('id="anuncios"');
    return html.slice(ini, html.indexOf('id="meta"', ini));
  };

  it('va primera después de la portada', () => {
    const html = renderizarManual(completo as any, meta);
    const orden = ['setup', 'anuncios', 'meta'].map((id) => html.indexOf(`<section class="sec" id="${id}"`));
    expect(orden[0]).toBeGreaterThan(-1);
    expect(orden[0]).toBeLessThan(orden[1]);
    expect(orden[1]).toBeLessThan(orden[2]);
  });

  it('agrupa los nueve anuncios en sus tres campañas, con objetivo y audiencia', () => {
    const a = seccionA(renderizarManual(completo as any, meta));
    expect((a.match(/<article class="anuncio"/g) ?? []).length).toBe(9);
    for (const c of completo.campanasMeta) {
      expect(a).toContain(`campana-${c.grupo}"`);
      expect(a).toContain(c.nombre);
      expect(a).toContain(`Objetivo: ${c.objetivo}`);
    }
    // Los anuncios de la campaña B van dentro del bloque de la campaña B.
    const b = a.slice(a.indexOf('campana-b"'), a.indexOf('campana-c"'));
    expect((b.match(/<article class="anuncio"/g) ?? []).length).toBe(3);
    expect(b).not.toContain('id="anuncio-a-');
  });

  it('cada anuncio trae su copy A y su copy B en pestañas enlazadas a su panel', () => {
    const a = seccionA(renderizarManual(completo as any, meta));
    for (const c of completo.creativos) {
      expect(a).toContain(c.copyA);
      expect(a).toContain(c.copyB);
    }
    expect((a.match(/role="tablist"/g) ?? []).length).toBe(9);
    expect(a).toContain('id="anuncio-a-1-tab-B" aria-controls="anuncio-a-1-copy-B"');
    expect(a).toContain('id="anuncio-a-1-copy-B" aria-labelledby="anuncio-a-1-tab-B"');
    // Cada botón Copiar apunta a un texto que existe.
    for (const [, destino] of a.matchAll(/data-copiar="([^"]+)"/g)) {
      expect(a, `el botón apunta a #${destino}, que no existe`).toContain(`id="${destino}"`);
    }
  });

  it('el hueco del arte trae medidas y el brief visual del mismo creativo', () => {
    const a = seccionA(renderizarManual(completo as any, meta));
    const video = a.slice(a.indexOf('id="anuncio-b-2"'), a.indexOf('id="anuncio-b-3"'));
    expect(video).toContain('ar-9x16');
    expect(video).toContain('1080 × 1920 px');
    expect(video).toContain(completo.promptsImagen.porCreativo[4]);
  });

  it('no inventa un CTA que el sistema no genera', () => {
    const a = seccionA(renderizarManual(completo as any, meta));
    expect(a).not.toMatch(/\bCTA\b|Llamado a la acción/);
  });

  it('sin prompts ni campañas, declara el hueco en su sitio y rinde los anuncios igual', () => {
    const g = clonar();
    delete g.promptsImagen;
    delete g.campanasMeta;
    g._huecos = { prompts: 'El agente de prompts falló.', estructura: 'La estructura no llegó.' };
    const a = seccionA(renderizarManual(g, meta));
    expect((a.match(/<article class="anuncio"/g) ?? []).length).toBe(9);
    expect(a).toContain('Sin brief visual: El agente de prompts falló.');
    expect(a).toContain('La estructura no llegó.');
  });

  it('sin creativos, declara el hueco en vez de tarjetas vacías', () => {
    const g = clonar();
    delete g.creativos;
    g._huecos = { creativos: 'El agente no devolvió datos válidos.' };
    const a = seccionA(renderizarManual(g, meta));
    expect(a).not.toContain('<article class="anuncio"');
    expect(a).toContain('Sin datos.');
  });

  it('escapa el copy y el brief', () => {
    const g = clonar();
    g.creativos[0].copyB = '<img src=x onerror=alert(1)>';
    g.promptsImagen.porCreativo[0] = '<script>alert(2)</script>';
    const a = seccionA(renderizarManual(g, meta));
    expect(a).not.toContain('<img src=x');
    expect(a).not.toContain('<script>alert(2)');
    expect(a).toContain('&lt;img src=x');
  });

  // Con la sección de creativos fuera, la edición de los copys vive aquí, con
  // las rutas de siempre para que la API los guarde igual.
  it('en modo edición, cada anuncio edita ángulo, copy A, copy B y brief con las rutas de siempre', () => {
    const a = seccionA(renderizarManual(completo as any, meta, undefined, true));
    completo.creativos.forEach((_: unknown, i: number) => {
      for (const campo of ['angulo', 'copyA', 'copyB']) {
        expect(a, `falta creativos.${i}.${campo}`).toContain(`data-editable="creativos.${i}.${campo}"`);
      }
      expect(a).toContain(`data-editable="promptsImagen.porCreativo.${i}"`);
    });
    expect(a).toContain('data-editable="promptsImagen.base"');
  });

  it('el copy B, en el panel que arranca oculto, también es editable', () => {
    const a = seccionA(renderizarManual(completo as any, meta, undefined, true));
    const panelB = a.slice(a.indexOf('id="anuncio-a-1-copy-B"'), a.indexOf('</div>', a.indexOf('id="anuncio-a-1-texto-B"')));
    expect(panelB).toContain('data-editable="creativos.0.copyB"');
  });

  it('cada ruta editable sale una sola vez en todo el manual', () => {
    const html = renderizarManual(completo as any, meta, undefined, true);
    const rutas = [...html.matchAll(/data-editable="([^"]+)"/g)].map((m) => m[1]);
    expect(rutas.length).toBeGreaterThan(0);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('sin modo edición (link público, portal) no marca nada editable', () => {
    expect(renderizarManual(completo as any, meta)).not.toContain('data-editable="');
  });

  it('conserva el prompt base y la regla de la cara, que venían de la sección de prompts', () => {
    const a = seccionA(renderizarManual(completo as any, meta));
    expect(a).toContain(completo.promptsImagen.base);
    expect(a).toContain('la cara del cliente no se genera con IA');
  });

  it('con flujo, cada anuncio lleva el ancla creativos.N de siempre', () => {
    const flujo = { tipo: 'growth', id: 'r1', etapaId: 'e1', puedeEditar: true, puedeComentar: true, rol: 'admin', esOperadorAsignado: false };
    const a = seccionA(renderizarManual(completo as any, meta, undefined, true, flujo as any));
    expect(a).toContain('id="anuncio-a-1" data-ancla="creativos.0"');
  });
});
