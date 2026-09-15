/**
 * Interacción propia del mapa de pilares, en ES5 y en línea: filtros
 * combinados del banco, el clic en una tarjeta de pilar (sección 03), el
 * ciclo de estado y la nota por PATCH, exportar CSV e imprimir.
 *
 * Una nota sobre las pestañas ARIA: `SCRIPT_EDITORIAL` (la base compartida)
 * maneja `[role="tab"]` como una sola lista plana en todo el documento, que
 * le basta a la investigación (un solo `tablist`). Aquí hay cinco, uno por
 * pilar, así que ese manejo global selecciona un tab a la vez EN TODO EL
 * DOCUMENTO y esconde los paneles de los otros cuatro pilares. En vez de
 * tocar la base compartida (la toca P5, no esta tarea), este script vuelve a
 * sincronizar cada bloque por separado después de cada clic o flecha: un
 * listener delegado en `document` siempre corre después del que puso cada
 * tab sobre sí mismo, porque la fase de burbuja llega al `document` cuando
 * ya pasó la fase del objetivo.
 */
export const SCRIPT_PILARES = `(function () {
  var banco = document.getElementById('banco');
  if (!banco) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var resultId = banco.getAttribute('data-result-id');

  function normalizarTexto(s) {
    return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  }

  // ── Pestañas por bloque: cada pilar recuerda su propia subcategoría activa ──
  var memoriaPestanas = {};
  function sincronizarPestanas() {
    var bloquesTabs = banco.querySelectorAll('.pilar-bloque');
    for (var i = 0; i < bloquesTabs.length; i++) {
      var bloque = bloquesTabs[i];
      var tabs = bloque.querySelectorAll('[role="tab"]');
      if (!tabs.length) continue;
      var clave = bloque.getAttribute('data-pilar');
      var elegido = -1;
      for (var j = 0; j < tabs.length; j++) { if (tabs[j].getAttribute('aria-selected') === 'true') elegido = j; }
      if (elegido === -1) elegido = memoriaPestanas[clave] || 0;
      memoriaPestanas[clave] = elegido;
      for (var k = 0; k < tabs.length; k++) {
        var activa = k === elegido;
        tabs[k].setAttribute('aria-selected', String(activa));
        tabs[k].setAttribute('tabindex', activa ? '0' : '-1');
        var panel = document.getElementById(tabs[k].getAttribute('aria-controls'));
        if (panel) panel.hidden = !activa;
      }
    }
  }
  sincronizarPestanas();
  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[role="tab"]')) sincronizarPestanas();
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target && e.target.closest && e.target.closest('[role="tab"]')) sincronizarPestanas();
  });

  // ── Filtros combinados ───────────────────────────────────────────────
  var filtros = banco.querySelectorAll('[data-filtro]');
  var tarjetas = banco.querySelectorAll('.tema-tarjeta');
  var bloques = banco.querySelectorAll('.pilar-bloque');
  var contador = banco.querySelector('[data-contador]');
  var total = tarjetas.length;

  function valorFiltro(nombre) {
    var el = banco.querySelector('[data-filtro="' + nombre + '"]');
    return el ? el.value : '';
  }

  function actualizarSubcategorias() {
    var pilarSel = valorFiltro('pilar');
    var selSub = banco.querySelector('[data-filtro="subcategoria"]');
    if (!selSub) return;
    var opciones = selSub.querySelectorAll('option[data-pilar]');
    for (var i = 0; i < opciones.length; i++) {
      var coincide = !pilarSel || opciones[i].getAttribute('data-pilar') === pilarSel;
      opciones[i].hidden = !coincide;
      if (!coincide && opciones[i].selected) selSub.value = '';
    }
  }

  function aplicarFiltros() {
    var texto = normalizarTexto(valorFiltro('texto'));
    var pilar = valorFiltro('pilar');
    var sub = valorFiltro('subcategoria');
    var funcion = valorFiltro('funcion');
    var formato = valorFiltro('formato');
    var estado = valorFiltro('estado');
    var visibles = 0;

    for (var i = 0; i < tarjetas.length; i++) {
      var t = tarjetas[i];
      var ok = true;
      if (ok && pilar && t.getAttribute('data-pilar') !== pilar) ok = false;
      if (ok && sub && t.getAttribute('data-subcategoria') !== sub) ok = false;
      if (ok && funcion && t.getAttribute('data-funcion') !== funcion) ok = false;
      if (ok && formato && t.getAttribute('data-formato') !== formato) ok = false;
      if (ok && estado && t.getAttribute('data-estado') !== estado) ok = false;
      if (ok && texto && (t.getAttribute('data-busqueda') || '').indexOf(texto) === -1) ok = false;
      t.hidden = !ok;
      if (ok) visibles++;
    }

    for (var b = 0; b < bloques.length; b++) {
      var bloque = bloques[b];
      var num = bloque.getAttribute('data-pilar');
      if (pilar && pilar !== num) { bloque.hidden = true; continue; }
      var tarjetasBloque = bloque.querySelectorAll('.tema-tarjeta');
      if (!tarjetasBloque.length) { bloque.hidden = false; continue; }
      var algunaVisible = false;
      for (var j = 0; j < tarjetasBloque.length; j++) { if (!tarjetasBloque[j].hidden) { algunaVisible = true; break; } }
      bloque.hidden = !algunaVisible;
    }

    if (contador) contador.textContent = 'Mostrando ' + visibles + ' de ' + total;
  }

  for (var f = 0; f < filtros.length; f++) {
    filtros[f].addEventListener('input', function () { actualizarSubcategorias(); aplicarFiltros(); });
    filtros[f].addEventListener('change', function () { actualizarSubcategorias(); aplicarFiltros(); });
  }

  var limpiar = banco.querySelector('[data-accion="limpiar"]');
  if (limpiar) limpiar.addEventListener('click', function () {
    for (var g = 0; g < filtros.length; g++) { filtros[g].value = ''; }
    actualizarSubcategorias();
    aplicarFiltros();
  });

  actualizarSubcategorias();
  aplicarFiltros();

  // ── Tarjeta de pilar (sección 03) → filtra y baja al banco ────────────
  function irAPilar(n) {
    var selPilar = banco.querySelector('[data-filtro="pilar"]');
    if (selPilar) selPilar.value = String(n);
    actualizarSubcategorias();
    aplicarFiltros();
    banco.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  var tarjetasPilar = document.querySelectorAll('[data-ir-pilar]');
  for (var h = 0; h < tarjetasPilar.length; h++) {
    (function (tarjeta) {
      tarjeta.addEventListener('click', function () { irAPilar(tarjeta.getAttribute('data-ir-pilar')); });
      tarjeta.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); irAPilar(tarjeta.getAttribute('data-ir-pilar')); }
      });
    })(tarjetasPilar[h]);
  }

  // ── Guardado por PATCH, compartido por estado y nota ───────────────────
  function guardarCambio(temaId, cuerpo, alExito, alFallo) {
    if (!resultId) { alFallo(); return; }
    fetch('/api/pilares/' + resultId + '/temas/' + temaId, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo)
    }).then(function (res) {
      if (!res.ok) throw new Error('fallo');
      return res.json();
    }).then(alExito).catch(alFallo);
  }

  function obtenerMeta(tarjeta) {
    var meta = tarjeta.querySelector('.tema-meta');
    var creado = false;
    if (!meta) {
      meta = document.createElement('p');
      meta.className = 'tema-meta suave';
      tarjeta.appendChild(meta);
      creado = true;
    }
    return { el: meta, creado: creado, previo: meta.textContent };
  }

  // ── Botón de estado: pendiente → en_desarrollo → desarrollado → publicado → pendiente ──
  var CICLO_ESTADO = ['pendiente', 'en_desarrollo', 'desarrollado', 'publicado'];
  var ETIQUETA_ESTADO = { pendiente: 'Pendiente', en_desarrollo: 'En desarrollo', desarrollado: 'Desarrollado', publicado: 'Publicado' };
  function siguienteEstado(actual) {
    var i = CICLO_ESTADO.indexOf(actual);
    return CICLO_ESTADO[(i + 1) % CICLO_ESTADO.length];
  }
  var botonesEstado = banco.querySelectorAll('.boton-estado');
  for (var e1 = 0; e1 < botonesEstado.length; e1++) {
    (function (boton) {
      boton.addEventListener('click', function () {
        var tarjeta = boton.closest('.tema-tarjeta');
        if (!tarjeta) return;
        var temaId = tarjeta.getAttribute('data-tema');
        var anterior = boton.getAttribute('data-estado-actual') || 'pendiente';
        var nuevo = siguienteEstado(anterior);

        tarjeta.setAttribute('data-estado', nuevo);
        boton.setAttribute('data-estado-actual', nuevo);
        boton.textContent = ETIQUETA_ESTADO[nuevo];

        var m = obtenerMeta(tarjeta);
        m.el.textContent = 'Guardado';

        guardarCambio(temaId, { estado: nuevo }, function (datos) {
          m.el.textContent = (datos.actualizadoPor || 'Sin autor') + ' · ' + String(datos.actualizadoEn || '').slice(0, 10);
        }, function () {
          tarjeta.setAttribute('data-estado', anterior);
          boton.setAttribute('data-estado-actual', anterior);
          boton.textContent = ETIQUETA_ESTADO[anterior];
          m.el.textContent = 'No se pudo guardar';
          setTimeout(function () {
            if (m.creado) { if (m.el.parentNode) m.el.parentNode.removeChild(m.el); }
            else { m.el.textContent = m.previo; }
          }, 2600);
        });
      });
    })(botonesEstado[e1]);
  }

  // ── Nota: un solo <dialog>, reutilizado por las 300 tarjetas ───────────
  var dialogoNota = document.getElementById('panel-nota');
  if (dialogoNota) {
    var notaTitulo = document.getElementById('panel-nota-titulo');
    var notaTexto = document.getElementById('panel-nota-texto');
    var notaEstado = document.getElementById('panel-nota-estado');
    var notaGuardar = document.getElementById('panel-nota-guardar');
    var notaCerrar = document.getElementById('panel-nota-cerrar');
    var temaActualId = null;
    var botonActual = null;

    function abrirNota(boton, tarjeta) {
      temaActualId = tarjeta.getAttribute('data-tema');
      botonActual = boton;
      if (notaTitulo) notaTitulo.textContent = boton.getAttribute('data-tema-titulo') || '';
      if (notaTexto) notaTexto.value = boton.getAttribute('data-nota') || '';
      if (notaEstado) notaEstado.textContent = '';
      if (dialogoNota.showModal) dialogoNota.showModal(); else dialogoNota.setAttribute('open', 'open');
      if (notaTexto) notaTexto.focus();
    }
    function cerrarNota() {
      if (dialogoNota.close) dialogoNota.close(); else dialogoNota.removeAttribute('open');
    }

    var botonesNota = banco.querySelectorAll('.boton-nota');
    for (var n = 0; n < botonesNota.length; n++) {
      (function (boton) {
        boton.addEventListener('click', function () {
          var tarjeta = boton.closest('.tema-tarjeta');
          if (tarjeta) abrirNota(boton, tarjeta);
        });
      })(botonesNota[n]);
    }

    if (notaGuardar) notaGuardar.addEventListener('click', function () {
      if (!temaActualId) return;
      var texto = notaTexto ? notaTexto.value : '';
      guardarCambio(temaActualId, { nota: texto }, function () {
        if (botonActual) {
          botonActual.setAttribute('data-nota', texto);
          botonActual.classList.toggle('con-nota', !!texto);
        }
        if (notaEstado) notaEstado.textContent = 'Guardada.';
      }, function () {
        if (notaEstado) notaEstado.textContent = 'No se pudo guardar.';
      });
    });
    if (notaCerrar) notaCerrar.addEventListener('click', cerrarNota);
    dialogoNota.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarNota(); });
  }

  // ── Exportar CSV, desde las tarjetas visibles ───────────────────────────
  var botonCsv = banco.querySelector('[data-accion="csv"]');
  if (botonCsv) botonCsv.addEventListener('click', function () {
    var filas = [['id', 'pilar', 'subcategoria', 'tema', 'funcion', 'formato', 'estado', 'nota']];
    for (var i = 0; i < tarjetas.length; i++) {
      var t = tarjetas[i];
      if (t.offsetParent === null) continue;
      var notaBtn = t.querySelector('.boton-nota');
      var textoEl = t.querySelector('.tema-texto');
      filas.push([
        t.getAttribute('data-tema') || '',
        t.getAttribute('data-pilar') || '',
        t.getAttribute('data-subcategoria') || '',
        textoEl ? textoEl.textContent : '',
        t.getAttribute('data-funcion') || '',
        t.getAttribute('data-formato') || '',
        t.getAttribute('data-estado') || '',
        notaBtn ? (notaBtn.getAttribute('data-nota') || '') : ''
      ]);
    }
    var csv = filas.map(function (fila) {
      return fila.map(function (v) {
        var s = String(v == null ? '' : v).replace(/"/g, '""');
        return '"' + s + '"';
      }).join(',');
    }).join('\\r\\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'banco-de-temas.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  // ── Imprimir: window.print() más abrir lo que el filtro dejó oculto ────
  var botonImprimir = banco.querySelector('[data-accion="imprimir"]');
  if (botonImprimir) botonImprimir.addEventListener('click', function () { window.print(); });

  var ocultosPorFiltro = [];
  window.addEventListener('beforeprint', function () {
    ocultosPorFiltro = [];
    var ds = banco.querySelectorAll('.tema-tarjeta[hidden], .pilar-bloque[hidden], .panel-subcat[hidden]');
    for (var i = 0; i < ds.length; i++) { ocultosPorFiltro.push(ds[i]); ds[i].hidden = false; }
  });
  window.addEventListener('afterprint', function () {
    for (var i = 0; i < ocultosPorFiltro.length; i++) ocultosPorFiltro[i].hidden = true;
    ocultosPorFiltro = [];
  });
})();`;
