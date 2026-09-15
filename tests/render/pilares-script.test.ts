import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCRIPT_PILARES } from '@/render/pilares/script';
import { FakeDocument, FakeWindow, ejecutarScript } from '../helpers/fake-dom';

/**
 * Ejecuta SCRIPT_PILARES de verdad (sin jsdom, ver fake-dom.ts) contra un
 * banco mínimo: dos tarjetas de tema, los filtros que el script toca y el
 * panel de nota. Solo lo que el script necesita — no es el marcado completo
 * de `banco.ts`, pero usa las mismas clases/atributos `data-*`.
 */
function construirBanco(doc: FakeDocument) {
  const banco = doc.createElement('div');
  banco.id = 'banco';
  banco.setAttribute('data-result-id', 'r1');
  doc.body.appendChild(banco);

  const filtro = (nombre: string) => {
    const el = doc.createElement('select');
    el.setAttribute('data-filtro', nombre);
    banco.appendChild(el);
    return el;
  };
  const filtroTexto = filtro('texto');
  const filtroPilar = filtro('pilar');
  filtro('subcategoria');
  filtro('funcion');
  filtro('formato');
  const filtroEstado = filtro('estado');

  const contador = doc.createElement('output');
  contador.setAttribute('data-contador', '');
  banco.appendChild(contador);

  const bloques = doc.createElement('div');
  bloques.className = 'pilares-bloques';
  banco.appendChild(bloques);

  const bloque1 = doc.createElement('details');
  bloque1.className = 'pilar-bloque';
  bloque1.setAttribute('data-pilar', '1');
  bloques.appendChild(bloque1);

  function crearTarjeta(opts: { id: string; pilar: string; estado: string; texto: string; nota?: string }) {
    const tarjeta = doc.createElement('article');
    tarjeta.className = 'tema-tarjeta';
    tarjeta.setAttribute('data-tema', opts.id);
    tarjeta.setAttribute('data-pilar', opts.pilar);
    tarjeta.setAttribute('data-subcategoria', 'Sub 1');
    tarjeta.setAttribute('data-funcion', 'venta');
    tarjeta.setAttribute('data-formato', 'reel');
    tarjeta.setAttribute('data-estado', opts.estado);
    tarjeta.setAttribute('data-busqueda', opts.texto.toLowerCase());
    bloque1.appendChild(tarjeta);

    const textoEl = doc.createElement('p');
    textoEl.className = 'tema-texto';
    textoEl.textContent = opts.texto;
    tarjeta.appendChild(textoEl);

    const checkboxElegir = doc.createElement('input');
    checkboxElegir.className = 'tema-elegir';
    checkboxElegir.checked = opts.estado !== 'pendiente';
    tarjeta.appendChild(checkboxElegir);

    const botonEstado = doc.createElement('button');
    botonEstado.className = 'boton-estado';
    botonEstado.setAttribute('data-estado-actual', opts.estado);
    tarjeta.appendChild(botonEstado);

    const botonNota = doc.createElement('button');
    botonNota.className = 'boton-nota';
    botonNota.setAttribute('data-nota', opts.nota ?? '');
    botonNota.setAttribute('data-tema-titulo', opts.texto);
    tarjeta.appendChild(botonNota);

    return { tarjeta, checkboxElegir, botonEstado, botonNota, textoEl };
  }

  const dialogoNota = doc.createElement('dialog');
  dialogoNota.id = 'panel-nota';
  doc.body.appendChild(dialogoNota);
  const notaTitulo = doc.createElement('h3'); notaTitulo.id = 'panel-nota-titulo'; dialogoNota.appendChild(notaTitulo);
  const notaTexto = doc.createElement('textarea'); notaTexto.id = 'panel-nota-texto'; dialogoNota.appendChild(notaTexto);
  const notaEstado = doc.createElement('p'); notaEstado.id = 'panel-nota-estado'; dialogoNota.appendChild(notaEstado);
  const notaGuardar = doc.createElement('button'); notaGuardar.id = 'panel-nota-guardar'; dialogoNota.appendChild(notaGuardar);
  const notaCerrar = doc.createElement('button'); notaCerrar.id = 'panel-nota-cerrar'; dialogoNota.appendChild(notaCerrar);

  const botonCsv = doc.createElement('button');
  botonCsv.setAttribute('data-accion', 'csv');
  banco.appendChild(botonCsv);

  return { banco, filtroTexto, filtroPilar, filtroEstado, contador, crearTarjeta, botonCsv, notaTexto, notaGuardar, notaEstado };
}

// Espera a que las promesas encadenadas por `guardarCambio` (fetch → json → callback) terminen.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SCRIPT_PILARES · comportamiento real (fake-dom)', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => { fetchOriginal = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('el CSV exporta el nombre legible de la subcategoría (data-subcategoria-nombre), no el índice estable (item 2)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { tarjeta } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });
    // 'construirBanco' pone 'data-subcategoria' con el índice estable, como
    // lo hace ahora 'banco.ts'; el nombre legible vive aparte.
    tarjeta.setAttribute('data-subcategoria', 'p1-s1');
    tarjeta.setAttribute('data-subcategoria-nombre', 'Reels de producto');

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    let capturado: Blob | null = null;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    (URL as any).createObjectURL = (b: Blob) => { capturado = b; return 'blob:mock'; };
    (URL as any).revokeObjectURL = () => {};
    try {
      dom.botonCsv.dispatch('click');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    const csv = await (capturado as unknown as Blob).text();
    expect(csv).toContain('Reels de producto');
    expect(csv).not.toContain('p1-s1');
  });

  it('editar el texto de un tema actualiza data-busqueda de inmediato, sin esperar a guardar (item 2)', () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { tarjeta, textoEl } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Texto original' });
    tarjeta.setAttribute('data-subcategoria-nombre', 'Sub 1');

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    expect(tarjeta.getAttribute('data-busqueda')).not.toContain('palabra nueva insertada');

    textoEl.textContent = 'Palabra nueva insertada';
    textoEl.dispatch('input');

    expect(tarjeta.getAttribute('data-busqueda')).toContain('palabra nueva insertada');
  });

  it('protege contra fórmulas también cuando la celda empieza con tab o retorno de carro (item 5)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const t1 = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: '\tPeligro', nota: '\rInyeccion' });
    dom.crearTarjeta({ id: 'P1-S1-02', pilar: '1', estado: 'pendiente', texto: 'Tema normal', nota: '' });
    void t1;

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    let capturado: Blob | null = null;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    (URL as any).createObjectURL = (b: Blob) => { capturado = b; return 'blob:mock'; };
    (URL as any).revokeObjectURL = () => {};
    try {
      dom.botonCsv.dispatch('click');
    } finally {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }

    expect(capturado).not.toBeNull();
    const csv = await (capturado as unknown as Blob).text();
    const filas = csv.split('\r\n');
    // El tema con tab al inicio y la nota con retorno de carro al inicio
    // deben quedar con comilla de escape delante, igual que =, + y -.
    expect(filas[1]).toContain(`"'\tPeligro"`);
    expect(filas[1]).toContain(`"'\rInyeccion"`);
    // Una celda normal no debe llevar comilla de escape.
    expect(filas[2]).toContain('"Tema normal"');
    expect(filas[2]).not.toContain(`"'Tema normal"`);
  });

  it('al guardar una nota, data-nota queda con el texto recortado (item 6a)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { botonNota } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, estado: 'pendiente', nota: 'Hola con espacios', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' }),
    }) as unknown as typeof fetch;

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    botonNota.dispatch('click');
    dom.notaTexto.value = '  Hola con espacios  ';
    dom.notaGuardar.dispatch('click');
    await flush();

    expect(botonNota.getAttribute('data-nota')).toBe('Hola con espacios');
    expect(botonNota.classList.contains('con-nota')).toBe(true);
    expect(dom.notaEstado.textContent).toBe('Guardada.');
  });

  it('una nota que queda vacía tras recortar espacios no marca con-nota (item 6a)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { botonNota } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno', nota: 'Antes' });
    botonNota.classList.add('con-nota');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, estado: 'pendiente', nota: null, actualizadoPor: null, actualizadoEn: '2026-09-15T10:00:00Z' }),
    }) as unknown as typeof fetch;

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    botonNota.dispatch('click');
    dom.notaTexto.value = '   ';
    dom.notaGuardar.dispatch('click');
    await flush();

    expect(botonNota.getAttribute('data-nota')).toBe('');
    expect(botonNota.classList.contains('con-nota')).toBe(false);
  });

  it('cambiar el estado de una tarjeta la esconde de inmediato si deja de calzar con el filtro de estado activo (item 6b)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { tarjeta, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, estado: 'en_desarrollo', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' }),
    }) as unknown as typeof fetch;

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    // Filtra por "pendiente": la única tarjeta hace match y se cuenta.
    dom.filtroEstado.value = 'pendiente';
    dom.filtroEstado.dispatch('change');
    expect(tarjeta.hidden).toBe(false);
    expect(dom.contador.textContent).toBe('Mostrando 1 de 1');

    // Ciclo de estado: pendiente → en_desarrollo. Ya no calza con el filtro
    // "pendiente" y debe esconderse de inmediato, sin esperar a que
    // conteste el PATCH ni a que se vuelva a tocar el filtro a mano.
    botonEstado.dispatch('click');
    expect(tarjeta.hidden).toBe(true);
    expect(dom.contador.textContent).toBe('Mostrando 0 de 1');

    await flush();
    expect(tarjeta.hidden).toBe(true);
  });

  it('si el PATCH del estado falla, se revierte y el filtro se vuelve a aplicar sobre el estado anterior (item 6b)', async () => {
    const doc = new FakeDocument();
    const win = new FakeWindow();
    const dom = construirBanco(doc);
    const { tarjeta, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

    dom.filtroEstado.value = 'pendiente';
    dom.filtroEstado.dispatch('change');

    botonEstado.dispatch('click');
    expect(tarjeta.hidden).toBe(true); // optimista: ya no es "pendiente"

    await flush();
    // El PATCH falló: el estado vuelve a "pendiente" y la tarjeta reaparece.
    expect(tarjeta.getAttribute('data-estado')).toBe('pendiente');
    expect(tarjeta.hidden).toBe(false);
    expect(dom.contador.textContent).toBe('Mostrando 1 de 1');
  });

  // B6, ronda de arreglos 1, punto 2: la tarjeta de pilar (sección 03) es
  // 'role="button"' y navega al banco con clic/Enter/Espacio; su nombre y
  // pregunta llevan `data-editable` (B6). En modo edición, un clic para
  // poner el cursor o el espacio al teclear una palabra no debe saltar al
  // banco.
  describe('tarjeta de pilar [data-ir-pilar] vs. modo edición', () => {
    function construirTarjetaPilar(doc: FakeDocument) {
      const tarjeta = doc.createElement('article');
      tarjeta.setAttribute('data-ir-pilar', '2');
      tarjeta.setAttribute('role', 'button');
      tarjeta.setAttribute('tabindex', '0');
      doc.body.appendChild(tarjeta);
      return tarjeta;
    }

    it('con <html class="modo-edicion">, un clic en la tarjeta no filtra el banco', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      (dom.banco as any).scrollIntoView = () => {};
      const tarjeta = construirTarjetaPilar(doc);
      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      doc.documentElement.classList.add('modo-edicion');
      tarjeta.dispatch('click');
      expect(dom.filtroPilar.value).toBe('');

      doc.documentElement.classList.remove('modo-edicion');
      tarjeta.dispatch('click');
      expect(dom.filtroPilar.value).toBe('2');
    });

    it('con el target contenteditable, Enter/Espacio en la tarjeta tampoco navegan', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      (dom.banco as any).scrollIntoView = () => {};
      const tarjeta = construirTarjetaPilar(doc);
      const nombre = doc.createElement('h3');
      (nombre as any).isContentEditable = true;
      tarjeta.appendChild(nombre);
      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      nombre.dispatch('keydown', { key: ' ' });
      expect(dom.filtroPilar.value).toBe('');

      tarjeta.dispatch('keydown', { key: 'Enter' });
      expect(dom.filtroPilar.value).toBe('2');
    });
  });

  // Pedido: «en el banco de temas, los tópicos se puedan elegir y tachar»
  // (Casilla + tachado). La casilla y el botón de estado comparten el mismo
  // flujo de PATCH (cambiarEstadoTema/guardarCambio) y se mantienen
  // sincronizados en los dos sentidos.
  describe('casilla «Elegir tema»', () => {
    it('marcarla desde pendiente hace PATCH a en_desarrollo y sincroniza el botón', async () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      const { tarjeta, checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

      let cuerpoEnviado: unknown = null;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        cuerpoEnviado = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, estado: 'en_desarrollo', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' }),
        });
      }) as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      checkboxElegir.checked = true;
      checkboxElegir.dispatch('change');

      // Optimista: la tarjeta, el botón y la casilla ya reflejan el cambio
      // antes de que conteste el PATCH.
      expect(tarjeta.getAttribute('data-estado')).toBe('en_desarrollo');
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('en_desarrollo');
      expect(botonEstado.textContent).toBe('En desarrollo');
      expect(tarjeta.classList.contains('tema-elegido')).toBe(true);
      expect(checkboxElegir.checked).toBe(true);

      expect(cuerpoEnviado).toEqual({ estado: 'en_desarrollo' });
      await flush();
      expect(checkboxElegir.checked).toBe(true);
    });

    it('el botón de estado también sincroniza la casilla al avanzar (pendiente → en_desarrollo)', async () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      const { checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, estado: 'en_desarrollo', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' }),
      }) as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      expect(checkboxElegir.checked).toBe(false);
      botonEstado.dispatch('click');
      expect(checkboxElegir.checked).toBe(true);
      await flush();
      expect(checkboxElegir.checked).toBe(true);
    });

    it('desmarcarla desde publicado pregunta con confirm; si se acepta, hace PATCH a pendiente', async () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      (win as any).confirm = vi.fn(() => true);
      const dom = construirBanco(doc);
      const { tarjeta, checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'publicado', texto: 'Uno' });

      let cuerpoEnviado: unknown = null;
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: any) => {
        cuerpoEnviado = JSON.parse(init.body);
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, estado: 'pendiente', actualizadoPor: 'eq@wozial.mx', actualizadoEn: '2026-09-15T10:00:00Z' }),
        });
      }) as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      checkboxElegir.checked = false;
      checkboxElegir.dispatch('change');

      expect((win as any).confirm).toHaveBeenCalledWith('¿Regresar este tema a pendiente?');
      expect(tarjeta.getAttribute('data-estado')).toBe('pendiente');
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
      expect(tarjeta.classList.contains('tema-tachado')).toBe(false);
      expect(cuerpoEnviado).toEqual({ estado: 'pendiente' });
      await flush();
    });

    it('desmarcarla desde desarrollado y rechazar el confirm no hace PATCH y vuelve a marcarla', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      (win as any).confirm = vi.fn(() => false);
      const dom = construirBanco(doc);
      const { tarjeta, checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'desarrollado', texto: 'Uno' });

      globalThis.fetch = vi.fn() as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      checkboxElegir.checked = false;
      checkboxElegir.dispatch('change');

      expect((win as any).confirm).toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(checkboxElegir.checked).toBe(true);
      expect(tarjeta.getAttribute('data-estado')).toBe('desarrollado');
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('desarrollado');
    });

    it('desmarcarla desde en_desarrollo no pregunta nada y hace PATCH directo a pendiente', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      (win as any).confirm = vi.fn(() => true);
      const dom = construirBanco(doc);
      const { checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'en_desarrollo', texto: 'Uno' });

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, estado: 'pendiente', actualizadoPor: null, actualizadoEn: '2026-09-15T10:00:00Z' }),
      }) as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      checkboxElegir.checked = false;
      checkboxElegir.dispatch('change');

      expect((win as any).confirm).not.toHaveBeenCalled();
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
    });

    it('si el PATCH de la casilla falla, se revierte tanto la casilla como el botón', async () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      const { tarjeta, checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      checkboxElegir.checked = true;
      checkboxElegir.dispatch('change');
      expect(checkboxElegir.checked).toBe(true); // optimista
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('en_desarrollo');

      await flush();

      expect(checkboxElegir.checked).toBe(false);
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
      expect(botonEstado.textContent).toBe('Pendiente');
      expect(tarjeta.getAttribute('data-estado')).toBe('pendiente');
      expect(tarjeta.classList.contains('tema-elegido')).toBe(false);
    });

    it('no alterna en modo edición: el cambio se revierte y no hay PATCH', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      const { checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

      globalThis.fetch = vi.fn() as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      doc.documentElement.classList.add('modo-edicion');
      checkboxElegir.checked = true;
      checkboxElegir.dispatch('change');

      expect(checkboxElegir.checked).toBe(false);
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('no alterna en modo comentar: el cambio se revierte y no hay PATCH', () => {
      const doc = new FakeDocument();
      const win = new FakeWindow();
      const dom = construirBanco(doc);
      const { checkboxElegir, botonEstado } = dom.crearTarjeta({ id: 'P1-S1-01', pilar: '1', estado: 'pendiente', texto: 'Uno' });

      globalThis.fetch = vi.fn() as unknown as typeof fetch;

      ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);

      doc.documentElement.classList.add('modo-comentar');
      checkboxElegir.checked = true;
      checkboxElegir.dispatch('change');

      expect(checkboxElegir.checked).toBe(false);
      expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });
});
