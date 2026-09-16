/**
 * Interacción propia del entregable del mes, en ES5 y en línea (sin módulos,
 * sin build): la cuenta regresiva del plazo, el visor de carrusel, el botón
 * «Copiar» de cada copy y de cada lista de hashtags, y los filtros por formato
 * y estado de la sección 03.
 *
 * Nada de esto es imprescindible para leer el documento, y esa es la regla con
 * la que está escrito: sin JS quedan la fecha límite (la cuenta regresiva solo
 * la repite en corto), la portada de cada pieza con todas sus miniaturas, el
 * copy completo seleccionable y la lista entera de piezas sin filtrar. Por eso
 * los filtros solo se muestran con `html.js` (la regla vive en los estilos).
 *
 * `tests/render/es5-scripts.test.ts` vigila que aquí no se cuele una arrow
 * function, un template literal, un `const` ni un `let`: esto viaja tal cual
 * dentro de un `<script>` y ningún compilador lo mira.
 */
export const SCRIPT_CONTENIDO = `(function () {
  // ── Cuenta regresiva del plazo de revisión ───────────────────────────
  // El límite viene ya calculado del servidor en ISO (UTC), así que aquí no
  // se cuentan días hábiles ni se interpreta ninguna zona: solo se resta.
  var caja = document.querySelector('[data-limite]');
  if (caja) {
    var limite = Date.parse(caja.getAttribute('data-limite'));
    var salida = caja.querySelector('[data-cuenta]');
    var pintar = function () {
      if (!salida || isNaN(limite)) return;
      var resta = limite - Date.now();
      if (resta <= 0) {
        caja.className = caja.className.indexOf('vencido') === -1 ? caja.className + ' vencido' : caja.className;
        salida.textContent = 'El plazo terminó';
        return;
      }
      var minutos = Math.floor(resta / 60000);
      var horas = Math.floor(minutos / 60);
      var dias = Math.floor(horas / 24);
      if (dias >= 1) salida.textContent = dias + (dias === 1 ? ' día ' : ' días ') + (horas % 24) + ' h';
      else if (horas >= 1) salida.textContent = horas + ' h ' + (minutos % 60) + ' min';
      else salida.textContent = minutos + (minutos === 1 ? ' minuto' : ' minutos');
    };
    pintar();
    // Cada 30 s: suficiente para que los minutos no se vean congelados y
    // mucho menos que un temporizador por segundo en una página larga.
    setInterval(pintar, 30000);
  }

  // ── Visor de carrusel ────────────────────────────────────────────────
  // Cada grupo de miniaturas cambia la imagen grande de SU tarjeta. Se busca
  // hacia arriba (parentNode) en vez de por id para no inventarle un id a
  // cada pieza solo para esto.
  var visores = document.querySelectorAll('[data-visor]');
  var i;
  for (i = 0; i < visores.length; i++) {
    (function (grupo) {
      var tarjeta = grupo.parentNode;
      var principal = tarjeta ? tarjeta.querySelector('[data-visor-principal]') : null;
      if (!principal) return;
      var botones = grupo.querySelectorAll('[data-slide]');
      var elegir = function (boton) {
        principal.src = boton.getAttribute('data-slide');
        var j;
        for (j = 0; j < botones.length; j++) {
          botones[j].setAttribute('aria-current', botones[j] === boton ? 'true' : 'false');
        }
      };
      var k;
      for (k = 0; k < botones.length; k++) {
        (function (boton) {
          boton.addEventListener('click', function () { elegir(boton); });
        })(botones[k]);
      }
    })(visores[i]);
  }

  // ── Copiar ───────────────────────────────────────────────────────────
  // El destino es el [data-copia] más cercano subiendo desde el botón: en una
  // tarjeta de feed eso es el bloque del copy o el de los hashtags, y en una
  // historia, la propia tarjeta.
  function destinoDe(boton) {
    var nodo = boton.parentNode;
    while (nodo && nodo.querySelector) {
      var encontrado = nodo.querySelector('[data-copia]');
      if (encontrado) return encontrado;
      nodo = nodo.parentNode;
    }
    return null;
  }

  function alPortapapeles(texto, listo) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () { listo(true); }, function () { listo(false); });
      return;
    }
    // Respaldo para navegadores sin API de portapapeles o servidos sin HTTPS.
    var area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', 'readonly');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    listo(ok);
  }

  var copiadores = document.querySelectorAll('[data-copiar]');
  for (i = 0; i < copiadores.length; i++) {
    (function (boton) {
      boton.addEventListener('click', function () {
        var destino = destinoDe(boton);
        if (!destino) return;
        var etiqueta = boton.querySelector('[data-copiar-texto]') || boton;
        var original = etiqueta.textContent;
        alPortapapeles(destino.textContent, function (ok) {
          etiqueta.textContent = ok ? 'Copiado' : 'Copia manual';
          setTimeout(function () { etiqueta.textContent = original; }, 2000);
        });
      });
    })(copiadores[i]);
  }

  // ── Filtros de la sección 03 ─────────────────────────────────────────
  var seccion = document.querySelector('[data-lista-piezas]');
  if (!seccion) return;
  var botonesFiltro = seccion.querySelectorAll('[data-filtro]');
  var tarjetas = seccion.querySelectorAll('[data-pieza]');
  var contador = seccion.querySelector('[data-contador]');
  var elegido = { formato: '', estado: '' };

  function aplicar() {
    var visibles = 0;
    var n;
    for (n = 0; n < tarjetas.length; n++) {
      var t = tarjetas[n];
      var pasa = (!elegido.formato || t.getAttribute('data-formato') === elegido.formato) &&
        (!elegido.estado || t.getAttribute('data-estado') === elegido.estado);
      t.hidden = !pasa;
      if (pasa) visibles++;
    }
    if (contador) {
      contador.textContent = visibles === tarjetas.length
        ? 'Mostrando ' + tarjetas.length + ' de ' + tarjetas.length
        : 'Mostrando ' + visibles + ' de ' + tarjetas.length;
    }
  }

  for (i = 0; i < botonesFiltro.length; i++) {
    (function (boton) {
      boton.addEventListener('click', function () {
        var grupo = boton.getAttribute('data-filtro');
        elegido[grupo] = boton.getAttribute('data-valor') || '';
        var m;
        for (m = 0; m < botonesFiltro.length; m++) {
          if (botonesFiltro[m].getAttribute('data-filtro') !== grupo) continue;
          botonesFiltro[m].setAttribute('aria-pressed', botonesFiltro[m] === boton ? 'true' : 'false');
        }
        aplicar();
      });
    })(botonesFiltro[i]);
  }
})();`;
