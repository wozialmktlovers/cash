import { escapar } from '@/render/escapar';
import type { BarraEtapa, BotonBarra } from '@/flujo/barra-documento';

// Barra de acción de la etapa dentro del documento (vista interna, con
// sesión de admin u operador). Qué dice y qué botones lleva lo decide
// `barraEtapaDocumento` (src/flujo/barra-documento.ts) con las mismas reglas
// que la tarjeta de la ficha; aquí solo se pinta y, en `SCRIPT_BARRA_ETAPA`,
// se manda la acción al mismo endpoint que usa la ficha
// (`POST /api/etapas/:id/transicion`), que vuelve a validar todo.
//
// Nunca llega al enlace público (`/p/...`: sin `flujo`) ni al portal del
// cliente (su `flujo` no trae `barra`, y `envolverDocumento` además la
// descarta si el rol es `cliente`).

const ETIQUETA: Record<BotonBarra['id'], string> = {
  aprobar: 'Autorizar',
  solicitar: 'Solicitar autorización',
  pedir_cambios: 'Pedir cambios',
};

const ICONO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

function boton(b: BotonBarra): string {
  if (b.id === 'pedir_cambios') {
    return `<button type="button" class="panel-boton" data-barra-accion="pedir_cambios" data-requiere="${b.requiereComentario ? 'true' : 'false'}">${ETIQUETA.pedir_cambios}</button>`;
  }
  // `data-por-comentarios`: deshabilitado solo por comentarios abiertos (la
  // excepción de `botonesEtapa`); el script lo habilita si se atienden todos
  // sin recargar. El servidor vuelve a contar al recibir la acción.
  return `<button type="button" class="panel-boton panel-primario" data-barra-accion="${b.id}"${b.disabled ? ` disabled data-por-comentarios aria-describedby="barra-etapa-razon"` : ''}>${ETIQUETA[b.id]}</button>`;
}

/** El HTML de la barra (y sus diálogos). Vacío si no hay barra. */
export function barraEtapa(barra: BarraEtapa | undefined | null): string {
  if (!barra) return '';

  if (barra.tono === 'discreta') {
    return `<p class="barra-etapa barra-etapa-discreta" id="barra-etapa" data-etapa-id="${escapar(barra.etapaId)}">${ICONO_CHECK}<span>${escapar(barra.titulo)}</span></p>`;
  }

  const razon = barra.botones.find((b): b is Extract<BotonBarra, { disabled: boolean }> => b.id !== 'pedir_cambios' && b.disabled)?.razon ?? '';
  const irAlPrimero = barra.comentariosPorAtender > 0
    ? '<button type="button" class="panel-boton" id="btn-barra-primer-comentario">Ir al primero</button>'
    : '';
  const tieneAprobar = barra.botones.some((b) => b.id === 'aprobar');
  const tieneCambios = barra.botones.some((b) => b.id === 'pedir_cambios');

  return `<section class="barra-etapa tono-${barra.tono}" id="barra-etapa" aria-labelledby="barra-etapa-titulo"
    data-etapa-id="${escapar(barra.etapaId)}" data-etapa-nombre="${escapar(barra.etapaNombre)}" data-comentarios="${barra.comentariosPorAtender}">
    <div class="barra-etapa-texto">
      <p class="barra-etapa-eyebrow">${escapar(barra.etapaNombre)}</p>
      <p class="barra-etapa-titulo" id="barra-etapa-titulo">${escapar(barra.titulo)}</p>
      ${barra.detalle ? `<p class="barra-etapa-detalle" id="barra-etapa-detalle">${escapar(barra.detalle)}</p>` : ''}
    </div>
    ${irAlPrimero || barra.botones.length ? `<div class="barra-etapa-acciones">${irAlPrimero}${barra.botones.map(boton).join('')}</div>` : ''}
    ${razon ? `<p class="barra-etapa-razon" id="barra-etapa-razon">${escapar(razon)}</p>` : ''}
    <p class="barra-etapa-estado" id="barra-etapa-estado" role="alert" hidden></p>
  </section>
  ${tieneAprobar ? `<dialog class="dialogo-versiones dialogo-barra" id="dialogo-barra-aprobar" aria-labelledby="dialogo-barra-aprobar-titulo">
    <div class="dialogo-cabecera"><h3 id="dialogo-barra-aprobar-titulo">Autorizar etapa</h3></div>
    <p>¿Autorizar «${escapar(barra.etapaNombre)}»? El cliente podrá verla como lista.</p>
    <p class="barra-etapa-estado" id="dialogo-barra-aprobar-error" role="alert" hidden></p>
    <div class="panel-filas">
      <button type="button" class="panel-boton panel-primario" id="dialogo-barra-aprobar-confirmar">Sí, autorizar</button>
      <button type="button" class="panel-boton" id="dialogo-barra-aprobar-cancelar">Cancelar</button>
    </div>
  </dialog>` : ''}
  ${tieneCambios ? `<dialog class="dialogo-versiones dialogo-barra" id="dialogo-barra-cambios" aria-labelledby="dialogo-barra-cambios-titulo">
    <div class="dialogo-cabecera"><h3 id="dialogo-barra-cambios-titulo">Pedir cambios · ${escapar(barra.etapaNombre)}</h3></div>
    <label class="dialogo-barra-etiqueta" for="dialogo-barra-cambios-texto" id="dialogo-barra-cambios-etiqueta">Comentario</label>
    <textarea id="dialogo-barra-cambios-texto" rows="4" maxlength="2000"></textarea>
    <p class="barra-etapa-estado" id="dialogo-barra-cambios-error" role="alert" hidden></p>
    <div class="panel-filas">
      <button type="button" class="panel-boton panel-primario" id="dialogo-barra-cambios-enviar">Enviar</button>
      <button type="button" class="panel-boton" id="dialogo-barra-cambios-cancelar">Cancelar</button>
    </div>
  </dialog>` : ''}`;
}

/**
 * Las acciones de la barra, en ES5 y en línea (mismo criterio que
 * `SCRIPT_FLUJO`: el documento se sirve tal cual, sin paso de build).
 * «Solicitar autorización» va directo; «Autorizar» confirma en un diálogo y
 * «Pedir cambios» pide el comentario (obligatorio si no hay comentarios
 * abiertos, igual que en la ficha; el servidor manda si llega vacío). Con
 * éxito se recarga ESTE documento —no la ficha—; si el servidor rechaza, se
 * enseña su razón tal cual.
 *
 * El conteo en vivo de comentarios («Ir al primero» y habilitar el botón al
 * atenderlos) vive en `SCRIPT_FLUJO`, que es el que tiene los comentarios.
 */
export const SCRIPT_BARRA_ETAPA = `(function () {
  var barra = document.getElementById('barra-etapa');
  if (!barra) return;
  var etapaId = barra.getAttribute('data-etapa-id');
  if (!etapaId) return;
  var estado = document.getElementById('barra-etapa-estado');

  var dialogoAprobar = document.getElementById('dialogo-barra-aprobar');
  var confirmarAprobar = document.getElementById('dialogo-barra-aprobar-confirmar');
  var cancelarAprobar = document.getElementById('dialogo-barra-aprobar-cancelar');
  var errorAprobar = document.getElementById('dialogo-barra-aprobar-error');

  var dialogoCambios = document.getElementById('dialogo-barra-cambios');
  var textoCambios = document.getElementById('dialogo-barra-cambios-texto');
  var etiquetaCambios = document.getElementById('dialogo-barra-cambios-etiqueta');
  var enviarCambios = document.getElementById('dialogo-barra-cambios-enviar');
  var cancelarCambios = document.getElementById('dialogo-barra-cambios-cancelar');
  var errorCambios = document.getElementById('dialogo-barra-cambios-error');

  var disparador = null;

  // Recarga el documento. Sin el #comentario-… o #primer-comentario con el
  // que se llegó desde un aviso: ya se atendió, y volver a abrir ese hilo
  // tras autorizar confundiría.
  function recargar() {
    var l = window.location;
    if (l.hash && l.replace) l.replace(l.pathname + (l.search || ''));
    else l.reload();
  }

  function mostrar(el, texto) {
    if (!el) return;
    el.textContent = texto;
    el.hidden = !texto;
  }

  function abrir(d) {
    if (!d) return;
    if (d.showModal) d.showModal(); else d.setAttribute('open', 'open');
  }

  function cerrar(d) {
    if (!d) return;
    if (d.close) d.close(); else d.removeAttribute('open');
    if (disparador && disparador.focus) disparador.focus();
  }

  function transicion(accion, comentario, alFallar) {
    var cuerpo = { accion: accion };
    if (comentario !== undefined) cuerpo.comentario = comentario;
    fetch('/api/etapas/' + encodeURIComponent(etapaId) + '/transicion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    }).then(function (res) {
      return res.json();
    }).then(function (b) {
      if (b && b.ok) { recargar(); return; }
      alFallar((b && b.errores && b.errores.length ? b.errores.join(' · ') : 'No se pudo completar la acción.'));
    }).catch(function () {
      alFallar('No se pudo contactar al servidor.');
    });
  }

  function alClicAccion(e) {
    var b = e && e.currentTarget ? e.currentTarget : this;
    if (!b || b.disabled) return;
    var accion = b.getAttribute('data-barra-accion');
    disparador = b;
    mostrar(estado, '');
    if (accion === 'solicitar') {
      b.disabled = true;
      transicion('solicitar', undefined, function (razon) { b.disabled = false; mostrar(estado, razon); });
      return;
    }
    if (accion === 'aprobar') {
      if (!dialogoAprobar) return;
      mostrar(errorAprobar, '');
      if (confirmarAprobar) confirmarAprobar.disabled = false;
      abrir(dialogoAprobar);
      return;
    }
    if (accion === 'pedir_cambios') {
      if (!dialogoCambios) return;
      var requiere = b.getAttribute('data-requiere') === 'true';
      if (etiquetaCambios) etiquetaCambios.textContent = requiere ? 'Comentario (obligatorio)' : 'Comentario (opcional: ya hay comentarios abiertos)';
      if (textoCambios) { textoCambios.value = ''; textoCambios.required = requiere; }
      mostrar(errorCambios, '');
      if (enviarCambios) enviarCambios.disabled = false;
      abrir(dialogoCambios);
      if (textoCambios && textoCambios.focus) textoCambios.focus();
    }
  }

  var botones = barra.querySelectorAll('[data-barra-accion]');
  for (var i = 0; i < botones.length; i++) botones[i].addEventListener('click', alClicAccion);

  if (confirmarAprobar) {
    confirmarAprobar.addEventListener('click', function () {
      confirmarAprobar.disabled = true;
      transicion('aprobar', undefined, function (razon) { confirmarAprobar.disabled = false; mostrar(errorAprobar, razon); });
    });
  }
  if (cancelarAprobar) cancelarAprobar.addEventListener('click', function () { cerrar(dialogoAprobar); });

  if (enviarCambios) {
    enviarCambios.addEventListener('click', function () {
      var texto = textoCambios ? String(textoCambios.value || '').replace(/^\\s+|\\s+$/g, '') : '';
      if (textoCambios && textoCambios.required && !texto) { mostrar(errorCambios, 'Deja al menos un comentario con los cambios'); return; }
      enviarCambios.disabled = true;
      transicion('pedir_cambios', texto, function (razon) { enviarCambios.disabled = false; mostrar(errorCambios, razon); });
    });
  }
  if (cancelarCambios) cancelarCambios.addEventListener('click', function () { cerrar(dialogoCambios); });
})();`;
