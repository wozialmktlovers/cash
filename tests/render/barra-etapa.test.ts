import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { barraEtapa, SCRIPT_BARRA_ETAPA } from '@/render/editorial/barra-etapa';
import { SCRIPT_FLUJO, type FlujoDatos } from '@/render/editorial/flujo-cliente';
import type { BarraEtapa } from '@/flujo/barra-documento';
import { renderizarInvestigacion } from '@/render/investigacion/documento';
import { renderizarPilares } from '@/render/pilares/documento';
import { renderizarManual } from '@/render/growth/manual';
import { FakeDocument, FakeElement, FakeWindow, ejecutarScript } from '../helpers/fake-dom';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import lecturaEjemplo from '../fixtures/lectura-ejemplo.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

/**
 * La barra de acción de la etapa dentro del documento: dónde sale (solo la
 * vista interna), qué manda al servidor y cómo se entiende con el recorrido
 * de comentarios y con los enlaces de los avisos.
 */

const ETAPA = 'e1';
const C1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const C2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const R1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

const BARRA_ADMIN: BarraEtapa = {
  etapaId: ETAPA, etapaNombre: 'Manual de campaña', tono: 'le-toca',
  titulo: 'Espera tu autorización', detalle: 'Ana Paw te pidió autorización hace 2 horas.',
  comentariosPorAtender: 0,
  botones: [{ id: 'aprobar', disabled: false, razon: '' }, { id: 'pedir_cambios', requiereComentario: true }],
};
const BARRA_OPERADOR_COMENTARIOS: BarraEtapa = {
  etapaId: ETAPA, etapaNombre: 'Manual de campaña', tono: 'le-toca',
  titulo: 'Tienes 2 comentarios por atender', detalle: null, comentariosPorAtender: 2,
  botones: [{ id: 'solicitar', disabled: true, razon: 'Primero hay que resolver los comentarios pendientes' }],
};

const operador = {
  clienteId: 'c1', clienteNombre: 'Ana', clienteSlug: 'ana', documentoId: 'd1',
  version: 2, tipo: 'research' as const, tokenActivo: null, base: 'https://x',
};
const flujo: FlujoDatos = {
  tipo: 'research', id: 'd1', etapaId: ETAPA, puedeEditar: true, puedeComentar: true, rol: 'admin', esOperadorAsignado: false,
  barra: BARRA_ADMIN,
};
const inv = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } } as any;
const metaInv = { cliente: 'Ana', giro: 'Belleza', fecha: '2026-09-15' };

const internos = (f: FlujoDatos) => [
  renderizarInvestigacion(inv, metaInv, operador, true, f, true),
  renderizarPilares(mapaFalso(), { cliente: 'Ana', fecha: '2026-09-15' }, {
    operador: { ...operador, tipo: 'pilares' }, editable: true, anclas: true, flujo: { ...f, tipo: 'pilares' },
  }),
  renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' }, undefined, true, { ...f, tipo: 'growth' }),
];

describe('dónde sale la barra', () => {
  it('investigación, mapa de pilares y manual: en la vista interna, arriba del aviso de comentarios, con su script', () => {
    for (const html of internos(flujo)) {
      expect(html).toContain('id="barra-etapa"');
      expect(html).toContain('data-barra-accion="aprobar"');
      expect(html).toContain('>Autorizar</button>');
      expect(html).toContain('id="dialogo-barra-aprobar"');
      expect(html.indexOf('id="barra-etapa"')).toBeLessThan(html.indexOf('id="aviso-comentarios"'));
      expect(html).toContain("'/api/etapas/' + encodeURIComponent(etapaId) + '/transicion'");
    }
  });

  it('la barra no viaja en data-flujo (ya va pintada)', () => {
    const html = internos(flujo)[0];
    const crudo = /data-flujo="([^"]*)"/.exec(html)![1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    expect(JSON.parse(crudo)).not.toHaveProperty('barra');
  });

  it('el enlace público (sin flujo) nunca la lleva', () => {
    const publicos = [
      renderizarInvestigacion(inv, metaInv),
      renderizarPilares(mapaFalso(), { cliente: 'Ana', fecha: '2026-09-15' }),
      renderizarManual(growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' }),
    ];
    for (const html of publicos) {
      expect(html).not.toContain('id="barra-etapa"');
      expect(html).not.toContain('data-barra-accion=');
      expect(html).not.toContain('/transicion');
    }
  });

  it('el portal del cliente tampoco, aunque por error le llegara una barra', () => {
    const portal: FlujoDatos = { ...flujo, tipo: 'growth', rol: 'cliente', puedeEditar: false, esOperadorAsignado: false };
    const html = renderizarManual(
      growthCompleto as any, { cliente: 'Ana', producto: 'Curso X', fecha: '2026-09-15' },
      undefined, false, portal, { volverHref: '/portal', volverTexto: '← Mi portal' },
    );
    expect(html).not.toContain('id="barra-etapa"');
    expect(html).not.toContain('/transicion');
  });

  it('sin barra (etapa sin nada que avanzar), no hay rastro de ella', () => {
    for (const html of internos({ ...flujo, barra: null })) {
      expect(html).not.toContain('id="barra-etapa"');
      expect(html).not.toContain('/transicion');
    }
  });
});

describe('barraEtapa (HTML)', () => {
  it('operador con comentarios: el título con el conteo, «Ir al primero» y Solicitar deshabilitado con la razón visible', () => {
    const html = barraEtapa(BARRA_OPERADOR_COMENTARIOS);
    expect(html).toContain('Tienes 2 comentarios por atender');
    expect(html).toContain('id="btn-barra-primer-comentario"');
    expect(html).toMatch(/data-barra-accion="solicitar" disabled data-por-comentarios aria-describedby="barra-etapa-razon">Solicitar autorización/);
    expect(html).toContain('<p class="barra-etapa-razon" id="barra-etapa-razon">Primero hay que resolver los comentarios pendientes</p>');
    expect(html).not.toContain('dialogo-barra-aprobar');
  });

  it('aprobada: una línea discreta, sin botones ni diálogos', () => {
    const html = barraEtapa({ ...BARRA_ADMIN, tono: 'discreta', titulo: 'Autorizada por Luis el 10 sept', detalle: null, botones: [] });
    expect(html).toContain('barra-etapa-discreta');
    expect(html).toContain('Autorizada por Luis el 10 sept');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<dialog');
  });

  it('escapa lo que viene de la base', () => {
    const html = barraEtapa({ ...BARRA_ADMIN, titulo: '<img src=x onerror=alert(1)>', detalle: '"><script>' });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('"><script>');
  });
});

// ── Script de acciones (fake-dom) ────────────────────────────────────────

function el(doc: FakeDocument, padre: FakeElement, tag: string, attrs: Record<string, string> = {}): FakeElement {
  const e = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v; else e.setAttribute(k, v);
  }
  padre.appendChild(e);
  return e;
}

type Loc = { hash: string; pathname: string; search: string; reload: ReturnType<typeof vi.fn>; replace: ReturnType<typeof vi.fn> };

function paginaBarra(o: { comentarios?: number; solicitarDeshabilitado?: boolean } = {}) {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  const location: Loc = { hash: '', pathname: '/growth/d1', search: '', reload: vi.fn(), replace: vi.fn() };
  (win as any).location = location;
  const barra = el(doc, doc.body, 'section', { id: 'barra-etapa', 'data-etapa-id': ETAPA, 'data-comentarios': String(o.comentarios ?? 0) });
  const titulo = el(doc, barra, 'p', { id: 'barra-etapa-titulo' });
  const aprobar = el(doc, barra, 'button', { 'data-barra-accion': 'aprobar' });
  const solicitar = el(doc, barra, 'button', { 'data-barra-accion': 'solicitar', ...(o.solicitarDeshabilitado ? { 'data-por-comentarios': '' } : {}) });
  if (o.solicitarDeshabilitado) (solicitar as any).disabled = true;
  const cambios = el(doc, barra, 'button', { 'data-barra-accion': 'pedir_cambios', 'data-requiere': 'true' });
  const razon = el(doc, barra, 'p', { id: 'barra-etapa-razon' });
  const primero = el(doc, barra, 'button', { id: 'btn-barra-primer-comentario' });
  const estado = el(doc, barra, 'p', { id: 'barra-etapa-estado' });
  estado.hidden = true;

  const dAprobar = el(doc, doc.body, 'dialog', { id: 'dialogo-barra-aprobar' });
  const confirmar = el(doc, dAprobar, 'button', { id: 'dialogo-barra-aprobar-confirmar' });
  el(doc, dAprobar, 'button', { id: 'dialogo-barra-aprobar-cancelar' });
  const errorAprobar = el(doc, dAprobar, 'p', { id: 'dialogo-barra-aprobar-error' });

  const dCambios = el(doc, doc.body, 'dialog', { id: 'dialogo-barra-cambios' });
  el(doc, dCambios, 'label', { id: 'dialogo-barra-cambios-etiqueta' });
  const texto = el(doc, dCambios, 'textarea', { id: 'dialogo-barra-cambios-texto' });
  const enviar = el(doc, dCambios, 'button', { id: 'dialogo-barra-cambios-enviar' });
  el(doc, dCambios, 'button', { id: 'dialogo-barra-cambios-cancelar' });
  const errorCambios = el(doc, dCambios, 'p', { id: 'dialogo-barra-cambios-error' });

  return {
    doc, win, location, barra, titulo, aprobar, solicitar, cambios, razon, primero, estado,
    dAprobar, confirmar, errorAprobar, dCambios, texto, enviar, errorCambios,
    correr: () => ejecutarScript(SCRIPT_BARRA_ETAPA, doc, win as unknown as Window),
  };
}

const flush = async () => { for (let i = 0; i < 4; i++) await new Promise((r) => setTimeout(r, 0)); };

function servidor(respuesta: { ok: boolean; errores?: string[] }) {
  const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
  globalThis.fetch = vi.fn((url: string, init?: { body?: string }) => {
    llamadas.push({ url, cuerpo: JSON.parse(init?.body ?? '{}') });
    return Promise.resolve({ json: () => Promise.resolve(respuesta) });
  }) as unknown as typeof fetch;
  return llamadas;
}

describe('SCRIPT_BARRA_ETAPA', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('«Solicitar autorización» manda la misma transición que la ficha y recarga ESTE documento', async () => {
    const llamadas = servidor({ ok: true });
    const p = paginaBarra();
    p.correr();
    p.solicitar.dispatch('click');
    await flush();
    expect(llamadas).toEqual([{ url: `/api/etapas/${ETAPA}/transicion`, cuerpo: { accion: 'solicitar' } }]);
    expect(p.location.reload).toHaveBeenCalled();
  });

  it('tras la acción, la recarga quita el #comentario-… con el que se llegó del aviso', async () => {
    servidor({ ok: true });
    const p = paginaBarra();
    p.location.hash = `#comentario-${C1}`;
    p.correr();
    p.solicitar.dispatch('click');
    await flush();
    expect(p.location.replace).toHaveBeenCalledWith('/growth/d1');
  });

  it('si el servidor rechaza, se ve su razón y el botón vuelve a servir', async () => {
    servidor({ ok: false, errores: ['Primero hay que resolver los comentarios pendientes'] });
    const p = paginaBarra();
    p.correr();
    p.solicitar.dispatch('click');
    await flush();
    expect(p.estado.hidden).toBe(false);
    expect(p.estado.textContent).toBe('Primero hay que resolver los comentarios pendientes');
    expect((p.solicitar as any).disabled).toBe(false);
    expect(p.location.reload).not.toHaveBeenCalled();
  });

  it('un botón deshabilitado no manda nada', async () => {
    const llamadas = servidor({ ok: true });
    const p = paginaBarra({ solicitarDeshabilitado: true, comentarios: 2 });
    p.correr();
    p.solicitar.dispatch('click');
    await flush();
    expect(llamadas).toEqual([]);
  });

  it('«Autorizar» confirma en un diálogo y solo entonces manda `aprobar`', async () => {
    const llamadas = servidor({ ok: true });
    const p = paginaBarra();
    p.correr();
    p.aprobar.dispatch('click');
    expect(p.dAprobar.getAttribute('open')).toBe('open');
    expect(llamadas).toEqual([]);
    p.confirmar.dispatch('click');
    await flush();
    expect(llamadas).toEqual([{ url: `/api/etapas/${ETAPA}/transicion`, cuerpo: { accion: 'aprobar' } }]);
    expect(p.location.reload).toHaveBeenCalled();
  });

  it('«Autorizar» rechazado: la razón en el diálogo', async () => {
    servidor({ ok: false, errores: ['La etapa cambió mientras tanto, recarga'] });
    const p = paginaBarra();
    p.correr();
    p.aprobar.dispatch('click');
    p.confirmar.dispatch('click');
    await flush();
    expect(p.errorAprobar.textContent).toBe('La etapa cambió mientras tanto, recarga');
    expect(p.errorAprobar.hidden).toBe(false);
  });

  it('«Pedir cambios» exige el motivo cuando no hay comentarios abiertos, y lo manda', async () => {
    const llamadas = servidor({ ok: true });
    const p = paginaBarra();
    p.correr();
    p.cambios.dispatch('click');
    expect(p.dCambios.getAttribute('open')).toBe('open');
    p.enviar.dispatch('click');
    await flush();
    expect(llamadas).toEqual([]);
    expect(p.errorCambios.textContent).toBe('Deja al menos un comentario con los cambios');
    p.texto.value = '  Cambia el tono  ';
    p.enviar.dispatch('click');
    await flush();
    expect(llamadas).toEqual([{ url: `/api/etapas/${ETAPA}/transicion`, cuerpo: { accion: 'pedir_cambios', comentario: 'Cambia el tono' } }]);
  });
});

// ── SCRIPT_FLUJO: la barra y los enlaces de los avisos ──────────────────

type Comentario = { id: string; ancla: string; estado: string; respuestaDe?: string | null; deOtraVersion?: boolean };

function paginaDocumento(o: { hash?: string; barra?: boolean; comentariosBarra?: number } = {}) {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  (win as any).location = { hash: o.hash ?? '', pathname: '/growth/d1', search: '', reload: vi.fn(), replace: vi.fn() };
  doc.body.setAttribute('data-flujo', JSON.stringify({
    tipo: 'growth', id: 'd1', etapaId: ETAPA, puedeEditar: false, puedeComentar: true, rol: 'operador', esOperadorAsignado: true,
  }));
  const main = el(doc, doc.body, 'main');
  let barra: FakeElement | null = null;
  let titulo: FakeElement | null = null;
  let solicitar: FakeElement | null = null;
  let razon: FakeElement | null = null;
  let primero: FakeElement | null = null;
  if (o.barra) {
    barra = el(doc, main, 'section', { id: 'barra-etapa', 'data-etapa-id': ETAPA, 'data-comentarios': String(o.comentariosBarra ?? 0) });
    titulo = el(doc, barra, 'p', { id: 'barra-etapa-titulo' });
    solicitar = el(doc, barra, 'button', { 'data-barra-accion': 'solicitar', 'data-por-comentarios': '' });
    (solicitar as any).disabled = true;
    razon = el(doc, barra, 'p', { id: 'barra-etapa-razon' });
    primero = el(doc, barra, 'button', { id: 'btn-barra-primer-comentario' });
  }
  const aviso = el(doc, main, 'div', { id: 'aviso-comentarios' });
  aviso.hidden = true;
  el(doc, aviso, 'p', { id: 'aviso-comentarios-texto' });
  const portada = el(doc, main, 'section', { id: 'inicio', 'data-ancla': 'seccion:inicio' });
  const tarjeta0 = el(doc, portada, 'article', { class: 'tarjeta', 'data-ancla': 'bloque.0' });
  const tarjeta1 = el(doc, portada, 'article', { class: 'tarjeta', 'data-ancla': 'bloque.1' });

  el(doc, doc.body, 'button', { id: 'btn-flujo-comentarios' });
  const dialogo = el(doc, doc.body, 'dialog', { id: 'dialog-comentarios' });
  el(doc, dialogo, 'button', { id: 'dialog-comentarios-cerrar' });
  const filtros: Record<string, FakeElement> = {};
  for (const f of ['abierto', 'resueltos', 'todos']) {
    filtros[f] = el(doc, dialogo, 'button', { 'data-filtro-comentarios': f, 'aria-pressed': f === 'abierto' ? 'true' : 'false' });
  }
  const lista = el(doc, dialogo, 'div', { id: 'comentarios-lista' });
  el(doc, dialogo, 'p', { id: 'comentarios-estado' });

  return {
    doc, win, barra, titulo, solicitar, razon, primero, tarjeta0, tarjeta1, dialogo, lista, filtros,
    correr: () => ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window),
  };
}

function servidorComentarios(inicial: Comentario[]) {
  const estado = {
    lista: inicial.map((c) => ({ texto: 'x', autor: 'Ana', autorRol: 'cliente', creadoEn: '2026-09-01', respuestaDe: null, deOtraVersion: false, versionNumero: 1, ...c })),
  };
  globalThis.fetch = vi.fn((url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'PATCH') {
      const id = url.split('/').pop();
      const cuerpo = JSON.parse(init.body ?? '{}');
      estado.lista = estado.lista.map((c) => (c.id === id ? { ...c, estado: cuerpo.estado } : c));
      return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, comentarios: estado.lista }) });
  }) as unknown as typeof fetch;
  return estado;
}

const filasDelHilo = (p: ReturnType<typeof paginaDocumento>) => p.lista.querySelectorAll('.hilo-actual');

describe('SCRIPT_FLUJO · enlaces de los avisos', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('#comentario-<id> abre ESE hilo en el panel y resalta su bloque', async () => {
    servidorComentarios([
      { id: C1, ancla: 'bloque.0', estado: 'abierto' },
      { id: C2, ancla: 'bloque.1', estado: 'abierto' },
    ]);
    const p = paginaDocumento({ hash: `#comentario-${C2}` });
    p.correr();
    await flush();
    expect(p.dialogo.getAttribute('open')).toBe('open');
    const hilo = filasDelHilo(p);
    expect(hilo.length).toBe(1);
    expect(hilo[0].getAttribute('data-hilo-ancla')).toBe('bloque.1');
    expect(p.tarjeta1.classList.contains('ancla-resaltada')).toBe(true);
    expect(p.tarjeta1.classList.contains('bloque-comentado')).toBe(true);
  });

  it('el id de una respuesta lleva al hilo al que responde', async () => {
    servidorComentarios([
      { id: C1, ancla: 'bloque.0', estado: 'abierto' },
      { id: R1, ancla: 'bloque.0', estado: 'abierto', respuestaDe: C1 },
    ]);
    const p = paginaDocumento({ hash: `#comentario-${R1}` });
    p.correr();
    await flush();
    expect(p.dialogo.getAttribute('open')).toBe('open');
    expect(filasDelHilo(p).map((f) => f.getAttribute('data-hilo-ancla'))).toEqual(['bloque.0']);
    expect(p.tarjeta0.classList.contains('ancla-resaltada')).toBe(true);
  });

  it('un comentario ya atendido se busca en «Todos»', async () => {
    servidorComentarios([{ id: C1, ancla: 'bloque.0', estado: 'atendido' }]);
    const p = paginaDocumento({ hash: `#comentario-${C1}` });
    p.correr();
    await flush();
    expect(p.filtros.todos.getAttribute('aria-pressed')).toBe('true');
    expect(filasDelHilo(p).length).toBe(1);
  });

  it('un id inexistente o con otra forma no hace nada (ni truena)', async () => {
    servidorComentarios([{ id: C1, ancla: 'bloque.0', estado: 'abierto' }]);
    for (const hash of ['#comentario-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '#comentario-"><img>', '#comentario-']) {
      const p = paginaDocumento({ hash });
      expect(() => p.correr()).not.toThrow();
      await flush();
      expect(p.dialogo.getAttribute('open')).toBeNull();
    }
  });

  it('#primer-comentario lleva al primero del recorrido (orden del documento)', async () => {
    servidorComentarios([
      { id: C2, ancla: 'bloque.1', estado: 'abierto' },
      { id: C1, ancla: 'bloque.0', estado: 'abierto' },
    ]);
    const p = paginaDocumento({ hash: '#primer-comentario' });
    p.correr();
    await flush();
    expect(p.tarjeta0.classList.contains('ancla-resaltada')).toBe(true);
    expect(p.dialogo.getAttribute('open')).toBeNull();
  });

  it('#primer-comentario con solo comentarios generales abre la lista', async () => {
    servidorComentarios([{ id: C1, ancla: 'general', estado: 'abierto' }]);
    const p = paginaDocumento({ hash: '#primer-comentario' });
    p.correr();
    await flush();
    expect(p.dialogo.getAttribute('open')).toBe('open');
  });

  it('#primer-comentario sin comentarios abiertos no hace nada', async () => {
    servidorComentarios([{ id: C1, ancla: 'bloque.0', estado: 'atendido' }]);
    const p = paginaDocumento({ hash: '#primer-comentario' });
    p.correr();
    await flush();
    expect(p.dialogo.getAttribute('open')).toBeNull();
  });
});

describe('SCRIPT_FLUJO · la barra en vivo', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('«Ir al primero» de la barra usa el mismo recorrido', async () => {
    servidorComentarios([{ id: C1, ancla: 'bloque.1', estado: 'abierto' }]);
    const p = paginaDocumento({ barra: true, comentariosBarra: 1 });
    p.correr();
    await flush();
    p.primero!.dispatch('click');
    expect(p.tarjeta1.classList.contains('ancla-resaltada')).toBe(true);
  });

  it('al atender el último comentario, «Solicitar autorización» se habilita sin recargar', async () => {
    servidorComentarios([
      { id: C1, ancla: 'bloque.0', estado: 'abierto' },
      { id: C2, ancla: 'general', estado: 'abierto' },
    ]);
    const p = paginaDocumento({ barra: true, comentariosBarra: 2 });
    p.correr();
    await flush();
    expect((p.solicitar as any).disabled).toBe(true);
    expect(p.titulo!.textContent).toBe('Tienes 2 comentarios por atender');

    // Marcar atendidos los dos desde el panel.
    p.doc.getElementById('btn-flujo-comentarios')!.dispatch('click');
    await flush();
    for (let i = 0; i < 2; i++) {
      const boton = p.lista.querySelectorAll('button').find((b) => b.textContent === 'Marcar atendido')!;
      boton.dispatch('click');
      await flush();
    }
    expect((p.solicitar as any).disabled).toBe(false);
    expect(p.razon!.hidden).toBe(true);
    expect(p.primero!.hidden).toBe(true);
    expect(p.titulo!.textContent).toBe('Ya no quedan comentarios por atender');
  });
});
