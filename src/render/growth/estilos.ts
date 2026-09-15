// Envase del manual de campaña: nueve secciones que se leen de corrido, con
// nav de anclas en vez de deck horizontal.
//
// Las clases vienen del machote, con una diferencia: todos los tamaños de
// letra pasaron de px a rem con piso de 0.75rem. El machote bajaba a 8.5px, y
// este documento también se presenta compartiendo pantalla en videollamada:
// ahí 8.5px le llegan al otro lado como cuatro o cinco píxeles efectivos.
//
// Origen: Wozial/estrategias/machote-growth-wozial.html

import { TOKENS, CSS_COMUN } from '../base';

const CSS_GROWTH = `
/* ── Tokens propios del machote de Growth ────────────── */
/* El machote nombra sus superficies y líneas de otra forma que el Social
   Research. Se declaran aquí, encima de la base compartida, en vez de
   reescribir las 84 reglas portadas: menos superficie donde equivocarse.
   Las líneas se alinean con --border y --border-med de la base para que los
   dos documentos tengan el mismo peso de trazo en videollamada. */
:root{
  --s1:#101017; --s2:#16161f; --s3:#1d1d28; --s4:#252533;
  --line:var(--border); --line-2:var(--border-med);
  --hi:rgba(255,255,255,.96);
  --r-xs:7px;
  --sh-1:0 1px 2px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.3);
}

/* El envase del deck traía estas dos; el manual las necesita igual. */
.nav-logo{height:23px;flex-shrink:0;filter:brightness(0) invert(1);opacity:.95;}
main{position:relative;z-index:1;}
/* El manual se lee de corrido: el body SÍ se desplaza. La nav es fija, así
   que hace falta el hueco para que la primera sección no arranque debajo. */
body{padding-top:64px; overflow-y:auto; overflow-x:hidden; min-height:100vh;}

/* ── Barra de anclas ─────────────────────────────────── */
.prog{position:fixed;top:54px;left:0;right:0;height:2px;background:rgba(255,255,255,.08);z-index:100;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--pink),var(--blue));width:0;transition:width .2s ease;}

/* Controles de videollamada, los mismos que el deck: sin ellos este documento
   se presentaría con la letra del machote y nadie leería las tablas. */
.gbtn{
  width:31px;height:31px;border-radius:50%;flex-shrink:0;
  background:var(--glass);border:1px solid var(--border);color:var(--white);
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .25s,border-color .25s;
}
.gbtn:hover{background:rgba(212,104,138,.16);border-color:rgba(212,104,138,.42);}
.gbtn-txt{
  width:auto;min-width:42px;padding:0 11px;border-radius:100px;
  font-size:0.75rem;font-weight:700;font-family:inherit;font-variant-numeric:tabular-nums;
}
.gbtn-txt.on{background:rgba(212,104,138,.2);border-color:rgba(212,104,138,.5);color:#f0a2bd;}
/* Botones del portal del cliente (C2, spec §4): el enlace de vuelta y el
   panel de observaciones son iconos de 44 px (objetivo táctil, y contenido
   fijo que nunca cambia); Comentar es una píldora de ancho automático
   porque SCRIPT_FLUJO le cambia el texto al entrar al modo — un círculo
   fijo se lo comería. Ninguno de los tres se oculta en celular (a
   diferencia de '.gbtn-txt', que es solo la comodidad de escala de texto):
   dejar observaciones es la función central del portal, no un extra de
   videollamada.
*/
.gbtn-44{width:44px;height:44px;}
.gbtn-pill{width:auto;height:44px;padding:0 16px;border-radius:100px;font-size:0.75rem;font-weight:700;font-family:inherit;white-space:nowrap;}
.nav-ctr{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto;}

.nav{position:fixed;top:0;left:0;right:0;height:62px;z-index:300;background:rgba(8,8,11,.9);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);border-bottom:1px solid var(--line-2);display:flex;align-items:center;gap:16px;padding:0 clamp(14px,3vw,32px);box-shadow:0 4px 24px rgba(0,0,0,.5);}

/* Banda «Vista previa del portal» (fix menores, punto 3), mismo criterio que
   la base editorial (investigación/pilares): fija arriba de todo (por
   encima de .nav, que usa z-index:300) y empuja .nav/.prog/body hacia
   abajo con el selector por atributo body[data-vista-previa]. */
.banda-vista-previa{position:fixed;top:0;left:0;right:0;height:40px;z-index:301;
  display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;
  padding:6px 16px;background:var(--s4);color:var(--hi);
  font-size:0.75rem;font-weight:700;text-align:center;border-bottom:1px solid var(--line-2);}
.banda-vista-previa span,.banda-vista-previa a{display:inline-flex;align-items:center;gap:6px;}
.banda-vista-previa a{color:var(--hi);text-decoration:underline;text-underline-offset:3px;}
body[data-vista-previa]{padding-top:104px;}
body[data-vista-previa] .nav{top:40px;}
body[data-vista-previa] .prog{top:94px;}
@media (max-width:768px){
  body[data-vista-previa]{padding-top:96px;}
  body[data-vista-previa] .nav{top:40px;}
  body[data-vista-previa] .prog{top:96px;}
}
.nav-links{display:flex;gap:3px;overflow-x:auto;scrollbar-width:none;flex:1;}
.nav-links::-webkit-scrollbar{display:none;}
.nav-links a{font-size:0.75rem;font-weight:600;color:var(--dim);text-decoration:none;padding:7px 12px;border-radius:var(--r-xs);white-space:nowrap;transition:.2s;border:1px solid transparent;}
.nav-links a:hover{color:var(--hi);background:var(--s3);}
.nav-links a.on{color:#fff;background:linear-gradient(135deg,rgba(212,104,138,.28),rgba(90,110,204,.24));border-color:rgba(212,104,138,.4);box-shadow:0 2px 10px rgba(212,104,138,.2);}
.sec{padding:68px 0;position:relative;}
.sec:nth-of-type(even){background:linear-gradient(180deg,var(--s1) 0%,rgba(16,16,23,.35) 100%);}
.sec:nth-of-type(even)::before,.sec:nth-of-type(even)::after{content:'';position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--line-2) 20%,var(--line-2) 80%,transparent);}
.sec:nth-of-type(even)::before{top:0;}
.sec:nth-of-type(even)::after{bottom:0;}
.shead{display:flex;align-items:flex-start;gap:20px;margin-bottom:32px;}
.shead-n{flex-shrink:0;width:54px;height:54px;border-radius:15px;background:linear-gradient(140deg,var(--s4),var(--s2));border:1px solid var(--line-2);box-shadow:var(--sh-1);display:flex;align-items:center;justify-content:center;position:relative;}
.shead-n span{font-size:1.188rem;font-weight:800;letter-spacing:-.02em;}
.shead-n::after{content:'';position:absolute;inset:-1px;border-radius:15px;padding:1px;background:linear-gradient(140deg,rgba(212,104,138,.5),transparent 60%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;}
.shead-x{flex:1;min-width:0;padding-top:2px;}
.skicker{display:block;font-size:0.75rem;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--pink);margin-bottom:7px;}
.g5{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;}
.tbl-bare{border:none;background:none;box-shadow:none;}
.tbl-bare thead th{background:transparent;color:var(--dim);}
.copy{background:#0c0c11;border:1px solid var(--line-2);border-left:3px solid var(--pink);border-radius:var(--r-xs);padding:13px 15px;font-size:0.781rem;color:rgba(255,255,255,.9);line-height:1.7;white-space:pre-line;box-shadow:inset 0 1px 0 rgba(255,255,255,.04);}
.pre{background:#0a0a0e;border:1px solid var(--line-2);border-radius:var(--r-xs);padding:13px 15px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.75rem;line-height:1.8;color:#c5cbe8;overflow-x:auto;white-space:pre;}
.pre::-webkit-scrollbar{height:6px;}
.pre::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:3px;}
.pre b{color:#f0a8bf;font-weight:600;}
.pre i{color:#5ee0ad;font-style:normal;}
.kv{display:grid;grid-template-columns:100px 1fr;gap:14px;align-items:start;padding:13px 0;border-bottom:1px solid var(--line);font-size:0.781rem;color:var(--mid);}
.kv:last-child{border-bottom:none;padding-bottom:0;}
.kv:first-of-type{padding-top:0;}
.kv-k{font-size:0.75rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--pink);padding-top:4px;}
.chips{display:flex;flex-wrap:wrap;gap:6px;}
.chip{font-size:0.75rem;padding:5px 11px;border-radius:var(--r-xs);background:var(--s3);border:1px solid var(--line-2);color:var(--mid);box-shadow:0 1px 2px rgba(0,0,0,.35);transition:.2s;}
.chip:hover{background:var(--s4);color:#fff;border-color:rgba(255,255,255,.24);}
.chip-x{background:rgba(212,104,138,.13);border-color:rgba(212,104,138,.3);color:#e6b3c4;}
.chip-k{background:rgba(90,110,204,.12);border-color:rgba(90,110,204,.26);color:#b3bdf5;font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;}
.grp-hd{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 22px;border-bottom:1px solid var(--line-2);}
.grp-a .grp-hd{background:linear-gradient(120deg,rgba(212,104,138,.24),rgba(212,104,138,.06));}
.grp-b .grp-hd{background:linear-gradient(120deg,rgba(90,110,204,.24),rgba(90,110,204,.06));}
.grp-c .grp-hd{background:linear-gradient(120deg,rgba(16,185,129,.22),rgba(16,185,129,.05));}
.grp-bd{padding:20px 22px;}
.fmt-hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:11px 15px;background:var(--s3);border-bottom:1px solid var(--line-2);}
.fmt-ic{width:28px;height:28px;border-radius:8px;background:linear-gradient(140deg,var(--s4),var(--s2));border:1px solid var(--line-2);display:flex;align-items:center;justify-content:center;font-size:0.812rem;flex-shrink:0;}
.fmt-bd{padding:15px;}
.fmt-split{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap;}
.slots{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;flex-shrink:0;}
.slots-car{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;width:100%;}
.slots-car .slot{width:auto;height:auto;aspect-ratio:1/1;}
.slot{
  background:linear-gradient(150deg,#14141d,#0d0d13);
  border:1.5px dashed rgba(255,255,255,.22);border-radius:10px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:7px;padding:18px 16px;text-align:center;position:relative;flex-shrink:0;
  transition:border-color .25s,background .25s;
}
.slot:hover{border-color:rgba(212,104,138,.55);background:linear-gradient(150deg,#191926,#101018);}
.slot::before{
  content:'';position:absolute;inset:7px;border-radius:5px;
  background:repeating-linear-gradient(45deg,transparent,transparent 6px,rgba(255,255,255,.022) 6px,rgba(255,255,255,.022) 12px);
  pointer-events:none;
}
.slot-r{font-size:2rem;font-weight:800;color:rgba(255,255,255,.62);letter-spacing:-.01em;position:relative;}
.slot-p{font-size:0.75rem;color:rgba(255,255,255,.36);letter-spacing:.06em;font-weight:600;position:relative;}
.slot-t{font-size:0.75rem;color:rgba(255,255,255,.5);line-height:1.45;margin-top:2px;position:relative;padding:0 2px;}
.slot-t strong{color:rgba(255,255,255,.88);font-size:0.844rem;display:block;margin-bottom:1px;}
.ar-1x1{width:390px;height:390px;}
.ar-4x5{width:390px;height:488px;}
.ar-9x16{width:342px;height:608px;}
.slot-n{position:absolute;top:10px;left:10px;width:25px;height:25px;border-radius:50%;background:rgba(212,104,138,.26);border:1px solid rgba(212,104,138,.45);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:800;color:#f0a8bf;z-index:2;}
.fmt-side{flex:1;min-width:290px;}
.utm{background:linear-gradient(120deg,rgba(90,110,204,.14),rgba(90,110,204,.05));border:1px solid rgba(90,110,204,.3);border-radius:var(--r-xs);padding:11px 13px;margin-top:12px;}
.utm-l{font-size:0.75rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#a3b0f0;margin-bottom:6px;}
.utm-c{font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.75;color:rgba(255,255,255,.85);word-break:break-all;display:block;}
.utm-c b{color:#8b9aec;font-weight:600;}
.utm-c i{color:#f0a8bf;font-style:normal;font-weight:600;}
.gcols .grp{margin-bottom:0;}
.gcols .kv{grid-template-columns:88px 1fr;gap:11px;}
.gcols .chip{font-size:0.75rem;padding:4px 9px;}
.gcols .chip-k{font-size:0.75rem;}
@media (max-width:1024px){.gcols{grid-template-columns:1fr;}.gcols .kv{grid-template-columns:1fr;gap:5px;}}
.ilu svg{display:block;width:100%;height:100%;}
.ilu-hero{top:-20px;right:0;width:min(420px,42vw);height:min(420px,42vw);opacity:.5;}
.grp-hd{position:relative;overflow:hidden;}
.ilu-grp{right:14px;top:50%;transform:translateY(-50%);width:96px;height:96px;opacity:.16;}
.ilu-card{right:-14px;bottom:-14px;width:104px;height:104px;opacity:.09;}
.shead{position:relative;}
.ilu-sec{right:0;top:-8px;width:132px;height:132px;opacity:.13;}
@media (max-width:768px){.ilu-hero{display:none;}.ilu-sec{width:88px;height:88px;opacity:.09;}}
.hr{height:1px;background:linear-gradient(90deg,transparent,var(--line-2),transparent);margin:26px 0;}
@media (max-width:1024px){.g4{grid-template-columns:repeat(2,1fr);}.g5{grid-template-columns:repeat(3,1fr);}}
@media (max-width:1200px){
  .ar-1x1{width:310px;height:310px;}
  .ar-4x5{width:310px;height:388px;}
  .ar-9x16{width:290px;height:516px;}
  .slots-car{grid-template-columns:repeat(3,1fr);}
}
@media (max-width:900px){
  .ar-1x1{width:250px;height:250px;}
  .ar-4x5{width:250px;height:313px;}
  .ar-9x16{width:250px;height:444px;}
}
@media (max-width:860px){
  .slots-car{grid-template-columns:repeat(2,1fr);}
}
@media (max-width:640px){
  .slots{flex-shrink:1;gap:10px;}
  .ar-1x1{width:142px;height:142px;}
  .ar-4x5{width:142px;height:178px;}
  .ar-9x16{width:150px;height:266px;}
  .slot-r{font-size:1.188rem;}
  .slot{padding:12px 9px;}
  .slot-t{font-size:0.75rem;}
  .slot-t strong{font-size:0.75rem;}
}
@media (max-width:768px){
  body{padding-top:56px;}.nav{height:56px;}.prog{top:56px;}
  .sec{padding:var(--e4) 0;}
  .g2,.g3,.g4{grid-template-columns:1fr;}.g5{grid-template-columns:repeat(2,1fr);}
  .kv{grid-template-columns:1fr;gap:5px;padding:11px 0;}.kv-k{padding-top:0;}
  .shead{gap:14px;margin-bottom:24px;}.shead-n{width:42px;height:42px;border-radius:12px;}
  .shead-n span{font-size:0.938rem;}
  .card{padding:18px;}.grp-bd,.grp-hd{padding:16px;}
}
/* Los tamaños fijos de .ar-* (390px) son los del machote y valen cuando la
   pieza va sola. Dentro de una columna estrecha no: un carrusel son cinco
   tarjetas de 390px metidas en 390px, así que se desbordaban y pisaban la
   columna vecina. Dentro del grupo de formatos mandan la proporción y el
   ancho disponible, nunca el píxel fijo. */
.slot{max-width:100%;}
.fmt-hd .slots,.fmt-hd .slots-car{
  display:grid;gap:8px;width:100%;
  grid-template-columns:repeat(auto-fill,minmax(84px,1fr));
}
.fmt-hd .slots{grid-template-columns:1fr;}
.fmt-hd .slot{width:auto!important;height:auto!important;padding:10px 6px;gap:3px;}
.fmt-hd .ar-1x1{aspect-ratio:1/1;}
.fmt-hd .ar-4x5{aspect-ratio:4/5;}
.fmt-hd .ar-9x16{aspect-ratio:9/16;}
/* En las tarjetas pequeñas del carrusel el texto del machote no cabe. */
.fmt-hd .slots-car .slot-r{font-size:1rem;}
.fmt-hd .slots-car .slot-p{font-size:0.75rem;}
.fmt-hd .slots-car .slot-t{font-size:0.75rem;}

/* ── Portada ─────────────────────────────────────────── */
/* La tira de especificación. Las cuatro cifras son la tesis del documento
   —cuánto hay que construir— así que abren en la voz de la evidencia y
   separadas por filetes, no encajonadas en tarjetas que las igualarían al
   resto del contenido. */
.portada-ttl{max-width:18ch;}
.portada-tesis{
  margin-top:14px;max-width:44ch;
  font-size:clamp(1rem,1.5vw,1.2rem);font-weight:300;line-height:1.6;color:var(--mid);
  padding-left:18px;border-left:2px solid var(--pink);
}
.portada-tesis strong{color:#fff;font-weight:600;}
.spec{
  display:grid;grid-template-columns:repeat(4,1fr);
  border-top:1px solid var(--border-med);border-bottom:1px solid var(--border-med);
}
.spec-i{padding:20px 22px 18px;border-left:1px solid var(--border);}
.spec-i:first-child{border-left:none;padding-left:0;}
.spec-v{
  font-family:var(--mono);font-weight:700;
  font-size:clamp(1.7rem,3.4vw,2.6rem);line-height:1;letter-spacing:-.04em;
  background:linear-gradient(135deg,var(--pink),var(--blue));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
}
.spec-l{
  font-family:var(--mono);font-size:0.75rem;color:var(--dim);
  text-transform:uppercase;letter-spacing:.12em;margin-top:10px;line-height:1.4;
}
@media (max-width:768px){
  .spec{grid-template-columns:repeat(2,1fr);}
  .spec-i{border-left:none;padding-left:0;border-top:1px solid var(--border);}
  .spec-i:nth-child(-n+2){border-top:none;}
}

/* ── Placa de sección ────────────────────────────────── */
/* La firma del documento. El numeral crece hasta ser una marca de expediente
   y la espina de color corre a lo alto de la sección: al desplazarse se nota
   el cambio de capítulo antes de leer el título. Alterna el suelo entre
   secciones para que dos capítulos seguidos no se fundan en una mancha. */
.sec{position:relative;background:var(--s0);}
.sec:nth-of-type(even){background:var(--s1);}
.sec::before{
  content:'';position:absolute;left:0;top:0;bottom:0;width:2px;
  background:linear-gradient(180deg,var(--pink) 0%,rgba(212,104,138,.12) 38%,transparent 72%);
}
.sec:nth-of-type(3n+2)::before{
  background:linear-gradient(180deg,var(--blue) 0%,rgba(90,110,204,.12) 38%,transparent 72%);
}
.sec:nth-of-type(3n)::before{
  background:linear-gradient(180deg,var(--yellow) 0%,rgba(200,200,0,.1) 38%,transparent 72%);
}
.shead{position:relative;}
.shead{align-items:baseline;gap:18px;}
/* El machote encierra el número en una caja de 54px. Aquí se suelta: la marca
   de expediente es el numeral mismo, no su recuadro. */
.shead-n{
  width:auto!important;height:auto!important;border:none;background:none;
  box-shadow:none;border-radius:0;flex-shrink:0;
  font-family:var(--mono);
  font-size:clamp(3.4rem,7vw,5.6rem);
  font-weight:700;line-height:.8;letter-spacing:-.06em;
  align-self:flex-start;
}
/* Sin el aro de degradado del recuadro: ya no hay recuadro. */
.shead-n::after{display:none;}
/* El degradado del machote se conserva pero atenuado: es marca, no titular.
   El tamaño se pone en el span porque el machote se lo fija ahí. */
.shead-n>*{
  font-family:var(--mono);
  font-size:clamp(3.4rem,7vw,5.6rem)!important;
  font-weight:700;line-height:.8;letter-spacing:-.06em;
  opacity:.4;
}
.skicker{
  font-family:var(--mono);
  letter-spacing:.16em;text-transform:uppercase;
}

/* ── Ritmo vertical ──────────────────────────────────── */
/* El manual se lee de corrido y de una sentada: sin aire entre apartados,
   nueve secciones densas se convierten en un muro. El salto de sección tiene
   que notarse sin leer, y el de apartado también. */
.sec{padding:var(--e5) 0;}
.shead{margin-bottom:var(--e4);}
/* Un h3 abre apartado: se separa de lo anterior mucho más de lo que se acerca
   a lo suyo. Es la señal de que empieza algo nuevo. */
.sec h3{margin-top:var(--e4);margin-bottom:var(--e2);}
.sec h3:first-child{margin-top:0;}
.sec .card h3,.sec .card h4{margin-top:0;}
.card{padding:26px 26px 24px;}
.card-sm{padding:20px;}
.kv{padding:16px 0;gap:18px;}
.chips{gap:9px;}
.grp{margin-top:var(--e3);}
.grp-bd{padding:26px;}
.fmt-bd{padding:20px 18px;}
.copy{padding:15px 17px;}
.g2,.g3,.g4{gap:22px;}
.spec{margin-top:var(--e4)!important;}
/* Las tarjetas de un grupo respiran entre sí dentro de su rejilla. */
.grp-bd .g3{gap:20px;}

@media (max-width:900px){
  .sec{padding:var(--e4) 0;}
  .shead{margin-bottom:var(--e3);}
  .sec h3{margin-top:var(--e3);}
}

@media (max-width:768px){
  .nav-links{display:none;}
  .slot{width:100%!important;height:auto!important;aspect-ratio:1/1;}
  .ar-4x5{aspect-ratio:4/5;}
  .ar-9x16{aspect-ratio:9/16;}
  .gbtn-txt{display:none;}
  .slots-car{grid-template-columns:repeat(2,1fr);}
  .gcols,.g5{grid-template-columns:1fr;}
}

/* ── Edición sobre el documento y versiones (B6, spec §3) ────────── */
#btn-flujo-editar[aria-pressed="true"]{background:var(--pink);border-color:var(--pink);color:#fff;}

html.modo-edicion [data-editable]{outline:2px dashed var(--pink);outline-offset:3px;border-radius:4px;cursor:text;}
html.modo-edicion [data-editable]:focus-visible{outline-style:solid;}

.barra-edicion{position:fixed;left:50%;translate:-50% 0;bottom:16px;z-index:400;
  display:flex;flex-wrap:wrap;align-items:center;gap:16px;min-height:44px;padding:10px 18px;border-radius:999px;
  background:var(--s3);color:var(--hi);border:1px solid var(--line-2);box-shadow:var(--sh-1);font-size:.82rem;font-weight:600;}
/* Regla global: '.recuadro-comentario' y '.respuesta-area' declaran su
   propio 'display' (grid), con la misma especificidad que la hoja del
   navegador para '[hidden]{display:none}' — como su regla viene después en
   el documento, gana y el elemento se queda visible aun con el atributo
   puesto. Una sola regla de mayor peso para todo '[hidden]' evita repetirla
   por cada clase nueva que el flujo del cliente vaya agregando. */
[hidden]{display:none!important;}
.barra-edicion-estado{color:var(--dim);font-weight:500;}
.barra-edicion-botones{display:flex;gap:8px;}
.barra-edicion-botones button{min-height:44px;padding:0 16px;border-radius:var(--r-xs);border:1px solid var(--line-2);
  background:transparent;color:inherit;font:inherit;font-weight:600;cursor:pointer;}
.barra-edicion-botones .barra-guardar{background:var(--pink);border-color:var(--pink);color:#fff;}
.barra-edicion-botones button:hover{opacity:.85;}

dialog.dialogo-versiones{width:min(520px,calc(100vw - 32px));border:1px solid var(--line-2);border-radius:var(--radius);
  padding:24px;display:grid;gap:14px;background:var(--s2);color:var(--mid);box-shadow:var(--sh-1);}
dialog.dialogo-versiones:not([open]){display:none;}
dialog.dialogo-versiones::backdrop{background:rgba(0,0,0,.55);}
.dialogo-cabecera{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.dialogo-cabecera h3{color:var(--hi);}
.dialogo-versiones-lista{display:grid;gap:10px;max-height:50vh;overflow-y:auto;}
.version-fila{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px;border:1px solid var(--line);border-radius:var(--r-xs);}
.version-info{display:grid;gap:2px;}
.version-motivo{font-weight:700;color:var(--hi);}
.dialogo-versiones .panel-boton,.dialogo-versiones-lista .panel-boton{min-height:40px;padding:0 14px;border-radius:var(--r-xs);
  border:1px solid var(--line-2);background:transparent;color:var(--mid);font:inherit;font-weight:600;cursor:pointer;}
.dialogo-versiones .panel-boton:hover{border-color:var(--pink);color:#fff;}
.panel-estado{color:var(--dim);font-size:.78rem;min-height:16px;}

/* ── Comentarios anclados (B7, spec §3) ──────────────── */
#btn-flujo-comentar[aria-pressed="true"]{background:var(--pink);border-color:var(--pink);color:#fff;}
#btn-flujo-editar:disabled,#btn-flujo-comentar:disabled{opacity:.45;cursor:not-allowed;}

html.modo-comentar{cursor:crosshair;}
html.modo-comentar [data-ancla]{position:relative;}
html.modo-comentar [data-ancla]:hover{outline:2px dashed var(--blue);outline-offset:3px;border-radius:4px;cursor:pointer;}
/* Ver el comentario equivalente en editorial/estilos.ts: los marcadores se
   pintan fuera del modo Comentar también, así que solo el '[data-ancla]' que
   de verdad tiene uno (marcado por SCRIPT_FLUJO con esta clase) necesita
   'position:relative' — nunca todos, sin condición (fix round 1, punto 7). */
.tiene-marcador-comentario{position:relative;}

.marcador-comentario{position:absolute;top:-8px;right:-8px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;
  background:var(--pink);color:#fff;font-size:.75rem;font-weight:700;display:flex;align-items:center;justify-content:center;
  box-shadow:var(--sh-1);pointer-events:none;z-index:5;}

.ancla-resaltada{outline:3px solid var(--pink);outline-offset:4px;border-radius:4px;transition:outline-color .3s ease;}

dialog.dialogo-comentarios{width:min(420px,calc(100vw - 32px));max-height:min(640px,calc(100vh - 64px));border:1px solid var(--line-2);border-radius:var(--radius);
  padding:24px;display:grid;gap:14px;background:var(--s2);color:var(--mid);box-shadow:var(--sh-1);
  position:fixed;inset:16px 16px auto auto;margin:0;}
dialog.dialogo-comentarios:not([open]){display:none;}
dialog.dialogo-comentarios::backdrop{background:transparent;}
/* Texto de ayuda del portal del cliente (C2, spec §4). */
.panel-ayuda{margin:0;color:var(--dim);font-size:.82rem;}
.comentarios-filtros{display:flex;gap:8px;flex-wrap:wrap;}
.filtro-comentarios{min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line-2);background:transparent;color:var(--mid);font-size:.78rem;cursor:pointer;}
.filtro-comentarios[aria-pressed="true"]{background:var(--pink);border-color:var(--pink);color:#fff;font-weight:700;}
.comentarios-lista{display:grid;gap:12px;overflow-y:auto;max-height:60vh;}
.comentario-fila{display:grid;gap:6px;padding:12px;border:1px solid var(--line-2);border-radius:var(--r-xs);}
.comentario-respuesta{margin-inline-start:20px;background:var(--s3);border-style:dashed;}
.comentario-cabeza{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.comentario-autor{font-weight:700;color:var(--hi);}
.comentario-ancla{font-family:var(--mono);word-break:break-all;color:var(--dim);font-size:.75rem;}
.respuesta-area{display:grid;gap:8px;}
.respuesta-area textarea{width:100%;min-height:70px;padding:10px;border-radius:var(--r-xs);border:1px solid var(--line-2);background:#0c0c11;color:var(--hi);font:inherit;resize:vertical;}

.recuadro-comentario{position:fixed;z-index:410;width:min(320px,calc(100vw - 32px));display:grid;gap:10px;padding:16px;
  border-radius:var(--radius);border:1px solid var(--line-2);background:var(--s2);color:var(--mid);box-shadow:var(--sh-1);}
.recuadro-comentario-ancla{font-size:.75rem;font-family:var(--mono);color:var(--dim);word-break:break-all;}
.recuadro-comentario textarea{width:100%;min-height:90px;padding:10px;border-radius:var(--r-xs);border:1px solid var(--line-2);background:#0c0c11;color:var(--hi);font:inherit;resize:vertical;}

.dialogo-comentarios .panel-boton,.recuadro-comentario .panel-boton,.respuesta-area .panel-boton{min-height:44px;padding:0 14px;border-radius:var(--r-xs);
  border:1px solid var(--line-2);background:transparent;color:var(--mid);font:inherit;font-weight:600;cursor:pointer;}
.dialogo-comentarios .panel-boton:hover,.recuadro-comentario .panel-boton:hover,.respuesta-area .panel-boton:hover{border-color:var(--pink);color:#fff;}
.dialogo-comentarios .panel-primario,.recuadro-comentario .panel-primario{background:var(--pink);border-color:var(--pink);color:#fff;}
.dialogo-comentarios .panel-peligro{color:var(--pink);}
.panel-filas{display:flex;flex-wrap:wrap;gap:8px;}

@media print{.dialogo-comentarios,.recuadro-comentario,.marcador-comentario{display:none!important;}}
`;

export const ESTILOS_GROWTH = `${TOKENS}
${CSS_COMUN}
${CSS_GROWTH}`;
