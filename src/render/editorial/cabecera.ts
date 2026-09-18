import type { OpcionesBarra } from '@/render/barra-operador';
import { escapar } from '@/render/escapar';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import { botonesFlujo, panelVersiones, barraEdicion, panelComentarios } from './flujo-cliente';

const SOL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const LUNA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';
const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5l6.8-3.8M8.6 13.5l6.8 3.8"/></svg>';
// Mismo trazo que `atras` en src/components/Icono.astro — un botón icono,
// nunca texto: en la cápsula angosta (portal, 375px) un enlace de texto
// («← Mi portal») envolvía a dos líneas y desbordaba la cabecera fija
// (visto en la verificación en vivo de C2). `aria-label` lleva la palabra.
const ICONO_VOLVER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
// Mismo trazo que `ojo` en src/components/Icono.astro: este archivo no es
// .astro, así que no puede usar ese componente y repite el path a mano.
const ICONO_OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';

/**
 * Banda «Vista previa del portal» cuando admin/operador abren el documento
 * aprobado desde `/portal/documentos/...` en modo previsualización (fix
 * menores, punto 3): mismo aviso que ya ve quien previsualiza la portada del
 * portal (`PortalBase.astro`), para que no confunda esta copia congelada
 * (la versión aprobada) con la vista interna normal del documento.
 */
export function bandaVistaPrevia(hrefVolver: string): string {
  return `<div class="banda-vista-previa">
    <span>${ICONO_OJO}Vista previa del portal</span>
    <a href="${escapar(hrefVolver)}">${ICONO_VOLVER}Volver a la ficha</a>
  </div>`;
}

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
function panelCompartir(o: OpcionesBarra, etiqueta: string): string {
  const url = o.tokenActivo ? `${o.base}/p/${o.clienteSlug}/${o.tokenActivo}` : '';

  return `<div class="panel-compartir" id="panel-compartir" role="dialog" aria-label="Compartir ${escapar(etiqueta.toLowerCase())}" hidden>
    <p class="panel-eyebrow">Vista interna · v${o.version}</p>
    <div class="panel-link" id="panel-link" ${o.tokenActivo ? '' : 'hidden'}>
      <input class="panel-url" id="panel-url" type="text" readonly aria-label="URL pública" value="${escapar(url)}" data-token="${escapar(o.tokenActivo ?? '')}">
      <button type="button" class="panel-boton" id="panel-copiar">Copiar</button>
    </div>
    ${o.razonNoCompartir
      // Sin permiso de crear (M2 punto 1): la razón ocupa el lugar del botón.
      ? `<p class="panel-razon" id="panel-razon" ${o.tokenActivo ? 'hidden' : ''}>${escapar(o.razonNoCompartir)}</p>`
      : `<button type="button" class="panel-boton panel-primario" id="panel-crear" data-documento="${escapar(o.documentoId)}" data-tipo="${escapar(o.tipo)}" ${o.tokenActivo ? 'hidden' : ''}>Crear link público</button>`}
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
 *
 * Los botones de Editar/Comentar y sus paneles van por `puedeEditar`/
 * `puedeComentar`, no por `operador`: en la vista interna siempre viajan
 * juntos (ese es el único llamador hasta C2), pero el portal del cliente
 * (C2, spec §4) necesita el botón y el panel de Comentar sin Compartir ni
 * el resto de la barra de operador — de ahí la separación.
 */
export function cabeceraDocumento(o: {
  etiqueta: string; cliente: string; operador?: OpcionesBarra; puedeEditar?: boolean; puedeComentar?: boolean;
  /** Enlace «← Mi portal» — solo en la vista del portal del cliente (C2). */
  volver?: { href: string; texto: string };
  /** Texto de ayuda sobre el panel de comentarios — solo en el portal (C2, spec §4). */
  ayudaComentarios?: string;
  /**
   * Botones propios del documento, delante del switch de tema. Hasta hoy solo
   * los usa el manual de campaña (escala de texto y pantalla completa): se
   * presenta compartiendo pantalla en videollamada y esos dos controles son
   * suyos, no de la base. Quien no los manda, no los tiene.
   */
  accionesExtra?: string;
}): string {
  return `<header class="cabecera" id="cabecera">
  <div class="cabecera-marca">
    ${o.volver ? `<a class="cabecera-volver" href="${escapar(o.volver.href)}" aria-label="${escapar(o.volver.texto)}" title="${escapar(o.volver.texto)}">${ICONO_VOLVER}</a>` : ''}
    <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
    <span class="titulo">${escapar(o.etiqueta)} · <b>${escapar(o.cliente)}</b></span>
  </div>
  <div class="cabecera-acciones">
    ${o.accionesExtra ?? ''}
    <div class="tema-switch" role="radiogroup" aria-label="Tema de color">
      <button type="button" role="radio" aria-checked="false" data-tema-valor="claro" aria-label="Día">${SOL}</button>
      <button type="button" role="radio" aria-checked="false" data-tema-valor="oscuro" aria-label="Noche">${LUNA}</button>
    </div>
    ${o.puedeEditar || o.puedeComentar ? botonesFlujo(Boolean(o.puedeEditar), Boolean(o.puedeComentar)) : ''}
    ${o.operador ? botonCompartir() : ''}
  </div>
  <div class="cabecera-progreso" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" aria-label="Progreso de lectura"></div>
</header>
${o.operador ? panelCompartir(o.operador, o.etiqueta) : ''}
${o.puedeEditar ? panelVersiones() + barraEdicion() : ''}
${o.puedeComentar ? panelComentarios(o.ayudaComentarios) : ''}`;
}

/**
 * Interacción base de la cabecera, en ES5 y en línea (sin módulos): compacta
 * al hacer scroll y progreso de lectura con requestAnimationFrame. Nada de
 * esto depende del botón Compartir — corre igual en la vista interna, en el
 * link público y en el portal del cliente (C2, spec §4).
 */
export const SCRIPT_CABECERA_BASE = `(function () {
  var cabecera = document.getElementById('cabecera');
  if (!cabecera) return;

  var progreso = cabecera.querySelector('.cabecera-progreso');
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var pendiente = false;

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
})();`;

/**
 * Interacción del botón Compartir y su panel (crear/copiar/revocar sobre
 * `/api/share`, misma lógica de red que `barraOperador`). El tipo de
 * documento para ese POST viaja en `data-tipo`, escrito por `panelCompartir`
 * arriba: este script no sabe de investigación, growth ni pilares.
 *
 * Aparte de `SCRIPT_CABECERA_BASE` a propósito (C2, spec §4): el botón y el
 * panel solo existen en la vista interna (`operador`), así que en el portal
 * del cliente ni siquiera se manda esta cadena — ninguna referencia a
 * `/api/share` llega al HTML que ve el cliente, aunque el botón tampoco
 * estuviera ahí para activarla.
 */
export const SCRIPT_CABECERA_COMPARTIR = `(function () {
  var cabecera = document.getElementById('cabecera');
  var boton = document.getElementById('btn-compartir');
  var panel = document.getElementById('panel-compartir');
  if (!cabecera || !boton || !panel) return;

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

  // El panel se reposiciona en su propio scroll/resize (independiente del
  // de SCRIPT_CABECERA_BASE): solo hace algo mientras está abierto.
  function actualizarPosicion() {
    pendiente = false;
    if (panelAbierto) posicionarPanel();
  }
  function pedirCuadro() {
    if (pendiente) return;
    pendiente = true;
    if (reduceMotion) { actualizarPosicion(); return; }
    window.requestAnimationFrame(actualizarPosicion);
  }
  window.addEventListener('scroll', pedirCuadro, { passive: true });
  window.addEventListener('resize', pedirCuadro);

  function candidatosFoco() {
    return panel.querySelectorAll('input:not([hidden]), button:not([hidden])');
  }
  function primerControl() {
    var candidatos = candidatosFoco();
    return candidatos.length ? candidatos[0] : null;
  }
  // Se escucha en fase de captura: este listener se registra al abrir el
  // panel, después del de SCRIPT_FLUJO (que se registra al cargar), así que
  // en fase de burbuja llegaría tarde. En captura corre antes y corta el
  // Escape para que no pregunte «¿salir sin guardar?» ni salga del modo
  // comentar mientras solo se cierra este panel.
  function alEscape(e) { if (e.key === 'Escape') { e.stopPropagation(); cerrar(true); } }
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
    document.addEventListener('keydown', alEscape, true);
    document.addEventListener('click', alClicFuera, true);
  }
  function cerrar(devolverFoco) {
    panelAbierto = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', alEscape, true);
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
  // Sin permiso de compartir no hay botón de crear, solo la razón (M2 punto 1).
  var razon = document.getElementById('panel-razon');
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
          avisar((b.errores && b.errores[0]) || 'No se pudo crear.');
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
          if (crear) crear.hidden = false;
          if (razon) razon.hidden = false;
          revocar.hidden = true;
          avisar('Link revocado. Ahora devuelve 404.');
        } else {
          avisar('No se pudo revocar.');
        }
      }).catch(function () { avisar('Sin conexion.'); });
    });
  }
})();`;

/**
 * Las dos juntas, para quien no necesita distinguirlas (pruebas existentes,
 * o cualquier caso que siempre tenga `operador`). `envolverDocumento` no usa
 * esta constante: manda cada mitad por separado, para poder omitir la de
 * Compartir en el portal del cliente (C2).
 */
export const SCRIPT_CABECERA = `${SCRIPT_CABECERA_BASE}\n${SCRIPT_CABECERA_COMPARTIR}`;
