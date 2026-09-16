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

/**
 * Los botones de revisión del portal: aprobar una pieza o pedir cambios con
 * nota, contra `POST /api/contenido/piezas/{id}/revision` (C2, diseño §6).
 *
 * Solo viaja cuando el documento se rinde CON controles, es decir, en el portal
 * del cliente identificado: al enlace público no se le manda ni esta cadena, así
 * que en el HTML que sale por `/p/…` no hay ninguna referencia a la API de
 * revisión, aunque tampoco estuvieran los botones para activarla. Es el mismo
 * criterio con el que `envolverDocumento` omite `SCRIPT_CABECERA_COMPARTIR`
 * fuera de la vista interna.
 *
 * Lo que la pantalla hace tras una respuesta buena es repintar: el chip de la
 * pieza, el `data-estado` que leen los filtros de la sección 03, el punto de
 * color del calendario y la barra de «14 de 22 aprobadas» de la portada. No
 * recarga: el cliente está a media lectura de un documento largo.
 *
 * Los errores se dicen tal cual los manda el servidor —el 409 del plazo vencido
 * es un texto escrito para leerse, no un código—, y los botones se vuelven a
 * habilitar para poder reintentar.
 *
 * En ES5 y sin dependencias, como el resto de los scripts en línea; lo vigila
 * `tests/render/es5-scripts.test.ts`.
 */
export const SCRIPT_REVISION = `(function () {
  var bloques = document.querySelectorAll('[data-revision]');
  if (!bloques.length) return;

  var ESTADO = { pendiente: 'Pendiente de revisión', aprobada: 'Aprobada', cambios: 'Con cambios' };

  // La barra de la portada y el punto de color del calendario viven fuera de
  // la tarjeta, así que se buscan por documento cuando hace falta.
  function pintarAvance(avance) {
    if (!avance) return;
    var caja = document.querySelector('[data-avance]');
    if (!caja) return;
    var cuenta = caja.querySelector('[data-avance-cuenta]');
    var pista = caja.querySelector('[data-avance-pista]');
    var relleno = caja.querySelector('[data-avance-relleno]');
    if (cuenta) {
      cuenta.textContent = avance.aprobadas + ' de ' + avance.total + ' ' + (avance.total === 1 ? 'aprobada' : 'aprobadas');
    }
    if (pista) pista.setAttribute('aria-valuenow', String(avance.porcentaje));
    if (relleno) relleno.style.width = avance.porcentaje + '%';
  }

  function pintarPieza(bloque, estado) {
    // La tarjeta de la pieza: la que lleva data-pieza, subiendo desde el bloque.
    var tarjeta = bloque.parentNode;
    while (tarjeta && tarjeta.getAttribute && !tarjeta.hasAttribute('data-pieza')) tarjeta = tarjeta.parentNode;
    if (tarjeta && tarjeta.setAttribute) {
      tarjeta.setAttribute('data-estado', estado);
      var chip = tarjeta.querySelector('[data-estado-chip]');
      if (chip) {
        chip.className = 'estado-pieza ' + estado;
        chip.textContent = ESTADO[estado] || estado;
      }
      // El mismo número de pieza en el calendario y en la cuadrícula del feed.
      var ancla = tarjeta.getAttribute('id');
      if (ancla) {
        var enlaces = document.querySelectorAll('a.dia-pieza[href="#' + ancla + '"]');
        var i;
        for (i = 0; i < enlaces.length; i++) {
          enlaces[i].className = 'dia-pieza ' + estado;
        }
      }
    }
  }

  function preparar(bloque) {
    var aviso = bloque.querySelector('[data-revision-aviso]');
    var caja = bloque.querySelector('.revision-nota');
    var abrir = bloque.querySelector('[data-abrir-nota]');
    var cancelar = bloque.querySelector('[data-cancelar-nota]');
    var nota = bloque.querySelector('[data-nota]');
    var botones = bloque.querySelectorAll('[data-decision]');
    var piezaId = bloque.getAttribute('data-pieza');

    function decir(texto, mal) {
      if (!aviso) return;
      aviso.textContent = texto;
      aviso.className = mal ? 'revision-aviso mal' : 'revision-aviso bien';
    }

    function habilitar(puede) {
      var i;
      for (i = 0; i < botones.length; i++) botones[i].disabled = !puede;
      if (abrir) abrir.disabled = !puede;
    }

    if (abrir && caja) {
      abrir.addEventListener('click', function () {
        caja.hidden = false;
        abrir.setAttribute('aria-expanded', 'true');
        if (nota) nota.focus();
      });
    }
    if (cancelar && caja) {
      cancelar.addEventListener('click', function () {
        caja.hidden = true;
        if (abrir) {
          abrir.setAttribute('aria-expanded', 'false');
          abrir.focus();
        }
      });
    }

    var k;
    for (k = 0; k < botones.length; k++) {
      (function (boton) {
        boton.addEventListener('click', function () {
          var decision = boton.getAttribute('data-decision');
          var texto = nota ? nota.value : '';
          if (decision === 'cambios' && !texto.replace(/^\\s+|\\s+$/g, '')) {
            decir('Escribe qué quieres que cambiemos.', true);
            if (nota) nota.focus();
            return;
          }
          habilitar(false);
          decir(decision === 'aprobar' ? 'Guardando tu aprobación…' : 'Enviando tus cambios…', false);

          var peticion = new XMLHttpRequest();
          peticion.open('POST', '/api/contenido/piezas/' + encodeURIComponent(piezaId) + '/revision', true);
          peticion.setRequestHeader('Content-Type', 'application/json');
          peticion.onreadystatechange = function () {
            if (peticion.readyState !== 4) return;
            habilitar(true);
            var cuerpo = null;
            try { cuerpo = JSON.parse(peticion.responseText); } catch (e) { cuerpo = null; }
            if (!cuerpo || !cuerpo.ok) {
              var razon = cuerpo && cuerpo.errores && cuerpo.errores[0];
              decir(razon || 'No se pudo guardar. Inténtalo otra vez en un momento.', true);
              return;
            }
            pintarPieza(bloque, cuerpo.pieza.estadoCliente);
            pintarAvance(cuerpo.avance);
            if (caja) caja.hidden = true;
            if (abrir) abrir.setAttribute('aria-expanded', 'false');
            decir(
              cuerpo.pieza.estadoCliente === 'aprobada'
                ? 'Listo, la aprobaste. Gracias.'
                : 'Ya le avisamos a tu equipo. Te escriben en cuanto lo tengan.',
              false
            );
          };
          peticion.onerror = function () {
            habilitar(true);
            decir('No pudimos conectarnos. Revisa tu internet e inténtalo otra vez.', true);
          };
          peticion.send(JSON.stringify({ decision: decision, nota: texto }));
        });
      })(botones[k]);
    }
  }

  var n;
  for (n = 0; n < bloques.length; n++) preparar(bloques[n]);
})();`;
