import { describe, it, expect } from 'vitest';
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';
import { cabeceraDocumento, SCRIPT_CABECERA } from '@/render/editorial/cabecera';
import { SCRIPT_EDITORIAL } from '@/render/editorial/interaccion';
import { envolverDocumento } from '@/render/editorial/comunes';

const operador = { clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1', version: 2, tipo: 'pilares' as const, tokenActivo: null, base: 'https://x' };

describe('base editorial', () => {
  it('estilos con tokens, ancho 85%, pestañas que respetan hidden y sin márgenes entre hermanos', () => {
    expect(ESTILOS_EDITORIAL).toContain(':root[data-tema="oscuro"]');
    expect(ESTILOS_EDITORIAL).toContain('min(85%,1600px)');
    expect(ESTILOS_EDITORIAL).not.toMatch(/\.panel-tema\s*\{[^}]*display:grid/);
    expect(ESTILOS_EDITORIAL).not.toMatch(/\.[\w-]+\s*\+\s*\.[\w-]+\s*\{/);
  });
  it('cabecera con etiqueta, sin Compartir en pública y con Compartir en interna', () => {
    const pub = cabeceraDocumento({ etiqueta: 'Mapa de pilares', cliente: '<Ana>' });
    expect(pub).toContain('Mapa de pilares');
    expect(pub).toContain('&lt;Ana&gt;');
    expect(pub).not.toContain('Compartir');
    const int = cabeceraDocumento({ etiqueta: 'Mapa de pilares', cliente: 'Ana', operador });
    expect(int).toContain('Compartir');
    expect(int).toContain('Vista interna · v2');
  });
  it('scripts válidos', () => {
    expect(() => new Function(SCRIPT_CABECERA)).not.toThrow();
    expect(() => new Function(SCRIPT_EDITORIAL)).not.toThrow();
  });
  it('envolverDocumento arma el marco con índice, cuerpo y pie', () => {
    const h = envolverDocumento({ titulo: 'T', etiqueta: 'Mapa de pilares', cliente: 'Ana', fecha: '2026-09-15', estilos: 'x{}', indice: [['01', 'uno', 'Uno']], cuerpo: '<section id="uno"></section>' });
    expect(h).toContain('<title>T</title>');
    expect(h).toContain('class="indice-lateral"');
    expect(h).toContain('href="#uno"');
    expect(h).toContain('Preparado por Wozial');
    expect(h).toContain("classList.add('js')");
  });
});
