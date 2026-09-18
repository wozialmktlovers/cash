// Lo propio del manual de campaña sobre la base editorial compartida
// (`src/render/editorial/estilos.ts`): la placa de sección con su numeral, la
// tira de especificación de la portada, los bloques de código y copy, los
// huecos de creativo con su proporción, los grupos de formato y las filas
// clave-valor.
//
// Hasta esta rama el manual traía su propia paleta escrita a mano —negros
// fijos, blancos con alfa, rosas en rgba()— y por eso era el único
// entregable sin modo noche. Ahora todo sale de los tokens del Studio y de
// las clases que ya usan la investigación y el mapa de pilares: la cabecera
// flotante, el índice lateral, el marco al 85% y el día/noche los pone
// `envolverDocumento`, no este archivo.
//
// Lo que sigue siendo suyo y de nadie más: la escala de videollamada
// (`TOKENS`) y los componentes del machote con sus nombres de siempre
// (`CSS_COMUN`), porque renombrarlos sería tocar las nueve secciones.
//
// Regla de la casa: la separación entre bloques va con gap o con la escala
// vertical (--e1…--e5), nunca con «.a + .a { margin }».
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';
import { TOKENS, CSS_COMUN } from '../base';

const CSS_GROWTH = `
/* ── Controles de videollamada en la cabecera ────────── */
/* El manual se presenta compartiendo pantalla: sin subir el tipo, las tablas
   técnicas llegan al otro lado ilegibles. Los dos botones viven en la cápsula
   flotante, junto al switch de tema, y se van en pantalla chica — ahí manda el
   ancho, no la comodidad del operador. */
.cabecera-escala,.cabecera-pantalla{flex-shrink:0;height:44px;display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--linea);border-radius:var(--r-pill);background:var(--gris);color:var(--tinta);cursor:pointer;
  font:var(--t-small);font-weight:700;}
.cabecera-pantalla{width:44px;}
.cabecera-escala{min-width:44px;padding:0 12px;font-variant-numeric:tabular-nums;}
.cabecera-escala:hover,.cabecera-pantalla:hover{border-color:var(--rosa);color:var(--rosa);}
.cabecera-escala.on{background:var(--rosa);border-color:var(--rosa);color:var(--sobre-acento);}
.cabecera-pantalla svg{width:16px;height:16px;}
@media (max-width:899px){.cabecera-escala,.cabecera-pantalla{display:none;}}

/* ── Placa de sección ────────────────────────────────── */
/* La firma del documento: el numeral es la marca de expediente, sin recuadro,
   y el suelo alterna entre capítulos para que dos seguidos no se fundan en
   una mancha. Es la misma banda de .seccion.alterna de la base editorial,
   con el mismo truco de sombra de 100vmax para salirse del marco. */
.sec{position:relative;padding:var(--e5) 0;}
.sec:nth-of-type(even){background:var(--gris);box-shadow:0 0 0 100vmax var(--gris);clip-path:inset(0 -100vmax);}
.shead{display:flex;align-items:flex-start;gap:24px;margin-bottom:var(--e4);position:relative;}
.shead-n{flex-shrink:0;font:700 clamp(44px,5vw,76px)/.9 var(--fuente);letter-spacing:-.04em;color:var(--linea);}
:root[data-tema="oscuro"] .shead-n{color:var(--suave);opacity:.45;}
/* El numeral no lleva acento: es marca, no titular. La clase .grad viene en
   el marcado de las nueve secciones, así que se neutraliza aquí. */
.shead-n .grad{color:inherit;}
.shead-x{flex:1;min-width:0;}
.shead h2{font-size:clamp(28px,3vw,42px);}
.skicker{display:block;font:var(--t-micro);letter-spacing:.16em;text-transform:uppercase;color:var(--rosa);margin-bottom:7px;}

/* Ilustración opcional de la cabecera de sección: el icono que admite
   cabeceraSeccion() en secciones/comunes.ts. */
.ilu{position:absolute;right:0;top:-8px;width:132px;height:132px;pointer-events:none;color:var(--rosa);opacity:.14;}
.ilu svg{display:block;width:100%;height:100%;}
@media (max-width:768px){.ilu{width:88px;height:88px;}}

/* ── Ritmo vertical ──────────────────────────────────── */
/* El manual se lee de corrido y de una sentada: sin aire entre apartados,
   nueve secciones densas se convierten en un muro. Un h3 abre apartado, así
   que se separa de lo anterior mucho más de lo que se acerca a lo suyo. */
.sec h3{margin-top:var(--e4);margin-bottom:var(--e2);}
.sec h3:first-child{margin-top:0;}
.sec .card h3,.sec .card h4{margin-top:0;}
.card{padding:26px 26px 24px;}
.chips{gap:9px;}
.g2,.g3,.g4{gap:22px;}
/* Las tres tarjetas de formato se reparten el ancho de lectura, pero nunca
   por debajo de lo que hace falta para leer un copy. */
.grp-bd .g3{gap:20px;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));}
@media (max-width:900px){
  .sec{padding:var(--e4) 0;}
  .shead{gap:14px;margin-bottom:var(--e3);}
  .sec h3{margin-top:var(--e3);}
}

/* ── Portada ─────────────────────────────────────────── */
/* Las cuatro cifras son la tesis del documento —cuánto hay que construir— así
   que abren en la voz de la evidencia y separadas por filetes, no encajonadas
   en tarjetas que las igualarían al resto del contenido. */
.portada-ttl{max-width:18ch;}
.portada-tesis{margin-top:14px;max-width:44ch;font-size:clamp(1rem,1.5vw,1.2rem);line-height:1.6;color:var(--suave);
  padding-left:18px;border-left:2px solid var(--rosa);}
.portada-tesis strong{color:var(--tinta);font-weight:600;}
.spec{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--linea);border-bottom:1px solid var(--linea);}
.spec-i{padding:20px 22px 18px;border-left:1px solid var(--linea);}
.spec-i:first-child{border-left:none;padding-left:0;}
.spec-v{font-family:var(--mono);font-weight:700;font-size:clamp(1.7rem,3.4vw,2.6rem);line-height:1;letter-spacing:-.04em;color:var(--tinta);}
.spec-l{font-family:var(--mono);font-size:0.75rem;color:var(--suave);text-transform:uppercase;letter-spacing:.12em;margin-top:10px;line-height:1.4;}
@media (max-width:768px){
  .spec{grid-template-columns:repeat(2,1fr);}
  .spec-i{border-left:none;padding-left:0;border-top:1px solid var(--linea);}
  .spec-i:nth-child(-n+2){border-top:none;}
}

/* ── Bloques técnicos ────────────────────────────────── */
/* Copy, prompts y URLs: lo que se copia y se pega. Van sobre la superficie
   baja del tema (--gris), nunca sobre un negro fijo, que de día quedaba como
   una mancha y de noche se comía el texto. Se envuelven en vez de desbordarse
   a lo ancho: un prompt de tres renglones no se lee con scroll horizontal. */
.copy{background:var(--gris);border:1px solid var(--linea);border-left:3px solid var(--rosa);border-radius:var(--r-sm);
  padding:15px 17px;color:var(--texto);line-height:1.7;white-space:pre-line;}
.pre{display:block;background:var(--gris);border:1px solid var(--linea);border-radius:var(--r-sm);padding:13px 15px;
  font-family:var(--mono);font-size:0.8rem;line-height:1.8;color:var(--tinta);
  white-space:pre-wrap;overflow-wrap:anywhere;}
.pre b{color:var(--rosa);font-weight:600;}
.pre i{color:var(--verde);font-style:normal;}

/* ── Filas clave-valor ───────────────────────────────── */
.kv{display:grid;grid-template-columns:110px 1fr;gap:18px;align-items:start;padding:16px 0;
  border-bottom:1px solid var(--linea);color:var(--texto);}
.kv:last-child{border-bottom:none;padding-bottom:0;}
.kv:first-of-type{padding-top:0;}
.kv-k{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);padding-top:4px;}

/* ── Chips ───────────────────────────────────────────── */
.chip{display:inline-flex;font:var(--t-small);padding:5px 11px;border-radius:var(--r-pill);
  background:var(--gris);border:1px solid var(--linea);color:var(--texto);}
.chip-x{background:var(--rojo-s);border-color:transparent;color:var(--rojo);}
.chip-k{background:var(--azul-s);border-color:transparent;color:var(--azul);font-family:var(--mono);}

/* ── Grupos (ángulo creativo, campaña de Search) ─────── */
/* Mismo bloque que la cabecera de pilar en el banco de temas: banda de color
   suave, filo de 6px en el tono pleno y el cuerpo sobre la tarjeta. */
.grp{margin-top:var(--e3);border:1px solid var(--linea);border-radius:var(--r);background:var(--tarjeta);
  box-shadow:var(--sombra);overflow:hidden;}
.grp-hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 22px;
  border-bottom:1px solid var(--linea);border-left:6px solid var(--linea);}
.grp-a .grp-hd{background:var(--rosa-s);border-left-color:var(--rosa);}
.grp-b .grp-hd{background:var(--azul-s);border-left-color:var(--azul);}
.grp-c .grp-hd{background:var(--verde-s);border-left-color:var(--verde);}
.grp-bd{padding:26px;}

/* ── Formatos y huecos de creativo ───────────────────── */
/* La proporción manda, nunca el píxel fijo: un carrusel son cinco tarjetas
   dentro del ancho de una, así que los tamaños del machote (390px) se
   desbordaban y pisaban la columna vecina. */
.fmt{border:1px solid var(--linea);border-radius:var(--r-sm);background:var(--fondo);overflow:hidden;}
.fmt-hd{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:11px 15px;
  background:var(--gris);border-bottom:1px solid var(--linea);}
.fmt-bd{padding:20px 18px;}
/* Dentro de una tarjeta de formato la columna es estrecha —tres por fila en
   el ancho de lectura—, así que la etiqueta de la fila se pone encima del
   valor en vez de robarle 110px al copy: con la rejilla de dos columnas, un
   copy de dos renglones salía a una palabra por línea. */
.fmt-bd .kv{grid-template-columns:1fr;gap:6px;}
.fmt-bd .kv-k{padding-top:0;}
.slots,.slots-car{display:grid;gap:8px;width:100%;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));}
.slots{grid-template-columns:1fr;}
.slot{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  padding:10px 6px;text-align:center;max-width:100%;
  background:var(--fondo);border:1.5px dashed color-mix(in srgb,var(--suave) 45%,transparent);border-radius:var(--r-sm);}
.ar-1x1{aspect-ratio:1/1;}
.ar-4x5{aspect-ratio:4/5;}
.ar-9x16{aspect-ratio:9/16;}
.slot-t{font:var(--t-small);color:var(--texto);line-height:1.35;}
.slot-t strong{display:block;}
.slot-r{font-size:1rem;font-weight:800;color:var(--suave);letter-spacing:-.01em;}
.slot-p{font:var(--t-micro);letter-spacing:.06em;color:var(--suave);}

/* ── Anuncios por campaña (sección A) ────────────────── */
/* La anatomía del entregable hecho a mano —campaña con sus datos, tarjeta por
   anuncio con el arte a un lado y los copys en pestañas al otro— vestida con
   la línea del Studio. Las pestañas son las .pestanas de la base editorial y
   las mueve SCRIPT_EDITORIAL; aquí solo se ajustan a la tarjeta. */
.campanas{display:grid;gap:var(--e4);margin-top:var(--e3);}
.campana{display:grid;gap:var(--e2);}
.campana-hd{display:grid;gap:8px;padding-left:18px;border-left:6px solid var(--rosa);}
.campana-b .campana-hd{border-left-color:var(--azul);}
.campana-c .campana-hd{border-left-color:var(--verde);}
.campana-hd .skicker{margin-bottom:0;}
.sec .campana-hd h3{margin:0;font-size:clamp(1.3rem,2.2vw,1.7rem);}
.campana-datos{display:flex;flex-wrap:wrap;gap:8px;list-style:none;margin:4px 0 0;padding:0;}
.campana-datos li{font:var(--t-small);padding:6px 12px;border-radius:var(--r-pill);background:var(--tarjeta);border:1px solid var(--linea);color:var(--texto);}
.anuncios-lista{display:grid;gap:22px;}
.anuncio{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);background:var(--tarjeta);border:1px solid var(--linea);
  border-radius:var(--r);box-shadow:var(--sombra);overflow:hidden;scroll-margin-top:96px;}
.anuncio-arte{display:flex;flex-direction:column;align-items:center;gap:16px;padding:24px;background:var(--gris);border-right:1px solid var(--linea);}
/* El hueco toma la proporción de la pieza y un ancho tope por formato, para
   que un 9:16 no mida un metro de alto dentro de la tarjeta. */
.arte-hueco{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;padding:16px;text-align:center;
  background:var(--fondo);border:1.5px dashed color-mix(in srgb,var(--suave) 45%,transparent);border-radius:var(--r-sm);}
.arte-hueco.ar-1x1{max-width:320px;}
.arte-hueco.ar-4x5{max-width:280px;}
.arte-hueco.ar-9x16{max-width:220px;}
.arte-hueco-k{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--suave);}
.arte-hueco-r{font:700 clamp(1.8rem,3vw,2.4rem)/1 var(--fuente);letter-spacing:-.03em;color:var(--tinta);}
.arte-hueco-m{font-family:var(--mono);font-size:0.8rem;color:var(--suave);}
.arte-brief{display:grid;gap:8px;width:100%;}
.arte-brief-hd,.anuncio-panel-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;}
.arte-brief .kv-k{padding-top:0;}
/* El prompt base va una vez, sobre las campañas, con la misma pieza que el
   brief de cada anuncio: rótulo, botón Copiar y el texto en monoespaciada. */
.prompt-base{margin-top:var(--e2);}
.anuncio-info{display:grid;align-content:start;gap:16px;padding:26px;min-width:0;}
.anuncio-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--linea);}
.anuncio-hd .eyebrow{margin-bottom:4px;}
.sec .anuncio h3{margin:0;font-size:clamp(1.25rem,2vw,1.6rem);}
.anuncio-formato{flex-shrink:0;white-space:nowrap;}
.anuncio-proposito{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;font-size:1.05rem;color:var(--tinta);font-weight:600;}
.anuncio-proposito .kv-k{padding-top:0;}
.anuncio-pestanas{margin-bottom:-4px;}
.anuncio-panel:not([hidden]){display:grid;gap:8px;}
/* Con JS la pestaña ya dice qué copy es; sin JS los dos paneles van seguidos
   y el título es lo único que los distingue. */
html.js .anuncio-panel-titulo{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
.anuncio-panel-titulo{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
html.js .anuncio-panel-hd{justify-content:flex-end;}
.anuncio-copiar{display:none;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:var(--tarjeta);color:var(--texto);font:var(--t-small);font-weight:600;cursor:pointer;}
html.js .anuncio-copiar{display:inline-flex;}
.anuncio-copiar:hover{border-color:var(--rosa);color:var(--rosa);}
.anuncio-copiar svg{width:14px;height:14px;}
@media (max-width:900px){
  .anuncio{grid-template-columns:1fr;}
  .anuncio-arte{border-right:none;border-bottom:1px solid var(--linea);padding:18px;}
  /* En el teléfono el hueco es referencia, no protagonista: más chico, para
     que el copy no quede a dos pantallas del encabezado del anuncio. */
  .arte-hueco.ar-1x1{max-width:200px;}
  .arte-hueco.ar-4x5{max-width:180px;}
  .arte-hueco.ar-9x16{max-width:150px;}
  .anuncio-info{padding:18px;}
  .anuncio-hd{flex-direction:column;gap:10px;}
}

@media (max-width:768px){
  .kv{grid-template-columns:1fr;gap:5px;padding:11px 0;}
  .kv-k{padding-top:0;}
  .card{padding:18px;}
  .grp-bd,.grp-hd{padding:16px;}
}

@media print{
  .sec{padding:var(--e4) 0;}
  .sec:nth-of-type(even){box-shadow:none;clip-path:none;}
  .grp,.card,.fmt{box-shadow:none;break-inside:avoid;}
  .cabecera-escala,.cabecera-pantalla{display:none!important;}
  .anuncio{break-inside:avoid;box-shadow:none;}
  .anuncio-copiar{display:none!important;}
  .anuncio-panel[hidden]{display:grid!important;}
  html.js .anuncio-panel-titulo{position:static;width:auto;height:auto;clip:auto;}
}
`;

export const ESTILOS_GROWTH = `${ESTILOS_EDITORIAL}
${TOKENS}
${CSS_COMUN}
${CSS_GROWTH}`;
