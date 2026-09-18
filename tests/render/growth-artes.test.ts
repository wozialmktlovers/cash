import { describe, it, expect } from 'vitest';
import { renderizarManual } from '@/render/growth/manual';
import { SCRIPT_ARTES } from '@/render/growth/artes-script';
import type { ArteGrowth } from '@/growth/artes-reglas';
import completo from '../fixtures/growth-completo.json';

// En el fixture: 0 imagen, 1 video, 2 carrusel (campaña A), y lo mismo en B y C.
const meta = {
  cliente: 'Negocio de Prueba', producto: 'Producto', fecha: '2026-09-18',
  destino: 'https://ejemplo.mx', creadoEn: new Date('2026-09-18T00:00:00Z'),
};

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const img = (n: number, creativo: number, orden: number): ArteGrowth =>
  ({ id: id(n), creativo, orden, tipo: 'archivo', mime: 'image/png', url: null, nombreOriginal: 'a.png' });

const lista: ArteGrowth[] = [
  img(1, 0, 0),
  img(2, 2, 0), img(3, 2, 1),
  { id: id(4), creativo: 1, orden: 0, tipo: 'enlace', mime: null, url: 'https://video.ejemplo.mx/v', nombreOriginal: null },
  img(5, 1, 1),
  img(6, 42, 0), // huérfano: el manual no tiene anuncio 42
];

const interno = (artes = lista) => renderizarManual(completo as any, {
  ...meta, inicio: '/',
  artes: { lista: artes, src: (a) => `/api/growth/G/artes/${a}`, api: '/api/growth/G/artes' },
});
const portal = () => renderizarManual(completo as any, {
  ...meta, artes: { lista, src: (a) => `/portal/documentos/E/arte/${a}` },
});
const publico = () => renderizarManual(completo as any, {
  ...meta, artes: { lista, src: (a) => `tok/arte/${a}` },
});

const anuncio = (html: string, grupo: string, n: number) => {
  const inicio = html.indexOf(`id="anuncio-${grupo}-${n}"`);
  const fin = html.indexOf('<article', inicio + 10);
  return html.slice(inicio, fin === -1 ? undefined : fin);
};

describe('manual sin arte', () => {
  it('sigue mostrando «Arte por producir» en cada anuncio y sin controles', () => {
    const html = renderizarManual(completo as any, meta);
    expect((html.match(/Arte por producir/g) ?? []).length).toBe(9);
    expect(html).not.toContain('data-arte-subir');
    expect(html).not.toContain('class="arte-gestion"');
  });

  it('en la vista interna sin arte: el recuadro de siempre y los botones para empezar', () => {
    const html = interno([]);
    expect((html.match(/Arte por producir/g) ?? []).length).toBe(9);
    const imagen = anuncio(html, 'a', 1);
    expect(imagen).toContain('>Subir arte<');
    const video = anuncio(html, 'a', 2);
    expect(video).toContain('>Subir video<');
    expect(video).toContain('>Agregar enlace<');
    expect(video).toContain('>Subir portada<');
    const carrusel = anuncio(html, 'a', 3);
    expect(carrusel).toContain('data-multiple="5"');
    expect(html).toContain(SCRIPT_ARTES.slice(0, 60));
  });
});

describe('manual con arte, vista interna', () => {
  const html = interno();

  it('el arte sustituye al recuadro, en su proporción', () => {
    const imagen = anuncio(html, 'a', 1);
    expect(imagen).not.toContain('Arte por producir');
    expect(imagen).toContain(`<div class="arte-marco ar-1x1"><img src="/api/growth/G/artes/${id(1)}"`);
    expect(imagen).toContain('>Reemplazar<');
    expect(imagen).toContain(`data-arte-quitar="${id(1)}"`);
  });

  it('el carrusel pinta sus tarjetas en orden y ofrece agregar mientras falten', () => {
    const carrusel = anuncio(html, 'a', 3);
    expect(carrusel.indexOf(id(2))).toBeLessThan(carrusel.indexOf(id(3)));
    expect(carrusel).toContain('Tarjeta 1 de 5');
    expect(carrusel).toContain('2 de 5 tarjetas');
    expect(carrusel).toContain('>Agregar tarjeta<');
    expect(carrusel).toContain('data-multiple="3"');
    expect(carrusel).toContain('ar-4x5');
  });

  it('el video enlazado lleva su portada y el enlace sale a otra pestaña', () => {
    const video = anuncio(html, 'a', 2);
    expect(video).toContain('href="https://video.ejemplo.mx/v" target="_blank" rel="noopener noreferrer"');
    expect(video).toContain('>Cambiar enlace<');
    expect(video).toContain(`/api/growth/G/artes/${id(5)}`);
  });

  it('los huérfanos no salen y no truena', () => {
    expect(html).not.toContain(id(6));
  });

  it('el contenedor dice a qué API hablar y de qué anuncio', () => {
    expect(anuncio(html, 'a', 3)).toContain('data-arte-api="/api/growth/G/artes" data-creativo="2"');
  });

  it('un enlace guardado con esquema peligroso no llega al href', () => {
    const malo: ArteGrowth = { id: id(9), creativo: 1, orden: 0, tipo: 'enlace', mime: null, url: 'javascript:alert(1)', nombreOriginal: null };
    const h = interno([malo]);
    expect(h).not.toContain('javascript:');
    expect(anuncio(h, 'a', 2)).toContain('Video por producir');
  });
});

describe('manual con arte, portal y enlace público', () => {
  it('portal: el arte por la puerta del portal, sin controles ni script', () => {
    const html = portal();
    expect(html).toContain(`src="/portal/documentos/E/arte/${id(1)}"`);
    expect(html).not.toContain('data-arte-');
    expect(html).not.toContain('class="arte-gestion"');
    expect(html).not.toContain(SCRIPT_ARTES.slice(0, 60));
  });

  it('enlace público: rutas relativas al documento, sin controles', () => {
    const html = publico();
    expect(html).toContain(`src="tok/arte/${id(1)}"`);
    expect(html).not.toContain('data-arte-');
    expect(html).not.toContain('>Quitar<');
    // Un hueco vacío no se anuncia como hueco para el cliente si otro ya tiene arte:
    // aquí el video tiene enlace y portada, así que no hay «por producir» en ese anuncio.
    expect(anuncio(html, 'a', 2)).not.toContain('Video por producir');
    expect(anuncio(html, 'a', 2)).not.toContain('Arte por producir');
  });
});
