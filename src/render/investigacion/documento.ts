import type { Investigacion, Sintesis } from '@/research/schemas';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { escapar } from './comunes';
import { ESTILOS_INVESTIGACION } from './estilos';
import { seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos } from './lectura';
import { seccionDetalle, sintesisEditorial } from './detalle';

export type MetaInvestigacion = { cliente: string; giro: string; fecha: string };

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

/**
 * Interacción del documento, en ES5 y sin módulos: se guarda y se abre suelto.
 * Todo lo que hace es mejora: sin este script el contenido completo ya se lee.
 */
export const SCRIPT_DOCUMENTO = `(function () {
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

  // Pestañas del detalle
  var pestanas = document.querySelectorAll('[role="tab"]');
  function elegir(tab, enfocar) {
    for (var j = 0; j < pestanas.length; j++) {
      var activa = pestanas[j] === tab;
      pestanas[j].setAttribute('aria-selected', String(activa));
      pestanas[j].setAttribute('tabindex', activa ? '0' : '-1');
      var panel = document.getElementById(pestanas[j].getAttribute('aria-controls'));
      if (panel) panel.hidden = !activa;
    }
    if (enfocar) tab.focus();
  }
  for (var k = 0; k < pestanas.length; k++) {
    (function (indice) {
      pestanas[indice].addEventListener('click', function () { elegir(pestanas[indice], false); });
      pestanas[indice].addEventListener('keydown', function (e) {
        var paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!paso) return;
        e.preventDefault();
        elegir(pestanas[(indice + paso + pestanas.length) % pestanas.length], true);
      });
    })(k);
  }
  if (pestanas.length) elegir(pestanas[0], false);

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

export function renderizarInvestigacion(inv: Investigacion, meta: MetaInvestigacion, barraOperador = ''): string {
  const lectura = inv.lectura?.estado === 'ok' ? inv.lectura.datos : null;
  const sintesis: Sintesis | null = inv.sintesis.estado === 'ok' ? inv.sintesis.datos : null;
  const eyebrow = `Investigación de mercado · ${meta.fecha}`;

  const indice = lectura
    ? [['01', 'descubrimos', 'Qué descubrimos'], ['02', 'cliente-ideal', 'Tu cliente ideal'], ['03', 'recomendamos', 'Qué te recomendamos'], ['04', 'detalle', 'Detalle']]
    : [...(sintesis ? [['01', 'sintesis', 'Lo más importante']] : []), ['04', 'detalle', 'Detalle']];

  const cuerpo = lectura
    ? [
        seccionPortada({ eyebrow, titular: lectura.portada.titular, resumen: lectura.portada.resumen, cifras: lectura.cifras, conIndice: true }),
        seccionDescubrimos(lectura),
        seccionClienteIdeal(lectura),
        seccionRecomendamos(lectura),
        seccionDetalle(inv, meta.cliente),
      ].join('\n')
    : [
        seccionPortada({ eyebrow, titular: meta.cliente, resumen: meta.giro, cifras: [], conIndice: false }),
        sintesisEditorial(sintesis),
        seccionDetalle(inv, meta.cliente),
      ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Investigación · ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="theme-color" content="${COLOR_BARRA.claro}">
<script>${SCRIPT_TEMA}</script>
<script>document.documentElement.classList.add('js');</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${ESTILOS_INVESTIGACION}</style>
</head><body>
${barraOperador}
<header class="doc-barra">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span class="titulo">Investigación · <b>${escapar(meta.cliente)}</b></span>
  <div class="tema-switch" role="radiogroup" aria-label="Tema de color">
    <button type="button" role="radio" aria-checked="false" data-tema-valor="claro" aria-label="Día">${SOL}</button>
    <button type="button" role="radio" aria-checked="false" data-tema-valor="oscuro" aria-label="Noche">${LUNA}</button>
  </div>
</header>
<div class="pagina"><div class="marco">
  <nav class="indice-lateral" aria-label="Secciones">
    <ol>${indice.map(([num, id, nombre]) => `<li><a href="#${id}"><span>${num}</span>${nombre}</a></li>`).join('')}</ol>
  </nav>
  <main>
${cuerpo}
  </main>
</div></div>
<footer class="pie">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span>Preparado por Wozial · ${escapar(meta.fecha)}</span>
</footer>
<script>${SCRIPT_DOCUMENTO}</script>
</body></html>`;
}
