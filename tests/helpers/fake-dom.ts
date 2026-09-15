/**
 * Micro-DOM para ejecutar de verdad los scripts en línea (ES5, sin
 * módulos) contra una página armada a mano, sin jsdom (no está instalado y
 * el proyecto no permite `npm install`). Cubre solo lo que esos scripts
 * usan: querySelectorAll/querySelector con selectores simples (etiqueta,
 * `.clase`, `[attr]`, `[attr="valor"]`) con combinador de descendiente
 * (`.a b`), closest, getAttribute/setAttribute, classList, `hidden`,
 * `value`/`textContent`, addEventListener con click/keydown en fase de
 * burbuja (por omisión) o de captura (`{capture:true}` o el tercer
 * parámetro `true`, como en el DOM real) que se propagan hasta `document`
 * salvo que alguien llame a `stopPropagation()`, y un `window` mínimo (sin
 * `IntersectionObserver`, para que los scripts tomen la rama de respaldo sin
 * necesidad de implementarlo).
 *
 * No es un DOM completo: alcanza para probar el comportamiento real de un
 * script (por ejemplo, que un clic en una pestaña no mueva el foco fuera de
 * su propio `[role="tablist"]`, o que un listener de `document` en fase de
 * captura pueda interceptar un clic antes de que le llegue a su objetivo),
 * no para renderizar layout ni CSS.
 */

type Listener = (e: any) => void;
type Opciones = boolean | { capture?: boolean };
type ListenerRegistrado = { fn: Listener; capture: boolean };

function esCaptura(opciones?: Opciones): boolean {
  return typeof opciones === 'boolean' ? opciones : Boolean(opciones && opciones.capture);
}

type Attrs = Record<string, string>;

function matchesSimple(el: FakeElement, token: string): boolean {
  if (token === '*') return true;
  if (token.startsWith('.')) return el.classList.contains(token.slice(1));
  if (token.startsWith('[')) {
    const m = /^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/.exec(token);
    if (!m) return false;
    const [, nombre, valor] = m;
    if (!el.hasAttribute(nombre)) return false;
    return valor === undefined ? true : el.getAttribute(nombre) === valor;
  }
  return el.tagName === token.toLowerCase();
}

function matchesSelector(el: FakeElement, selector: string): boolean {
  return selector.split(',').some((parte) => {
    const tokens = parte.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return false;
    const ultimo = tokens[tokens.length - 1];
    if (!matchesSimple(el, ultimo)) return false;
    let actual = el.parent;
    for (let i = tokens.length - 2; i >= 0; i--) {
      let encontrado = false;
      while (actual) {
        if (matchesSimple(actual, tokens[i])) { encontrado = true; actual = actual.parent; break; }
        actual = actual.parent;
      }
      if (!encontrado) return false;
    }
    return true;
  });
}

export class FakeElement {
  tagName: string;
  attrs: Attrs = {};
  children: FakeElement[] = [];
  parent: FakeElement | null = null;
  listeners: Record<string, ListenerRegistrado[]> = {};
  doc: FakeDocument;
  private _hidden = false;
  private _value = '';
  private _checked = false;
  private _textContent = '';
  private classes = new Set<string>();

  constructor(tagName: string, doc: FakeDocument) {
    this.tagName = tagName.toLowerCase();
    this.doc = doc;
  }

  get id(): string { return this.attrs.id ?? ''; }
  set id(v: string) { this.attrs.id = v; }

  get parentNode(): FakeElement | null { return this.parent; }

  getAttribute(name: string): string | null { return name in this.attrs ? this.attrs[name] : null; }
  setAttribute(name: string, value: string): void { this.attrs[name] = String(value); }
  removeAttribute(name: string): void { delete this.attrs[name]; }
  hasAttribute(name: string): boolean { return name in this.attrs; }

  get hidden(): boolean { return this._hidden; }
  set hidden(v: boolean) { this._hidden = !!v; }

  get value(): string { return this._value; }
  set value(v: string) { this._value = v; }

  /** Propiedad viva de `<input type="checkbox">` — separada del atributo `checked`, igual que en el DOM real. */
  get checked(): boolean { return this._checked; }
  set checked(v: boolean) { this._checked = !!v; }

  get textContent(): string { return this._textContent; }
  set textContent(v: string) { this._textContent = v; this.children = []; }

  get className(): string { return Array.from(this.classes).join(' '); }
  set className(v: string) { this.classes = new Set(v.split(/\s+/).filter(Boolean)); }

  get classList() {
    const self = this;
    return {
      add: (c: string) => { self.classes.add(c); },
      remove: (c: string) => { self.classes.delete(c); },
      contains: (c: string) => self.classes.has(c),
      toggle: (c: string, force?: boolean) => {
        const quiere = force === undefined ? !self.classes.has(c) : force;
        if (quiere) self.classes.add(c); else self.classes.delete(c);
        return quiere;
      },
    };
  }

  appendChild(el: FakeElement): FakeElement { el.parent = this; this.children.push(el); return el; }
  removeChild(el: FakeElement): FakeElement { this.children = this.children.filter((c) => c !== el); el.parent = null; return el; }

  focus(): void { this.doc.activeElement = this; }

  /** No-op: alcanza para los scripts que llaman a `elemento.click()` a mano (por ejemplo, el <a> de descarga del CSV). */
  click(): void {}

  addEventListener(type: string, fn: Listener, opciones?: Opciones): void {
    (this.listeners[type] ??= []).push({ fn, capture: esCaptura(opciones) });
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l.fn !== fn);
  }

  /**
   * Dispara el evento: primero la fase de captura (de `document` hacia el
   * objetivo, objetivo incluido), luego la de burbuja (del objetivo hasta
   * `document`), en el mismo orden que ya tenía esta función cuando no hay
   * ningún listener de captura. `stopPropagation()` corta el resto de la
   * propagación, en cualquiera de las dos fases — así un listener de
   * captura en `document` puede interceptar un clic antes de que le llegue
   * a su objetivo (el caso real: el modo Comentar sobre un botón que, sin
   * eso, dispararía su propio manejador).
   */
  dispatch(type: string, init: Record<string, unknown> = {}): void {
    let detenido = false;
    const evt = {
      type, target: this, defaultPrevented: false,
      preventDefault() { evt.defaultPrevented = true; },
      stopPropagation() { detenido = true; },
      ...init,
    };

    const cadena: FakeElement[] = [];
    for (let n: FakeElement | null = this; n; n = n.parent) cadena.push(n);

    for (const fn of (this.doc.listeners[type] ?? []).filter((l) => l.capture).map((l) => l.fn).slice()) {
      fn.call(this.doc, evt);
      if (detenido) return;
    }
    for (const nodo of cadena.slice().reverse()) {
      for (const fn of (nodo.listeners[type] ?? []).filter((l) => l.capture).map((l) => l.fn).slice()) {
        fn.call(nodo, evt);
        if (detenido) return;
      }
    }

    for (const nodo of cadena) {
      for (const fn of (nodo.listeners[type] ?? []).filter((l) => !l.capture).map((l) => l.fn).slice()) {
        fn.call(nodo, evt);
        if (detenido) return;
      }
    }
    for (const fn of (this.doc.listeners[type] ?? []).filter((l) => !l.capture).map((l) => l.fn).slice()) {
      fn.call(this.doc, evt);
      if (detenido) return;
    }
  }

  matches(selector: string): boolean { return matchesSelector(this, selector); }

  closest(selector: string): FakeElement | null {
    let nodo: FakeElement | null = this;
    while (nodo) { if (nodo.matches(selector)) return nodo; nodo = nodo.parent; }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const out: FakeElement[] = [];
    const recorrer = (el: FakeElement) => {
      for (const c of el.children) {
        if (c.matches(selector)) out.push(c);
        recorrer(c);
      }
    };
    recorrer(this);
    return out;
  }
  querySelector(selector: string): FakeElement | null { return this.querySelectorAll(selector)[0] ?? null; }
}

export class FakeDocument {
  documentElement: FakeElement;
  body: FakeElement;
  activeElement: FakeElement | null = null;
  listeners: Record<string, ListenerRegistrado[]> = {};

  constructor() {
    this.documentElement = new FakeElement('html', this);
    this.body = new FakeElement('body', this);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag: string): FakeElement { return new FakeElement(tag, this); }

  getElementById(id: string): FakeElement | null {
    return this.documentElement.querySelectorAll(`[id="${id}"]`)[0] ?? null;
  }
  querySelectorAll(selector: string): FakeElement[] { return this.documentElement.querySelectorAll(selector); }
  querySelector(selector: string): FakeElement | null { return this.documentElement.querySelector(selector); }

  addEventListener(type: string, fn: Listener, opciones?: Opciones): void {
    (this.listeners[type] ??= []).push({ fn, capture: esCaptura(opciones) });
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l.fn !== fn);
  }
}

export class FakeWindow {
  listeners: Record<string, Array<(e: any) => void>> = {};
  matchMedia(_q: string) { return { matches: false }; }
  addEventListener(type: string, fn: (e: any) => void): void { (this.listeners[type] ??= []).push(fn); }
  removeEventListener(type: string, fn: (e: any) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  trigger(type: string): void { for (const fn of (this.listeners[type] ?? []).slice()) fn({ type }); }
  // Deliberadamente sin `IntersectionObserver`: los scripts que lo usan
  // (`SCRIPT_EDITORIAL`) prueban `'IntersectionObserver' in window` y, al no
  // estar, toman su rama de respaldo en vez de necesitar un observer real.
}

/** Construye un `<button role="tab">` + `<div role="tabpanel">` ya enlazados por id/aria-controls. */
export function crearPestana(doc: FakeDocument, tablist: FakeElement, opts: { idTab: string; idPanel: string; seleccionado: boolean }): { tab: FakeElement; panel: FakeElement } {
  const tab = doc.createElement('button');
  tab.setAttribute('role', 'tab');
  tab.setAttribute('id', opts.idTab);
  tab.setAttribute('aria-controls', opts.idPanel);
  tab.setAttribute('aria-selected', String(opts.seleccionado));
  tablist.appendChild(tab);

  const panel = doc.createElement('div');
  panel.setAttribute('role', 'tabpanel');
  panel.setAttribute('id', opts.idPanel);
  doc.body.appendChild(panel);

  return { tab, panel };
}

/** Ejecuta uno de los scripts en línea del documento (SCRIPT_EDITORIAL, SCRIPT_PILARES...) contra un `document`/`window` falsos. */
export function ejecutarScript(script: string, doc: FakeDocument, win: FakeWindow): void {
  // eslint-disable-next-line no-new-func
  const fn = new Function('document', 'window', script);
  fn(doc, win);
}
