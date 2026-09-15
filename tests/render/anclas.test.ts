import { describe, it, expect } from 'vitest';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import type { FlujoDatos } from '@/render/editorial/flujo-cliente';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import lecturaEjemplo from '../fixtures/lectura-ejemplo.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

const operador = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1',
  version: 2, tipo: 'research' as const, tokenActivo: null, base: 'https://x',
};

const flujo: FlujoDatos = {
  tipo: 'research', id: 'd1', etapaId: 'e1', puedeEditar: true, puedeComentar: true, rol: 'admin', esOperadorAsignado: false,
};

// B7, spec §3 «Anclas»: data-ancla en secciones (`seccion:<id>`), tarjetas
// (la ruta del objeto) y temas (`tema:<id>`), SOLO en la vista interna
// (cuando se pide `anclas: true`). La vista pública (/p/...) y cualquier
// render sin ese flag no debe llevar ni una — el ruling del controlador B7
// lo trata como una opción aparte de `editable`.
describe('data-ancla en los renders (B7)', () => {
  it('investigación: con anclas trae seccion:, la tarjeta de un descubrimiento y ningún data-ancla si no se pide', () => {
    const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
    const conAnclas = renderizarInvestigacion(inv, { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' }, operador, true, flujo, true);
    expect(conAnclas).toContain('data-ancla="seccion:descubrimos"');
    expect(conAnclas).toContain('data-ancla="lectura.datos.descubrimos.0"');
    expect(conAnclas).toContain('data-ancla="seccion:recomendamos"');

    const sinAnclas = renderizarInvestigacion(inv, { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' }, operador, true, flujo, false);
    expect(sinAnclas).not.toContain('data-ancla="');
  });

  it('investigación: la vista pública (sin flujo ni anclas, como /p/...) no lleva ningún data-ancla', () => {
    const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
    const publico = renderizarInvestigacion(inv, { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' });
    expect(publico).not.toContain('data-ancla="');
  });

  it('mapa de pilares: con anclas trae seccion:, una tarjeta de estrategia y el tema con su código (tema:P#-S#-##)', () => {
    const mapa = mapaFalso();
    const conAnclas = renderizarPilares(
      mapa,
      { cliente: 'Ana', fecha: '2026-09-15' },
      { operador: { ...operador, tipo: 'pilares' }, editable: true, anclas: true, flujo: { ...flujo, tipo: 'pilares' } },
    );
    expect(conAnclas).toContain('data-ancla="seccion:partida"');
    expect(conAnclas).toContain('data-ancla="estrategia.ideas.0"');
    expect(conAnclas).toMatch(/data-ancla="tema:P\d-S\d-\d{2}"/);
  });

  it('mapa de pilares: sin operador (vista pública) no lleva ningún data-ancla', () => {
    const mapa = mapaFalso();
    const publico = renderizarPilares(mapa, { cliente: 'Ana', fecha: '2026-09-15' });
    expect(publico).not.toContain('data-ancla="');
  });

  it('manual de Growth: con flujo, cada sección trae seccion:<id>', () => {
    const html = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' },
      '',
      true,
      { ...flujo, tipo: 'growth' },
    );
    expect(html).toContain('data-ancla="seccion:meta"');
    expect(html).toContain('data-ancla="seccion:creativos"');
  });

  it('manual de Growth: sin flujo (vista pública) no lleva ningún data-ancla', () => {
    const html = renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' });
    expect(html).not.toContain('data-ancla="');
  });
});
