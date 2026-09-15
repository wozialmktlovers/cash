import { escapar } from '@/render/escapar';
import { SCRIPT_TEMA, COLOR_BARRA } from '@/lib/ui/tema';
import { LOGO_WOZIAL_SRC } from '@/render/marca';
import type { OpcionesBarra } from '@/render/barra-operador';
import { cabeceraDocumento, bandaVistaPrevia, SCRIPT_CABECERA_BASE, SCRIPT_CABECERA_COMPARTIR } from './cabecera';
import { SCRIPT_EDITORIAL } from './interaccion';
import { atributoFlujo, panelComentarios, SCRIPT_FLUJO, type FlujoDatos } from './flujo-cliente';

export { escapar };

export function lista(items: string[]): string {
  if (!items.length) return '';
  return `<ul class="lista">${items.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>`;
}

/** Número grande, título y una línea de entrada: la jerarquía que faltaba entre secciones. */
export function encabezadoSeccion(num: string, titulo: string, entrada: string): string {
  return `<header class="seccion-cabeza aparece">
    <span class="seccion-num">${escapar(num)}</span>
    <div><h2>${escapar(titulo)}</h2><p class="entrada">${escapar(entrada)}</p></div>
  </header>`;
}

/**
 * Documento autónomo completo: head con tema y estilos en línea, cabecera
 * flotante, marco con índice lateral y cuerpo, pie y scripts. Es el molde
 * que hasta ahora armaba `renderizarInvestigacion` a mano; cualquier
 * documento editorial (investigación, mapa de pilares...) lo reutiliza,
 * pasando su etiqueta, sus estilos propios (ya sumados a `ESTILOS_EDITORIAL`)
 * y su índice y cuerpo ya armados.
 */
export function envolverDocumento(o: {
  titulo: string;
  etiqueta: string;
  cliente: string;
  fecha: string;
  estilos: string;
  indice: [num: string, id: string, nombre: string][];
  cuerpo: string;
  operador?: OpcionesBarra;
  scriptsExtra?: string;
  /** Solo en la vista interna: activa `data-flujo` en `<body>` y `SCRIPT_FLUJO` (edición y versiones — B6). */
  flujo?: FlujoDatos;
  /**
   * Enlace «← Mi portal» — solo en el portal del cliente (C2, spec §4).
   * `vistaPrevia` (fix menores, punto 3) agrega la banda de aviso cuando
   * quien mira es admin/operador previsualizando, no el cliente real.
   */
  volver?: { href: string; texto: string; vistaPrevia?: boolean };
  /** Texto de ayuda sobre el panel de comentarios — solo en el portal (C2, spec §4). */
  ayudaComentarios?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>${escapar(o.titulo)}</title>
<meta name="theme-color" content="${COLOR_BARRA.claro}">
<script>${SCRIPT_TEMA}</script>
<script>document.documentElement.classList.add('js');</script>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${o.estilos}</style>
</head><body${o.flujo ? atributoFlujo(o.flujo) : ''}${o.volver?.vistaPrevia ? ' data-vista-previa' : ''}>
${o.volver?.vistaPrevia ? bandaVistaPrevia(o.volver.href) : ''}
${cabeceraDocumento({
  etiqueta: o.etiqueta, cliente: o.cliente, operador: o.operador,
  puedeEditar: o.flujo?.puedeEditar, puedeComentar: o.flujo?.puedeComentar,
  volver: o.volver, ayudaComentarios: o.ayudaComentarios,
})}
<div class="pagina"><div class="marco">
  <nav class="indice-lateral" aria-label="Secciones">
    <ol>${o.indice.map(([num, id, nombre]) => `<li><a href="#${id}"><span>${num}</span>${nombre}</a></li>`).join('')}</ol>
  </nav>
  <main>
${o.cuerpo}
  </main>
</div></div>
<footer class="pie">
  <img class="logo" src="${LOGO_WOZIAL_SRC}" alt="Wozial" width="545" height="194">
  <span>Preparado por Wozial · ${escapar(o.fecha)}</span>
</footer>
<script>${SCRIPT_EDITORIAL}</script>
<script>${SCRIPT_CABECERA_BASE}</script>
${o.operador ? `<script>${SCRIPT_CABECERA_COMPARTIR}</script>` : ''}
${o.flujo ? `<script>${SCRIPT_FLUJO}</script>` : ''}
${o.scriptsExtra ? `<script>${o.scriptsExtra}</script>` : ''}
</body></html>`;
}
