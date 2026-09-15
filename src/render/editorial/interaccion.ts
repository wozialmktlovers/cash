/**
 * Interacción compartida de cualquier documento editorial, en ES5 y sin
 * módulos: se guarda y se abre suelto. Todo lo que hace es mejora: sin este
 * script el contenido completo ya se lee. Cubre tema, pestañas ARIA, índice
 * lateral activo, apariciones al hacer scroll e impresión. No sabe nada de
 * un documento en particular (investigación, pilares...): opera solo sobre
 * selectores genéricos ([data-tema-valor], [role="tab"], .indice-lateral a,
 * [data-seccion], .aparece, <details>).
 */
export const SCRIPT_EDITORIAL = `(function () {
  var raiz = document.documentElement;

  // Tema
  var botonesTema = document.querySelectorAll('[data-tema-valor]');
  function sincronizarTema() {
    for (var i = 0; i < botonesTema.length; i++) {
      botonesTema[i].setAttribute('aria-checked', String(botonesTema[i].getAttribute('data-tema-valor') === raiz.getAttribute('data-tema')));
    }
  }
  for (var i = 0; i < botonesTema.length; i++) {
    botonesTema[i].addEventListener('click', function () {
      if (window.__wozialTema) window.__wozialTema.elegir(this.getAttribute('data-tema-valor'));
    });
  }
  document.addEventListener('wozial:tema', sincronizarTema);
  sincronizarTema();

  // Pestañas ARIA, agrupadas por su propio [role="tablist"]: un documento
  // puede traer más de uno (el banco de pilares trae cinco, uno por pilar) y
  // cada grupo se comporta como si fuera el único en la página — flechas,
  // Home/End y la selección inicial no cruzan de un tablist a otro.
  var listasDePestanas = document.querySelectorAll('[role="tablist"]');
  function elegir(tabsDelGrupo, tab, enfocar) {
    for (var j = 0; j < tabsDelGrupo.length; j++) {
      var activa = tabsDelGrupo[j] === tab;
      tabsDelGrupo[j].setAttribute('aria-selected', String(activa));
      tabsDelGrupo[j].setAttribute('tabindex', activa ? '0' : '-1');
      var panel = document.getElementById(tabsDelGrupo[j].getAttribute('aria-controls'));
      if (panel) panel.hidden = !activa;
    }
    if (enfocar) tab.focus();
  }
  for (var g = 0; g < listasDePestanas.length; g++) {
    (function (grupo) {
      var tabsDelGrupo = grupo.querySelectorAll('[role="tab"]');
      for (var k = 0; k < tabsDelGrupo.length; k++) {
        (function (indice) {
          tabsDelGrupo[indice].addEventListener('click', function () { elegir(tabsDelGrupo, tabsDelGrupo[indice], false); });
          tabsDelGrupo[indice].addEventListener('keydown', function (e) {
            if (e.key === 'Home') { e.preventDefault(); elegir(tabsDelGrupo, tabsDelGrupo[0], true); return; }
            if (e.key === 'End') { e.preventDefault(); elegir(tabsDelGrupo, tabsDelGrupo[tabsDelGrupo.length - 1], true); return; }
            var paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
            if (!paso) return;
            e.preventDefault();
            elegir(tabsDelGrupo, tabsDelGrupo[(indice + paso + tabsDelGrupo.length) % tabsDelGrupo.length], true);
          });
        })(k);
      }
      if (tabsDelGrupo.length) elegir(tabsDelGrupo, tabsDelGrupo[0], false);
    })(listasDePestanas[g]);
  }

  // Índice activo y apariciones
  var enlaces = document.querySelectorAll('.indice-lateral a');
  var aparece = document.querySelectorAll('.aparece');
  if ('IntersectionObserver' in window) {
    var visor = new IntersectionObserver(function (entradas) {
      for (var m = 0; m < entradas.length; m++) {
        if (!entradas[m].isIntersecting) continue;
        var id = entradas[m].target.id;
        for (var n = 0; n < enlaces.length; n++) {
          enlaces[n].classList.toggle('activo', enlaces[n].getAttribute('href') === '#' + id);
        }
      }
    }, { rootMargin: '-40% 0px -55% 0px' });
    var secciones = document.querySelectorAll('[data-seccion]');
    for (var p = 0; p < secciones.length; p++) visor.observe(secciones[p]);

    var revela = new IntersectionObserver(function (entradas) {
      for (var q = 0; q < entradas.length; q++) {
        if (entradas[q].isIntersecting) { entradas[q].target.classList.add('visible'); revela.unobserve(entradas[q].target); }
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (var r = 0; r < aparece.length; r++) revela.observe(aparece[r]);
  } else {
    for (var s = 0; s < aparece.length; s++) aparece[s].classList.add('visible');
  }

  // Impresión: claro, todo visible y los desplegables abiertos; después se restaura.
  var temaPrevio = null, cerrados = [];
  window.addEventListener('beforeprint', function () {
    temaPrevio = raiz.getAttribute('data-tema');
    raiz.setAttribute('data-tema', 'claro');
    cerrados = [];
    var ds = document.querySelectorAll('details');
    for (var t = 0; t < ds.length; t++) { if (!ds[t].open) { cerrados.push(ds[t]); ds[t].open = true; } }
    for (var u = 0; u < aparece.length; u++) aparece[u].classList.add('visible');
  });
  window.addEventListener('afterprint', function () {
    if (temaPrevio) raiz.setAttribute('data-tema', temaPrevio);
    for (var v = 0; v < cerrados.length; v++) cerrados[v].open = false;
  });
})();`;
