import { describe, it, expect } from 'vitest';
import { renderizarPilares, SCRIPT_PILARES } from '@/render/pilares/documento';
import { mapaFalso } from '../fixtures/pilares';

const meta = { cliente: 'Ana Villa', fecha: '2026-09-15' };
// Las comprobaciones negativas miran solo el marcado: los estilos y scripts en
// línea mencionan clases y rutas aunque la vista no las use.
const marcado = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
const operador = { clienteId: 'c1', clienteNombre: 'Ana Villa', clienteSlug: 'ana-villa', documentoId: 'r1', version: 1, tipo: 'pilares' as const, tokenActivo: 'tok', base: 'https://x' };

describe('mapa de pilares · vista interna', () => {
  const avance = { 'P1-S1-01': { estado: 'publicado' as const, nota: 'Listo', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' } };
  const html = renderizarPilares(mapaFalso(), meta, { operador, avance, resultId: 'r1' });

  it('trae las seis secciones numeradas con índice', () => {
    for (const [num, id] of [['01', 'partida'], ['02', 'principios'], ['03', 'pilares'], ['04', 'mix'], ['05', 'conversion'], ['06', 'banco']]) {
      expect(html).toContain(`id="${id}"`);
      expect(html).toContain(`href="#${id}"`);
      expect(html).toContain(`class="seccion-num">${num}<`);
    }
  });

  it('rinde los 300 temas con id, función y formato', () => {
    expect((html.match(/class="tema-tarjeta/g) ?? []).length).toBe(300);
    expect(html).toContain('data-tema="P5-S3-20"');
    expect(html).toContain('data-funcion="autoridad"');
    expect(html).toContain('data-formato="reel"');
  });

  it('muestra controles, avance, mix real y el estado guardado', () => {
    expect(html).toContain('Compartir');
    expect(html).toContain('Exportar CSV');
    expect(html).toContain('Mix real del banco');
    expect(html).toContain('data-estado="publicado"');
    expect(html).toContain('eq@wozial.mx');
    expect((html.match(/class="boton-estado/g) ?? []).length).toBe(300);
  });

  it('pestañas ARIA por subcategoría dentro de cada pilar', () => {
    expect((html.match(/role="tab"(?=[\s>])/g) ?? []).length).toBe(15);
  });
});

describe('mapa de pilares · vista pública', () => {
  const html = renderizarPilares(mapaFalso(), meta);
  it('sin controles, estados, notas ni supuestos', () => {
    for (const s of ['Compartir', 'Exportar CSV', 'boton-estado', 'data-estado', 'Mix real del banco', '/api/pilares']) expect(marcado(html)).not.toContain(s);
    expect((html.match(/class="tema-tarjeta/g) ?? []).length).toBe(300);
  });
});

describe('bordes', () => {
  it('pilar vacío declara su razón y ofrece regenerar solo en la interna', () => {
    const m = mapaFalso();
    m.pilares[1] = { numero: 2, estado: 'vacio', razon: 'Se alcanzó el tope de costo antes de ejecutar este pilar.' };
    expect(renderizarPilares(m, meta, { operador, resultId: 'r1' })).toContain('Regenerar el mapa');
    const pub = renderizarPilares(m, meta);
    expect(pub).toContain('Este pilar no se generó');
    expect(marcado(pub)).not.toContain('Regenerar el mapa');
  });
  it('aviso de revisión solo en la interna', () => {
    const m = mapaFalso();
    m.revision.fueraDeMargen = ['venta'];
    expect(renderizarPilares(m, meta, { operador, resultId: 'r1' })).toContain('aviso-revision');
    expect(marcado(renderizarPilares(m, meta))).not.toContain('aviso-revision');
  });
  it('escapa el texto del modelo', () => {
    const m = mapaFalso();
    (m.pilares[0] as any).subcategorias[0].temas[0].texto = '<script>alert(1)</script>';
    m.estrategia.ideas[0].titulo = '<img onerror=x>';
    const h = renderizarPilares(m, meta);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).not.toContain('<img onerror=x>');
  });
  it('el script del mapa es JavaScript válido y guarda por PATCH', () => {
    expect(() => new Function(SCRIPT_PILARES)).not.toThrow();
    for (const s of ['PATCH', '/api/pilares/', 'text/csv', 'Escape']) expect(SCRIPT_PILARES).toContain(s);
  });
});
