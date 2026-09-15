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

  // Pedido: la cabecera de cada pilar debe destacar más (banda de color
  // suave) y dejar claro a qué pilar pertenece con un eyebrow «Pilar N».
  it('la cabecera de cada pilar lleva --color-pilar-s y el eyebrow «Pilar N»', () => {
    const iP3 = html.indexOf('data-pilar="3" style="--color-pilar:');
    const bloqueP3 = html.slice(iP3, html.indexOf('</summary>', iP3));
    expect(bloqueP3).toContain('--color-pilar-s:');
    expect(bloqueP3).toContain('class="pilar-eyebrow"');
    expect(bloqueP3).toContain('>Pilar 3<');
  });

  // Pedido: «en el banco de temas, los tópicos se puedan elegir y tachar»
  // (Casilla + tachado, guardado con los estados existentes).
  it('trae una casilla «Elegir tema» por tarjeta, checada solo si el estado no es pendiente', () => {
    expect((html.match(/class="tema-elegir"/g) ?? []).length).toBe(300);
    // P1-S1-01 está "publicado" en `avance`: su casilla llega marcada.
    const iP1S101 = html.indexOf('data-tema="P1-S1-01"');
    const tarjetaP1S101 = html.slice(iP1S101, html.indexOf('</article>', iP1S101));
    expect(tarjetaP1S101).toContain('aria-label="Elegir tema P1-S1-01"');
    expect(tarjetaP1S101).toMatch(/class="tema-elegir"[^>]*\schecked/);
    // Un tema sin fila en `avance` queda "pendiente": su casilla no lleva `checked`.
    const iP5S320 = html.indexOf('data-tema="P5-S3-20"');
    const tarjetaP5S320 = html.slice(iP5S320, html.indexOf('</article>', iP5S320));
    expect(tarjetaP5S320).not.toMatch(/class="tema-elegir"[^>]*\schecked/);
  });

  it('tacha (con `.tema-tachado`) los temas desarrollado/publicado; `.tema-elegido` marca los en_desarrollo', () => {
    const m = mapaFalso();
    const conAvance = {
      'P1-S1-01': { estado: 'publicado' as const, actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' },
      'P1-S1-02': { estado: 'en_desarrollo' as const, actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' },
      'P1-S1-03': { estado: 'desarrollado' as const, actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' },
    };
    const h = renderizarPilares(m, meta, { operador, avance: conAvance, resultId: 'r1' });

    const tarjetaAntes = (id: string) => h.slice(h.lastIndexOf('<article class="tema-tarjeta', h.indexOf(`data-tema="${id}"`)), h.indexOf(`data-tema="${id}"`));

    expect(tarjetaAntes('P1-S1-01')).toContain('tema-tachado');
    expect(tarjetaAntes('P1-S1-03')).toContain('tema-tachado');
    expect(tarjetaAntes('P1-S1-02')).toContain('tema-elegido');
    expect(tarjetaAntes('P1-S1-02')).not.toContain('tema-tachado');
    // Un tema pendiente (sin fila en avance) no lleva ninguna de las dos.
    expect(tarjetaAntes('P5-S3-20')).not.toContain('tema-tachado');
    expect(tarjetaAntes('P5-S3-20')).not.toContain('tema-elegido');
  });
});

describe('mapa de pilares · filtro de subcategoría estable (item 2)', () => {
  // El banco (300 temas) se genera una sola vez; un renombre posterior de la
  // subcategoría en modo edición cambia `mapa.estrategia`, pero no
  // regenera `mapa.pilares[n].subcategorias[i].nombre`. Comparar por nombre
  // dejaba el filtro en «0 de 300» apenas alguien renombraba (banco.ts:39
  // contra :152 antes del arreglo).
  it('data-subcategoria usa el índice estable p{n}-s{i}, no el nombre', () => {
    const html = renderizarPilares(mapaFalso(), meta, { operador, resultId: 'r1' });
    expect(html).toContain('data-subcategoria="p1-s1"');
    expect(html).not.toContain('data-subcategoria="Subcategoría 1.1"');
    // El valor de la opción del filtro debe usar el mismo esquema, para que
    // seleccionar la opción calce con las tarjetas.
    expect(html).toContain('<option value="p1-s1" data-pilar="1">');
  });

  it('un renombre en la estrategia se refleja en la etiqueta visible, sin tocar el índice estable', () => {
    const m = mapaFalso();
    m.estrategia.pilares[0].subcategorias[0].nombre = 'Nombre nuevo';
    const html = renderizarPilares(m, meta, { operador, resultId: 'r1' });

    // El id estable de la tarjeta y de la opción del filtro no cambian.
    expect(html).toContain('data-subcategoria="p1-s1"');
    expect(html).toContain('<option value="p1-s1" data-pilar="1">Nombre nuevo</option>');
    // Pero la etiqueta visible (pestaña, título de panel, CSV) sí sale del
    // nombre vigente de la estrategia.
    expect(html).toContain('>Nombre nuevo<');
    expect(html).not.toContain('Subcategoría 1.1');
    // El CSV usa un atributo aparte con el nombre legible (no el índice).
    const iTarjeta = html.indexOf('data-tema="P1-S1-01"');
    const tarjeta = html.slice(html.lastIndexOf('<article', iTarjeta), html.indexOf('</article>', iTarjeta));
    expect(tarjeta).toContain('data-subcategoria-nombre="Nombre nuevo"');
  });

  it('data-busqueda incluye el nombre vigente de la subcategoría, no el original del banco', () => {
    const m = mapaFalso();
    m.estrategia.pilares[0].subcategorias[0].nombre = 'Nombre nuevo';
    const html = renderizarPilares(m, meta, { operador, resultId: 'r1' });
    const iTarjeta = html.indexOf('data-tema="P1-S1-01"');
    const tarjeta = html.slice(html.lastIndexOf('<article', iTarjeta), html.indexOf('</article>', iTarjeta));
    expect(tarjeta).toContain('nombre nuevo');
  });
});

describe('mapa de pilares · vista pública', () => {
  const html = renderizarPilares(mapaFalso(), meta);
  it('sin controles, estados, notas ni supuestos', () => {
    for (const s of ['Compartir', 'Exportar CSV', 'boton-estado', 'data-estado', 'Mix real del banco', '/api/pilares', 'tema-elegir', 'type="checkbox"']) expect(marcado(html)).not.toContain(s);
    expect((html.match(/class="tema-tarjeta/g) ?? []).length).toBe(300);
  });

  // Spec §5: «Exportar CSV» es interno (columnas con nota, estado, etc.), pero
  // «Imprimir / PDF» no expone nada privado y debe estar también en la vista
  // pública que recibe el cliente.
  it('Imprimir / PDF sí está en la vista pública, aunque Exportar CSV no', () => {
    expect(marcado(html)).toContain('data-accion="imprimir"');
    expect(html).toContain('Imprimir / PDF');
    expect(marcado(html)).not.toContain('data-accion="csv"');
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
