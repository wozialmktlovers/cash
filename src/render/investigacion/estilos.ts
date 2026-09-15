// Los mismos tokens que el Studio, incrustados como texto: el documento se
// descarga y se imprime suelto, sin la hoja del sitio.
import TOKENS_CSS from '@/styles/tokens.css?raw';

const DOCUMENTO = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;scroll-behavior:smooth;scroll-padding-top:90px;}
body{font:var(--t-body);color:var(--texto);background:var(--fondo);transition:background-color .25s ease,color .25s ease;}
a{color:var(--rosa);}
h1,h2,h3{color:var(--tinta);letter-spacing:var(--tracking-titulo);}
h2{font:var(--t-h1);margin-bottom:18px;}
h3{font:var(--t-h3);letter-spacing:-0.01em;margin-bottom:8px;}
.eyebrow{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--rosa);}
.suave{color:var(--suave);font:var(--t-small);}

.doc-barra{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;
  background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--linea);}
.doc-barra .logo{height:22px;width:auto;filter:brightness(0);}
:root[data-tema="oscuro"] .doc-barra .logo,:root[data-tema="oscuro"] .pie .logo{filter:none;}
.doc-barra .titulo{flex:1;min-width:0;font:var(--t-small);color:var(--suave);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.doc-barra .titulo b{color:var(--tinta);font-weight:600;}

.tema-switch{display:inline-flex;padding:3px;gap:2px;border-radius:var(--r-pill);background:var(--gris);border:1px solid var(--linea);}
.tema-switch button{width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--suave);cursor:pointer;display:grid;place-items:center;}
.tema-switch svg{width:18px;height:18px;}
.tema-switch button[aria-checked="true"]{background:var(--tarjeta);color:var(--tinta);box-shadow:var(--sombra);}

.doc{max-width:760px;margin:0 auto;padding:40px 16px 64px;}
.doc section{margin-top:56px;}
.portada{margin-top:12px!important;}
.portada h1{font:var(--t-display);margin:12px 0 16px;}
.portada .resumen{font-size:1.08rem;line-height:1.65;color:var(--texto);}
.indice{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px;}
.indice a{display:inline-flex;align-items:center;min-height:44px;padding:0 18px;border-radius:var(--r-pill);
  background:var(--gris);border:1px solid var(--linea);color:var(--tinta);text-decoration:none;font:var(--t-small);font-weight:600;}
.indice a:hover{border-color:var(--rosa);color:var(--rosa);}

.tarjeta{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:22px;box-shadow:var(--sombra);}
.tarjeta+.tarjeta{margin-top:14px;}
.etiqueta{display:inline-flex;font:var(--t-micro);letter-spacing:.04em;padding:5px 10px;border-radius:var(--r-pill);margin-bottom:10px;}
.etiqueta.a_favor{background:var(--verde-s);color:var(--verde);}
.etiqueta.cuidar{background:var(--amarillo-s);color:var(--amarillo);}
.etiqueta.oportunidad{background:var(--rosa-s);color:var(--rosa);}

.columnas{display:grid;gap:14px;grid-template-columns:1fr;margin-top:18px;}
@media (min-width:700px){.columnas{grid-template-columns:1fr 1fr;}}
.columnas .tarjeta+.tarjeta{margin-top:0;}
.lista{list-style:none;display:flex;flex-direction:column;gap:8px;}
.lista li{position:relative;padding-left:18px;}
.lista li::before{content:'';position:absolute;left:0;top:.7em;width:7px;height:7px;border-radius:50%;background:var(--rosa);}

.perfil{display:flex;gap:16px;align-items:flex-start;}
.avatar{flex-shrink:0;width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-weight:700;background:var(--azul-s);color:var(--azul);}
.perfil:nth-child(odd) .avatar{background:var(--rosa-s);color:var(--rosa);}
.como-hablarle{margin-top:12px;padding:12px 14px;border-radius:var(--r-sm);background:var(--gris);font:var(--t-small);font-weight:400;}
.como-hablarle b{display:block;color:var(--tinta);margin-bottom:2px;}

.pasos{list-style:none;counter-reset:paso;display:flex;flex-direction:column;gap:14px;}
.paso{counter-increment:paso;display:flex;gap:16px;}
.paso::before{content:counter(paso);flex-shrink:0;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;
  background:var(--rosa);color:var(--sobre-acento);font-weight:700;}
.paso .cuerpo{flex:1;min-width:0;}
.paso dt{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);margin-top:10px;}
.paso dd{margin-top:2px;}
.bloque{margin-top:22px;}

.detalle{margin-top:64px;border-top:1px solid var(--linea);padding-top:24px;}
.detalle>summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font:var(--t-h3);color:var(--tinta);list-style:none;}
.detalle>summary::before{content:'+';display:inline-grid;place-items:center;width:28px;height:28px;margin-right:10px;border-radius:50%;background:var(--gris);}
.detalle[open]>summary::before{content:'−';}
.detalle h3{margin-top:32px;}
.detalle h4{font:var(--t-small);font-weight:700;color:var(--tinta);margin:18px 0 8px;}
.tabla{overflow-x:auto;border:1px solid var(--linea);border-radius:var(--r-sm);}
table{width:100%;border-collapse:collapse;font:var(--t-small);font-weight:400;}
th{text-align:left;font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--suave);background:var(--gris);padding:10px 12px;}
td{padding:10px 12px;border-top:1px solid var(--linea);vertical-align:top;}
.fuente{font-size:.8rem;white-space:nowrap;}
.sin-datos{color:var(--suave);font:var(--t-small);}
.cita{border-left:3px solid var(--rosa);padding-left:12px;margin:10px 0;}

.pie{max-width:760px;margin:0 auto;padding:24px 16px 48px;display:flex;align-items:center;gap:12px;border-top:1px solid var(--linea);color:var(--suave);font:var(--t-small);}
.pie .logo{height:18px;width:auto;filter:brightness(0);}

:focus-visible{outline:none;box-shadow:var(--foco);border-radius:var(--r-sm);}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;}html{scroll-behavior:auto;}}
@media print{
  .doc-barra,.tema-switch,#barra-op{display:none!important;}
  body{padding-top:0!important;}
  .tarjeta{box-shadow:none;break-inside:avoid;}
  .doc section{break-inside:avoid-page;}
}
`;

export const ESTILOS_INVESTIGACION = `${TOKENS_CSS}\n${DOCUMENTO}`;
