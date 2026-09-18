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
/* El enlace del logo no aporta nada visual: solo envuelve la imagen. flex
   para que no meta la línea de base de un elemento en línea bajo el logo.
   El anillo de foco va hacia dentro porque .cabecera-marca recorta con
   overflow:hidden y el común (hacia fuera) quedaría cortado arriba y abajo;
   el relleno vertical le da sitio sin mover el logo de lado. */
.cabecera-inicio{display:flex;align-items:center;flex-shrink:0;min-height:44px;padding-block:4px;border-radius:6px;text-decoration:none;}
.cabecera-inicio:focus-visible{box-shadow:inset var(--foco);}
.cabecera .logo{height:24px;width:auto;flex-shrink:0;filter:brightness(0);transition:height .2s ease;}
.cabecera.compacta .logo{height:20px;}
@media (prefers-reduced-motion:reduce){.cabecera .logo{transition:none;}}
.cabecera .titulo{font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.cabecera .titulo b{color:var(--tinta);font-weight:600;}

.cabecera-acciones{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.cabecera-accion{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:var(--gris);color:var(--tinta);font:var(--t-small);font-weight:600;cursor:pointer;white-space:nowrap;}
.cabecera-accion:hover{border-color:var(--rosa);color:var(--rosa);}
.cabecera-accion svg{width:16px;height:16px;flex-shrink:0;}

/* Menú de acciones del documento. En escritorio no existe a la vista: el
   botón de tres puntos va oculto y el contenedor se pinta en línea con el
   switch de tema primero, igual que antes. */
.cabecera-menu{display:none;flex-shrink:0;width:44px;height:44px;border-radius:50%;align-items:center;justify-content:center;position:relative;
  border:1px solid var(--linea);background:var(--gris);color:var(--tinta);cursor:pointer;}
.cabecera-menu:hover{border-color:var(--rosa);color:var(--rosa);}
.cabecera-menu svg{width:18px;height:18px;}
.menu-acciones{display:flex;align-items:center;gap:8px;}
.menu-tema{display:contents;}
.menu-tema-texto{display:none;}
.menu-acciones .tema-switch{order:-1;}
/* La barra de progreso vive en su propia pista recortada: así la cápsula
   puede dejar de recortar (overflow visible en celular) para que el menú
   se despliegue debajo sin que la barra se salga de las esquinas. */
.cabecera-pista{position:absolute;inset:0;border-radius:inherit;overflow:hidden;pointer-events:none;}

/* Pantallas angostas: las acciones del documento (editar, versiones,
   comentar, comentarios, compartir link) y el switch de tema se recogen en un desplegable
   bajo la cápsula. Fuera quedan volver, el logo, el título y el botón. El
   corte está en 1199 px porque con todas las acciones (más «Salir de
   comentar» y los dos controles de videollamada del manual) la fila pide
   unos 850 px más logo y título: por debajo de ahí el logo se salía. */
@media (max-width:1199px){
  .cabecera{overflow:visible;}
  /* Etiqueta y cliente en dos renglones: en una sola línea, a 375 px, el
     nombre del cliente quedaba cortado a las pocas letras. */
  .cabecera .titulo{display:flex;flex-direction:column;min-width:0;line-height:1.25;}
  .cabecera .titulo > *{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .cabecera .titulo-sep{display:none;}
  .cabecera-menu{display:inline-flex;}
  .menu-acciones{position:absolute;top:calc(100% + 8px);right:0;z-index:62;display:none;flex-direction:column;align-items:stretch;gap:4px;
    width:min(280px,calc(100vw - 24px));max-height:calc(100vh - 120px);overflow-y:auto;padding:8px;
    background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);box-shadow:var(--sombra);}
  .cabecera.menu-abierto .menu-acciones{display:flex;}
  .menu-acciones .cabecera-accion{width:100%;justify-content:flex-start;border-radius:var(--r-sm);border-color:transparent;background:transparent;padding:0 12px;font:var(--t-body);font-weight:600;}
  .menu-acciones .cabecera-accion:hover{background:var(--gris);}
  .menu-acciones .texto-compartir{display:inline;}
  .menu-acciones .cabecera-compartir svg{display:none;}
  .menu-tema{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 4px 4px 12px;margin-top:4px;border-top:1px solid var(--linea);}
  /* En el portal sin acciones el tema va solo: sin filete encima. */
  .menu-tema:first-child{margin-top:0;padding-top:4px;border-top:none;}
  .menu-tema-texto{display:inline;font:var(--t-small);font-weight:600;color:var(--suave);}
  .menu-acciones .tema-switch{order:0;}
  /* Un modo activo (Editar o Comentar) queda escondido dentro del menú:
     un punto rosa en el botón avisa que hay algo encendido ahí dentro. */
  html.modo-edicion .cabecera-menu::after,html.modo-comentar .cabecera-menu::after{content:"";position:absolute;top:6px;right:6px;width:9px;height:9px;border-radius:50%;background:var(--rosa);}
}

/* Enlace de vuelta al portal del cliente (C2, spec §4): botón icono fijo de
   44 px, nunca texto — siempre en la cabecera angosta del portal, así que
   nunca vale la pena reservarle sitio a una etiqueta que se vería recortada
   en celular. */
.cabecera-volver{flex-shrink:0;width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--linea);background:var(--gris);color:var(--tinta);}
.cabecera-volver:hover{border-color:var(--rosa);color:var(--rosa);}
.cabecera-volver svg{width:16px;height:16px;flex-shrink:0;}

.cabecera-progreso{position:absolute;left:0;bottom:0;height:3px;width:0;background:var(--rosa);}

/* Banda «Vista previa del portal» (fix menores, punto 3): fija arriba de
   todo (por encima de la cápsula, z-index 60), empuja la cabecera flotante
   hacia abajo con el selector por atributo body[data-vista-previa],
   igual que el aviso equivalente de PortalBase.astro. */
.banda-vista-previa{position:fixed;top:0;left:0;right:0;z-index:65;
  display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;
  min-height:40px;padding:8px 16px;background:var(--tinta);color:var(--fondo);
  font:var(--t-small);font-weight:600;text-align:center;}
.banda-vista-previa span,.banda-vista-previa a{display:inline-flex;align-items:center;gap:6px;}
.banda-vista-previa svg{width:16px;height:16px;flex-shrink:0;}
.banda-vista-previa a{color:var(--fondo);text-decoration:underline;text-underline-offset:3px;}
body[data-vista-previa]{padding-top:136px;}
body[data-vista-previa] .cabecera{top:54px;}

.panel-compartir{position:fixed;z-index:61;right:16px;width:min(380px,calc(100vw - 24px));
  background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);box-shadow:var(--sombra);
  padding:20px;display:grid;gap:14px;}
/* Regla propia quitada (limpieza M3, punto 1): el [hidden]{display:none!important}
   global (arriba en este mismo archivo) ya cubre .panel-compartir[hidden]. */
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
/* Razón por la que no se puede crear el link (M2 punto 1): en lugar del botón. */
.panel-razon{font:var(--t-small);color:var(--suave);margin:0;max-width:34ch;}

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

/* minmax(0,1fr) y no la columna implícita (auto): con auto, una fila de
   pestañas más ancha que la pantalla (sección «detalle» de la investigación)
   estiraba la sección y, con ella, toda la página a 443 px en un celular. */
.seccion{padding:72px 0;display:grid;grid-template-columns:minmax(0,1fr);gap:36px;}
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
  .cabecera,.panel-compartir,.indice-lateral,.pestanas,.accesos,.banda-vista-previa{display:none!important;}
  body{padding-top:0!important;}
  .pagina,.pie{width:auto;margin:0;}
  .marco{display:block;}
  .panel-tema[hidden]{display:grid!important;}
  html.js .panel-titulo{position:static;width:auto;height:auto;clip:auto;}
  html.js .aparece{opacity:1!important;translate:none!important;}
  .tarjeta{box-shadow:none;break-inside:avoid;}
  .seccion.alterna{box-shadow:none;clip-path:none;}
}

/* Edición sobre el documento y versiones (B6, spec §3). */
#btn-flujo-editar[aria-pressed="true"]{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}

html.modo-edicion [data-editable]{outline:2px dashed var(--rosa);outline-offset:3px;border-radius:4px;cursor:text;}
html.modo-edicion [data-editable]:focus-visible{outline-style:solid;}

.barra-edicion{position:fixed;left:50%;translate:-50% 0;bottom:16px;z-index:70;
  display:flex;flex-wrap:wrap;align-items:center;gap:16px;min-height:44px;padding:10px 18px;border-radius:var(--r-pill);
  background:var(--tinta);color:var(--fondo);box-shadow:var(--sombra);font:var(--t-small);font-weight:600;}
.barra-edicion[hidden]{display:none;}
.barra-edicion-estado{color:var(--suave);font-weight:500;}
.barra-edicion-botones{display:flex;gap:8px;}
.barra-edicion-botones button{min-height:44px;padding:0 16px;border-radius:var(--r-sm);border:1px solid color-mix(in srgb,var(--fondo) 30%,transparent);
  background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;}
.barra-edicion-botones .barra-guardar{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}
.barra-edicion-botones button:hover{opacity:.85;}
/* Celular: barra de lado a lado, con el contador a la izquierda, los dos
   botones a la derecha y el estado (si hay) en un renglón debajo. Centrada y con flex-wrap se
   partía en dos renglones y quedaba como una burbuja deforme. */
@media (max-width:640px){
  .barra-edicion:not([hidden]){left:12px;right:12px;translate:none;display:grid;grid-template-columns:minmax(0,1fr) auto;
    column-gap:10px;row-gap:0;padding:8px 8px 8px 16px;border-radius:var(--r);}
  .barra-edicion #barra-edicion-contador{grid-column:1;grid-row:1;align-self:center;}
  .barra-edicion-botones{grid-column:2;grid-row:1;}
  .barra-edicion-estado{grid-column:1 / span 2;grid-row:2;padding-top:4px;font-size:.8rem;}
  .barra-edicion-estado:empty{display:none;}
  .barra-edicion-botones button{padding:0 14px;}
}
@media print{.barra-edicion{display:none!important;}}

dialog.dialogo-versiones{width:min(520px,calc(100vw - 32px));border:1px solid var(--linea);border-radius:var(--r);
  padding:24px;display:grid;gap:14px;background:var(--tarjeta);color:var(--texto);box-shadow:var(--sombra);}
/* margin:auto de vuelta: el reset «*{margin:0}» le quitaba al <dialog> el
   centrado del navegador y lo dejaba pegado a la esquina de arriba. */
dialog.dialogo-versiones{margin:auto;max-height:calc(100vh - 32px);overflow-y:auto;}
dialog.dialogo-versiones:not([open]){display:none;}
dialog.dialogo-versiones::backdrop{background:color-mix(in srgb,var(--tinta) 45%,transparent);}
.dialogo-cabecera{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.dialogo-cabecera h3{font:var(--t-h3);color:var(--tinta);}
.dialogo-versiones-lista{display:grid;gap:10px;max-height:50vh;overflow-y:auto;}
.version-fila{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--linea);border-radius:var(--r-sm);}
.version-info{display:grid;gap:2px;}
.version-motivo{font-weight:700;color:var(--tinta);}

/* Comentarios anclados (B7, spec §3). */
#btn-flujo-comentar[aria-pressed="true"]{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}
#btn-flujo-editar:disabled,#btn-flujo-comentar:disabled{opacity:.45;cursor:not-allowed;}

html.modo-comentar{cursor:crosshair;}
html.modo-comentar [data-ancla]{position:relative;}
html.modo-comentar [data-ancla]:hover{outline:2px dashed var(--azul);outline-offset:3px;border-radius:4px;cursor:pointer;}
/* Los marcadores se pintan al cargar la página, fuera del modo Comentar
   (spec §3: «los elementos con comentarios abiertos llevan un marcador», sin
   condicionarlo al modo) — así que su contenedor necesita 'position:relative'
   siempre que traiga uno, no solo en 'html.modo-comentar'. Fix round 1, punto
   7: en vez de dárselo a TODO '[data-ancla]' sin condición (cientos de
   elementos en un documento largo, casi ninguno con marcador), 'SCRIPT_FLUJO'
   marca con esta clase solo a los que de verdad tienen uno. */
.tiene-marcador-comentario{position:relative;}

.marcador-comentario{position:absolute;top:-8px;right:-8px;min-width:22px;height:22px;padding:0 6px;border-radius:var(--r-pill);
  background:var(--rosa);color:var(--sobre-acento);font:var(--t-small);font-weight:700;display:flex;align-items:center;justify-content:center;
  box-shadow:var(--sombra);pointer-events:none;z-index:5;}

.ancla-resaltada{outline:3px solid var(--rosa);outline-offset:4px;border-radius:4px;transition:outline-color .3s ease;}

dialog.dialogo-comentarios{width:min(420px,calc(100vw - 32px));max-height:min(640px,calc(100vh - 64px));border:1px solid var(--linea);border-radius:var(--r);
  padding:24px;display:grid;gap:14px;background:var(--tarjeta);color:var(--texto);box-shadow:var(--sombra);
  position:fixed;inset:16px 16px auto auto;margin:0;}
dialog.dialogo-comentarios:not([open]){display:none;}
dialog.dialogo-comentarios::backdrop{background:transparent;}
/* Texto de ayuda del portal del cliente (C2, spec §4): explica cómo dejar
   una observación, antes de los filtros. */
.panel-ayuda{margin:0;}
.comentarios-filtros{display:flex;gap:8px;flex-wrap:wrap;}
.filtro-comentarios{min-height:44px;padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--linea);background:transparent;color:var(--texto);font:var(--t-small);cursor:pointer;}
.filtro-comentarios[aria-pressed="true"]{background:var(--tinta);border-color:var(--tinta);color:var(--fondo);font-weight:700;}
.comentarios-lista{display:grid;gap:12px;overflow-y:auto;max-height:60vh;}
.comentario-fila{display:grid;gap:6px;padding:12px;border:1px solid var(--linea);border-radius:var(--r-sm);}
.comentario-respuesta{margin-inline-start:20px;background:var(--gris);border-style:dashed;}
.comentario-cabeza{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.comentario-autor{font-weight:700;color:var(--tinta);}
.comentario-ancla{font-family:monospace;word-break:break-all;}
.respuesta-area{display:grid;gap:8px;}
.respuesta-area textarea{width:100%;min-height:70px;padding:10px;border-radius:var(--r-sm);border:1px solid var(--linea);background:var(--fondo);color:var(--texto);font:inherit;resize:vertical;}

.recuadro-comentario{position:fixed;z-index:80;width:min(320px,calc(100vw - 32px));display:grid;gap:10px;padding:16px;
  border-radius:var(--r);border:1px solid var(--linea);background:var(--tarjeta);color:var(--texto);box-shadow:var(--sombra);}
/* Aviso de modo Comentar en celular: ahí «Salir de comentar» vive dentro
   del menú de acciones, y sin él no habría salida a la vista. */
.aviso-comentar{display:none;}
@media (max-width:1199px){
  html.modo-comentar .aviso-comentar{position:fixed;left:50%;translate:-50% 0;bottom:16px;z-index:70;width:max-content;max-width:calc(100vw - 24px);
    display:flex;align-items:center;gap:12px;padding:6px 6px 6px 18px;border-radius:var(--r-pill);
    background:var(--tinta);color:var(--fondo);box-shadow:var(--sombra);font:var(--t-small);font-weight:600;}
  /* Mientras se escribe un comentario, el recuadro manda: el aviso se quita. */
  html.modo-comentar .recuadro-comentario:not([hidden]) ~ .aviso-comentar{display:none;}
  html.modo-comentar .aviso-comentar .panel-boton{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);border-radius:var(--r-pill);}
}
@media print{.aviso-comentar{display:none!important;}}
.recuadro-comentario-ancla{font:var(--t-small);font-family:monospace;color:var(--suave);word-break:break-all;}
.recuadro-comentario textarea{width:100%;min-height:90px;padding:10px;border-radius:var(--r-sm);border:1px solid var(--linea);background:var(--fondo);color:var(--texto);font:inherit;resize:vertical;}
@media print{.dialogo-comentarios,.recuadro-comentario,.marcador-comentario{display:none!important;}}
`;

export const ESTILOS_EDITORIAL = `${TOKENS_CSS}\n${EDITORIAL}`;
