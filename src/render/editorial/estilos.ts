// Los mismos tokens que el Studio, incrustados como texto: el documento se
// descarga y se imprime suelto, sin la hoja del sitio.
//
// Base compartida entre cualquier documento editorial (investigación, mapa de
// pilares...): tokens, reset, cabecera flotante, marco de página con índice
// lateral, portada y cifras, secciones numeradas, tarjetas/etiquetas/listas,
// pestañas ARIA, apariciones, pie, foco, movimiento reducido e impresión.
// Lo propio de cada documento (gráficas, perfiles, citas, pasos...) vive en
// su propio archivo de estilos, que suma esta base a sus reglas.
import TOKENS_CSS from '@/styles/tokens.css?raw';

// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
const EDITORIAL = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
/* Red de seguridad para el panel de compartir link: sus botones y campos
   traen su propio display (flex/inline-flex) sin condición, que ganaría
   siempre sobre el [hidden]{display:none} del navegador, igual que le
   pasaba a las pestañas del detalle antes de esta rama. */
[hidden]{display:none!important;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:96px;}
/* La cabecera flotante es fija y no reserva su espacio en el flujo: el
   cuerpo lo hace a mano, a juego con scroll-padding-top de arriba. */
body{font:var(--t-body);color:var(--texto);background:var(--fondo);padding-top:96px;}
a{color:var(--rosa);}
h1,h2,h3,h4{color:var(--tinta);letter-spacing:var(--tracking-titulo);}
h2{font:var(--t-h1);}
h3{font:var(--t-h3);letter-spacing:-0.01em;}
p{max-width:68ch;}
.eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.suave{color:var(--suave);font:var(--t-small);}

:root[data-tema="oscuro"] .logo{filter:none!important;}
.tema-switch{display:inline-flex;padding:3px;gap:2px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);}
.tema-switch button{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--suave);cursor:pointer;display:grid;place-items:center;}
.tema-switch svg{width:18px;height:18px;}
.tema-switch button[aria-checked="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:var(--sombra);}

/* Cabecera flotante: sustituye a las dos barras de antes (la del documento y
   la del operador). Cápsula independiente del flujo, con overflow:hidden
   para que la barra de progreso quede recortada por su propio radio sin
   necesidad de un clip-path aparte. El panel de compartir link vive fuera de
   ella a propósito, para no quedar atrapado por ese overflow. */
.cabecera{position:fixed;top:14px;left:50%;translate:-50% 0;z-index:60;
  width:min(85%,1600px);height:64px;display:flex;align-items:center;gap:16px;padding:0 20px;
  border-radius:var(--r-pill);overflow:hidden;
  background:color-mix(in srgb,var(--tarjeta) 82%,transparent);backdrop-filter:blur(16px);
  border:1px solid var(--linea);box-shadow:var(--sombra);
  transition:height .2s ease;}
.cabecera.compacta{height:52px;}
@media (max-width:899px){.cabecera{width:calc(100% - 24px);}}
@media (prefers-reduced-motion:reduce){.cabecera{transition:none;}}

.cabecera-marca{display:flex;align-items:center;gap:10px;min-width:0;flex:1;overflow:hidden;}
.cabecera .logo{height:24px;width:auto;flex-shrink:0;filter:brightness(0);transition:height .2s ease;}
.cabecera.compacta .logo{height:20px;}
@media (prefers-reduced-motion:reduce){.cabecera .logo{transition:none;}}
.cabecera .titulo{font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cabecera .titulo b{color:var(--tinta);font-weight:600;}

.cabecera-acciones{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.cabecera-compartir{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:var(--gris);color:var(--tinta);font:var(--t-small);font-weight:600;cursor:pointer;}
.cabecera-compartir:hover{border-color:var(--rosa);color:var(--rosa);}
.cabecera-compartir svg{width:16px;height:16px;flex-shrink:0;}
@media (max-width:520px){.cabecera-compartir{width:44px;padding:0;justify-content:center;}.cabecera-compartir .texto-compartir{display:none;}}

.cabecera-progreso{position:absolute;left:0;bottom:0;height:3px;width:0;background:var(--rosa);}

.panel-compartir{position:fixed;z-index:61;right:16px;width:min(380px,calc(100vw - 24px));
  background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);box-shadow:var(--sombra);
  padding:20px;display:grid;gap:14px;}
.panel-compartir[hidden]{display:none;}
.panel-eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.panel-link{display:flex;gap:8px;}
.panel-url{flex:1;min-width:0;min-height:44px;padding:0 12px;border-radius:var(--r-sm);border:1px solid var(--linea);
  background:var(--gris);color:var(--tinta);font:var(--t-small);}
.panel-boton{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:var(--r-sm);
  border:1px solid var(--linea);background:transparent;color:var(--texto);text-decoration:none;font:var(--t-small);font-weight:600;cursor:pointer;}
.panel-boton:hover{border-color:var(--rosa);color:var(--rosa);}
.panel-primario{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}
.panel-peligro{color:var(--rojo);border-color:var(--rojo-s);}
.panel-peligro:hover{border-color:var(--rojo);}
.panel-filas{display:flex;flex-wrap:wrap;gap:8px;}
.panel-estado{font:var(--t-small);color:var(--suave);min-height:18px;}

.pagina{width:auto;margin:0 16px;}
.marco{display:block;}
.indice-lateral{display:none;}
@media (min-width:900px){
  .pagina{width:min(85%,1600px);margin:0 auto;}
  .marco{display:grid;grid-template-columns:190px minmax(0,1fr);gap:56px;}
  /* z-index explícito: sin él, el clip-path de .seccion.alterna abre su
     propio contexto de apilamiento a la altura de z-index:0 y, al venir
     después en el DOM, pinta por encima del índice fijo. */
  .indice-lateral{display:block;position:sticky;top:96px;align-self:start;padding-top:48px;z-index:5;}
}
.indice-lateral ol{list-style:none;display:flex;flex-direction:column;gap:4px;border-left:2px solid var(--linea);}
.indice-lateral a{display:flex;gap:10px;align-items:baseline;min-height:44px;padding:10px 14px;margin-left:-2px;border-left:2px solid transparent;
  color:var(--suave);text-decoration:none;font:var(--t-small);}
.indice-lateral a span{font-weight:700;}
.indice-lateral a:hover,.indice-lateral a.activo{color:var(--tinta);border-left-color:var(--rosa);}
.indice-lateral a.activo span{color:var(--rosa);}

.portada{min-height:70vh;display:grid;align-content:center;gap:32px;padding:56px 0;}
.portada-texto{display:grid;gap:20px;}
@media (min-width:1100px){.portada-texto{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);align-items:end;gap:48px;}}
.portada h1{font:var(--t-display);font-size:clamp(34px,4.6vw,64px);line-height:1.04;}
.portada .resumen{font-size:1.12rem;line-height:1.6;}
.cifras{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));}
.cifra-tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:22px;display:grid;gap:6px;box-shadow:var(--sombra);}
.cifra-valor{font:700 clamp(30px,3.2vw,44px)/1 var(--fuente);letter-spacing:var(--tracking-titulo);color:var(--tinta);}
.cifra-tarjeta.a_favor .cifra-valor{color:var(--verde);}
.cifra-tarjeta.cuidar .cifra-valor{color:var(--amarillo);}
.cifra-etiqueta{font:var(--t-small);color:var(--texto);}
.accesos{display:flex;flex-wrap:wrap;gap:8px;}
.accesos a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);
  color:var(--tinta);text-decoration:none;font:var(--t-small);font-weight:600;}
.accesos a:hover{border-color:var(--rosa);color:var(--rosa);}

.seccion{padding:72px 0;display:grid;gap:36px;}
.seccion.alterna{background:var(--gris);box-shadow:0 0 0 100vmax var(--gris);clip-path:inset(0 -100vmax);}
.seccion-cabeza{display:flex;gap:24px;align-items:flex-start;}
.seccion-num{font:700 clamp(44px,5vw,76px)/.9 var(--fuente);color:var(--linea);letter-spacing:-0.04em;}
:root[data-tema="oscuro"] .seccion-num{color:var(--suave);opacity:.45;}
.seccion-cabeza h2{font-size:clamp(28px,3vw,42px);}
.entrada{color:var(--suave);margin-top:6px;}
.subtitulo{font:var(--t-h3);color:var(--tinta);}

.rejilla{display:grid;gap:18px;grid-template-columns:1fr;}
@media (min-width:700px){.rejilla.dos,.rejilla.tres,.rejilla.cuatro{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (min-width:1100px){.rejilla.tres{grid-template-columns:repeat(3,minmax(0,1fr));}.rejilla.cuatro{grid-template-columns:repeat(4,minmax(0,1fr));}}
.pila{display:grid;gap:14px;align-content:start;}

.tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;box-shadow:var(--sombra);display:grid;gap:10px;align-content:start;}
.etiqueta{justify-self:start;display:inline-flex;font:var(--t-micro);letter-spacing:.04em;padding:5px 10px;border-radius:var(--r-pill);}
.etiqueta.a_favor{background:var(--verde-s);color:var(--verde);}
.etiqueta.cuidar{background:var(--amarillo-s);color:var(--amarillo);}
.etiqueta.oportunidad{background:var(--rosa-s);color:var(--rosa);}
.mas summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--rosa);font:var(--t-small);font-weight:600;}
.mas summary::after{content:'+';font-weight:700;}
.mas[open] summary::after{content:'−';}
.mas summary::-webkit-details-marker{display:none;}

.lista{list-style:none;display:grid;gap:10px;}
.lista li{position:relative;padding-left:20px;}
.lista li::before{content:'';position:absolute;left:0;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--rosa);}

.destacado{background:var(--rosa-s);border:0;box-shadow:none;}
.destacado h3{color:var(--rosa);}

/* Sin JS los botones no hacen nada (los paneles ya están todos visibles uno
   tras otro): se ocultan y solo aparecen cuando el script marca <html class="js">. */
.pestanas{display:none;}
html.js .pestanas{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--linea);scrollbar-width:none;}
.pestanas [role="tab"]{flex-shrink:0;min-height:48px;padding:0 20px;border:0;background:transparent;cursor:pointer;
  font:var(--t-small);font-weight:600;color:var(--suave);border-bottom:3px solid transparent;margin-bottom:-1px;}
.pestanas [role="tab"][aria-selected="true"]{color:var(--rosa);border-bottom-color:var(--rosa);}
/* :not([hidden]) para no pisar el atributo que pone el script: display:grid
   sin condición ganaba siempre sobre [hidden]{display:none} del navegador,
   así que los cuatro paneles se veían aunque solo uno estuviera seleccionado. */
.panel-tema:not([hidden]){display:grid;gap:28px;padding-top:28px;}
.panel-titulo{font:var(--t-h2);}
html.js .panel-titulo{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}

.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;}
.chips li{padding:6px 12px;border-radius:var(--r-pill);background:var(--gris);font:var(--t-small);}

.pie{width:min(85%,1600px);margin:0 auto;padding:28px 0 56px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--linea);color:var(--suave);font:var(--t-small);}
@media (max-width:899px){.pie{width:auto;margin:0 16px;}}
.pie .logo{height:18px;width:auto;filter:brightness(0);}

html.js .aparece{opacity:0;translate:0 18px;transition:opacity .5s ease,translate .5s ease;}
html.js .aparece.visible{opacity:1;translate:0 0;}
:focus-visible{outline:none;box-shadow:var(--foco);border-radius:var(--r-sm);}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto;}
  html.js .aparece{opacity:1;translate:none;transition:none;}
}
@media print{
  .cabecera,.panel-compartir,.indice-lateral,.pestanas,.accesos{display:none!important;}
  body{padding-top:0!important;}
  .pagina,.pie{width:auto;margin:0;}
  .marco{display:block;}
  .panel-tema[hidden]{display:grid!important;}
  html.js .panel-titulo{position:static;width:auto;height:auto;clip:auto;}
  html.js .aparece{opacity:1!important;translate:none!important;}
  .tarjeta{box-shadow:none;break-inside:avoid;}
  .seccion.alterna{box-shadow:none;clip-path:none;}
}
`;

export const ESTILOS_EDITORIAL = `${TOKENS_CSS}\n${EDITORIAL}`;
