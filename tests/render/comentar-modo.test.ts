import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SCRIPT_FLUJO } from '@/render/editorial/flujo-cliente';
import { FakeDocument, FakeWindow, ejecutarScript } from '../helpers/fake-dom';

/**
 * Arma una micro-página con lo que necesita el modo Comentar de SCRIPT_FLUJO
 * (B7, spec §3): un `[data-ancla]`, los botones Comentar/Comentarios/Editar,
 * el recuadro de nuevo comentario y el panel lateral. Mismo patrón que
 * `tests/render/editable.test.ts` para el modo edición (B6).
 */
function armarPagina(o: { puedeComentar?: boolean; puedeEditar?: boolean; rol?: string; esOperadorAsignado?: boolean } = {}) {
  const doc = new FakeDocument();
  const win = new FakeWindow();
  (win as any).confirm = vi.fn(() => true);
  (win as any).location = { reload: vi.fn() };

  doc.body.setAttribute('data-flujo', JSON.stringify({
    tipo: 'research', id: 'doc1', etapaId: 'etapa1',
    puedeEditar: o.puedeEditar ?? false,
    puedeComentar: o.puedeComentar ?? true,
    rol: o.rol ?? 'admin',
    esOperadorAsignado: o.esOperadorAsignado ?? false,
  }));

  const seccion = doc.createElement('section');
  seccion.setAttribute('data-ancla', 'seccion:recomendamos');
  doc.body.appendChild(seccion);

  const tarjeta = doc.createElement('article');
  tarjeta.setAttribute('data-ancla', 'lectura.datos.descubrimos.0');
  tarjeta.textContent = 'Un hallazgo';
  seccion.appendChild(tarjeta);

  const btnEditar = doc.createElement('button');
  btnEditar.id = 'btn-flujo-editar';
  doc.body.appendChild(btnEditar);

  const btnComentar = doc.createElement('button');
  btnComentar.id = 'btn-flujo-comentar';
  doc.body.appendChild(btnComentar);

  const btnComentarios = doc.createElement('button');
  btnComentarios.id = 'btn-flujo-comentarios';
  doc.body.appendChild(btnComentarios);

  const dialogoComentarios = doc.createElement('dialog');
  dialogoComentarios.id = 'dialog-comentarios';
  doc.body.appendChild(dialogoComentarios);

  const cerrarComentariosBtn = doc.createElement('button');
  cerrarComentariosBtn.id = 'dialog-comentarios-cerrar';
  dialogoComentarios.appendChild(cerrarComentariosBtn);

  for (const filtro of ['abierto', 'atendido', 'todos']) {
    const btn = doc.createElement('button');
    btn.setAttribute('data-filtro-comentarios', filtro);
    btn.setAttribute('aria-pressed', filtro === 'abierto' ? 'true' : 'false');
    dialogoComentarios.appendChild(btn);
  }

  const listaComentarios = doc.createElement('div');
  listaComentarios.id = 'comentarios-lista';
  dialogoComentarios.appendChild(listaComentarios);

  const estadoComentarios = doc.createElement('p');
  estadoComentarios.id = 'comentarios-estado';
  dialogoComentarios.appendChild(estadoComentarios);

  const recuadro = doc.createElement('div');
  recuadro.id = 'recuadro-comentario';
  recuadro.hidden = true;
  doc.body.appendChild(recuadro);

  const recuadroAncla = doc.createElement('p');
  recuadroAncla.id = 'recuadro-comentario-ancla';
  recuadro.appendChild(recuadroAncla);

  const recuadroTexto = doc.createElement('textarea');
  recuadroTexto.id = 'recuadro-comentario-texto';
  recuadro.appendChild(recuadroTexto);

  const recuadroEnviar = doc.createElement('button');
  recuadroEnviar.id = 'recuadro-comentario-enviar';
  recuadro.appendChild(recuadroEnviar);

  const recuadroCancelar = doc.createElement('button');
  recuadroCancelar.id = 'recuadro-comentario-cancelar';
  recuadro.appendChild(recuadroCancelar);

  const recuadroEstado = doc.createElement('p');
  recuadroEstado.id = 'recuadro-comentario-estado';
  recuadro.appendChild(recuadroEstado);

  ejecutarScript(SCRIPT_FLUJO, doc, win as unknown as Window);
  return {
    doc, win, seccion, tarjeta, btnEditar, btnComentar, btnComentarios, dialogoComentarios,
    cerrarComentariosBtn, listaComentarios, estadoComentarios,
    recuadro, recuadroAncla, recuadroTexto, recuadroEnviar, recuadroCancelar, recuadroEstado,
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SCRIPT_FLUJO · modo Comentar (fake-dom)', () => {
  let fetchOriginal: typeof fetch;
  beforeEach(() => {
    fetchOriginal = globalThis.fetch;
    // Toda página con `puedeComentar` carga la lista de comentarios (y por lo
    // tanto los marcadores) al entrar, sin esperar a abrir el panel — un
    // fetch por defecto evita que cada prueba tenga que darle cuerda.
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, comentarios: [] }) }) as unknown as typeof fetch;
  });
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  it('Comentar activa el modo (clase en <html> y aria-pressed)', async () => {
    const { doc, btnComentar } = armarPagina();
    await flush();

    btnComentar.dispatch('click');

    expect(doc.documentElement.classList.contains('modo-comentar')).toBe(true);
    expect(btnComentar.getAttribute('aria-pressed')).toBe('true');
  });

  it('sin puedeComentar en data-flujo, Comentar no entra en modo', async () => {
    const { doc, btnComentar } = armarPagina({ puedeComentar: false });
    await flush();

    btnComentar.dispatch('click');

    expect(doc.documentElement.classList.contains('modo-comentar')).toBe(false);
  });

  it('un clic en un [data-ancla] fuera de modo Comentar no abre el recuadro', async () => {
    const { tarjeta, recuadro } = armarPagina();
    await flush();

    tarjeta.dispatch('click');

    expect(recuadro.hidden).toBe(true);
  });

  it('en modo Comentar, un clic en un [data-ancla] abre el recuadro con esa ancla', async () => {
    const { btnComentar, tarjeta, recuadro, recuadroAncla } = armarPagina();
    await flush();
    btnComentar.dispatch('click');

    tarjeta.dispatch('click');

    expect(recuadro.hidden).toBe(false);
    expect(recuadroAncla.textContent).toBe('lectura.datos.descubrimos.0');
  });

  it('en modo Comentar, un clic en el [data-ancla] más específico (la tarjeta) no abre el de la sección que la envuelve', async () => {
    const { btnComentar, tarjeta, recuadroAncla } = armarPagina();
    await flush();
    btnComentar.dispatch('click');

    tarjeta.dispatch('click');

    expect(recuadroAncla.textContent).toBe('lectura.datos.descubrimos.0');
    expect(recuadroAncla.textContent).not.toBe('seccion:recomendamos');
  });

  it('Enviar manda el POST con etapaId, ancla y el texto exacto', async () => {
    const { btnComentar, tarjeta, recuadroTexto, recuadroEnviar, recuadro } = armarPagina();
    await flush();
    btnComentar.dispatch('click');
    tarjeta.dispatch('click');

    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: true, comentario: { id: 'c1' } }) }) as unknown as typeof fetch;
    recuadroTexto.value = 'Falta el precio aquí';
    recuadroEnviar.dispatch('click');
    await flush();

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/comentarios', expect.objectContaining({ method: 'POST' }));
    const cuerpo = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(cuerpo).toEqual({ etapaId: 'etapa1', ancla: 'lectura.datos.descubrimos.0', texto: 'Falta el precio aquí' });
    expect(recuadro.hidden).toBe(true);
  });

  it('Enviar sin texto no manda nada y avisa en el recuadro', async () => {
    const { btnComentar, tarjeta, recuadroEnviar, recuadroEstado } = armarPagina();
    await flush();
    btnComentar.dispatch('click');
    tarjeta.dispatch('click');

    globalThis.fetch = vi.fn();
    recuadroEnviar.dispatch('click');

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(recuadroEstado.textContent).toBe('Escribe el comentario.');
  });

  it('si el POST falla, el error queda en el recuadro y no se cierra', async () => {
    const { btnComentar, tarjeta, recuadroTexto, recuadroEnviar, recuadroEstado, recuadro } = armarPagina();
    await flush();
    btnComentar.dispatch('click');
    tarjeta.dispatch('click');

    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ok: false, errores: ['Esta etapa aún no tiene documento'] }) }) as unknown as typeof fetch;
    recuadroTexto.value = 'x';
    recuadroEnviar.dispatch('click');
    await flush();

    expect(recuadroEstado.textContent).toBe('Esta etapa aún no tiene documento');
    expect(recuadro.hidden).toBe(false);
  });

  it('Cancelar cierra el recuadro sin mandar nada', async () => {
    const { btnComentar, tarjeta, recuadroCancelar, recuadro } = armarPagina();
    await flush();
    btnComentar.dispatch('click');
    tarjeta.dispatch('click');
    expect(recuadro.hidden).toBe(false);

    globalThis.fetch = vi.fn();
    recuadroCancelar.dispatch('click');

    expect(recuadro.hidden).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('Escape con el recuadro abierto lo cierra primero (dueño único de Escape)', async () => {
    const { doc, btnComentar, tarjeta, recuadro } = armarPagina();
    await flush();
    btnComentar.dispatch('click');
    tarjeta.dispatch('click');
    expect(recuadro.hidden).toBe(false);

    tarjeta.dispatch('keydown', { key: 'Escape' });

    expect(recuadro.hidden).toBe(true);
    // El modo Comentar sigue activo: Escape solo cerró el recuadro.
    expect(doc.documentElement.classList.contains('modo-comentar')).toBe(true);
  });

  it('Escape sin nada abierto sale del modo Comentar', async () => {
    const { doc, btnComentar } = armarPagina();
    await flush();
    btnComentar.dispatch('click');

    btnComentar.dispatch('keydown', { key: 'Escape' });

    expect(doc.documentElement.classList.contains('modo-comentar')).toBe(false);
  });

  it('Comentar y Editar son mutuamente excluyentes: entrar a editar deshabilita Comentar', async () => {
    const { btnEditar, btnComentar } = armarPagina({ puedeEditar: true });
    await flush();

    btnEditar.dispatch('click');

    expect((btnComentar as any).disabled).toBe(true);
  });

  it('entrar a Comentar deshabilita Editar', async () => {
    const { btnEditar, btnComentar } = armarPagina({ puedeEditar: true });
    await flush();

    btnComentar.dispatch('click');

    expect((btnEditar as any).disabled).toBe(true);
  });

  it('al cargar, pinta un marcador con el conteo sobre el [data-ancla] con comentarios abiertos', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        comentarios: [
          { id: 'c1', ancla: 'lectura.datos.descubrimos.0', texto: 'x', estado: 'abierto', respuestaDe: null, autorRol: 'cliente', autor: 'Ana', versionNumero: 1, creadoEn: '2026-09-01' },
          { id: 'c2', ancla: 'lectura.datos.descubrimos.0', texto: 'y', estado: 'abierto', respuestaDe: null, autorRol: 'cliente', autor: 'Ana', versionNumero: 1, creadoEn: '2026-09-02' },
          { id: 'c3', ancla: 'lectura.datos.descubrimos.0', texto: 'z (atendido, no cuenta)', estado: 'atendido', respuestaDe: null, autorRol: 'cliente', autor: 'Ana', versionNumero: 1, creadoEn: '2026-09-03' },
        ],
      }),
    }) as unknown as typeof fetch;

    const { tarjeta } = armarPagina();
    await flush();

    const marcador = tarjeta.children.find((c) => c.className === 'marcador-comentario');
    expect(marcador).toBeTruthy();
    expect(marcador!.textContent).toBe('2 comentarios');
  });

  it('Comentarios abre el panel lateral y pinta la lista, con «Ver en el documento» que lleva a la ancla', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        comentarios: [
          { id: 'c1', ancla: 'lectura.datos.descubrimos.0', texto: 'Falta el precio', estado: 'abierto', respuestaDe: null, autorRol: 'cliente', autor: 'Ana', versionNumero: 1, creadoEn: '2026-09-01' },
        ],
      }),
    }) as unknown as typeof fetch;

    const { btnComentarios, dialogoComentarios, listaComentarios } = armarPagina();
    await flush();

    btnComentarios.dispatch('click');
    await flush();

    expect(dialogoComentarios.getAttribute('open')).toBe('open');
    expect(listaComentarios.children.length).toBeGreaterThan(0);
  });
});
