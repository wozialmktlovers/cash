/**
 * Interacción propia del mapa de pilares, en ES5 y en línea: filtros
 * combinados del banco, el clic en una tarjeta de pilar (sección 03), el
 * ciclo de estado y la nota por PATCH, exportar CSV e imprimir.
 *
 * Las pestañas ARIA de cada pilar (un `[role="tablist"]` por bloque) ya las
 * escopa `SCRIPT_EDITORIAL` (la base compartida): cada grupo elige su propio
 * primer tab al cargar y las flechas/Home/End no cruzan de un pilar a otro.
 * Este script solo se mete con las pestañas para un caso propio del banco:
 * mientras hay un filtro activo, las tres subcategorías de cada pilar se
 * muestran a la vez (si no, un tema que hace match en la subcategoría 2
 * quedaría escondido por la pestaña 1, que es la que está seleccionada) —
 * ver `hayFiltrosActivos`/`aplicarModoFiltro` más abajo.
 */
export const SCRIPT_PILARES = `(function () {
  var banco = document.getElementById('banco');
  if (!banco) return;

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var resultId = banco.getAttribute('data-result-id');

  function normalizarTexto(s) {
    return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
  }

  // ── Filtros combinados ───────────────────────────────────────────────
  var filtros = banco.querySelectorAll('[data-filtro]');
  var tarjetas = banco.querySelectorAll('.tema-tarjeta');
  var bloques = banco.querySelectorAll('.pilar-bloque');
  var contenedorBloques = banco.querySelector('.pilares-bloques');
  var contador = banco.querySelector('[data-contador]');
  var total = tarjetas.length;

  function valorFiltro(nombre) {
    var el = banco.querySelector('[data-filtro="' + nombre + '"]');
    return el ? el.value : '';
  }

  function hayFiltrosActivos() {
    return !!(normalizarTexto(valorFiltro('texto')) || valorFiltro('pilar') || valorFiltro('subcategoria') ||
      valorFiltro('funcion') || valorFiltro('formato') || valorFiltro('estado'));
  }

  // Mientras hay un filtro activo, las tres pestañas de cada pilar se
  // muestran a la vez (con su título de subcategoría, que las pestañas
  // normalmente esconden) para que un match en la subcategoría 2 o 3 no
  // quede detrás de la pestaña 1. Al limpiar los filtros se restaura
  // exactamente el tab que estaba elegido (su aria-selected no se toca).
  //
  // aria-disabled solo (sin tabindex="-1") no alcanza para un teclado: el
  // tab que seguía seleccionado se quedaba con tabindex="0", así que se
  // podía tabular hasta él y su Enter/flecha (que SCRIPT_EDITORIAL ahora
  // rechaza si ve aria-disabled, pero más vale no depender solo de eso)
  // volvía a esconder las otras subcategorías sin que aria-disabled
  // cambiara. Sacarlos del tab order es la otra mitad del arreglo.
  function mostrarTodasLasSubcategorias() {
    if (contenedorBloques) contenedorBloques.classList.add('filtro-activo');
    var paneles = banco.querySelectorAll('.panel-subcat');
    for (var i = 0; i < paneles.length; i++) paneles[i].hidden = false;
    var tabs = banco.querySelectorAll('.pestanas [role="tab"]');
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].setAttribute('aria-disabled', 'true');
      tabs[j].setAttribute('tabindex', '-1');
    }
  }
  function restaurarPestanaElegida() {
    if (contenedorBloques) contenedorBloques.classList.remove('filtro-activo');
    var listas = banco.querySelectorAll('.pestanas');
    for (var i = 0; i < listas.length; i++) {
      var tabs = listas[i].querySelectorAll('[role="tab"]');
      for (var j = 0; j < tabs.length; j++) {
        tabs[j].removeAttribute('aria-disabled');
        var activa = tabs[j].getAttribute('aria-selected') === 'true';
        // Tabindex en rueda (roving tabindex): solo el tab elegido vuelve a
        // ser alcanzable con Tab, como antes de que el filtro los apagara.
        tabs[j].setAttribute('tabindex', activa ? '0' : '-1');
        var panel = document.getElementById(tabs[j].getAttribute('aria-controls'));
        if (panel) panel.hidden = !activa;
      }
    }
  }
  function aplicarModoFiltro() {
    if (hayFiltrosActivos()) mostrarTodasLasSubcategorias(); else restaurarPestanaElegida();
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

  function actualizarContadorFiltros() {
    var insignia = banco.querySelector('[data-filtros-contador]');
    if (!insignia) return;
    var claves = ['pilar', 'subcategoria', 'funcion', 'formato', 'estado'];
    var n = 0;
    for (var i = 0; i < claves.length; i++) { if (valorFiltro(claves[i])) n++; }
    insignia.textContent = n > 0 ? String(n) : '';
  }

  function aplicarFiltros() {
    var texto = normalizarTexto(valorFiltro('texto'));
    var pilar = valorFiltro('pilar');
    var sub = valorFiltro('subcategoria');
    var funcion = valorFiltro('funcion');
    var formato = valorFiltro('formato');
    var estado = valorFiltro('estado');
    var visibles = 0;

    // Recorre las 300 tarjetas sin importar en qué subcategoría estén: el
    // contador y el CSV cuentan lo mismo, «cuántos temas hacen match en
    // TODAS las subcategorías», nunca solo la pestaña que se ve.
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
    actualizarContadorFiltros();
    aplicarModoFiltro();
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

  // ── Barra de herramientas compacta: bajo 1100px los filtros se esconden
  // detrás de un botón «Filtros (n)», colapsados por defecto ────────────
  var botonFiltros = banco.querySelector('#btn-filtros');
  var panelFiltros = banco.querySelector('#herramientas-filtros');
  if (botonFiltros && panelFiltros) {
    botonFiltros.addEventListener('click', function () {
      var abierta = panelFiltros.classList.toggle('abierta');
      botonFiltros.setAttribute('aria-expanded', String(abierta));
    });
  }

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
  // La tarjeta de pilar (sección 03) es 'role="button"' y su nombre/pregunta
  // llevan 'data-editable' (B6) y también 'data-ancla' (B7): en modo edición,
  // un clic para poner el cursor en el texto, o el espacio al teclear una
  // palabra, no debe saltar al banco; en modo Comentar, un clic sobre la
  // tarjeta debe abrir el recuadro de comentario, no navegar. Ambas miran la
  // misma clase que pone SCRIPT_FLUJO en <html> al entrar en cada modo.
  function enModoEdicion() {
    return document.documentElement.classList.contains('modo-edicion');
  }
  function enModoComentar() {
    return document.documentElement.classList.contains('modo-comentar');
  }
  var tarjetasPilar = document.querySelectorAll('[data-ir-pilar]');
  for (var h = 0; h < tarjetasPilar.length; h++) {
    (function (tarjeta) {
      tarjeta.addEventListener('click', function (e) {
        if (enModoEdicion() || enModoComentar() || (e.target && e.target.isContentEditable)) return;
        irAPilar(tarjeta.getAttribute('data-ir-pilar'));
      });
      tarjeta.addEventListener('keydown', function (e) {
        if (enModoEdicion() || enModoComentar() || (e.target && e.target.isContentEditable)) return;
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
  // (ETIQUETA_ESTADO se repite aquí a propósito, en ES5 puro: si cambian los
  // nombres o el orden de ESTADOS_TEMA en pilares/schemas.ts, hay que
  // actualizar también el mismo mapa en render/pilares/banco.ts.)
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
        // Si hay un filtro de estado activo, la tarjeta puede dejar de (o
        // empezar a) hacer match: sin esto el contador y el CSV quedaban
        // desfasados de lo que se veía hasta el siguiente filtro manual.
        aplicarFiltros();

        var m = obtenerMeta(tarjeta);
        m.el.textContent = 'Guardado';

        // Un doble clic (o dos cambios de estado seguidos antes de que
        // conteste el primero) no debe dejar que la respuesta más vieja
        // pise el resultado del clic más nuevo: cada clic sube un contador
        // propio del botón y solo el que sigue vigente toca el DOM.
        var version = (boton._version || 0) + 1;
        boton._version = version;

        guardarCambio(temaId, { estado: nuevo }, function (datos) {
          if (boton._version !== version) return;
          m.el.textContent = (datos.actualizadoPor || 'Sin autor') + ' · ' + String(datos.actualizadoEn || '').slice(0, 10);
        }, function () {
          if (boton._version !== version) return;
          tarjeta.setAttribute('data-estado', anterior);
          boton.setAttribute('data-estado-actual', anterior);
          boton.textContent = ETIQUETA_ESTADO[anterior];
          aplicarFiltros();
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
      // Se capturan aquí, no dentro de los callbacks: si el operador cierra
      // el diálogo y abre la nota de OTRO tema antes de que conteste el
      // PATCH, 'temaActualId'/'botonActual' ya habrán cambiado y el
      // callback tardío terminaría marcando 'con-nota' en la tarjeta
      // equivocada.
      var temaEnvio = temaActualId;
      var botonEnvio = botonActual;
      var texto = notaTexto ? notaTexto.value : '';
      guardarCambio(temaEnvio, { nota: texto }, function () {
        if (botonEnvio) {
          // El servidor guarda la nota recortada (ver validarCambioTema); el
          // botón debe reflejar lo mismo, si no la próxima vez que se abra
          // el panel mostraría espacios que ya no están guardados.
          var textoGuardado = texto.trim();
          botonEnvio.setAttribute('data-nota', textoGuardado);
          botonEnvio.classList.toggle('con-nota', !!textoGuardado);
        }
        if (notaEstado) notaEstado.textContent = 'Guardada.';
      }, function () {
        if (notaEstado) notaEstado.textContent = 'No se pudo guardar.';
      });
    });
    if (notaCerrar) notaCerrar.addEventListener('click', cerrarNota);
    dialogoNota.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarNota(); });
  }

  // ── Exportar CSV: mismas tarjetas que cuenta el contador (todas las que
  // hacen match, no solo las de la pestaña abierta) ──────────────────────
  function celdaSegura(v) {
    var s = String(v == null ? '' : v);
    // Protección contra inyección de fórmulas: si Excel/Sheets abre el CSV,
    // una celda que empiece con = + - @ (o con tab/retorno de carro, que
    // algunos lectores saltan antes de mirar el primer caracter "visible")
    // puede ejecutarse como fórmula.
    if (/^[=+\\-@\\t\\r]/.test(s)) s = "'" + s;
    return s;
  }
  var botonCsv = banco.querySelector('[data-accion="csv"]');
  if (botonCsv) botonCsv.addEventListener('click', function () {
    var filas = [['id', 'pilar', 'subcategoria', 'tema', 'funcion', 'formato', 'estado', 'nota']];
    for (var i = 0; i < tarjetas.length; i++) {
      var t = tarjetas[i];
      if (t.hidden) continue;
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
        var s = celdaSegura(v).replace(/"/g, '""');
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
