// Lo propio del mapa de pilares sobre la base editorial compartida
// (`src/render/editorial/estilos.ts`): tarjetas de idea/principio/pilar,
// barra apilada del mix, la barra de herramientas del banco (en píldora,
// pegajosa al bajar), la tarjeta de tema con sus estados y el panel de nota.
//
// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';

const PILARES = `
.dato-grande{font:700 clamp(24px,2.4vw,34px)/1.1 var(--fuente);color:var(--tinta);}

/* Barra de progreso genérica, para el avance global y las mini tarjetas por pilar. */
.progreso-pista{position:relative;height:10px;border-radius:var(--r-pill);background:var(--gris);overflow:hidden;}
.progreso-relleno{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--rosa);}
.avance-global{display:grid;gap:8px;max-width:420px;}

/* 01 · Punto de partida: el filo de color va inline (tres colores fijos, sin variable). */
.idea-tarjeta{border-left-width:4px;border-left-style:solid;}

/* 02 · No negociables: número grande a modo de marca de agua discreta. */
.principio-tarjeta{position:relative;}
.principio-num{font:700 clamp(30px,3vw,40px)/1 var(--fuente);color:var(--linea);}
:root[data-tema="oscuro"] .principio-num{color:var(--suave);opacity:.45;}

/* 03 · Los 5 pilares: fila desde 1300px, como pide el spec (no coincide con
   los cortes de .rejilla, que son 700/1100). */
.pilares-fila{display:grid;gap:18px;grid-template-columns:1fr;}
@media (min-width:700px){.pilares-fila{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media (min-width:1300px){.pilares-fila{grid-template-columns:repeat(5,minmax(0,1fr));}}
.pilar-tarjeta{cursor:pointer;border-top:4px solid var(--color-pilar);}
.pilar-tarjeta:hover,.pilar-tarjeta:focus-visible{border-color:var(--color-pilar);box-shadow:0 0 0 1px var(--color-pilar);}
.pilar-num{justify-self:start;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;
  background:var(--color-pilar);color:var(--sobre-acento);font-weight:700;}

/* 04 · Mix editorial: barra apilada, un tramo por función. */
.mix-barra{display:flex;height:26px;border-radius:var(--r-pill);overflow:hidden;background:var(--gris);}
.mix-tramo{height:100%;}
.mix-tramo.fuera-margen{outline:2px dashed var(--rojo);outline-offset:-2px;}
.etiqueta-funcion{justify-self:start;display:inline-flex;font:var(--t-micro);letter-spacing:.04em;padding:5px 10px;border-radius:var(--r-pill);}
.etiqueta-funcion.autoridad{background:var(--azul-s);color:var(--azul);}
.etiqueta-funcion.conexion{background:var(--rosa-s);color:var(--rosa);}
.etiqueta-funcion.engagement{background:var(--amarillo-s);color:var(--amarillo);}
.etiqueta-funcion.prueba_social{background:var(--verde-s);color:var(--verde);}
.etiqueta-funcion.venta{background:var(--tinta);color:var(--sobre-acento);}

/* 05 · Conversión: pasos en línea, como en la investigación pero sin
   depender de sus estilos (el mapa de pilares no los importa). */
.pasos-conversion{list-style:none;display:grid;gap:18px;counter-reset:paso;}
@media (min-width:900px){.pasos-conversion{grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);}}
.pasos-conversion li{counter-increment:paso;position:relative;display:grid;gap:6px;align-content:start;padding-top:52px;}
.pasos-conversion li::before{content:counter(paso);position:absolute;top:0;left:0;width:38px;height:38px;border-radius:50%;display:grid;place-items:center;
  background:var(--sobre-acento);color:var(--rosa);font-weight:700;}

/* 06 · Banco de temas ------------------------------------------------- */
.herramientas{position:sticky;top:96px;z-index:4;display:flex;flex-wrap:wrap;align-items:center;gap:10px;
  padding:12px 16px;border-radius:var(--r-pill);background:color-mix(in srgb,var(--tarjeta) 92%,transparent);
  backdrop-filter:blur(10px);border:1px solid var(--linea);box-shadow:var(--sombra);}
.herramientas input[type="search"]{flex:1;min-width:160px;min-height:44px;padding:0 14px;border-radius:var(--r-pill);
  border:1px solid var(--linea);background:var(--gris);color:var(--tinta);font:var(--t-small);}
.herramientas select{min-height:44px;padding:0 12px;border-radius:var(--r-pill);border:1px solid var(--linea);
  background:var(--gris);color:var(--tinta);font:var(--t-small);}
.herramientas button{min-height:44px;padding:0 16px;border-radius:var(--r-pill);border:1px solid var(--linea);
  background:transparent;color:var(--texto);font:var(--t-small);font-weight:600;cursor:pointer;}
.herramientas button:hover{border-color:var(--rosa);color:var(--rosa);}
.herramientas output{margin-left:auto;font:var(--t-small);color:var(--suave);}

.avance-mini-grid{display:grid;gap:14px;grid-template-columns:repeat(2,minmax(0,1fr));}
@media (min-width:900px){.avance-mini-grid{grid-template-columns:repeat(5,minmax(0,1fr));}}
.avance-mini-item{display:grid;gap:8px;padding:16px;border-radius:var(--r);background:var(--tarjeta);border:1px solid var(--linea);box-shadow:var(--sombra);}
.avance-mini-num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:var(--color-pilar);color:var(--sobre-acento);font-weight:700;font-size:.8rem;}
.avance-mini-item .progreso-relleno{background:var(--color-pilar);}

.aviso-revision{display:grid;gap:8px;padding:16px 18px;border-radius:var(--r-sm);background:var(--amarillo-s);color:var(--tinta);}
.aviso-revision .lista li::before{background:var(--amarillo);}

.pilares-bloques{display:grid;gap:18px;}
.pilar-bloque{border-radius:var(--r);border:1px solid var(--linea);background:var(--tarjeta);box-shadow:var(--sombra);overflow:hidden;}
.pilar-cabecera{list-style:none;cursor:pointer;display:flex;align-items:center;gap:16px;padding:18px 22px;
  border-left:6px solid var(--color-pilar);}
.pilar-cabecera::-webkit-details-marker{display:none;}
.pilar-cabecera .pilar-num{flex-shrink:0;}
.pilar-info{flex:1;min-width:0;display:grid;gap:2px;}
.pilar-conteo{flex-shrink:0;font:var(--t-small);color:var(--suave);}
.pilar-bloque > .pestanas,.pilar-bloque > .panel-tema{margin:0 22px;}
.pilar-bloque > .panel-tema:last-child{padding-bottom:22px;}
.pilar-bloque.vacio{border-style:dashed;}
.pilar-vacio-cuerpo{display:grid;gap:10px;padding:0 22px 22px;justify-items:start;}

.tema-tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r-sm);padding:16px;
  display:grid;gap:8px;align-content:start;}
.tema-tarjeta[data-estado="publicado"]{opacity:.68;}
.tema-id{font:var(--t-micro);letter-spacing:.06em;color:var(--suave);}
.tema-etiquetas{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.etiqueta-formato{display:inline-flex;align-items:center;gap:5px;font:var(--t-small);color:var(--suave);}
.etiqueta-formato svg{width:14px;height:14px;}
.tema-texto{color:var(--texto);}
.tema-controles{display:flex;flex-wrap:wrap;gap:8px;}
.boton-estado,.boton-nota{min-height:44px;padding:0 14px;border-radius:var(--r-pill);border:1px solid var(--linea);
  background:var(--gris);color:var(--texto);font:var(--t-small);font-weight:600;cursor:pointer;}
.boton-estado[data-estado-actual="pendiente"]{background:var(--gris);color:var(--suave);}
.boton-estado[data-estado-actual="en_desarrollo"]{background:var(--amarillo-s);color:var(--amarillo);border-color:transparent;}
.boton-estado[data-estado-actual="desarrollado"]{background:var(--azul-s);color:var(--azul);border-color:transparent;}
.boton-estado[data-estado-actual="publicado"]{background:var(--verde-s);color:var(--verde);border-color:transparent;}
.boton-nota{position:relative;}
.boton-nota.con-nota::after{content:'';position:absolute;top:6px;right:8px;width:7px;height:7px;border-radius:50%;background:var(--rosa);}
.tema-meta{font:var(--t-small);color:var(--suave);min-height:16px;}

dialog.panel-nota{width:min(480px,calc(100vw - 32px));border:1px solid var(--linea);border-radius:var(--r);
  padding:24px;display:grid;gap:14px;background:var(--tarjeta);color:var(--texto);box-shadow:var(--sombra);}
dialog.panel-nota::backdrop{background:color-mix(in srgb,var(--tinta) 45%,transparent);}
.panel-nota-titulo{font:var(--t-h3);color:var(--tinta);}
dialog.panel-nota textarea{min-height:140px;padding:12px;border-radius:var(--r-sm);border:1px solid var(--linea);
  background:var(--gris);color:var(--tinta);font:var(--t-body);resize:vertical;}

@media print{
  .herramientas,.avance-mini-grid,.aviso-revision,.boton-estado,.boton-nota,.tema-meta,dialog.panel-nota{display:none!important;}
  .pilar-bloque{box-shadow:none;break-inside:avoid;}
  .tema-tarjeta{box-shadow:none;break-inside:avoid;}
}
`;

export const ESTILOS_PILARES = `${ESTILOS_EDITORIAL}\n${PILARES}`;
