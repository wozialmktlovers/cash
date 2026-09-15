import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import { seccionPortada as seccionPortadaLectura } from '@/render/investigacion/lectura';
import { SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import { FakeDocument, FakeWindow, ejecutarScript } from '../helpers/fake-dom';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import lecturaEjemplo from '../fixtures/lectura-ejemplo.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

const operador = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1',
  version: 2, tipo: 'research' as const, tokenActivo: null, base: 'https://x',
};

const flujo: FlujoDatos = { tipo: 'research', id: 'd1', etapaId: 'e1', puedeEditar: true, puedeComentar: true };

describe('data-editable en los renders', () => {
  it('seccionPortada de la lectura marca titular y resumen cuando editable', () => {
    const h = seccionPortadaLectura({ eyebrow: 'e', titular: 'Mi titular', resumen: 'Mi resumen', cifras: [], conIndice: false, editable: true });
    expect(h).toContain('data-editable="lectura.datos.portada.titular"');
    expect(h).toContain('data-editable="lectura.datos.portada.resumen"');
  });

  it('sin editable, la portada de la lectura no lleva data-editable', () => {
    const h = seccionPortadaLectura({ eyebrow: 'e', titular: 'Mi titular', resumen: 'Mi resumen', cifras: [], conIndice: false });
    expect(h).not.toContain('data-editable');
  });

  it('la vista interna de investigación trae data-editable, data-flujo y SCRIPT_FLUJO', () => {
    const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
    const html = renderizarInvestigacion(inv, { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' }, operador, true, flujo);
    expect(html).toContain('data-editable="lectura.datos.portada.titular"');
    expect(html).toMatch(/<body[^>]*data-flujo=/);
    expect(html).toContain('id="btn-flujo-editar"');
    expect(html).toContain('id="btn-flujo-versiones"');
    expect(html).toContain('id="barra-edicion"');
    expect(html).toContain('id="dialog-versiones"');
  });

  it('la vista pública de investigación no trae data-editable ni data-flujo', () => {
    const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
    const html = renderizarInvestigacion(inv, { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' });
    expect(html).not.toContain('data-editable="');
    expect(html).not.toMatch(/<body[^>]*data-flujo=/);
    expect(html).not.toContain('id="btn-flujo-editar"');
  });

  it('el mapa de pilares marca un tema del banco y un texto de la estrategia', () => {
    const mapa = mapaFalso();
    const html = renderizarPilares(
      mapa,
      { cliente: 'Ana', fecha: '2026-09-15' },
      { operador: { ...operador, tipo: 'pilares' }, editable: true, flujo: { ...flujo, tipo: 'pilares' } },
    );
    expect(html).toContain('data-editable="estrategia.ideas.0.titulo"');
    expect(html).toContain('data-editable="pilares.0.subcategorias.0.temas.0.texto"');
  });

  it('el mapa de pilares sin operador (vista pública) no marca nada', () => {
    const mapa = mapaFalso();
    const html = renderizarPilares(mapa, { cliente: 'Ana', fecha: '2026-09-15' });
    expect(html).not.toContain('data-editable="');
    expect(html).not.toContain('data-flujo');
  });

  it('el manual de Growth marca un título/copy principal cuando editable', () => {
    const html = renderizarManual(
      growthCompleto as any,
      { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' },
      '',
      true,
      { ...flujo, tipo: 'growth' },
    );
    expect(html).toContain(`data-editable="bloqueantes.0"`);
    expect(html).toContain(`data-editable="campanasMeta.0.nombre"`);
    expect(html).toMatch(/<body[^>]*data-flujo=/);
  });

  it('el manual de Growth sin flujo (vista pública) no marca nada', () => {
    const html = renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' });
    expect(html).not.toContain('data-editable="');
    expect(html).not.toContain('data-flujo');
  });
});

describe('SCRIPT_FLUJO · válido', () => {
  it('es un script ES5 sintácticamente válido', () => {
    expect(() => new Function(SCRIPT_FLUJO)).not.toThrow();
  });
});

/**
 * Ejecuta SCRIPT_FLUJO de verdad (sin jsdom, ver fake-dom.ts) contra una
 * micro-página con un `[data-editable]`, los botones Editar/Guardar/
 * Descartar y la barra de cambios. Cubre entrar/salir de modo edición y
 * armar el payload de cambios a partir del texto editado.
 */
function armarPagina(puedeEditarDoc = true) {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  (win as any).confirm = vi.fn(() => true);
  (win as any).location = { reload: vi.fn() };

  doc.body.setAttribute('data-flujo', JSON.stringify({
    tipo: 'research', id: 'doc1', etapaId: 'etapa1', puedeEditar: puedeEditarDoc, puedeComentar: true,
  }));

  const titular = doc.createElement('h1');
  titular.setAttribute('data-editable', 'lectura.datos.portada.titular');
  titular.textContent = 'Titular original';
  doc.body.appendChild(titular);

  const btnEditar = doc.createElement('button');
  btnEditar.id = 'btn-flujo-editar';
  doc.body.appendChild(btnEditar);

  const barra = doc.createElement('div');
  barra.id = 'barra-edicion';
  barra.hidden = true;
  doc.body.appendChild(barra);

  const contador = doc.createElement('span');
  contador.id = 'barra-edicion-contador';
  doc.body.appendChild(contador);

  const estadoBarra = doc.createElement('span');
  estadoBarra.id = 'barra-edicion-estado';
  doc.body.appendChild(estadoBarra);

  const btnGuardar = doc.createElement('button');
  btnGuardar.id = 'btn-guardar-cambios';
  doc.body.appendChild(btnGuardar);

  const btnDescartar = doc.createElement('button');
  btnDescartar.id = 'btn-descartar-cambios';
  doc.body.appendChild(btnDescartar);

  ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window);
  return { doc, win, titular, btnEditar, barra, contador, estadoBarra, btnGuardar, btnDescartar };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SCRIPT_FLUJO · modo edición (fake-dom)', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('Editar activa contenteditable en los [data-editable] y muestra la barra', () => {
    const { titular, btnEditar, barra, contador } = armarPagina();
    expect(barra.hidden).toBe(true);

    btnEditar.dispatch('click');

    expect(titular.getAttribute('contenteditable')).toBeTruthy();
    expect(barra.hidden).toBe(false);
    expect(contador.textContent).toBe('0 cambios');
  });

  it('editar el texto actualiza el contador de cambios pendientes', () => {
    const { titular, btnEditar, contador } = armarPagina();
    btnEditar.dispatch('click');

    titular.textContent = 'Titular editado';
    titular.dispatch('input');

    expect(contador.textContent).toBe('1 cambio');
  });

  it('volver el texto a su valor original deja el contador en cero', () => {
    const { titular, btnEditar, contador } = armarPagina();
    btnEditar.dispatch('click');

    titular.textContent = 'Cambiado';
    titular.dispatch('input');
    expect(contador.textContent).toBe('1 cambio');

    titular.textContent = 'Titular original';
    titular.dispatch('input');
    expect(contador.textContent).toBe('0 cambios');
  });

  it('Guardar manda el PATCH con la ruta y el texto exacto (sin recortar), y recarga si sale bien', async () => {
    const { titular, btnEditar, btnGuardar, win } = armarPagina();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, version: 3 }) }) as unknown as typeof fetch;

    btnEditar.dispatch('click');
    titular.textContent = '  Titular con espacios  ';
    titular.dispatch('input');
    btnGuardar.dispatch('click');
    await flush();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/documentos/research/doc1', expect.objectContaining({ method: 'PATCH' }));
    const cuerpo = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(cuerpo.cambios).toEqual([{ ruta: 'lectura.datos.portada.titular', valor: '  Titular con espacios  ' }]);
    expect((win as any).location.reload).toHaveBeenCalled();
  });

  it('si el PATCH falla, avisa en la barra y no sale del modo edición', async () => {
    const { titular, btnEditar, btnGuardar, estadoBarra, barra } = armarPagina();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: false, errores: ['Ruta inválida'] }) }) as unknown as typeof fetch;

    btnEditar.dispatch('click');
    titular.textContent = 'Cambiado';
    titular.dispatch('input');
    btnGuardar.dispatch('click');
    await flush();

    expect(estadoBarra.textContent).toBe('Ruta inválida');
    expect(barra.hidden).toBe(false);
  });

  it('Descartar restaura el texto original y sale del modo edición', () => {
    const { titular, btnEditar, btnDescartar, barra } = armarPagina();
    btnEditar.dispatch('click');
    titular.textContent = 'Cambiado';
    titular.dispatch('input');

    btnDescartar.dispatch('click');

    expect(titular.textContent).toBe('Titular original');
    expect(barra.hidden).toBe(true);
    expect(titular.getAttribute('contenteditable')).toBeNull();
  });

  it('Escape con cambios pendientes pregunta antes de salir; si se confirma, sale', () => {
    const { titular, btnEditar, barra, win } = armarPagina();
    btnEditar.dispatch('click');
    titular.textContent = 'Cambiado';
    titular.dispatch('input');

    // El listener de Escape se registra en `document`; cualquier elemento lo
    // burbujea hasta ahí (ver fake-dom.ts: FakeElement.dispatch).
    titular.dispatch('keydown', { key: 'Escape' });

    expect((win as any).confirm).toHaveBeenCalled();
    expect(barra.hidden).toBe(true);
  });

  it('Escape sin cambios sale directo, sin preguntar', () => {
    const { titular, btnEditar, barra, win } = armarPagina();
    btnEditar.dispatch('click');

    titular.dispatch('keydown', { key: 'Escape' });

    expect((win as any).confirm).not.toHaveBeenCalled();
    expect(barra.hidden).toBe(true);
  });

  it('sin puedeEditar en data-flujo, Editar no entra en modo edición', () => {
    const { titular, btnEditar, barra } = armarPagina(false);
    btnEditar.dispatch('click');
    expect(titular.getAttribute('contenteditable')).toBeNull();
    expect(barra.hidden).toBe(true);
  });
});
