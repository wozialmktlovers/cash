import { describe, it, expect } from 'vitest';
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';
import { cabeceraDocumento, SCRIPT_CABECERA } from '@/render/editorial/cabecera';
import { SCRIPT_EDITORIAL } from '@/render/editorial/interaccion';
import { envolverDocumento } from '@/render/editorial/comunes';
import { FakeDocument, FakeWindow, crearPestana, ejecutarScript } from '../helpers/fake-dom';

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

// El banco de pilares trae cinco `[role="tablist"]` (uno por pilar) en la
// misma página, algo que la investigación nunca tuvo (un solo tablist). Esta
// suite ejecuta SCRIPT_EDITORIAL de verdad contra una micro-DOM (sin jsdom:
// no está instalado y el proyecto no permite `npm install`) para probar que
// cada grupo es independiente: la selección inicial, el clic y las flechas
// nunca cruzan de un tablist a otro.
describe('SCRIPT_EDITORIAL · pestañas por tablist', () => {
  function armarDosTablists() {
    const doc = new FakeDocument();
    const win = new FakeWindow();

    const tablistA = doc.createElement('div');
    tablistA.setAttribute('role', 'tablist');
    doc.body.appendChild(tablistA);
    const a = [0, 1, 2].map((i) => crearPestana(doc, tablistA, { idTab: `tabA${i}`, idPanel: `panelA${i}`, seleccionado: i === 0 }));

    const tablistB = doc.createElement('div');
    tablistB.setAttribute('role', 'tablist');
    doc.body.appendChild(tablistB);
    const b = [0, 1, 2].map((i) => crearPestana(doc, tablistB, { idTab: `tabB${i}`, idPanel: `panelB${i}`, seleccionado: i === 0 }));

    ejecutarScript(SCRIPT_EDITORIAL, doc, win);
    return { doc, win, a, b };
  }

  it('la selección inicial elige el primer tab de CADA tablist, no solo del primero de la página', () => {
    const { a, b } = armarDosTablists();
    expect(a[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(a[0].panel.hidden).toBe(false);
    expect(a[1].panel.hidden).toBe(true);
    expect(a[2].panel.hidden).toBe(true);

    // Antes de este arreglo, `elegir(pestanas[0])` trataba las seis
    // pestañas como una sola lista: solo tabA0 quedaba seleccionado y el
    // panel de tabB0 (el "primero" de su propio grupo) se escondía.
    expect(b[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(b[0].panel.hidden).toBe(false);
    expect(b[1].panel.hidden).toBe(true);
  });

  it('un clic en un tab del grupo A no toca la selección ni los paneles del grupo B', () => {
    const { a, b } = armarDosTablists();
    a[1].tab.dispatch('click');

    expect(a[1].tab.getAttribute('aria-selected')).toBe('true');
    expect(a[1].panel.hidden).toBe(false);
    expect(a[0].panel.hidden).toBe(true);

    expect(b[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(b[0].panel.hidden).toBe(false);
  });

  it('ArrowRight/Home/End se quedan dentro del mismo tablist, nunca saltan al siguiente grupo', () => {
    const { a, b } = armarDosTablists();

    // Último tab del grupo A: ArrowRight debe dar la vuelta a tabA0, no
    // "seguir" hacia tabB0 como pasaba con la lista plana.
    a[2].tab.dispatch('click');
    a[2].tab.dispatch('keydown', { key: 'ArrowRight' });
    expect(a[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(b[0].tab.getAttribute('aria-selected')).toBe('true');

    a[0].tab.dispatch('keydown', { key: 'End' });
    expect(a[2].tab.getAttribute('aria-selected')).toBe('true');
    expect(a[2].panel.hidden).toBe(false);
    expect(b[0].tab.getAttribute('aria-selected')).toBe('true');

    a[2].tab.dispatch('keydown', { key: 'Home' });
    expect(a[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(b[0].tab.getAttribute('aria-selected')).toBe('true');
  });

  // El banco de pilares apaga sus pestañas con aria-disabled mientras hay un
  // filtro activo (para que las tres subcategorías se vean a la vez), pero
  // aria-disabled no es un atributo que el navegador haga cumplir por sí
  // solo: sin esta revisión, un tab que seguía con tabindex="0" (el que
  // estaba elegido antes del filtro) se podía alcanzar con Tab y su
  // clic/Enter/flecha revertía el estado igual, aunque el mouse ya no
  // pudiera tocarlo (eso lo cubre pointer-events:none, que no llega a un
  // teclado).
  it('con aria-disabled en el tab, un clic o una flecha no cambian la selección ni los paneles', () => {
    const { a, b } = armarDosTablists();
    for (const { tab } of a) tab.setAttribute('aria-disabled', 'true');

    a[1].tab.dispatch('click');
    expect(a[1].tab.getAttribute('aria-selected')).toBe('false');
    expect(a[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(a[0].panel.hidden).toBe(false);
    expect(a[1].panel.hidden).toBe(true);

    a[0].tab.dispatch('keydown', { key: 'ArrowRight' });
    a[0].tab.dispatch('keydown', { key: 'End' });
    expect(a[0].tab.getAttribute('aria-selected')).toBe('true');
    expect(a[0].panel.hidden).toBe(false);

    // El grupo B, sin aria-disabled, sigue funcionando normalmente.
    b[1].tab.dispatch('click');
    expect(b[1].tab.getAttribute('aria-selected')).toBe('true');
    expect(b[1].panel.hidden).toBe(false);
  });

  it('con aria-disabled en el propio [role="tablist"], sus pestañas también quedan bloqueadas', () => {
    const { a } = armarDosTablists();
    const tablistA = a[0].tab.parent!;
    tablistA.setAttribute('aria-disabled', 'true');

    a[1].tab.dispatch('click');
    expect(a[1].tab.getAttribute('aria-selected')).toBe('false');
    expect(a[0].panel.hidden).toBe(false);
  });

  it('la investigación (un solo tablist) se comporta exactamente igual que antes', () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const tablist = doc.createElement('div');
    tablist.setAttribute('role', 'tablist');
    doc.body.appendChild(tablist);
    const tabs = [0, 1, 2, 3].map((i) => crearPestana(doc, tablist, { idTab: `t${i}`, idPanel: `p${i}`, seleccionado: i === 0 }));
    ejecutarScript(SCRIPT_EDITORIAL, doc, win);

    expect(tabs[0].panel.hidden).toBe(false);
    for (const t of tabs.slice(1)) expect(t.panel.hidden).toBe(true);

    tabs[2].tab.dispatch('click');
    expect(tabs[2].panel.hidden).toBe(false);
    expect(tabs[0].panel.hidden).toBe(true);
  });
});
