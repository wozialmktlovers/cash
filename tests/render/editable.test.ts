import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import { seccionPortada as seccionPortadaLectura } from '@/render/investigacion/lectura';
import { SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import { NAVEGACION_GROWTH } from '@/render/growth/navegacion';
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

  const btnVersiones = doc.createElement('button');
  btnVersiones.id = 'btn-flujo-versiones';
  doc.body.appendChild(btnVersiones);

  const dialogoVersiones = doc.createElement('dialog');
  dialogoVersiones.id = 'dialog-versiones';
  doc.body.appendChild(dialogoVersiones);

  const listaVersiones = doc.createElement('div');
  listaVersiones.id = 'dialog-versiones-lista';
  dialogoVersiones.appendChild(listaVersiones);

  const estadoVersiones = doc.createElement('p');
  estadoVersiones.id = 'dialog-versiones-estado';
  dialogoVersiones.appendChild(estadoVersiones);

  const cerrarVersionesBtn = doc.createElement('button');
  cerrarVersionesBtn.id = 'dialog-versiones-cerrar';
  dialogoVersiones.appendChild(cerrarVersionesBtn);

  ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window);
  return {
    doc, win, titular, btnEditar, barra, contador, estadoBarra, btnGuardar, btnDescartar,
    btnVersiones, dialogoVersiones, listaVersiones, estadoVersiones, cerrarVersionesBtn,
  };
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

  // B6, ronda de arreglos 1, punto 3: salir sin guardar (por Escape o por
  // volver a pulsar Editar) no debe dejar el texto editado a medias en la
  // página — la salida confirmada pasa por `descartar()`, que restaura cada
  // [data-editable] a su texto original.
  it('confirmar la salida por Escape restaura el texto original (sin fantasmas)', () => {
    const { titular, btnEditar } = armarPagina();
    btnEditar.dispatch('click');
    titular.textContent = 'Texto fantasma';
    titular.dispatch('input');

    titular.dispatch('keydown', { key: 'Escape' });

    expect(titular.textContent).toBe('Titular original');
  });

  it('confirmar la salida al volver a pulsar Editar restaura el texto original', () => {
    const { titular, btnEditar } = armarPagina();
    btnEditar.dispatch('click');
    titular.textContent = 'Texto fantasma';
    titular.dispatch('input');

    btnEditar.dispatch('click'); // "Salir de editar"

    expect(titular.textContent).toBe('Titular original');
  });

  it('si no se confirma la salida, el texto editado se queda tal cual (sigue en modo edición)', () => {
    const { titular, btnEditar, barra, win } = armarPagina();
    (win as any).confirm = vi.fn(() => false);
    btnEditar.dispatch('click');
    titular.textContent = 'Sigo editando';
    titular.dispatch('input');

    titular.dispatch('keydown', { key: 'Escape' });

    expect(titular.textContent).toBe('Sigo editando');
    expect(barra.hidden).toBe(false);
  });

  it('sin puedeEditar en data-flujo, Editar no entra en modo edición', () => {
    const { titular, btnEditar, barra } = armarPagina(false);
    btnEditar.dispatch('click');
    expect(titular.getAttribute('contenteditable')).toBeNull();
    expect(barra.hidden).toBe(true);
  });

  // B6, ronda de arreglos 1, punto 7 (primera mitad): un campo editable es
  // el texto de una tarjeta, no un editor de párrafos.
  it('Enter dentro de un [data-editable] se previene (nunca mete un salto de línea)', () => {
    const { titular, btnEditar } = armarPagina();
    btnEditar.dispatch('click');

    let prevenido = false;
    const evento = { key: 'Enter', preventDefault: () => { prevenido = true; } };
    titular.dispatch('keydown', evento as any);

    expect(prevenido).toBe(true);
  });

  // B6, ronda de arreglos 1, punto 7 (segunda mitad): Escape con el diálogo
  // de versiones abierto le pertenece SOLO al diálogo — antes, también
  // disparaba el aviso de «¿salir sin guardar?» del modo edición.
  it('Escape con el diálogo de versiones abierto lo cierra a él y no toca el modo edición', async () => {
    const { titular, btnEditar, btnVersiones, dialogoVersiones, win } = armarPagina();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, versiones: [] }) }) as unknown as typeof fetch;

    btnEditar.dispatch('click');
    titular.textContent = 'Cambiado, pero no me toques';
    titular.dispatch('input');

    btnVersiones.dispatch('click');
    await flush();
    expect(dialogoVersiones.getAttribute('open')).toBe('open');

    titular.dispatch('keydown', { key: 'Escape' });

    // El diálogo se cerró (su Escape), pero el modo edición sigue con el
    // texto tal cual — nunca se llamó a confirm() para salir de editar.
    expect(dialogoVersiones.getAttribute('open')).toBeNull();
    expect((win as any).confirm).not.toHaveBeenCalled();
    expect(titular.textContent).toBe('Cambiado, pero no me toques');
    expect(titular.getAttribute('contenteditable')).toBeTruthy();
  });
});

/**
 * B6, ronda de arreglos 1, punto 1: los atajos de teclado del manual de
 * Growth (f/0/+/-/=/_) no deben robarle la tecla a un [data-editable] en
 * modo edición. Se prueba con 'f' (pantalla completa) porque no toca
 * `element.style`, que fake-dom no implementa; los atajos de escala
 * (+/-/0) usan la misma condición de guarda, así que quedan cubiertos por
 * el mismo cambio de código aunque no se ejecuten aquí.
 */
describe('NAVEGACION_GROWTH · atajos vs. modo edición (fake-dom)', () => {
  function armarNav() {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const seccion = doc.createElement('div');
    seccion.className = 'sec';
    doc.body.appendChild(seccion);
    (doc as any).fullscreenElement = {};
    (doc as any).exitFullscreen = vi.fn();
    // fake-dom no modela `.style`: el script aplica la escala tipográfica al
    // cargar (independiente del atajo de teclado que prueban estos casos),
    // así que basta un `setProperty` de mentiras para que no truene.
    (doc.documentElement as any).style = { setProperty: () => {} };
    ejecutarScript(NAVEGACION_GROWTH, doc, win as unknown as Window);
    return { doc, win };
  }

  it('con el foco en un campo contenteditable, "f" no dispara pantalla completa', () => {
    const { doc } = armarNav();
    const campo = doc.createElement('div');
    (campo as any).isContentEditable = true;
    doc.body.appendChild(campo);

    campo.dispatch('keydown', { key: 'f' });

    expect((doc as any).exitFullscreen).not.toHaveBeenCalled();
  });

  it('con <html class="modo-edicion">, "f" tampoco dispara pantalla completa', () => {
    const { doc } = armarNav();
    doc.documentElement.classList.add('modo-edicion');
    const cualquiera = doc.createElement('div');
    doc.body.appendChild(cualquiera);

    cualquiera.dispatch('keydown', { key: 'f' });

    expect((doc as any).exitFullscreen).not.toHaveBeenCalled();
  });

  it('fuera de modo edición, "f" sigue disparando pantalla completa (no se rompió el atajo)', () => {
    const { doc } = armarNav();
    const cualquiera = doc.createElement('div');
    doc.body.appendChild(cualquiera);

    cualquiera.dispatch('keydown', { key: 'f' });

    expect((doc as any).exitFullscreen).toHaveBeenCalled();
  });
});
