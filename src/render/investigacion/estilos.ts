// Los mismos tokens que el Studio, incrustados como texto: el documento se
// descarga y se imprime suelto, sin la hoja del sitio.
import TOKENS_CSS from '@/styles/tokens.css?raw';

// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
const DOCUMENTO = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:96px;}
body{font:var(--t-body);color:var(--texto);background:var(--fondo);}
a{color:var(--rosa);}
h1,h2,h3,h4{color:var(--tinta);letter-spacing:var(--tracking-titulo);}
h2{font:var(--t-h1);}
h3{font:var(--t-h3);letter-spacing:-0.01em;}
p{max-width:68ch;}
.eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.suave{color:var(--suave);font:var(--t-small);}

.doc-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px max(16px,7.5vw);
  background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--linea);}
.doc-barra .logo{height:22px;width:auto;filter:brightness(0);}
:root[data-tema="oscuro"] .logo{filter:none!important;}
.doc-barra .titulo{flex:1;min-width:0;font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.doc-barra .titulo b{color:var(--tinta);font-weight:600;}
.tema-switch{display:inline-flex;padding:3px;gap:2px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);}
.tema-switch button{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--suave);cursor:pointer;display:grid;place-items:center;}
.tema-switch svg{width:18px;height:18px;}
.tema-switch button[aria-checked="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:var(--sombra);}

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
.hallazgo h3{font-size:1.2rem;}
.mas summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;color:var(--rosa);font:var(--t-small);font-weight:600;}
.mas summary::after{content:'+';font-weight:700;}
.mas[open] summary::after{content:'−';}
.mas summary::-webkit-details-marker{display:none;}

.lista{list-style:none;display:grid;gap:10px;}
.lista li{position:relative;padding-left:20px;}
.lista li::before{content:'';position:absolute;left:0;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--rosa);}

.perfil{display:grid;gap:14px;grid-template-columns:auto minmax(0,1fr);align-items:start;}
.avatar{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-weight:700;font-size:1.1rem;background:var(--azul-s);color:var(--azul);}
.perfil.primero .avatar{background:var(--rosa-s);color:var(--rosa);}
.perfil .cuerpo{display:grid;gap:10px;}
.cita{font:600 1.15rem/1.45 var(--fuente);color:var(--tinta);border-left:3px solid var(--rosa);padding-left:14px;}
.como-hablarle{padding:14px;border-radius:var(--r-sm);background:var(--gris);font:var(--t-small);font-weight:400;display:grid;gap:4px;}
.seccion.alterna .como-hablarle{background:var(--fondo);}
.como-hablarle b{color:var(--tinta);}

.pasos{list-style:none;display:grid;gap:18px;counter-reset:paso;}
/* Sin grid-template-columns: son las auto-columns quienes reparten el ancho
   entre las columnas que genera grid-auto-flow:column; con un template fijo
   de por medio, auto-fit no tiene filas de sobra que colapsar y se queda en
   una sola columna. */
@media (min-width:1100px){.pasos{grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);}}
.paso{counter-increment:paso;position:relative;display:grid;gap:10px;align-content:start;padding-top:60px;}
.paso::before{content:counter(paso);position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
  background:var(--rosa);color:var(--sobre-acento);font-weight:700;z-index:1;}
@media (min-width:1100px){.paso::after{content:'';position:absolute;top:21px;left:44px;right:-18px;height:2px;background:var(--linea);}.paso:last-child::after{display:none;}}
.paso dl{display:grid;gap:4px;}
.paso dt{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.destacado{background:var(--rosa-s);border:0;box-shadow:none;}
.destacado h3{color:var(--rosa);}

.pestanas{display:flex;gap:6px;overflow-x:auto;border-bottom:1px solid var(--linea);scrollbar-width:none;}
.pestanas [role="tab"]{flex-shrink:0;min-height:48px;padding:0 20px;border:0;background:transparent;cursor:pointer;
  font:var(--t-small);font-weight:600;color:var(--suave);border-bottom:3px solid transparent;margin-bottom:-1px;}
.pestanas [role="tab"][aria-selected="true"]{color:var(--rosa);border-bottom-color:var(--rosa);}
/* :not([hidden]) para no pisar el atributo que pone el script: display:grid
   sin condición ganaba siempre sobre [hidden]{display:none} del navegador,
   así que los cuatro paneles se veían aunque solo uno estuviera seleccionado. */
.panel-tema:not([hidden]){display:grid;gap:28px;padding-top:28px;}
.panel-titulo{font:var(--t-h2);}
html.js .panel-titulo{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
.grafica{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;display:grid;gap:12px;}
.grafica figcaption{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.barra-fila{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) auto;gap:14px;align-items:center;font:var(--t-small);}
.barra-nombre{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.barra-pista{position:relative;height:14px;border-radius:var(--r-pill);background:var(--gris);}
.barra-relleno{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--azul);}
.rango-tramo{position:absolute;top:0;bottom:0;border-radius:inherit;background:var(--verde);}
.rango-punto{position:absolute;top:-3px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--amarillo);}
.barra-fila.destacada{font-weight:700;color:var(--tinta);}
.barra-fila.destacada .barra-relleno{background:var(--rosa);}
.barra-valor{font-variant-numeric:tabular-nums;font-weight:600;color:var(--tinta);}
@media (max-width:699px){.barra-fila{grid-template-columns:1fr auto;}.barra-pista{grid-column:1/-1;grid-row:2;}}
.dato-grande{font:700 clamp(24px,2.4vw,34px)/1.1 var(--fuente);color:var(--tinta);}
.chips{display:flex;flex-wrap:wrap;gap:8px;list-style:none;}
.chips li{padding:6px 12px;border-radius:var(--r-pill);background:var(--gris);font:var(--t-small);}
.fuente{font-size:.78rem;color:var(--suave);}
.sin-datos{color:var(--suave);font:var(--t-small);}

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
  .doc-barra,.indice-lateral,.pestanas,.accesos,#barra-op{display:none!important;}
  body{padding-top:0!important;}
  .pagina,.pie{width:auto;margin:0;}
  .marco{display:block;}
  .panel-tema[hidden]{display:grid!important;}
  html.js .panel-titulo{position:static;width:auto;height:auto;clip:auto;}
  html.js .aparece{opacity:1!important;translate:none!important;}
  .tarjeta,.grafica{box-shadow:none;break-inside:avoid;}
  .seccion.alterna{box-shadow:none;clip-path:none;}
}
`;

export const ESTILOS_INVESTIGACION = `${TOKENS_CSS}\n${DOCUMENTO}`;
