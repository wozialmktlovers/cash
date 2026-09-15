import type { Investigacion, Sintesis } from '@/research/schemas';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { escapar } from './comunes';
import { ESTILOS_INVESTIGACION } from './estilos';
import {
  seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos,
} from './lectura';
import { detalleInvestigacion, sintesisContinua } from './detalle';

export type MetaInvestigacion = { cliente: string; giro: string; fecha: string };

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

/**
 * Switch de tema e impresión. En ES5 y sin módulos: el documento se guarda y
 * se abre suelto, sin el bundle del sitio.
 */
export const SCRIPT_DOCUMENTO = `(function () {
  var botones = document.querySelectorAll('[data-tema-valor]');
  function sincronizar() {
    var actual = document.documentElement.dataset.tema;
    for (var i = 0; i < botones.length; i++) {
      botones[i].setAttribute('aria-checked', String(botones[i].getAttribute('data-tema-valor') === actual));
    }
  }
  for (var i = 0; i < botones.length; i++) {
    botones[i].addEventListener('click', function () {
      if (window.__wozialTema) window.__wozialTema.elegir(this.getAttribute('data-tema-valor'));
    });
  }
  document.addEventListener('wozial:tema', sincronizar);
  sincronizar();

  // Al imprimir: siempre claro y con el detalle desplegado; después se restaura.
  var previo = null, cerrados = [];
  window.addEventListener('beforeprint', function () {
    previo = document.documentElement.dataset.tema;
    document.documentElement.dataset.tema = 'claro';
    cerrados = [];
    var ds = document.querySelectorAll('details');
    for (var j = 0; j < ds.length; j++) { if (!ds[j].open) { cerrados.push(ds[j]); ds[j].open = true; } }
  });
  window.addEventListener('afterprint', function () {
    if (previo) document.documentElement.dataset.tema = previo;
    for (var k = 0; k < cerrados.length; k++) cerrados[k].open = false;
  });
})();`;

export function renderizarInvestigacion(inv: Investigacion, meta: MetaInvestigacion, barraOperador = ''): string {
  const lectura = inv.lectura?.estado === 'ok' ? inv.lectura.datos : null;
  const sintesis: Sintesis | null = inv.sintesis.estado === 'ok' ? inv.sintesis.datos : null;
  const eyebrow = `Investigación de mercado · ${meta.fecha}`;

  const cuerpo = lectura
    ? [
        seccionPortada({ eyebrow, titular: lectura.portada.titular, resumen: lectura.portada.resumen, cifras: lectura.cifras, conIndice: true }),
        seccionDescubrimos(lectura),
        seccionClienteIdeal(lectura),
        seccionRecomendamos(lectura),
        detalleInvestigacion(inv, false),
      ].join('\n')
    : [
        seccionPortada({ eyebrow, titular: meta.cliente, resumen: meta.giro, cifras: [], conIndice: false }),
        sintesisContinua(sintesis),
        detalleInvestigacion(inv, true),
      ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>Investigación · ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="theme-color" content="${COLOR_BARRA.claro}">
<script>${SCRIPT_TEMA}</script>
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
<main class="doc">
${cuerpo}
</main>
<footer class="pie">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span>Preparado por Wozial · ${escapar(meta.fecha)}</span>
</footer>
<script>${SCRIPT_DOCUMENTO}</script>
</body></html>`;
}
