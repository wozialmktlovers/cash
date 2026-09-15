import { escapar } from '@/render/escapar';
import type { TipoDocumento } from '@/flujo/reglas';

/**
 * Lo que necesita `SCRIPT_FLUJO` en el navegador para saber a qué documento
 * hablar, y qué puede hacer quien mira la página. Va en `data-flujo` sobre
 * `<body>`, como JSON escapado como atributo (spec §3, «SCRIPT_FLUJO»).
 * `puedeComentar` viaja ya desde B6 aunque el modo Comentar lo activa B7: la
 * forma del atributo no debería volver a cambiar cuando eso llegue.
 */
export type FlujoDatos = {
  tipo: TipoDocumento;
  id: string;
  etapaId: string;
  puedeEditar: boolean;
  puedeComentar: boolean;
};

/** El atributo `data-flujo` completo (con el espacio delante), listo para pegar dentro de una etiqueta. */
export function atributoFlujo(o: FlujoDatos): string {
  return ` data-flujo="${escapar(JSON.stringify(o))}"`;
}

/**
 * El atributo `data-editable` (con el espacio delante) para un elemento cuyo
 * contenido de texto sale exactamente de `datos[ruta]`. Vacío si `editable`
 * es falso: así los renders pueden pasar el mismo `${rutaEditable(...)}` en
 * la vista pública sin ramificar la plantilla, y esa vista nunca lleva el
 * atributo (spec §3, «Marcado en los renders»).
 */
export function rutaEditable(editable: boolean, ruta: string): string {
  return editable ? ` data-editable="${escapar(ruta)}"` : '';
}

/** Botones Editar y Versiones del panel de la cabecera (o de la barra de operador, en Growth). Vacío si no se puede editar. */
export function botonesFlujo(puedeEditarDocumento: boolean): string {
  if (!puedeEditarDocumento) return '';
  return `<button type="button" class="cabecera-compartir" id="btn-flujo-editar" aria-pressed="false">Editar</button>
    <button type="button" class="cabecera-compartir" id="btn-flujo-versiones" aria-haspopup="dialog" aria-controls="dialog-versiones">Versiones</button>`;
}

/** El `<dialog>` de historial de versiones: lo llena `SCRIPT_FLUJO` con un GET al abrirse. */
export function panelVersiones(): string {
  return `<dialog class="dialogo-versiones" id="dialog-versiones" aria-label="Historial de versiones">
    <div class="dialogo-cabecera"><h3>Versiones</h3><button type="button" class="panel-boton" id="dialog-versiones-cerrar">Cerrar</button></div>
    <div class="dialogo-versiones-lista" id="dialog-versiones-lista" aria-live="polite"></div>
    <p class="panel-estado" id="dialog-versiones-estado" role="status" aria-live="polite"></p>
  </dialog>`;
}

/** Barra fija de abajo del modo edición: «N cambios · Guardar · Descartar». Oculta hasta que se entra en modo edición. */
export function barraEdicion(): string {
  return `<div class="barra-edicion" id="barra-edicion" role="region" aria-label="Modo edición" hidden>
    <span id="barra-edicion-contador">0 cambios</span>
    <span class="barra-edicion-estado" id="barra-edicion-estado" role="status" aria-live="polite"></span>
    <div class="barra-edicion-botones">
      <button type="button" id="btn-descartar-cambios">Descartar</button>
      <button type="button" class="barra-guardar" id="btn-guardar-cambios">Guardar</button>
    </div>
  </div>`;
}

/**
 * Interacción del modo Editar y del panel Versiones, en ES5 y en línea, sin
 * depender de `SCRIPT_EDITORIAL` ni de `SCRIPT_PILARES`: se guarda y se abre
 * suelto en cualquier documento interno (investigación, mapa de pilares,
 * manual de Growth). No hace nada si `<body>` no trae `data-flujo` (vista
 * pública, portal) o si los botones no existen (sin permiso de editar,
 * `botonesFlujo` no los rinde).
 *
 * Modo edición: pone `contenteditable` (`plaintext-only`, con respaldo a
 * `true` si el navegador no lo soporta) en cada `[data-editable]`, guarda su
 * texto original para poder armar el payload de cambios y para «Descartar»,
 * y muestra la barra fija con el contador. Pegar siempre inserta texto
 * plano, tanto si el navegador soporta `plaintext-only` (ya lo garantiza
 * solo) como si no (entonces lo hace el propio handler).
 *
 * Escape (o el botón Editar de nuevo) sale del modo, preguntando primero si
 * hay cambios sin guardar. Guardar manda el PATCH y recarga; un error se
 * avisa en la propia barra, sin salir del modo.
 */
export const SCRIPT_FLUJO = `(function () {
  var crudo = document.body.getAttribute('data-flujo');
  if (!crudo) return;
  var flujo;
  try { flujo = JSON.parse(crudo); } catch (e) { return; }
  if (!flujo || !flujo.tipo || !flujo.id) return;

  var editables = document.querySelectorAll('[data-editable]');
  var enEdicion = false;
  var modoContenteditable = 'true';

  function soportaPlaintextOnly() {
    try {
      var sonda = document.createElement('div');
      sonda.contentEditable = 'plaintext-only';
      return sonda.contentEditable === 'plaintext-only';
    } catch (e) {
      return false;
    }
  }

  function recolectarCambios() {
    var cambios = [];
    for (var i = 0; i < editables.length; i++) {
      var el = editables[i];
      if (el.textContent !== el.__original) {
        cambios.push({ ruta: el.getAttribute('data-editable'), valor: el.textContent });
      }
    }
    return cambios;
  }

  var barra = document.getElementById('barra-edicion');
  var contador = document.getElementById('barra-edicion-contador');
  var estadoBarra = document.getElementById('barra-edicion-estado');
  var btnGuardar = document.getElementById('btn-guardar-cambios');
  var btnDescartar = document.getElementById('btn-descartar-cambios');
  var btnEditar = document.getElementById('btn-flujo-editar');
  var btnVersiones = document.getElementById('btn-flujo-versiones');

  function actualizarContador() {
    if (!contador) return;
    var n = recolectarCambios().length;
    contador.textContent = n + (n === 1 ? ' cambio' : ' cambios');
  }

  function alPegar(e) {
    e.preventDefault();
    var texto = '';
    if (e.clipboardData && e.clipboardData.getData) texto = e.clipboardData.getData('text/plain');
    else if (window.clipboardData && window.clipboardData.getData) texto = window.clipboardData.getData('Text');
    if (document.execCommand) {
      document.execCommand('insertText', false, texto);
    } else if (e.target) {
      e.target.textContent = texto;
    }
  }

  for (var i = 0; i < editables.length; i++) {
    (function (el) {
      el.addEventListener('input', actualizarContador);
      el.addEventListener('paste', alPegar);
    })(editables[i]);
  }

  function entrarEdicion() {
    if (enEdicion || !flujo.puedeEditar) return;
    enEdicion = true;
    modoContenteditable = soportaPlaintextOnly() ? 'plaintext-only' : 'true';
    for (var j = 0; j < editables.length; j++) {
      editables[j].__original = editables[j].textContent;
      editables[j].setAttribute('contenteditable', modoContenteditable);
    }
    document.documentElement.classList.add('modo-edicion');
    if (btnEditar) { btnEditar.setAttribute('aria-pressed', 'true'); btnEditar.textContent = 'Salir de editar'; }
    if (estadoBarra) estadoBarra.textContent = '';
    if (barra) barra.hidden = false;
    actualizarContador();
  }

  function salirEdicion() {
    if (!enEdicion) return;
    enEdicion = false;
    for (var k = 0; k < editables.length; k++) editables[k].removeAttribute('contenteditable');
    document.documentElement.classList.remove('modo-edicion');
    if (btnEditar) { btnEditar.setAttribute('aria-pressed', 'false'); btnEditar.textContent = 'Editar'; }
    if (barra) barra.hidden = true;
  }

  function confirmarSalida() {
    if (recolectarCambios().length === 0) return true;
    return window.confirm('¿Salir sin guardar los cambios?');
  }

  function descartar() {
    for (var m = 0; m < editables.length; m++) editables[m].textContent = editables[m].__original;
    actualizarContador();
    salirEdicion();
  }

  function guardar() {
    var cambios = recolectarCambios();
    if (cambios.length === 0) { salirEdicion(); return; }
    if (btnGuardar) btnGuardar.disabled = true;
    fetch('/api/documentos/' + flujo.tipo + '/' + flujo.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cambios: cambios }),
    }).then(function (res) {
      return res.json().then(function (b) { return { ok: b && b.ok, errores: b && b.errores }; });
    }).then(function (r) {
      if (r.ok) {
        window.location.reload();
      } else {
        if (btnGuardar) btnGuardar.disabled = false;
        if (estadoBarra) estadoBarra.textContent = (r.errores && r.errores[0]) || 'No se pudo guardar.';
      }
    }).catch(function () {
      if (btnGuardar) btnGuardar.disabled = false;
      if (estadoBarra) estadoBarra.textContent = 'Sin conexión.';
    });
  }

  if (btnEditar) {
    btnEditar.addEventListener('click', function () {
      if (enEdicion) { if (confirmarSalida()) salirEdicion(); }
      else entrarEdicion();
    });
  }
  if (btnGuardar) btnGuardar.addEventListener('click', guardar);
  if (btnDescartar) btnDescartar.addEventListener('click', descartar);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && enEdicion) { if (confirmarSalida()) salirEdicion(); }
  });

  // ── Panel de versiones ──────────────────────────────────────────────
  var dialogoVersiones = document.getElementById('dialog-versiones');
  if (dialogoVersiones && btnVersiones) {
    var lista = document.getElementById('dialog-versiones-lista');
    var estadoVersiones = document.getElementById('dialog-versiones-estado');
    var cerrarBtn = document.getElementById('dialog-versiones-cerrar');
    var cargada = false;

    function etiquetaMotivo(m) {
      if (m === 'generado') return 'Generado';
      if (m === 'edicion') return 'Edición';
      if (m === 'aprobada') return 'Aprobada';
      if (m === 'restaurada') return 'Restaurada';
      return m;
    }

    function pintarVersiones(versiones) {
      if (!lista) return;
      lista.textContent = '';
      if (!versiones.length) {
        var vacio = document.createElement('p');
        vacio.className = 'suave';
        vacio.textContent = 'Todavía no hay versiones guardadas.';
        lista.appendChild(vacio);
        return;
      }
      for (var i = 0; i < versiones.length; i++) {
        (function (v) {
          var fila = document.createElement('div');
          fila.className = 'version-fila';

          var info = document.createElement('div');
          info.className = 'version-info';
          var motivo = document.createElement('span');
          motivo.className = 'version-motivo';
          motivo.textContent = 'v' + v.numero + ' · ' + etiquetaMotivo(v.motivo);
          var meta = document.createElement('span');
          meta.className = 'suave';
          meta.textContent = (v.autor || 'Wozial') + ' · ' + String(v.creadoEn).slice(0, 10);
          info.appendChild(motivo);
          info.appendChild(meta);
          fila.appendChild(info);

          if (flujo.puedeEditar) {
            var restaurar = document.createElement('button');
            restaurar.type = 'button';
            restaurar.className = 'panel-boton';
            restaurar.textContent = 'Restaurar';
            restaurar.addEventListener('click', function () {
              if (!window.confirm('¿Restaurar la versión v' + v.numero + '? Se guardan los datos actuales antes de reemplazarlos.')) return;
              restaurar.disabled = true;
              fetch('/api/documentos/' + flujo.tipo + '/' + flujo.id + '/versiones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numero: v.numero }),
              }).then(function (res) {
                return res.json().then(function (b) { return { ok: b && b.ok, errores: b && b.errores }; });
              }).then(function (r) {
                if (r.ok) {
                  window.location.reload();
                } else {
                  restaurar.disabled = false;
                  if (estadoVersiones) estadoVersiones.textContent = (r.errores && r.errores[0]) || 'No se pudo restaurar.';
                }
              }).catch(function () {
                restaurar.disabled = false;
                if (estadoVersiones) estadoVersiones.textContent = 'Sin conexión.';
              });
            });
            fila.appendChild(restaurar);
          }

          lista.appendChild(fila);
        })(versiones[i]);
      }
    }

    function cargarVersiones() {
      if (lista) lista.textContent = 'Cargando…';
      fetch('/api/documentos/' + flujo.tipo + '/' + flujo.id + '/versiones')
        .then(function (res) { return res.json(); })
        .then(function (b) {
          if (b && b.ok) { pintarVersiones(b.versiones); cargada = true; }
          else if (lista) { lista.textContent = ''; if (estadoVersiones) estadoVersiones.textContent = 'No se pudo cargar el historial.'; }
        })
        .catch(function () {
          if (lista) lista.textContent = '';
          if (estadoVersiones) estadoVersiones.textContent = 'Sin conexión.';
        });
    }

    function abrirVersiones() {
      if (estadoVersiones) estadoVersiones.textContent = '';
      if (dialogoVersiones.showModal) dialogoVersiones.showModal(); else dialogoVersiones.setAttribute('open', 'open');
      cargarVersiones();
    }
    function cerrarVersiones() {
      if (dialogoVersiones.close) dialogoVersiones.close(); else dialogoVersiones.removeAttribute('open');
    }

    btnVersiones.addEventListener('click', abrirVersiones);
    if (cerrarBtn) cerrarBtn.addEventListener('click', cerrarVersiones);
    dialogoVersiones.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarVersiones(); });
    void cargada;
  }
})();`;
