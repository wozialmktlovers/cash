import type { OpcionesBarra } from '@/render/barra-operador';
import { escapar } from '@/render/escapar';
import { LOGO_WOZIAL_SRC } from '@/render/marca';

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8"/></svg>';

function botonCompartir(): string {
  return `<button type="button" class="cabecera-compartir" id="btn-compartir" aria-haspopup="dialog" aria-expanded="false" aria-controls="panel-compartir" aria-label="Compartir">
    ${ICONO_COMPARTIR}
    <span class="texto-compartir" aria-hidden="true">Compartir</span>
  </button>`;
}

/** A dónde manda «Regenerar» según el tipo de documento. */
function regenerarHref(o: OpcionesBarra): string {
  const id = escapar(o.clienteId);
  if (o.tipo === 'growth') return `/clientes/${id}`;
  if (o.tipo === 'pilares') return `/clientes/${id}/pilares`;
  return `/clientes/${id}/investigar`;
}

/**
 * Panel del botón Compartir: misma lógica de red que `barraOperador` (crear,
 * copiar, revocar), pero en el panel de la cabecera nueva. Vive fuera del
 * <header> a propósito: la cápsula recorta su contenido con `overflow:hidden`
 * para redondear la barra de progreso, y el panel no debe quedar atrapado ahí.
 */
function panelCompartir(o: OpcionesBarra): string {
  const url = o.tokenActivo ? `${o.base}/p/${o.clienteSlug}/${o.tokenActivo}` : '';

  return `<div class="panel-compartir" id="panel-compartir" role="dialog" aria-label="Compartir investigación" hidden>
    <p class="panel-eyebrow">Vista interna · v${o.version}</p>
    <div class="panel-link" id="panel-link" ${o.tokenActivo ? '' : 'hidden'}>
      <input class="panel-url" id="panel-url" type="text" readonly aria-label="URL pública" value="${escapar(url)}" data-token="${escapar(o.tokenActivo ?? '')}">
      <button type="button" class="panel-boton" id="panel-copiar">Copiar</button>
    </div>
    <button type="button" class="panel-boton panel-primario" id="panel-crear" data-documento="${escapar(o.documentoId)}" data-tipo="${escapar(o.tipo)}" ${o.tokenActivo ? 'hidden' : ''}>Crear link público</button>
    <div class="panel-filas">
      <a class="panel-boton" href="/clientes/${escapar(o.clienteId)}">Cliente</a>
      <a class="panel-boton" href="${regenerarHref(o)}">Regenerar</a>
      <button type="button" class="panel-boton panel-peligro" id="panel-revocar" ${o.tokenActivo ? '' : 'hidden'}>Revocar</button>
    </div>
    <p class="panel-estado" id="panel-estado" role="status" aria-live="polite"></p>
  </div>`;
}

/**
 * Cabecera flotante de un documento editorial: cápsula fija con logo,
 * etiqueta · cliente, switch de tema, progreso de lectura y, solo en la
 * vista interna (cuando se pasa `operador`), el botón Compartir con su
 * panel. La etiqueta («Investigación», «Mapa de pilares»...) la da quien
 * llama: esta base no sabe de qué tipo de documento se trata.
 */
export function cabeceraDocumento(o: { etiqueta: string; cliente: string; operador?: OpcionesBarra }): string {
  return `<header class="cabecera" id="cabecera">
  <div class="cabecera-marca">
    <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
    <span class="titulo">${escapar(o.etiqueta)} · <b>${escapar(o.cliente)}</b></span>
  </div>
  <div class="cabecera-acciones">
    <div class="tema-switch" role="radiogroup" aria-label="Tema de color">
      <button type="button" role="radio" aria-checked="false" data-tema-valor="claro" aria-label="Día">${SOL}</button>
      <button type="button" role="radio" aria-checked="false" data-tema-valor="oscuro" aria-label="Noche">${LUNA}</button>
    </div>
    ${o.operador ? botonCompartir() : ''}
  </div>
  <div class="cabecera-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de lectura"></div>
</header>
${o.operador ? panelCompartir(o.operador) : ''}`;
}

/**
 * Interacción de la cabecera, en ES5 y en línea (sin módulos): compacta al
 * hacer scroll, progreso de lectura con requestAnimationFrame y, cuando
 * existe, el panel Compartir con la misma lógica de red que `barraOperador`
 * (crear/copiar/revocar sobre /api/share). El tipo de documento para ese
 * POST viaja en `data-tipo`, escrito por `panelCompartir` arriba: este
 * script no sabe de investigación, growth ni pilares.
 */
export const SCRIPT_CABECERA = `(function () {
  var cabecera = document.getElementById('cabecera');
  if (!cabecera) return;

  var progreso = cabecera.querySelector('.cabecera-progreso');
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var panelAbierto = false;
  var pendiente = false;

  function posicionarPanel() {
    if (!panel) return;
    var r = cabecera.getBoundingClientRect();
    panel.style.top = (r.bottom + 10) + 'px';
    // Alineado con el borde derecho de la cápsula, no con el de la ventana:
    // en pantallas anchas la cápsula no llega al borde (min(85%,1600px) y
    // centrada), así que un «right:16px» fijo del viewport lo dejaba volando
    // lejos del botón que lo abre. Con un mínimo de 16px se conserva el
    // margen de antes en pantallas angostas, donde la cápsula sí casi toca el borde.
    var margenDerecho = window.innerWidth - r.right;
    panel.style.right = Math.max(16, margenDerecho) + 'px';
  }

  function actualizar() {
    pendiente = false;
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    cabecera.classList.toggle('compacta', y > 40);
    var alto = document.documentElement.scrollHeight - window.innerHeight;
    var pct = alto > 0 ? Math.min(100, Math.max(0, (y / alto) * 100)) : 0;
    if (progreso) {
      progreso.style.width = pct + '%';
      progreso.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    if (panelAbierto) posicionarPanel();
  }
  function pedirCuadro() {
    if (pendiente) return;
    pendiente = true;
    if (reduceMotion) { actualizar(); return; }
    window.requestAnimationFrame(actualizar);
  }
  window.addEventListener('scroll', pedirCuadro, { passive: true });
  window.addEventListener('resize', pedirCuadro);
  actualizar();

  // El panel de compartir link solo existe en la vista interna.
  var boton = document.getElementById('btn-compartir');
  var panel = document.getElementById('panel-compartir');
  if (!boton || !panel) return;

  function candidatosFoco() {
    return panel.querySelectorAll('input:not([hidden]), button:not([hidden])');
  }
  function primerControl() {
    var candidatos = candidatosFoco();
    return candidatos.length ? candidatos[0] : null;
  }
  function alEscape(e) { if (e.key === 'Escape') cerrar(true); }
  function alClicFuera(e) {
    if (panel.contains(e.target) || boton.contains(e.target)) return;
    cerrar(false);
  }
  function abrir() {
    panelAbierto = true;
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    posicionarPanel();
    var f = primerControl();
    if (f) f.focus();
    document.addEventListener('keydown', alEscape);
    document.addEventListener('click', alClicFuera, true);
  }
  function cerrar(devolverFoco) {
    panelAbierto = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', alEscape);
    document.removeEventListener('click', alClicFuera, true);
    if (devolverFoco) boton.focus();
  }
  boton.addEventListener('click', function () {
    if (panelAbierto) cerrar(true); else abrir();
  });

  // Crear / copiar / revocar: misma lógica de red que la barra de operador.
  var estado = document.getElementById('panel-estado');
  var envoltura = document.getElementById('panel-link');
  var campo = document.getElementById('panel-url');
  var crear = document.getElementById('panel-crear');
  var revocar = document.getElementById('panel-revocar');
  var copiar = document.getElementById('panel-copiar');
  var avisar = function (t) {
    if (!estado) return;
    estado.textContent = t;
    setTimeout(function () { estado.textContent = ''; }, 2600);
  };

  if (crear) {
    crear.addEventListener('click', function () {
      crear.disabled = true;
      fetch('/api/share', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId: crear.getAttribute('data-documento'), tipo: crear.getAttribute('data-tipo') })
      }).then(function (res) { return res.json(); }).then(function (b) {
        if (b.ok) {
          campo.value = b.url;
          campo.setAttribute('data-token', b.token);
          if (envoltura) envoltura.hidden = false;
          crear.hidden = true;
          if (revocar) revocar.hidden = false;
          avisar('Link creado.');
        } else {
          avisar('No se pudo crear.');
        }
        crear.disabled = false;
      }).catch(function () { avisar('Sin conexion.'); crear.disabled = false; });
    });
  }

  if (copiar) {
    copiar.addEventListener('click', function () {
      campo.select();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(campo.value).then(function () { avisar('Copiado.'); }, function () { avisar('Copia manual.'); });
      } else {
        try { document.execCommand('copy'); avisar('Copiado.'); } catch (e) { avisar('Copia manual.'); }
      }
    });
  }

  if (revocar) {
    revocar.addEventListener('click', function () {
      fetch('/api/share', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: campo.getAttribute('data-token') })
      }).then(function (res) {
        if (res.ok) {
          if (envoltura) envoltura.hidden = true;
          crear.hidden = false;
          revocar.hidden = true;
          avisar('Link revocado. Ahora devuelve 404.');
        } else {
          avisar('No se pudo revocar.');
        }
      }).catch(function () { avisar('Sin conexion.'); });
    });
  }
})();`;
