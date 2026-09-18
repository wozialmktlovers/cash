import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';
import { FakeDocument, FakeElement, FakeWindow, ejecutarScript } from '../helpers/fake-dom';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import lecturaEjemplo from '../fixtures/lectura-ejemplo.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

/**
 * Dónde están los comentarios abiertos (aviso resumen, índice lateral,
 * bloque resaltado, marcador tocable y la vuelta desde el panel). La página
 * de prueba imita la estructura real: índice con `href="#id"`, secciones con
 * `data-seccion` y `data-ancla="seccion:…"`, tarjetas con su propia ancla.
 */
type Comentario = {
  id: string; ancla: string; estado: string; respuestaDe?: string | null; deOtraVersion?: boolean;
  texto?: string; autor?: string; autorRol?: string; creadoEn?: string;
};

function comentario(c: Comentario) {
  return { texto: 'x', autor: 'Ana', autorRol: 'admin', creadoEn: '2026-09-01', respuestaDe: null, deOtraVersion: false, versionNumero: 1, ...c };
}

function el(doc: FakeDocument, padre: FakeElement, tag: string, attrs: Record<string, string> = {}): FakeElement {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  padre.appendChild(e);
  return e;
}

function armarPagina(o: { rol?: string } = {}) {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  (win as any).location = { hash: '', reload: vi.fn() };
  doc.body.setAttribute('data-flujo', JSON.stringify({
    tipo: 'research', id: 'doc1', etapaId: 'etapa1', puedeEditar: false, puedeComentar: true,
    rol: o.rol ?? 'operador', esOperadorAsignado: true,
  }));

  const nav = el(doc, doc.body, 'nav', { class: 'indice-lateral' });
  const ol = el(doc, nav, 'ol');
  const enlaceDescubrimos = el(doc, el(doc, ol, 'li'), 'a', { href: '#descubrimos' });
  const enlaceRecomendamos = el(doc, el(doc, ol, 'li'), 'a', { href: '#recomendamos' });
  const enlaceDetalle = el(doc, el(doc, ol, 'li'), 'a', { href: '#detalle' });

  const main = el(doc, doc.body, 'main');
  const aviso = el(doc, main, 'div', { id: 'aviso-comentarios' });
  aviso.hidden = true;
  const avisoTexto = el(doc, aviso, 'p', { id: 'aviso-comentarios-texto', role: 'status' });
  const btnPrimero = el(doc, aviso, 'button', { id: 'btn-comentarios-primero' });
  const btnAnterior = el(doc, aviso, 'button', { id: 'btn-comentarios-anterior' });
  const btnSiguiente = el(doc, aviso, 'button', { id: 'btn-comentarios-siguiente' });
  const btnLista = el(doc, aviso, 'button', { id: 'btn-comentarios-lista' });

  const portada = el(doc, main, 'section', { id: 'inicio', 'data-ancla': 'seccion:inicio' });
  const descubrimos = el(doc, main, 'section', { id: 'descubrimos', 'data-seccion': '', 'data-ancla': 'seccion:descubrimos' });
  const tarjeta0 = el(doc, descubrimos, 'article', { class: 'tarjeta', 'data-ancla': 'lectura.datos.descubrimos.0' });
  const tarjeta1 = el(doc, descubrimos, 'article', { class: 'tarjeta', 'data-ancla': 'lectura.datos.descubrimos.1' });
  const recomendamos = el(doc, main, 'section', { id: 'recomendamos', 'data-seccion': '', 'data-ancla': 'seccion:recomendamos' });
  const paso0 = el(doc, recomendamos, 'li', { 'data-ancla': 'lectura.datos.recomendamos.pasos.0' });
  const detalle = el(doc, main, 'section', { id: 'detalle', 'data-seccion': '', 'data-ancla': 'seccion:detalle' });
  const tablist = el(doc, detalle, 'div', { role: 'tablist' });
  const tabA = el(doc, tablist, 'button', { role: 'tab', 'aria-controls': 'panel-a' });
  const tabB = el(doc, tablist, 'button', { role: 'tab', 'aria-controls': 'panel-b' });
  el(doc, detalle, 'div', { role: 'tabpanel', id: 'panel-a' });
  const panelB = el(doc, detalle, 'div', { role: 'tabpanel', id: 'panel-b' });
  panelB.hidden = true;
  const tarjetaOculta = el(doc, panelB, 'article', { class: 'tarjeta', 'data-ancla': 'mercado.datos.0' });

  const navegador = el(doc, doc.body, 'div', { id: 'navegador-comentarios' });
  navegador.hidden = true;
  const navPosicion = el(doc, navegador, 'span', { id: 'navegador-comentarios-posicion' });

  const btnComentarios = el(doc, doc.body, 'button', { id: 'btn-flujo-comentarios' });
  const dialogo = el(doc, doc.body, 'dialog', { id: 'dialog-comentarios' });
  el(doc, dialogo, 'button', { id: 'dialog-comentarios-cerrar' });
  for (const f of ['abierto', 'resueltos', 'todos']) {
    el(doc, dialogo, 'button', { 'data-filtro-comentarios': f, 'aria-pressed': f === 'abierto' ? 'true' : 'false' });
  }
  const lista = el(doc, dialogo, 'div', { id: 'comentarios-lista' });
  el(doc, dialogo, 'p', { id: 'comentarios-estado' });

  return {
    doc, win, aviso, avisoTexto, btnPrimero, btnAnterior, btnSiguiente, btnLista, navegador, navPosicion,
    enlaceDescubrimos, enlaceRecomendamos, enlaceDetalle, portada, descubrimos, tarjeta0, tarjeta1,
    recomendamos, paso0, detalle, tabA, tabB, panelB, tarjetaOculta, btnComentarios, dialogo, lista,
    correr: () => ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window),
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

/** fetch falso: GET /api/comentarios devuelve `estado.lista`; PATCH /api/comentarios/:id cambia su estado. */
function servidorFalso(inicial: Comentario[]) {
  const estado = { lista: inicial.map(comentario) };
  const fn = vi.fn((url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PATCH') {
      const id = url.split('/').pop();
      const cuerpo = JSON.parse(init.body ?? '{}');
      estado.lista = estado.lista.map((c) => (c.id === id ? { ...c, estado: cuerpo.estado } : c));
      return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, comentarios: estado.lista }) });
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return estado;
}

function marcador(e: FakeElement): FakeElement | undefined {
  return e.children.find((c) => c.classList.contains('marcador-comentario'));
}

function puntoIndice(a: FakeElement): string | null {
  const p = a.children.find((c) => c.classList.contains('indice-comentarios'));
  if (!p) return null;
  return p.children.find((c) => c.classList.contains('indice-comentarios-numero'))?.textContent ?? null;
}

const MEZCLA: Comentario[] = [
  { id: 'c1', ancla: 'lectura.datos.descubrimos.0', estado: 'abierto' },
  { id: 'c2', ancla: 'lectura.datos.descubrimos.0', estado: 'abierto' },
  { id: 'c3', ancla: 'lectura.datos.descubrimos.1', estado: 'atendido' },
  { id: 'c4', ancla: 'lectura.datos.descubrimos.1', estado: 'descartado' },
  { id: 'r1', ancla: 'lectura.datos.descubrimos.1', estado: 'abierto', respuestaDe: 'c3' },
  { id: 'c5', ancla: 'seccion:recomendamos', estado: 'abierto' },
  { id: 'c6', ancla: 'lectura.datos.recomendamos.pasos.0', estado: 'abierto', deOtraVersion: true },
];

describe('SCRIPT_FLUJO · dónde están los comentarios (fake-dom)', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('resalta solo los bloques con comentarios abiertos de primer nivel (ni atendidos, ni descartados, ni respuestas, ni de otra versión)', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();

    expect(p.tarjeta0.classList.contains('bloque-comentado')).toBe(true);
    expect(p.tarjeta1.classList.contains('bloque-comentado')).toBe(false);
    expect(marcador(p.tarjeta1)).toBeUndefined();
    expect(p.paso0.classList.contains('bloque-comentado')).toBe(false);
    // Una sección entera lleva su propia clase (se tiñe su cabeza, no todo).
    expect(p.recomendamos.classList.contains('seccion-comentada')).toBe(true);
    expect(p.recomendamos.classList.contains('bloque-comentado')).toBe(false);
    expect(p.descubrimos.classList.contains('seccion-comentada')).toBe(false);
  });

  it('el marcador es un botón que dice «2 comentarios» y lleva el ancla de su bloque', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();

    const m = marcador(p.tarjeta0)!;
    expect(m.tagName).toBe('button');
    expect(m.textContent).toBe('2 comentarios');
    expect(m.getAttribute('data-marcador-ancla')).toBe('lectura.datos.descubrimos.0');
    expect(marcador(p.recomendamos)!.textContent).toBe('1 comentario');
  });

  it('el índice lateral lleva el conteo por sección, y nada en las secciones sin comentarios abiertos', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();

    expect(puntoIndice(p.enlaceDescubrimos)).toBe('2');
    expect(puntoIndice(p.enlaceRecomendamos)).toBe('1');
    expect(puntoIndice(p.enlaceDetalle)).toBeNull();
  });

  it('el aviso resume comentarios y secciones; sin comentarios abiertos no aparece', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();
    expect(p.aviso.hidden).toBe(false);
    expect(p.avisoTexto.textContent).toBe('Tienes 3 comentarios por atender en 2 secciones.');

    servidorFalso([{ id: 'c3', ancla: 'lectura.datos.descubrimos.1', estado: 'atendido' }]);
    const q = armarPagina();
    q.correr();
    await flush();
    expect(q.aviso.hidden).toBe(true);
    expect(q.tarjeta1.classList.contains('bloque-comentado')).toBe(false);
  });

  it('los comentarios generales se cuentan aparte en el aviso (solo viven en la lista)', async () => {
    servidorFalso([
      { id: 'c1', ancla: 'lectura.datos.descubrimos.0', estado: 'abierto' },
      { id: 'g1', ancla: 'general', estado: 'abierto' },
    ]);
    const p = armarPagina();
    p.correr();
    await flush();
    expect(p.avisoTexto.textContent).toBe('Tienes 1 comentario por atender en 1 sección y 1 comentario general (en la lista).');

    servidorFalso([{ id: 'g1', ancla: 'general', estado: 'abierto' }]);
    const q = armarPagina();
    q.correr();
    await flush();
    expect(q.aviso.hidden).toBe(false);
    expect(q.avisoTexto.textContent).toBe('Tienes 1 comentario general por atender (en la lista).');
    // Sin bloques a los que saltar, los controles del recorrido se esconden.
    expect(q.btnPrimero.hidden).toBe(true);
    expect(q.btnSiguiente.hidden).toBe(true);
  });

  it('en el portal, el cliente ve «observaciones abiertas»', async () => {
    servidorFalso([
      { id: 'c1', ancla: 'lectura.datos.descubrimos.0', estado: 'abierto' },
      { id: 'c2', ancla: 'seccion:recomendamos', estado: 'abierto' },
    ]);
    const p = armarPagina({ rol: 'cliente' });
    p.correr();
    await flush();
    expect(p.avisoTexto.textContent).toBe('Tienes 2 observaciones abiertas en 2 secciones.');
    expect(marcador(p.tarjeta0)!.textContent).toBe('1 observación');
  });

  it('«Ir al primero», siguiente y anterior recorren los bloques en el orden del documento y los destacan', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();

    p.btnPrimero.dispatch('click');
    expect(p.tarjeta0.classList.contains('ancla-resaltada')).toBe(true);
    expect(p.navPosicion.textContent).toBe('1 de 2');

    p.btnSiguiente.dispatch('click');
    expect(p.recomendamos.classList.contains('ancla-resaltada')).toBe(true);
    expect(p.tarjeta0.classList.contains('ancla-resaltada')).toBe(false);
    expect(p.navPosicion.textContent).toBe('2 de 2');

    p.btnSiguiente.dispatch('click');
    expect(p.navPosicion.textContent).toBe('1 de 2');

    p.btnAnterior.dispatch('click');
    expect(p.navPosicion.textContent).toBe('2 de 2');
  });

  it('saltar a un bloque dentro de una pestaña no elegida elige primero esa pestaña', async () => {
    servidorFalso([{ id: 'c1', ancla: 'mercado.datos.0', estado: 'abierto' }]);
    const p = armarPagina();
    const clicPestana = vi.fn();
    p.tabB.click = clicPestana;
    p.correr();
    await flush();

    p.btnPrimero.dispatch('click');
    expect(clicPestana).toHaveBeenCalled();
    expect(puntoIndice(p.enlaceDetalle)).toBe('1');
  });

  it('tocar el marcador abre el panel en el hilo de ese bloque, sin disparar el clic del propio bloque', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    const clicBloque = vi.fn();
    p.tarjeta0.addEventListener('click', clicBloque);
    p.correr();
    await flush();

    marcador(p.tarjeta0)!.dispatch('click');
    await flush();

    expect(p.dialogo.getAttribute('open')).toBe('open');
    expect(clicBloque).not.toHaveBeenCalled();
    const delHilo = p.lista.querySelectorAll('.hilo-actual');
    expect(delHilo.length).toBe(2);
    expect(delHilo.every((f) => f.getAttribute('data-hilo-ancla') === 'lectura.datos.descubrimos.0')).toBe(true);
    expect(p.doc.activeElement).toBe(delHilo[0]);
  });

  it('en modo Comentar, tocar el marcador abre el hilo en vez del recuadro de comentario nuevo', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    const btnComentar = el(p.doc, p.doc.body, 'button', { id: 'btn-flujo-comentar' });
    const recuadro = el(p.doc, p.doc.body, 'div', { id: 'recuadro-comentario' });
    recuadro.hidden = true;
    el(p.doc, recuadro, 'textarea', { id: 'recuadro-comentario-texto' });
    p.correr();
    await flush();
    btnComentar.dispatch('click');

    marcador(p.tarjeta0)!.dispatch('click');
    await flush();

    expect(recuadro.hidden).toBe(true);
    expect(p.dialogo.getAttribute('open')).toBe('open');
  });

  it('«Ver en el documento» en el panel cierra el panel, destaca el bloque y pasa el foco a su marcador', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina();
    p.correr();
    await flush();
    p.btnComentarios.dispatch('click');
    await flush();

    const botones = p.lista.querySelectorAll('button').filter((b) => b.textContent === 'Ver en el documento');
    expect(botones.length).toBeGreaterThan(0);
    const fila = botones[0].closest('.comentario-fila')!;
    const ancla = fila.getAttribute('data-hilo-ancla')!;
    botones[0].dispatch('click');

    const bloque = ancla === 'seccion:recomendamos' ? p.recomendamos : p.tarjeta0;
    expect(p.dialogo.getAttribute('open')).toBeNull();
    expect(bloque.classList.contains('ancla-resaltada')).toBe(true);
    expect(p.doc.activeElement).toBe(marcador(bloque));
  });

  it('marcar uno como atendido actualiza resaltado, marcador, índice y aviso sin recargar', async () => {
    servidorFalso(MEZCLA);
    const p = armarPagina({ rol: 'admin' });
    p.correr();
    await flush();
    p.btnComentarios.dispatch('click');
    await flush();

    const fila = p.lista.querySelectorAll('.comentario-fila').find((f) => f.getAttribute('data-hilo-ancla') === 'seccion:recomendamos')!;
    const atender = fila.querySelectorAll('button').find((b) => b.textContent === 'Marcar atendido')!;
    atender.dispatch('click');
    await flush();
    await flush();

    expect(p.recomendamos.classList.contains('seccion-comentada')).toBe(false);
    expect(marcador(p.recomendamos)).toBeUndefined();
    expect(puntoIndice(p.enlaceRecomendamos)).toBeNull();
    expect(puntoIndice(p.enlaceDescubrimos)).toBe('2');
    expect(p.avisoTexto.textContent).toBe('Tienes 2 comentarios por atender en 1 sección.');
  });
});

const operador = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1',
  version: 2, tipo: 'research' as const, tokenActivo: null, base: 'https://x',
};
const flujo: FlujoDatos = {
  tipo: 'research', id: 'd1', etapaId: 'e1', puedeEditar: true, puedeComentar: true, rol: 'operador', esOperadorAsignado: true,
};
const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
const metaInv = { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' };

describe('aviso y navegador de comentarios en los renders', () => {
  it('investigación, mapa de pilares y manual: la vista interna con comentarios trae el aviso y el navegador', () => {
    const internas = [
      renderizarInvestigacion(inv, metaInv, operador, true, flujo, true),
      renderizarPilares(mapaFalso(), { cliente: 'Ana', fecha: '2026-09-15' }, {
        operador: { ...operador, tipo: 'pilares' }, editable: true, anclas: true, flujo: { ...flujo, tipo: 'pilares' },
      }),
      renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' }, undefined, true, { ...flujo, tipo: 'growth' }),
    ];
    for (const html of internas) {
      expect(html).toContain('id="aviso-comentarios"');
      expect(html).toContain('id="navegador-comentarios"');
      expect(html).toMatch(/id="aviso-comentarios-texto" role="status"/);
      // Llega oculto: el script lo enseña solo si hay comentarios abiertos.
      expect(html).toMatch(/<div class="aviso-comentarios" id="aviso-comentarios" hidden>/);
    }
  });

  it('el enlace público (sin flujo) no trae nada de esto, en ninguno de los tres documentos', () => {
    const publicos = [
      renderizarInvestigacion(inv, metaInv),
      renderizarPilares(mapaFalso(), { cliente: 'Ana', fecha: '2026-09-15' }),
      renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' }),
    ];
    for (const html of publicos) {
      expect(html).not.toContain('id="aviso-comentarios"');
      expect(html).not.toContain('id="navegador-comentarios"');
      expect(html).not.toContain('data-flujo=');
      expect(html).not.toContain('data-ancla="');
    }
  });

  it('sin permiso de comentar (flujo sin puedeComentar) tampoco aparece', () => {
    const html = renderizarInvestigacion(inv, metaInv, operador, true, { ...flujo, puedeComentar: false }, true);
    expect(html).not.toContain('id="aviso-comentarios"');
    expect(html).not.toContain('id="navegador-comentarios"');
  });

  it('los controles del aviso tienen nombre accesible', () => {
    const html = renderizarInvestigacion(inv, metaInv, operador, true, flujo, true);
    expect(html).toContain('aria-label="Bloque comentado anterior"');
    expect(html).toContain('aria-label="Bloque comentado siguiente"');
    expect(html).toContain('>Ir al primero</button>');
  });

  it('el resaltado sale de los tokens: fondo --rosa-s y franja --rosa', () => {
    expect(ESTILOS_EDITORIAL).toMatch(/\.bloque-comentado\{background-color:var\(--rosa-s\)/);
    expect(ESTILOS_EDITORIAL).toMatch(/-4px 0 0 8px var\(--rosa\)/);
  });
});
