import { escapar } from '@/render/escapar';
import type { TipoDocumento, Rol } from '@/flujo/reglas';

/**
 * Lo que necesita `SCRIPT_FLUJO` en el navegador para saber a qué documento
 * hablar, y qué puede hacer quien mira la página. Va en `data-flujo` sobre
 * `<body>`, como JSON escapado como atributo (spec §3, «SCRIPT_FLUJO»).
 * `rol` y `esOperadorAsignado` viajan para que el panel de comentarios (B7)
 * calcule en el cliente qué botones mostrar (Responder, Marcar atendido,
 * Descartar) con `puedeCambiarEstadoComentario`, sin depender de datos por
 * comentario — el servidor sigue siendo quien de verdad autoriza cada acción.
 */
export type FlujoDatos = {
  tipo: TipoDocumento;
  id: string;
  etapaId: string;
  puedeEditar: boolean;
  puedeComentar: boolean;
  rol: Rol;
  esOperadorAsignado: boolean;
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

/**
 * El atributo `data-ancla` (con el espacio delante) sobre una sección, una
 * tarjeta o un tema del banco de pilares (spec §3, «Anclas»): secciones
 * `seccion:<id>`, tarjetas la ruta del objeto, temas `tema:<id>`. Vacío si
 * `anclas` es falso — la vista pública (`/p/...`) nunca la recibe (ruling
 * del controlador B7: `anclas` es una opción aparte de `editable`, porque el
 * personal siempre puede comentar aunque no pueda editar en ese momento).
 */
export function rutaAncla(anclas: boolean, ancla: string): string {
  return anclas ? ` data-ancla="${escapar(ancla)}"` : '';
}

/**
 * Botones del panel de la cabecera (o de la barra de operador, en Growth):
 * Editar + Versiones si se puede editar; Comentar (modo anclado) +
 * Comentarios (panel lateral) si se puede comentar. Los dos pares son
 * independientes entre sí — puede haber solo edición, solo comentarios, o
 * ambos, según `puedeEditar`/`puedeComentar` de la etapa (B6/B7).
 */
export function botonesFlujo(puedeEditarDocumento: boolean, puedeComentarDocumento = false): string {
  const editar = puedeEditarDocumento
    ? `<button type="button" class="cabecera-compartir" id="btn-flujo-editar" aria-pressed="false">Editar</button>
    <button type="button" class="cabecera-compartir" id="btn-flujo-versiones" aria-haspopup="dialog" aria-controls="dialog-versiones">Versiones</button>`
    : '';
  const comentar = puedeComentarDocumento
    ? `<button type="button" class="cabecera-compartir" id="btn-flujo-comentar" aria-pressed="false">Comentar</button>
    <button type="button" class="cabecera-compartir" id="btn-flujo-comentarios" aria-haspopup="dialog" aria-controls="dialog-comentarios">Comentarios</button>`
    : '';
  return `${editar}${comentar}`;
}

/** El `<dialog>` de historial de versiones: lo llena `SCRIPT_FLUJO` con un GET al abrirse. */
export function panelVersiones(): string {
  return `<dialog class="dialogo-versiones" id="dialog-versiones" aria-label="Historial de versiones">
    <div class="dialogo-cabecera"><h3>Versiones</h3><button type="button" class="panel-boton" id="dialog-versiones-cerrar">Cerrar</button></div>
    <div class="dialogo-versiones-lista" id="dialog-versiones-lista" aria-live="polite"></div>
    <p class="panel-estado" id="dialog-versiones-estado" role="status" aria-live="polite"></p>
  </dialog>`;
}

/**
 * El panel lateral de comentarios (spec §3, «panel lateral de comentarios»):
 * un `<dialog>` con el filtro Abiertos/Atendidos/Todos y la lista, que llena
 * `SCRIPT_FLUJO` con un GET al abrirse (y tras cada acción). Junto a él, el
 * recuadro flotante de «nuevo comentario» que abre un clic sobre `[data-ancla]`
 * en modo Comentar: vive fuera del `<dialog>` a propósito, porque se abre
 * sobre el propio documento, no dentro del panel.
 */
export function panelComentarios(): string {
  return `<dialog class="dialogo-comentarios" id="dialog-comentarios" aria-label="Comentarios">
    <div class="dialogo-cabecera"><h3>Comentarios</h3><button type="button" class="panel-boton" id="dialog-comentarios-cerrar">Cerrar</button></div>
    <div class="comentarios-filtros" role="radiogroup" aria-label="Filtrar comentarios">
      <button type="button" class="filtro-comentarios" data-filtro-comentarios="abierto" aria-pressed="true">Abiertos</button>
      <button type="button" class="filtro-comentarios" data-filtro-comentarios="resueltos" aria-pressed="false">Resueltos</button>
      <button type="button" class="filtro-comentarios" data-filtro-comentarios="todos" aria-pressed="false">Todos</button>
    </div>
    <div class="comentarios-lista" id="comentarios-lista" aria-live="polite"></div>
    <p class="panel-estado" id="comentarios-estado" role="status" aria-live="polite"></p>
  </dialog>
  <div class="recuadro-comentario" id="recuadro-comentario" role="dialog" aria-label="Nuevo comentario" hidden>
    <p class="recuadro-comentario-ancla" id="recuadro-comentario-ancla"></p>
    <textarea id="recuadro-comentario-texto" maxlength="2000" aria-label="Escribe tu comentario"></textarea>
    <div class="panel-filas">
      <button type="button" class="panel-boton" id="recuadro-comentario-cancelar">Cancelar</button>
      <button type="button" class="panel-boton panel-primario" id="recuadro-comentario-enviar">Enviar</button>
    </div>
    <p class="panel-estado" id="recuadro-comentario-estado" role="status" aria-live="polite"></p>
  </div>`;
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
 * hay cambios sin guardar; si se confirma (o no había ninguno), la salida
 * pasa siempre por `descartar()`: además de salir, deja cada `[data-editable]`
 * con su texto original, para no dejar en pantalla un cambio a medio hacer
 * que nadie guardó. Si el diálogo de versiones está abierto, Escape lo cierra
 * a él y no toca el modo edición (un solo dueño de la tecla). Guardar manda
 * el PATCH y recarga; un error se avisa en la propia barra, sin salir del
 * modo. Dentro de un `[data-editable]`, Enter nunca mete un salto de línea.
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
  var dialogoAbierto = false;

  var barra = document.getElementById('barra-edicion');
  var contador = document.getElementById('barra-edicion-contador');
  var estadoBarra = document.getElementById('barra-edicion-estado');
  var btnGuardar = document.getElementById('btn-guardar-cambios');
  var btnDescartar = document.getElementById('btn-descartar-cambios');
  var btnEditar = document.getElementById('btn-flujo-editar');
  var btnVersiones = document.getElementById('btn-flujo-versiones');
  var dialogoVersiones = document.getElementById('dialog-versiones');
  var lista = document.getElementById('dialog-versiones-lista');
  var estadoVersiones = document.getElementById('dialog-versiones-estado');
  var cerrarBtn = document.getElementById('dialog-versiones-cerrar');

  // Modo Comentar (B7, spec §3): mutuamente excluyente con el modo edición.
  var anclas = document.querySelectorAll('[data-ancla]');
  var enComentar = false;
  var comentariosCache = [];
  var anclaActual = null;
  var filtroComentarios = 'abierto';
  var dialogoComentariosAbierto = false;
  var recuadroAbierto = false;

  var btnComentar = document.getElementById('btn-flujo-comentar');
  var btnComentarios = document.getElementById('btn-flujo-comentarios');
  var dialogoComentarios = document.getElementById('dialog-comentarios');
  var listaComentarios = document.getElementById('comentarios-lista');
  var estadoComentarios = document.getElementById('comentarios-estado');
  var cerrarComentariosBtn = document.getElementById('dialog-comentarios-cerrar');
  var filtrosComentarios = document.querySelectorAll('[data-filtro-comentarios]');
  var recuadro = document.getElementById('recuadro-comentario');
  var recuadroAncla = document.getElementById('recuadro-comentario-ancla');
  var recuadroTexto = document.getElementById('recuadro-comentario-texto');
  var recuadroEnviar = document.getElementById('recuadro-comentario-enviar');
  var recuadroCancelar = document.getElementById('recuadro-comentario-cancelar');
  var recuadroEstado = document.getElementById('recuadro-comentario-estado');

  // Todas las funciones se declaran aquí arriba, fuera de cualquier bloque
  // 'if': una function declaration dentro de un bloque no es válida en ES5
  // estricto (varía de motor a motor). Los 'if' de abajo solo deciden si se
  // ENGANCHAN los listeners, nunca si la función existe.

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

  // Un campo editable es el texto de una tarjeta, no un editor de párrafos:
  // Enter nunca mete un salto de línea.
  function alTecleoEditable(e) {
    if (e.key === 'Enter') e.preventDefault();
  }

  for (var i = 0; i < editables.length; i++) {
    (function (el) {
      el.addEventListener('input', actualizarContador);
      el.addEventListener('paste', alPegar);
      el.addEventListener('keydown', alTecleoEditable);
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
    if (btnComentar) btnComentar.disabled = true;
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
    if (btnComentar) btnComentar.disabled = false;
    if (barra) barra.hidden = true;
  }

  function confirmarSalida() {
    if (recolectarCambios().length === 0) return true;
    return window.confirm('¿Salir sin guardar los cambios?');
  }

  // Deshace los cambios en pantalla (vuelve cada [data-editable] a su texto
  // original) y sale del modo. Tanto «Descartar» como una salida confirmada
  // por «Editar»/Escape pasan por aquí: salir sin guardar nunca debe dejar
  // el texto editado a medias en la página (fantasma que confunde a quien
  // vuelva a entrar en modo edición, porque '__original' ya no es el que se
  // ve).
  function descartar() {
    for (var m = 0; m < editables.length; m++) editables[m].textContent = editables[m].__original;
    actualizarContador();
    salirEdicion();
  }

  function salirConfirmando() {
    if (!confirmarSalida()) return;
    descartar();
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
        if (b && b.ok) { pintarVersiones(b.versiones); }
        else if (lista) { lista.textContent = ''; if (estadoVersiones) estadoVersiones.textContent = 'No se pudo cargar el historial.'; }
      })
      .catch(function () {
        if (lista) lista.textContent = '';
        if (estadoVersiones) estadoVersiones.textContent = 'Sin conexión.';
      });
  }

  function abrirVersiones() {
    dialogoAbierto = true;
    if (estadoVersiones) estadoVersiones.textContent = '';
    if (dialogoVersiones.showModal) dialogoVersiones.showModal(); else dialogoVersiones.setAttribute('open', 'open');
    cargarVersiones();
  }

  function cerrarVersiones() {
    dialogoAbierto = false;
    if (dialogoVersiones.close) dialogoVersiones.close(); else dialogoVersiones.removeAttribute('open');
  }

  // ── Modo Comentar (B7, spec §3 «Comentarios anclados») ──────────────────
  // Mutuamente excluyente con el modo edición (los botones se deshabilitan
  // entre sí, arriba en entrarEdicion/salirEdicion y aquí abajo). Todas las
  // funciones, igual que las de edición, se declaran fuera de cualquier
  // bloque 'if'.

  function elementosDeAncla(ancla) {
    // Comparación literal del atributo, sin CSS.escape: el valor puede traer
    // '.' o ':' (rutas y 'seccion:x'), que son válidos dentro de un string
    // entre comillas en un selector de atributo, pero más simple y a prueba
    // de motores viejos es recorrer la lista ya capturada al cargar.
    var out = [];
    for (var i = 0; i < anclas.length; i++) {
      if (anclas[i].getAttribute('data-ancla') === ancla) out.push(anclas[i]);
    }
    return out;
  }

  function limpiarMarcadores() {
    var marcadores = document.querySelectorAll('.marcador-comentario');
    for (var i = 0; i < marcadores.length; i++) {
      // Deshace exactamente lo que puso pintarMarcadores: el marcador Y la
      // clase que le dio 'position:relative' a su contenedor (fix round 1,
      // punto 7 — ese 'position:relative' ya no es incondicional sobre TODO
      // [data-ancla], solo sobre el que de verdad trae un marcador).
      if (marcadores[i].parentNode) {
        marcadores[i].parentNode.classList.remove('tiene-marcador-comentario');
        marcadores[i].parentNode.removeChild(marcadores[i]);
      }
    }
  }

  // Un marcador con número por cada ancla con comentarios abiertos (de
  // primer nivel: una respuesta no cuenta aparte). Se recalcula desde cero
  // en cada carga, así que siempre refleja el estado real sin arrastrar
  // marcadores viejos. Los 'deOtraVersion' (fix round 1, punto 1: siguen
  // contando para bloquear «solicitar», pero quedaron en un documento que ya
  // no es el que se está mirando) no se marcan sobre la página — su ancla
  // podría ni existir aquí, o coincidir por casualidad con otra cosa; esos
  // se ven en el panel lateral, con su propia etiqueta.
  function pintarMarcadores() {
    limpiarMarcadores();
    var conteos = {};
    for (var i = 0; i < comentariosCache.length; i++) {
      var c = comentariosCache[i];
      if (c.respuestaDe || c.estado !== 'abierto' || c.deOtraVersion) continue;
      conteos[c.ancla] = (conteos[c.ancla] || 0) + 1;
    }
    for (var ancla in conteos) {
      if (!Object.prototype.hasOwnProperty.call(conteos, ancla)) continue;
      var elementos = elementosDeAncla(ancla);
      for (var j = 0; j < elementos.length; j++) {
        elementos[j].classList.add('tiene-marcador-comentario');
        var marcador = document.createElement('span');
        marcador.className = 'marcador-comentario';
        marcador.setAttribute('aria-hidden', 'true');
        marcador.textContent = String(conteos[ancla]);
        elementos[j].appendChild(marcador);
      }
    }
  }

  // Qué botones mostrar por comentario, calculado en el cliente a partir de
  // flujo.rol/flujo.esOperadorAsignado — el mismo criterio que
  // puedeCambiarEstadoComentario (src/flujo/comentarios.ts). El servidor
  // sigue siendo quien de verdad autoriza cada PATCH: esto solo decide la UI.
  function puedeCambiarEstadoUi(nuevo) {
    if (flujo.rol === 'cliente') return false;
    if (flujo.rol === 'admin') return true;
    return Boolean(flujo.esOperadorAsignado) && nuevo === 'atendido';
  }

  function fechaCortaComentario(iso) {
    return String(iso).slice(0, 10);
  }

  function etiquetaRol(rol) {
    if (rol === 'admin') return 'Admin';
    if (rol === 'operador') return 'Operador';
    return 'Cliente';
  }

  function crearBotonComentario(texto, claseExtra, alClic) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'panel-boton' + (claseExtra ? ' ' + claseExtra : '');
    b.textContent = texto;
    b.addEventListener('click', alClic);
    return b;
  }

  function irAAncla(ancla) {
    var elementos = elementosDeAncla(ancla);
    if (!elementos.length) return;
    var el = elementos[0];
    if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ancla-resaltada');
    setTimeout(function () { el.classList.remove('ancla-resaltada'); }, 1600);
    cerrarComentarios();
  }

  function pintarFilaComentario(c, respuestas) {
    var fila = document.createElement('div');
    fila.className = 'comentario-fila';

    var cabeza = document.createElement('div');
    cabeza.className = 'comentario-cabeza';
    var autor = document.createElement('span');
    autor.className = 'comentario-autor';
    autor.textContent = c.autor + ' · ' + etiquetaRol(c.autorRol);
    var fecha = document.createElement('span');
    fecha.className = 'suave';
    fecha.textContent = fechaCortaComentario(c.creadoEn);
    cabeza.appendChild(autor);
    cabeza.appendChild(fecha);

    var texto = document.createElement('p');
    texto.textContent = c.texto;

    var anclaP = document.createElement('p');
    anclaP.className = 'suave comentario-ancla';
    anclaP.textContent = c.ancla;

    var acciones = document.createElement('div');
    acciones.className = 'panel-filas';

    if (c.ancla !== 'general' && elementosDeAncla(c.ancla).length) {
      acciones.appendChild(crearBotonComentario('Ir', '', function () { irAAncla(c.ancla); }));
    }

    var areaRespuesta = null;
    if (flujo.puedeComentar) {
      areaRespuesta = document.createElement('div');
      areaRespuesta.className = 'respuesta-area';
      areaRespuesta.hidden = true;
      var campoRespuesta = document.createElement('textarea');
      campoRespuesta.maxLength = 2000;
      campoRespuesta.setAttribute('aria-label', 'Responder');
      var enviarRespuestaBtn = crearBotonComentario('Enviar', 'panel-primario', function () {
        var texto2 = campoRespuesta.value.trim();
        if (!texto2) return;
        enviarRespuestaBtn.disabled = true;
        fetch('/api/comentarios/' + c.id + '/respuestas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: texto2 }),
        }).then(function (res) { return res.json(); }).then(function (b) {
          enviarRespuestaBtn.disabled = false;
          if (b && b.ok) { campoRespuesta.value = ''; cargarComentarios(); }
          else if (estadoComentarios) estadoComentarios.textContent = (b && b.errores && b.errores[0]) || 'No se pudo responder.';
        }).catch(function () {
          enviarRespuestaBtn.disabled = false;
          if (estadoComentarios) estadoComentarios.textContent = 'Sin conexión.';
        });
      });
      areaRespuesta.appendChild(campoRespuesta);
      areaRespuesta.appendChild(enviarRespuestaBtn);
      acciones.appendChild(crearBotonComentario('Responder', '', function () { areaRespuesta.hidden = !areaRespuesta.hidden; }));
    }

    function botonEstado(destino, textoBoton) {
      if (!puedeCambiarEstadoUi(destino)) return;
      acciones.appendChild(crearBotonComentario(textoBoton, destino === 'descartado' ? 'panel-peligro' : '', function () {
        fetch('/api/comentarios/' + c.id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: destino }),
        }).then(function (res) { return res.json(); }).then(function (b) {
          if (b && b.ok) cargarComentarios();
          else if (estadoComentarios) estadoComentarios.textContent = (b && b.errores && b.errores[0]) || 'No se pudo cambiar el estado.';
        }).catch(function () { if (estadoComentarios) estadoComentarios.textContent = 'Sin conexión.'; });
      }));
    }
    if (c.estado === 'abierto') {
      botonEstado('atendido', 'Marcar atendido');
      botonEstado('descartado', 'Descartar');
    } else {
      botonEstado('abierto', 'Reabrir');
    }

    fila.appendChild(cabeza);
    fila.appendChild(texto);
    fila.appendChild(anclaP);
    fila.appendChild(acciones);
    if (areaRespuesta) fila.appendChild(areaRespuesta);
    if (listaComentarios) listaComentarios.appendChild(fila);

    for (var r = 0; r < respuestas.length; r++) {
      var resp = document.createElement('div');
      resp.className = 'comentario-fila comentario-respuesta';
      var cabezaR = document.createElement('div');
      cabezaR.className = 'comentario-cabeza';
      var autorR = document.createElement('span');
      autorR.className = 'comentario-autor';
      autorR.textContent = respuestas[r].autor + ' · ' + etiquetaRol(respuestas[r].autorRol);
      var fechaR = document.createElement('span');
      fechaR.className = 'suave';
      fechaR.textContent = fechaCortaComentario(respuestas[r].creadoEn);
      cabezaR.appendChild(autorR);
      cabezaR.appendChild(fechaR);
      var textoR = document.createElement('p');
      textoR.textContent = respuestas[r].texto;
      resp.appendChild(cabezaR);
      resp.appendChild(textoR);
      if (listaComentarios) listaComentarios.appendChild(resp);
    }
  }

  function pintarListaComentarios() {
    if (!listaComentarios) return;
    listaComentarios.textContent = '';

    var principales = [];
    var porPadre = {};
    for (var i = 0; i < comentariosCache.length; i++) {
      var c = comentariosCache[i];
      if (c.respuestaDe) {
        porPadre[c.respuestaDe] = porPadre[c.respuestaDe] || [];
        porPadre[c.respuestaDe].push(c);
      } else {
        principales.push(c);
      }
    }
    // Los de ancla 'general' salen arriba (spec §3); el resto, del más al
    // menos reciente.
    principales.sort(function (a, b) {
      if (a.ancla === 'general' && b.ancla !== 'general') return -1;
      if (b.ancla === 'general' && a.ancla !== 'general') return 1;
      return new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime();
    });

    var filtrados = principales.filter(function (c) {
      if (filtroComentarios === 'todos') return true;
      if (filtroComentarios === 'abierto') return c.estado === 'abierto';
      return c.estado !== 'abierto';
    });

    if (!filtrados.length) {
      var vacio = document.createElement('p');
      vacio.className = 'suave';
      vacio.textContent = 'No hay comentarios aquí.';
      listaComentarios.appendChild(vacio);
      return;
    }

    for (var j = 0; j < filtrados.length; j++) {
      var respuestas = (porPadre[filtrados[j].id] || []).slice().sort(function (a, b) {
        return new Date(a.creadoEn).getTime() - new Date(b.creadoEn).getTime();
      });
      pintarFilaComentario(filtrados[j], respuestas);
    }
  }

  function cargarComentarios() {
    fetch('/api/comentarios?etapa=' + encodeURIComponent(flujo.etapaId))
      .then(function (res) { return res.json(); })
      .then(function (b) {
        comentariosCache = (b && b.ok && b.comentarios) || [];
        pintarMarcadores();
        pintarListaComentarios();
      })
      .catch(function () {
        if (estadoComentarios) estadoComentarios.textContent = 'Sin conexión.';
      });
  }

  function abrirComentarios() {
    dialogoComentariosAbierto = true;
    if (estadoComentarios) estadoComentarios.textContent = '';
    if (dialogoComentarios.showModal) dialogoComentarios.showModal(); else dialogoComentarios.setAttribute('open', 'open');
    cargarComentarios();
  }

  function cerrarComentarios() {
    dialogoComentariosAbierto = false;
    if (!dialogoComentarios) return;
    if (dialogoComentarios.close) dialogoComentarios.close(); else dialogoComentarios.removeAttribute('open');
  }

  // 'true' si 'el' queda total o parcialmente fuera del alto visible —
  // entonces vale la pena desplazar antes de calcular dónde poner el
  // recuadro (fix round 1, punto 8).
  function fueraDeVista(el) {
    if (!el.getBoundingClientRect) return false;
    var r = el.getBoundingClientRect();
    var altoVentana = (window && window.innerHeight) || 800;
    return r.top < 0 || r.bottom > altoVentana;
  }

  function posicionarRecuadro(el) {
    // Sin getBoundingClientRect (o sin .style, en las pruebas con fake-dom)
    // el recuadro se abre igual, solo que sin reposicionarse junto al
    // elemento — nunca hace falta para construir o mandar el comentario.
    if (!recuadro || !recuadro.style || !el.getBoundingClientRect) return;
    if (fueraDeVista(el) && el.scrollIntoView) {
      // Sin animación: si fuera 'smooth', el getBoundingClientRect de abajo
      // seguiría leyendo la posición de ANTES de desplazar.
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
    var r = el.getBoundingClientRect();
    var altoVentana = (window && window.innerHeight) || 800;
    var anchoVentana = (window && window.innerWidth) || 1200;
    // El recuadro nunca debe quedar recortado por el borde de la ventana:
    // el tope mínimo es 12px desde arriba, el máximo deja sitio para su
    // propia altura más otros 12px abajo (fix round 1, punto 8).
    var altoRecuadro = recuadro.offsetHeight || 220;
    var topMinimo = 12;
    var topMaximo = Math.max(topMinimo, altoVentana - altoRecuadro - 12);
    var top = Math.min(topMaximo, Math.max(topMinimo, r.bottom + 10));
    var left = Math.min(anchoVentana - 20, Math.max(20, r.left));
    recuadro.style.top = top + 'px';
    recuadro.style.left = left + 'px';
  }

  // El elemento con foco justo antes de abrir el recuadro (normalmente el
  // propio '[data-ancla]' en el que se hizo clic, si es enfocable) — cerrar
  // sin devolverle el foco lo dejaría perdido en '<body>' (fix round 1,
  // punto 8).
  var elementoConFocoPrevio = null;

  function abrirRecuadro(el) {
    if (!recuadro || !recuadroTexto) return;
    elementoConFocoPrevio = document.activeElement || null;
    anclaActual = el.getAttribute('data-ancla');
    recuadroAbierto = true;
    recuadro.hidden = false;
    if (recuadroAncla) recuadroAncla.textContent = anclaActual;
    recuadroTexto.value = '';
    if (recuadroEstado) recuadroEstado.textContent = '';
    posicionarRecuadro(el);
    recuadroTexto.focus();
  }

  function cerrarRecuadro() {
    recuadroAbierto = false;
    if (recuadro) recuadro.hidden = true;
    anclaActual = null;
    if (elementoConFocoPrevio && elementoConFocoPrevio.focus) elementoConFocoPrevio.focus();
    elementoConFocoPrevio = null;
  }

  function enviarNuevoComentario() {
    if (!recuadroTexto || !anclaActual) return;
    var texto = recuadroTexto.value.trim();
    if (!texto) { if (recuadroEstado) recuadroEstado.textContent = 'Escribe el comentario.'; return; }
    if (recuadroEnviar) recuadroEnviar.disabled = true;
    fetch('/api/comentarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ etapaId: flujo.etapaId, ancla: anclaActual, texto: texto }),
    }).then(function (res) { return res.json(); })
      .then(function (b) {
        if (recuadroEnviar) recuadroEnviar.disabled = false;
        if (b && b.ok) {
          cerrarRecuadro();
          cargarComentarios();
        } else if (recuadroEstado) {
          recuadroEstado.textContent = (b && b.errores && b.errores[0]) || 'No se pudo enviar.';
        }
      }).catch(function () {
        if (recuadroEnviar) recuadroEnviar.disabled = false;
        if (recuadroEstado) recuadroEstado.textContent = 'Sin conexión.';
      });
  }

  function entrarComentar() {
    if (enComentar || !flujo.puedeComentar || enEdicion) return;
    enComentar = true;
    document.documentElement.classList.add('modo-comentar');
    if (btnComentar) { btnComentar.setAttribute('aria-pressed', 'true'); btnComentar.textContent = 'Salir de comentar'; }
    if (btnEditar) btnEditar.disabled = true;
  }

  function salirComentar() {
    if (!enComentar) return;
    enComentar = false;
    document.documentElement.classList.remove('modo-comentar');
    if (btnComentar) { btnComentar.setAttribute('aria-pressed', 'false'); btnComentar.textContent = 'Comentar'; }
    if (btnEditar) btnEditar.disabled = false;
    cerrarRecuadro();
  }

  // Delegado en document: los elementos [data-ancla] no cambian, pero así
  // también funciona sobre cualquier hijo que se pinte después (marcadores).
  // En fase de CAPTURA (se engancha así más abajo) para llegar antes que
  // cualquier manejador propio del elemento bajo el clic — sin esto, un
  // clic en modo Comentar sobre un botón de estado del banco de pilares, la
  // nota, una pestaña o el filtro/CSV disparaba SU comportamiento normal
  // además de (o en vez de) abrir el recuadro (fix round 1, punto 3).
  function alClicDocumento(e) {
    if (!enComentar) return;
    var objetivo = e.target;
    if (!objetivo || !objetivo.closest) return;
    // Nunca intercepta un clic dentro del propio recuadro o del panel de
    // comentarios (sus botones, el textarea...): ninguno de los dos vive
    // dentro de un [data-ancla], pero por si acaso cambiara el marcado más
    // adelante, se revisa aparte.
    if (objetivo.closest('.dialogo-comentarios, .recuadro-comentario')) return;
    var el = objetivo.closest('[data-ancla]');
    if (!el) return;
    e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    abrirRecuadro(el);
  }

  if (btnEditar) {
    btnEditar.addEventListener('click', function () {
      if (enEdicion) salirConfirmando();
      else entrarEdicion();
    });
  }
  if (btnGuardar) btnGuardar.addEventListener('click', guardar);
  if (btnDescartar) btnDescartar.addEventListener('click', descartar);

  // Un solo dueño de Escape: el elemento más «encima» en pantalla se cierra
  // primero (recuadro de nuevo comentario, luego el panel de comentarios,
  // luego el de versiones) y solo si nada de eso está abierto se sale del
  // modo que esté activo. Antes, el propio <dialog> y este listener
  // competían por la misma tecla y cerrar el diálogo también disparaba
  // «¿salir sin guardar?».
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (recuadroAbierto) { cerrarRecuadro(); return; }
    if (dialogoComentariosAbierto) { cerrarComentarios(); return; }
    if (dialogoAbierto) { cerrarVersiones(); return; }
    if (enEdicion) { salirConfirmando(); return; }
    if (enComentar) { salirComentar(); return; }
  });

  if (dialogoVersiones) dialogoVersiones.addEventListener('close', function () { dialogoAbierto = false; });

  if (dialogoVersiones && btnVersiones) {
    btnVersiones.addEventListener('click', abrirVersiones);
    if (cerrarBtn) cerrarBtn.addEventListener('click', cerrarVersiones);
  }

  if (btnComentar) {
    btnComentar.addEventListener('click', function () {
      if (enComentar) salirComentar(); else entrarComentar();
    });
  }
  if (recuadroEnviar) recuadroEnviar.addEventListener('click', enviarNuevoComentario);
  if (recuadroCancelar) recuadroCancelar.addEventListener('click', cerrarRecuadro);
  document.addEventListener('click', alClicDocumento, true);

  if (dialogoComentarios && btnComentarios) {
    btnComentarios.addEventListener('click', abrirComentarios);
    if (cerrarComentariosBtn) cerrarComentariosBtn.addEventListener('click', cerrarComentarios);
  }
  if (dialogoComentarios) dialogoComentarios.addEventListener('close', function () { dialogoComentariosAbierto = false; });

  for (var fc = 0; fc < filtrosComentarios.length; fc++) {
    (function (boton) {
      boton.addEventListener('click', function () {
        filtroComentarios = boton.getAttribute('data-filtro-comentarios');
        for (var x = 0; x < filtrosComentarios.length; x++) {
          filtrosComentarios[x].setAttribute('aria-pressed', String(filtrosComentarios[x] === boton));
        }
        pintarListaComentarios();
      });
    })(filtrosComentarios[fc]);
  }

  // Los marcadores (y la caché para el panel) se cargan al entrar a la
  // página, no solo al abrir el panel: spec §3, «los elementos con
  // comentarios abiertos llevan un marcador», sin condicionarlo al modo.
  if (flujo.puedeComentar) cargarComentarios();
})();`;
