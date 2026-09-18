// Lo propio del entregable del mes sobre la base editorial compartida
// (`src/render/editorial/estilos.ts`): el mensaje con la cuenta regresiva de la
// portada, la cuadrícula del feed, el calendario, la tarjeta grande de una
// pieza (arte a la izquierda, datos a la derecha) y la tira de historias.
//
// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
//
// Los colores de estado salen de los tokens `--verde/-s`, `--rosa/-s` y
// `--gris`, que son los pares que `tests/lib/ui/contraste.test.ts` ya vigila en
// los dos temas. Nada de color-mix para texto: solo para veladuras.
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';

const CONTENIDO = `
/* Barra de progreso: la misma pieza que usa el mapa de pilares para su avance.
   Aquí lleva «14 de 22 aprobadas» (diseño §7). */
.progreso-pista{position:relative;height:10px;border-radius:var(--r-pill);background:var(--gris);overflow:hidden;}
.progreso-relleno{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--verde);}
.avance-revision{display:grid;gap:8px;max-width:460px;}
.avance-revision .cuenta{font:var(--t-small);color:var(--suave);}

/* Estado de revisión de una pieza. El pendiente es neutro a propósito: no es un
   problema, es que el cliente todavía no la ha visto. */
.estado-pieza{justify-self:start;display:inline-flex;align-items:center;gap:6px;flex-shrink:0;
  font:var(--t-micro);letter-spacing:.04em;padding:6px 12px;border-radius:var(--r-pill);
  background:var(--gris);color:var(--suave);}
.estado-pieza.aprobada{background:var(--verde-s);color:var(--verde);}
.estado-pieza.cambios{background:var(--rosa-s);color:var(--rosa);}
.estado-pieza::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor;}

/* Portada · el mensaje al cliente con el plazo -------------------------- */
.mensaje-cliente{display:grid;gap:14px;padding:26px;border-radius:var(--r);background:var(--rosa-s);}
.mensaje-cliente h2{font:var(--t-h2);color:var(--rosa);}
.mensaje-cliente p{max-width:62ch;}
.plazo{display:flex;flex-wrap:wrap;align-items:center;gap:12px;}
.plazo-dato{display:grid;gap:2px;padding:12px 16px;border-radius:var(--r-sm);background:var(--tarjeta);}
.plazo-dato span{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.plazo-dato strong{font:var(--t-h3);color:var(--tinta);}
/* Se pinta con JS; sin JS queda la fecha límite de al lado, que es el dato que
   de verdad importa. La cuenta regresiva es la cortesía. */
.cuenta-regresiva strong{font-variant-numeric:tabular-nums;}
.cuenta-regresiva.vencido strong{color:var(--rojo);}

/* 01 · Vista del feed ---------------------------------------------------- */
/* Tres columnas SIEMPRE, también en celular: es la retícula del perfil, y a dos
   o a cuatro ya no se parece a lo que el cliente va a ver en Instagram. El gap
   de 3px es el de la app. */
.feed-rejilla{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;
  max-width:560px;border-radius:var(--r-sm);overflow:hidden;background:var(--linea);}
.feed-celda{position:relative;display:block;aspect-ratio:1/1;background:var(--gris);overflow:hidden;}
.feed-celda img{width:100%;height:100%;object-fit:cover;display:block;}
.feed-celda:hover img,.feed-celda:focus-visible img{opacity:.82;}
/* Sin arte todavía: el hueco dice de qué pieza es, en vez de quedar en blanco. */
.feed-vacia{display:grid;place-content:center;gap:4px;justify-items:center;color:var(--suave);font:var(--t-micro);text-align:center;padding:6px;}
.feed-vacia svg{width:18px;height:18px;}
/* Distintivo de formato en la esquina, como el de la app. */
.feed-marca{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:6px;
  display:grid;place-items:center;background:color-mix(in srgb,var(--tinta) 55%,transparent);color:#fff;}
.feed-marca svg{width:13px;height:13px;}
.feed-perfil{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start;}
.feed-perfil .pila{flex:1;min-width:260px;}
/* La retícula es hija de un flex: sin base propia se encogía a lo que medían
   sus celdas (con columnas minmax(0,1fr), casi nada) y quedaba en 96 px de
   ancho, tres cuadritos de 30 px en el celular. */
.feed-perfil .feed-rejilla{flex:1 1 300px;}

/* 02 · Calendario -------------------------------------------------------- */
.calendario{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;}
.calendario-dia-nombre{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);text-align:center;padding-bottom:4px;}
.dia{min-height:84px;display:grid;gap:4px;align-content:start;padding:6px;border-radius:var(--r-sm);
  border:1px solid var(--linea);background:var(--tarjeta);}
.dia.vacio{border-style:dashed;background:transparent;}
.dia.fin-de-semana{background:var(--gris);}
.dia-numero{font:var(--t-micro);color:var(--suave);}
.dia-pieza{display:flex;align-items:center;gap:4px;padding:3px 6px;border-radius:6px;text-decoration:none;
  background:var(--gris);color:var(--suave);font:var(--t-micro);}
.dia-pieza svg{width:12px;height:12px;flex-shrink:0;}
.dia-pieza.aprobada{background:var(--verde-s);color:var(--verde);}
.dia-pieza.cambios{background:var(--rosa-s);color:var(--rosa);}
.dia-pieza:hover{box-shadow:0 0 0 1px currentColor;}
/* En celular el mes entero a siete columnas deja celdas de ~40px: caben el
   número y los puntos de color, no las etiquetas. */
@media (max-width:699px){
  .dia{min-height:54px;padding:4px;}
  /* 24 px de alto como mínimo (WCAG 2.5.8): con 16 px el dedo no atinaba. */
  .dia-pieza{justify-content:center;padding:2px;min-height:24px;}
  .dia-pieza .dia-pieza-num{display:none;}
}
.sin-fecha{display:flex;flex-wrap:wrap;gap:8px;}

/* Leyenda de formatos y estados, para que los iconos y los colores del
   calendario se puedan leer sin adivinar. */
.leyenda{display:flex;flex-wrap:wrap;gap:8px 18px;}
.leyenda-item{display:inline-flex;align-items:center;gap:6px;font:var(--t-small);color:var(--suave);}
.leyenda-item svg{width:14px;height:14px;}
.leyenda-punto{width:10px;height:10px;border-radius:50%;background:var(--suave);}
.leyenda-punto.aprobada{background:var(--verde);}
.leyenda-punto.cambios{background:var(--rosa);}

/* Filtros de la sección 03. Sin JS no filtran nada, así que se esconden igual
   que las pestañas de la base editorial. */
.filtros-contenido{display:none;}
html.js .filtros-contenido{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}
.filtros-grupo{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.filtros-grupo > span{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);}
.filtro-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:transparent;color:var(--texto);font:var(--t-small);font-weight:600;cursor:pointer;}
.filtro-btn svg{width:14px;height:14px;}
.filtro-btn:hover{border-color:var(--rosa);color:var(--rosa);}
.filtro-btn[aria-pressed="true"]{background:var(--tinta);border-color:var(--tinta);color:var(--fondo);}
.filtros-contenido output{margin-left:auto;font:var(--t-small);color:var(--suave);}

/* 03 · Tarjeta grande de una pieza -------------------------------------- */
.piezas-lista{display:grid;gap:18px;}
.pieza-tarjeta{display:grid;gap:0;border:1px solid var(--linea);border-radius:var(--r);background:var(--tarjeta);
  box-shadow:var(--sombra);overflow:hidden;scroll-margin-top:110px;}
@media (min-width:900px){
  /* Arte a la izquierda, datos a la derecha (diseño §7). La columna del arte
     es fija para que todas las tarjetas se alineen aunque el arte sea
     cuadrado, vertical o un reproductor. */
  .pieza-tarjeta{grid-template-columns:minmax(0,340px) minmax(0,1fr);}
}
.pieza-arte{display:grid;gap:10px;align-content:start;padding:18px;background:var(--gris);}
.pieza-visor{position:relative;display:block;width:100%;border-radius:var(--r-sm);overflow:hidden;background:var(--linea);}
.pieza-visor img,.pieza-visor video{width:100%;height:100%;object-fit:cover;display:block;background:var(--linea);}
.pieza-visor.cuadrado{aspect-ratio:1/1;}
.pieza-visor.vertical{aspect-ratio:9/16;}
.pieza-miniaturas{display:flex;flex-wrap:wrap;gap:6px;}
.pieza-miniatura{width:52px;height:52px;padding:0;border-radius:8px;overflow:hidden;cursor:pointer;
  border:2px solid transparent;background:var(--linea);}
.pieza-miniatura img{width:100%;height:100%;object-fit:cover;display:block;}
.pieza-miniatura[aria-current="true"]{border-color:var(--rosa);}
.pieza-enlace{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 16px;
  border-radius:var(--r-pill);border:1px solid var(--linea);background:var(--tarjeta);color:var(--tinta);
  text-decoration:none;font:var(--t-small);font-weight:600;}
.pieza-enlace:hover{border-color:var(--rosa);color:var(--rosa);}
.pieza-enlace svg{width:15px;height:15px;}
.arte-pendiente{display:grid;place-content:center;justify-items:center;gap:8px;aspect-ratio:1/1;
  border-radius:var(--r-sm);border:1px dashed var(--linea);color:var(--suave);font:var(--t-small);text-align:center;padding:16px;}
.arte-pendiente svg{width:22px;height:22px;}

.pieza-datos{display:grid;gap:16px;align-content:start;padding:22px;}
.pieza-cabeza{display:flex;flex-wrap:wrap;align-items:flex-start;gap:12px;}
.pieza-cabeza .pila{flex:1;min-width:0;gap:2px;}
.pieza-cabeza h3{font:var(--t-h2);}
.pieza-meta{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));}
.pieza-dato{display:grid;gap:2px;}
.pieza-dato span{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);}
.pieza-dato strong{font:var(--t-small);font-weight:600;color:var(--tinta);}
.bloque-texto{display:grid;gap:8px;padding:16px;border-radius:var(--r-sm);background:var(--gris);}
.bloque-cabeza{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;}
.bloque-cabeza h4{font:var(--t-h3);}
/* El copy se guarda con sus saltos de línea y se publica igual: se muestra tal
   cual, que es la única forma de revisarlo de verdad. */
.copy-texto{white-space:pre-wrap;max-width:62ch;}
.hashtags-texto{color:var(--azul);word-break:break-word;max-width:62ch;}
.btn-copiar{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 16px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:var(--tarjeta);color:var(--texto);font:var(--t-small);font-weight:600;cursor:pointer;}
.btn-copiar:hover{border-color:var(--rosa);color:var(--rosa);}
.btn-copiar svg{width:14px;height:14px;}
.nota-cliente{display:grid;gap:6px;padding:16px;border-radius:var(--r-sm);background:var(--rosa-s);color:var(--tinta);}
.nota-cliente span{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--rosa);}
.vacio-seccion{padding:26px;border-radius:var(--r);border:1px dashed var(--linea);color:var(--suave);}

/* Revisión del cliente (diseño §6, tarea C2) ----------------------------- */
/* Todo este bloque depende de JS —la decisión se manda al servidor— así que
   sin JS se esconde y queda en su lugar la línea que lo explica. Misma regla
   que los filtros de la sección 03: un botón que no hace nada engaña, y aquí
   el plazo sigue corriendo mientras el cliente cree que aprobó. */
.revision{display:grid;gap:10px;padding-top:16px;border-top:1px solid var(--linea);}
.revision-sin-js{font:var(--t-small);color:var(--suave);}
html.js .revision-sin-js{display:none;}
.revision-botones{display:none;flex-wrap:wrap;gap:8px;}
html.js .revision-botones{display:flex;}
.btn-revision{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 18px;
  border-radius:var(--r-pill);border:1px solid transparent;font:var(--t-small);font-weight:600;cursor:pointer;}
.btn-revision svg{width:15px;height:15px;flex-shrink:0;}
.btn-revision[disabled]{opacity:.55;cursor:default;}
.btn-revision.aprobar{background:var(--verde);color:var(--fondo);}
.btn-revision.aprobar:hover:not([disabled]){filter:brightness(1.06);}
.btn-revision.cambios{background:transparent;border-color:var(--linea);color:var(--texto);}
.btn-revision.cambios:hover:not([disabled]){border-color:var(--rosa);color:var(--rosa);}
.btn-revision.suave{background:transparent;color:var(--suave);}
.btn-revision.suave:hover:not([disabled]){color:var(--tinta);}
.revision-nota{display:grid;gap:8px;padding:14px;border-radius:var(--r-sm);background:var(--gris);}
.revision-nota label{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);}
.revision-nota textarea{width:100%;padding:10px 12px;border-radius:var(--r-sm);border:1px solid var(--linea);
  background:var(--tarjeta);color:var(--texto);font:var(--t-small);font-family:inherit;resize:vertical;}
/* Vacío no ocupa renglón: el aviso solo aparece cuando hay algo que decir. */
.revision-aviso{font:var(--t-small);}
.revision-aviso:empty{display:none;}
.revision-aviso.bien{color:var(--verde);}
.revision-aviso.mal{color:var(--rojo);}
/* En la tira de historias la tarjeta mide 230px: los dos botones no caben de
   lado y se apilan. */
.historia-tarjeta .revision-botones{flex-direction:column;align-items:stretch;}

/* Portada · qué se puede hacer en esta copia del mes y qué no. */
.como-decidir{max-width:62ch;}
.como-decidir.solo-lectura a{color:var(--rosa);text-decoration:underline;text-underline-offset:3px;}

/* 04 · Historias --------------------------------------------------------- */
/* Tira horizontal de tarjetas verticales (diseño §7). Es una lista con scroll
   propio, no una rejilla que envuelve: las historias se leen en orden y se
   pasan de lado, como en la app. */
.historias-tira{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,230px);gap:14px;
  overflow-x:auto;padding-bottom:10px;scroll-snap-type:x proximity;list-style:none;}
.historia-tarjeta{display:grid;gap:10px;align-content:start;scroll-snap-align:start;
  border:1px solid var(--linea);border-radius:var(--r);background:var(--tarjeta);box-shadow:var(--sombra);
  padding:12px;scroll-margin-top:110px;}
.historia-tarjeta .pieza-visor{aspect-ratio:9/16;}
.historia-cabeza{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.historia-cabeza strong{font:var(--t-h3);color:var(--tinta);}
.historia-fecha{font:var(--t-small);color:var(--suave);}
.historia-copy{font:var(--t-small);white-space:pre-wrap;max-height:7.6em;overflow:hidden;}

@media print{
  .filtros-contenido,.btn-copiar,.pieza-miniaturas,.cuenta-regresiva,.revision{display:none!important;}
  .pieza-tarjeta,.historia-tarjeta{box-shadow:none;break-inside:avoid;}
  .historias-tira{grid-auto-flow:row;grid-auto-columns:auto;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;}
  .dia{break-inside:avoid;}
}
`;

export const ESTILOS_CONTENIDO = `${ESTILOS_EDITORIAL}\n${CONTENIDO}`;
