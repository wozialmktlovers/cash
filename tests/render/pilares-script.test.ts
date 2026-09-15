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

    const botonEstado = doc.createElement('button');
    botonEstado.className = 'boton-estado';
    botonEstado.setAttribute('data-estado-actual', opts.estado);
    tarjeta.appendChild(botonEstado);

    const botonNota = doc.createElement('button');
    botonNota.className = 'boton-nota';
    botonNota.setAttribute('data-nota', opts.nota ?? '');
    botonNota.setAttribute('data-tema-titulo', opts.texto);
    tarjeta.appendChild(botonNota);

    return { tarjeta, botonEstado, botonNota, textoEl };
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
});
