/**
 * Subir, enlazar y quitar el arte de los anuncios del manual, desde la vista
 * interna. Solo se incluye cuando el render recibe `artes.api` (quien puede
 * operar al cliente); el portal y el enlace público no lo llevan.
 *
 * Todo lo que necesita lo lee de los `data-*` que pinta
 * `src/render/growth/secciones/anuncios.ts`: el contenedor `.arte-gestion`
 * dice a qué API hablar y de qué anuncio (`data-arte-api`, `data-creativo`), y
 * cada botón qué hueco toca (`data-arte-subir`, `data-arte-enlace`,
 * `data-arte-quitar`). Después de cada cambio que el servidor confirma, la
 * página se recarga: el render del servidor es el único que decide qué hueco
 * enseña qué, y repetirlo aquí sería tener dos.
 *
 * ES5 y sin backticks ni interpolaciones dentro del literal (ver
 * tests/render/es5-scripts.test.ts).
 */
export const SCRIPT_ARTES = `
(function(){
  var MAX_BYTES = 25 * 1024 * 1024;
  var ocupado = false;
  var entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.hidden = true;
  entrada.setAttribute('aria-hidden', 'true');
  entrada.tabIndex = -1;
  document.body.appendChild(entrada);
  var pendiente = null;

  function modoOcupado(){
    var c = document.documentElement.classList;
    return c.contains('modo-edicion') || c.contains('modo-comentar');
  }

  function contenedorDe(el){
    while (el && el !== document) {
      if (el.classList && el.classList.contains('arte-gestion')) return el;
      el = el.parentNode;
    }
    return null;
  }

  function estado(caja, texto, error){
    var p = caja.querySelector('.arte-estado');
    if (!p) return;
    p.textContent = texto || '';
    if (error) p.classList.add('arte-error'); else p.classList.remove('arte-error');
  }

  function bloquear(caja, si){
    ocupado = si;
    var botones = caja.querySelectorAll('button');
    for (var i = 0; i < botones.length; i++) botones[i].disabled = si;
    if (si) caja.setAttribute('aria-busy', 'true'); else caja.removeAttribute('aria-busy');
  }

  function errorDe(res, cuerpo){
    if (cuerpo && cuerpo.errores && cuerpo.errores[0]) return cuerpo.errores[0];
    if (res && res.status === 413) return 'El archivo supera 25 MB.';
    if (res && res.status === 404) return 'Este manual ya no está disponible. Recarga la página.';
    return 'No se pudo guardar el arte. Intenta de nuevo.';
  }

  function pedir(url, opciones){
    return fetch(url, opciones).then(function(res){
      return res.json().catch(function(){ return null; }).then(function(cuerpo){
        if (res.ok && cuerpo && cuerpo.ok) return cuerpo;
        throw new Error(errorDe(res, cuerpo));
      });
    }, function(){
      throw new Error('Sin conexión. Revisa tu internet e intenta de nuevo.');
    });
  }

  function enviar(caja, orden, campo, valor, nombre){
    var datos = new FormData();
    datos.append('creativo', caja.getAttribute('data-creativo') || '');
    datos.append('orden', orden);
    if (nombre) datos.append(campo, valor, nombre); else datos.append(campo, valor);
    return pedir(caja.getAttribute('data-arte-api'), { method: 'POST', body: datos });
  }

  function subirArchivos(caja, orden, archivos){
    var lista = [];
    for (var i = 0; i < archivos.length; i++) lista.push(archivos[i]);
    for (var j = 0; j < lista.length; j++) {
      if (lista[j].size > MAX_BYTES) { estado(caja, '«' + lista[j].name + '» supera 25 MB.', true); return; }
    }
    var hechos = 0;
    bloquear(caja, true);
    function siguiente(){
      if (hechos >= lista.length) { estado(caja, 'Listo. Actualizando…', false); window.location.reload(); return; }
      estado(caja, lista.length > 1 ? 'Subiendo ' + (hechos + 1) + ' de ' + lista.length + '…' : 'Subiendo…', false);
      enviar(caja, orden, 'archivo', lista[hechos], lista[hechos].name).then(function(){
        hechos++;
        siguiente();
      }, function(e){
        bloquear(caja, false);
        var extra = hechos > 0 ? ' Se guardaron ' + hechos + '; recarga la página para verlas.' : '';
        estado(caja, e.message + extra, true);
      });
    }
    siguiente();
  }

  entrada.addEventListener('change', function(){
    var p = pendiente;
    pendiente = null;
    if (!p || !entrada.files || !entrada.files.length) return;
    var archivos = entrada.files;
    if (archivos.length > p.maximo) {
      estado(p.caja, 'Caben ' + p.maximo + (p.maximo === 1 ? ' tarjeta más.' : ' tarjetas más.') + ' Elige menos archivos.', true);
      entrada.value = '';
      return;
    }
    subirArchivos(p.caja, p.orden, archivos);
    entrada.value = '';
  });

  function abrirEnlace(caja, boton){
    var previo = caja.querySelector('.arte-enlace-form');
    if (previo) { previo.parentNode.removeChild(previo); boton.focus(); return; }
    var form = document.createElement('form');
    form.className = 'arte-enlace-form';
    var etiqueta = document.createElement('label');
    etiqueta.textContent = 'Enlace del video (http:// o https://)';
    var campo = document.createElement('input');
    campo.type = 'url';
    campo.required = true;
    campo.maxLength = 2000;
    campo.placeholder = 'https://';
    campo.value = boton.getAttribute('data-actual') || '';
    etiqueta.appendChild(campo);
    var fila = document.createElement('div');
    fila.className = 'arte-botones';
    var guardar = document.createElement('button');
    guardar.type = 'submit';
    guardar.className = 'panel-boton panel-primario';
    guardar.textContent = 'Guardar enlace';
    var cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'panel-boton';
    cancelar.textContent = 'Cancelar';
    fila.appendChild(guardar);
    fila.appendChild(cancelar);
    form.appendChild(etiqueta);
    form.appendChild(fila);
    var estadoEl = caja.querySelector('.arte-estado');
    caja.insertBefore(form, estadoEl);
    campo.focus();
    cancelar.addEventListener('click', function(){ form.parentNode.removeChild(form); boton.focus(); });
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var valor = campo.value.replace(/^\\s+|\\s+$/g, '');
      if (!/^https?:\\/\\//i.test(valor)) { estado(caja, 'El enlace debe empezar con http:// o https://.', true); campo.focus(); return; }
      bloquear(caja, true);
      estado(caja, 'Guardando…', false);
      enviar(caja, boton.getAttribute('data-arte-enlace'), 'url', valor).then(function(){
        estado(caja, 'Listo. Actualizando…', false);
        window.location.reload();
      }, function(e){
        bloquear(caja, false);
        estado(caja, e.message, true);
      });
    });
  }

  function quitar(caja, boton){
    var id = boton.getAttribute('data-arte-quitar');
    if (!window.confirm('¿Quitar este arte? El archivo se borra y el hueco vuelve a quedar por producir.')) return;
    bloquear(caja, true);
    estado(caja, 'Quitando…', false);
    pedir(caja.getAttribute('data-arte-api') + '/' + encodeURIComponent(id), { method: 'DELETE' }).then(function(){
      window.location.reload();
    }, function(e){
      bloquear(caja, false);
      estado(caja, e.message, true);
    });
  }

  document.addEventListener('click', function(ev){
    var el = ev.target;
    var boton = null;
    while (el && el !== document) {
      if (el.tagName === 'BUTTON' && (el.hasAttribute('data-arte-subir') || el.hasAttribute('data-arte-enlace') || el.hasAttribute('data-arte-quitar'))) { boton = el; break; }
      el = el.parentNode;
    }
    if (!boton || ocupado || modoOcupado()) return;
    var caja = contenedorDe(boton);
    if (!caja) return;
    estado(caja, '', false);
    if (boton.hasAttribute('data-arte-subir')) {
      var maximo = Number(boton.getAttribute('data-multiple') || '1');
      pendiente = { caja: caja, orden: boton.getAttribute('data-arte-subir'), maximo: maximo };
      entrada.accept = boton.getAttribute('data-acepta') || '';
      entrada.multiple = maximo > 1;
      entrada.value = '';
      entrada.click();
    } else if (boton.hasAttribute('data-arte-enlace')) {
      abrirEnlace(caja, boton);
    } else {
      quitar(caja, boton);
    }
  });
})();
`;
