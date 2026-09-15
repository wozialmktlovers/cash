import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeDocument, FakeElement } from '../helpers/fake-dom';

/**
 * src/scripts/etapas.ts tal cual, importado contra el micro-DOM. El script
 * se registra al cargarse (efecto de módulo), así que cada prueba arma la
 * página, publica `document`/`window`/`fetch` como globales y lo importa de
 * nuevo con `vi.resetModules()`.
 *
 * El caso que se fija: «Pedir cambios» y «Reabrir» llevan `data-accion` Y
 * `data-abrir="comentario"`. Si el manejador de una sola acción los captura,
 * el POST de transición sale sin comentario en cuanto se abre el diálogo.
 */

type Llamada = { url: string; cuerpo: Record<string, unknown> };

function boton(doc: FakeDocument, attrs: Record<string, string>): FakeElement {
  const b = doc.createElement('button');
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  // `dataset` no existe en el micro-DOM: se espeja desde los data-* que usa el script.
  (b as any).dataset = {
    etapaId: attrs['data-etapa-id'],
    accion: attrs['data-accion'],
    etapaNombre: attrs['data-etapa-nombre'],
    requiere: attrs['data-requiere'],
  };
  doc.body.appendChild(b);
  return b;
}

function armarPagina() {
  const doc = new FakeDocument();

  const iniciar = boton(doc, { 'data-accion': 'iniciar', 'data-etapa-id': 'e1' });
  const solicitar = boton(doc, { 'data-accion': 'solicitar', 'data-etapa-id': 'e1' });
  const pedirCambios = boton(doc, {
    'data-abrir': 'comentario', 'data-accion': 'pedir_cambios', 'data-etapa-id': 'e2',
    'data-etapa-nombre': 'Investigación', 'data-requiere': 'true',
  });
  const reabrir = boton(doc, {
    'data-abrir': 'comentario', 'data-accion': 'reabrir', 'data-etapa-id': 'e3',
    'data-etapa-nombre': 'Pilares', 'data-requiere': 'true',
  });

  // Diálogo de comentario con lo mínimo que usa el script.
  const dialogo = doc.createElement('dialog');
  dialogo.id = 'dialogo-comentario';
  (dialogo as any).abierto = false;
  (dialogo as any).showModal = () => { (dialogo as any).abierto = true; };
  (dialogo as any).close = () => { (dialogo as any).abierto = false; };
  doc.body.appendChild(dialogo);
  const hijo = (tag: string, id: string) => { const el = doc.createElement(tag); el.id = id; dialogo.appendChild(el); return el; };
  hijo('h2', 'comentario-titulo');
  hijo('label', 'comentario-etiqueta');
  const textarea = hijo('textarea', 'comentario-texto');
  const forma = hijo('form', 'forma-comentario');
  hijo('button', 'comentario-enviar');
  hijo('p', 'comentario-error');
  hijo('button', 'comentario-cancelar');

  return { doc, iniciar, solicitar, pedirCambios, reabrir, dialogo, textarea, forma };
}

let llamadas: Llamada[];

async function cargarScript(doc: FakeDocument) {
  llamadas = [];
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', { location: { pathname: '/clientes/c1' } });
  vi.stubGlobal('location', { reload: vi.fn() });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
    llamadas.push({ url, cuerpo: JSON.parse(init.body) });
    // Respuesta fallida a propósito: evita el `setTimeout(location.reload)` del éxito.
    return { json: async () => ({ ok: false, errores: ['prueba'] }) };
  }));
  vi.resetModules();
  await import('@/scripts/etapas');
}

describe('etapas.ts · botones de transición', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('«Pedir cambios» abre el diálogo y NO manda la transición', async () => {
    const p = armarPagina();
    await cargarScript(p.doc);

    p.pedirCambios.dispatch('click');
    await vi.runAllTimersAsync();

    expect((p.dialogo as any).abierto).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('«Reabrir» abre el diálogo y NO manda la transición', async () => {
    const p = armarPagina();
    await cargarScript(p.doc);

    p.reabrir.dispatch('click');
    await vi.runAllTimersAsync();

    expect((p.dialogo as any).abierto).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('el diálogo manda la transición con su comentario al enviarse', async () => {
    const p = armarPagina();
    await cargarScript(p.doc);

    p.pedirCambios.dispatch('click');
    p.textarea.value = '  Falta la competencia  ';
    p.forma.dispatch('submit');
    await vi.runAllTimersAsync();

    expect(llamadas).toEqual([
      { url: '/api/etapas/e2/transicion', cuerpo: { accion: 'pedir_cambios', comentario: 'Falta la competencia' } },
    ]);
  });

  it('«Iniciar» y «Solicitar» siguen mandando su transición al instante', async () => {
    const p = armarPagina();
    await cargarScript(p.doc);

    p.iniciar.dispatch('click');
    await vi.runAllTimersAsync();
    p.solicitar.dispatch('click');
    await vi.runAllTimersAsync();

    expect(llamadas).toEqual([
      { url: '/api/etapas/e1/transicion', cuerpo: { accion: 'iniciar' } },
      { url: '/api/etapas/e1/transicion', cuerpo: { accion: 'solicitar' } },
    ]);
  });
});
