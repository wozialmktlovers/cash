import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCRIPT_PILARES } from '@/render/pilares/script';
import { SCRIPT_FLUJO } from '@/render/editorial/flujo-cliente';
import { FakeDocument, FakeWindow, ejecutarScript } from '../helpers/fake-dom';

/**
 * Fix round 1, punto 3: en modo Comentar, un clic sobre CUALQUIER control
 * dentro de un `[data-ancla]` (el botón de estado del banco de pilares, en
 * este caso — el mismo problema existe con la Nota, las pestañas y el resto)
 * no debe disparar su propio manejador, solo abrir el recuadro de
 * comentario. Antes, `SCRIPT_FLUJO` escuchaba el clic en fase de burbuja: el
 * manejador del propio botón (`SCRIPT_PILARES`, registrado directamente
 * sobre él) siempre corría primero.
 *
 * Arma un banco mínimo (como `pilares-script.test.ts`) con una tarjeta que
 * lleva `data-ancla` (el marcado real de `banco.ts` cuando `anclas` es
 * verdadero) y ejecuta los dos scripts de verdad, uno encima del otro,
 * contra el mismo documento falso — igual que en la página real.
 */
function armarPagina() {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  (win as any).location = { hash: '' };

  doc.body.setAttribute('data-flujo', JSON.stringify({
    tipo: 'pilares', id: 'doc1', etapaId: 'etapa1', puedeEditar: false, puedeComentar: true, rol: 'admin', esOperadorAsignado: false,
  }));

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
  filtro('texto'); filtro('pilar'); filtro('subcategoria'); filtro('funcion'); filtro('formato'); filtro('estado');

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

  // La tarjeta real de banco.ts: data-ancla="tema:P1-S1-01" además de los
  // data-* que ya usa SCRIPT_PILARES.
  const tarjeta = doc.createElement('article');
  tarjeta.className = 'tema-tarjeta';
  tarjeta.setAttribute('data-tema', 'P1-S1-01');
  tarjeta.setAttribute('data-pilar', '1');
  tarjeta.setAttribute('data-subcategoria', 'Sub 1');
  tarjeta.setAttribute('data-funcion', 'venta');
  tarjeta.setAttribute('data-formato', 'reel');
  tarjeta.setAttribute('data-estado', 'pendiente');
  tarjeta.setAttribute('data-busqueda', 'un tema');
  tarjeta.setAttribute('data-ancla', 'tema:P1-S1-01');
  bloque1.appendChild(tarjeta);

  const botonEstado = doc.createElement('button');
  botonEstado.className = 'boton-estado';
  botonEstado.setAttribute('data-estado-actual', 'pendiente');
  tarjeta.appendChild(botonEstado);

  const dialogoNota = doc.createElement('dialog');
  dialogoNota.id = 'panel-nota';
  doc.body.appendChild(dialogoNota);
  const notaTitulo = doc.createElement('h3'); notaTitulo.id = 'panel-nota-titulo'; dialogoNota.appendChild(notaTitulo);
  const notaTexto = doc.createElement('textarea'); notaTexto.id = 'panel-nota-texto'; dialogoNota.appendChild(notaTexto);
  const notaEstado = doc.createElement('p'); notaEstado.id = 'panel-nota-estado'; dialogoNota.appendChild(notaEstado);
  const notaGuardar = doc.createElement('button'); notaGuardar.id = 'panel-nota-guardar'; dialogoNota.appendChild(notaGuardar);
  const notaCerrar = doc.createElement('button'); notaCerrar.id = 'panel-nota-cerrar'; dialogoNota.appendChild(notaCerrar);

  // Lo mínimo de SCRIPT_FLUJO para entrar en modo Comentar y abrir el recuadro.
  const btnComentar = doc.createElement('button');
  btnComentar.id = 'btn-flujo-comentar';
  doc.body.appendChild(btnComentar);

  const recuadro = doc.createElement('div');
  recuadro.id = 'recuadro-comentario';
  recuadro.hidden = true;
  doc.body.appendChild(recuadro);
  const recuadroAncla = doc.createElement('p'); recuadroAncla.id = 'recuadro-comentario-ancla'; recuadro.appendChild(recuadroAncla);
  const recuadroTexto = doc.createElement('textarea'); recuadroTexto.id = 'recuadro-comentario-texto'; recuadro.appendChild(recuadroTexto);
  const recuadroEnviar = doc.createElement('button'); recuadroEnviar.id = 'recuadro-comentario-enviar'; recuadro.appendChild(recuadroEnviar);
  const recuadroCancelar = doc.createElement('button'); recuadroCancelar.id = 'recuadro-comentario-cancelar'; recuadro.appendChild(recuadroCancelar);
  const recuadroEstado = doc.createElement('p'); recuadroEstado.id = 'recuadro-comentario-estado'; recuadro.appendChild(recuadroEstado);

  // SCRIPT_PILARES primero (así queda registrado su listener directo sobre
  // el botón, el que SCRIPT_FLUJO tiene que ganarle por fase de captura), y
  // SCRIPT_FLUJO después — el mismo orden en que `envolverDocumento` los
  // inyecta en la página real (SCRIPT_PILARES vía `scriptsExtra`, antes de
  // que `SCRIPT_FLUJO` se agregue al final del body).
  ejecutarScript(SCRIPT_PILARES, doc, win as unknown as Window);
  ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window);

  return { doc, win, tarjeta, botonEstado, btnComentar, recuadro, recuadroAncla };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('modo Comentar vs. controles internos del banco de pilares (fake-dom)', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, comentarios: [] }) }) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('fuera de modo Comentar, el botón de estado sigue funcionando normal (no se rompió el caso de siempre)', async () => {
    const { botonEstado } = armarPagina();
    await flush();

    botonEstado.dispatch('click');

    expect(botonEstado.getAttribute('data-estado-actual')).toBe('en_desarrollo');
  });

  it('en modo Comentar, un clic en el botón de estado NO cicla el estado ni llama a fetch — abre el recuadro', async () => {
    const { botonEstado, btnComentar, recuadro, recuadroAncla } = armarPagina();
    await flush();
    btnComentar.dispatch('click');

    (globalThis.fetch as any).mockClear();
    botonEstado.dispatch('click');

    expect(botonEstado.getAttribute('data-estado-actual')).toBe('pendiente');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(recuadro.hidden).toBe(false);
    expect(recuadroAncla.textContent).toBe('tema:P1-S1-01');
  });

  it('en modo Comentar, un clic en la propia tarjeta (fuera del botón) también abre el recuadro con la misma ancla', async () => {
    const { tarjeta, btnComentar, recuadro, recuadroAncla } = armarPagina();
    await flush();
    btnComentar.dispatch('click');

    tarjeta.dispatch('click');

    expect(recuadro.hidden).toBe(false);
    expect(recuadroAncla.textContent).toBe('tema:P1-S1-01');
  });
});
