// CSS derivado del machote de Social Research de Wozial.
// Origen: Wozial/estrategias/machote-social-research-wozial.html
//
// Se conserva la identidad visual del machote aprobado. Lo que sí cambió es la
// escala tipográfica, porque el destino real de esta presentación es una
// videollamada con pantalla compartida:
//
//  1. Todos los tamaños de letra pasaron de px sueltos a rem, y el rem lo fija
//     `--esc`. Así el operador sube toda la tipografía de golpe sin que se
//     descuadre nada: las rejillas, los radios y los espesores de borde siguen
//     en px y no se mueven.
//  2. Nada baja de 0.75rem (12px con la escala en 1). El machote llegaba a
//     9.5px, que al recomprimirse y reescalarse el video queda en cinco o seis
//     píxeles efectivos del otro lado: ilegible.
//  3. Los grises subieron de opacidad. El códec de una videollamada tira
//     primero el detalle de bajo contraste, y el gris al 30% sobre negro es lo
//     primero que se convierte en lodo.

export const ESTILOS = `
:root{
  --black:#0a0a0a; --white:#fff;
  --pink:#d4688a; --blue:#5a6ecc; --yellow:#c8c800; --green:#10b981;
  --glass:rgba(255,255,255,.06); --glass-deep:rgba(255,255,255,.03);
  --border:rgba(255,255,255,.14); --border-med:rgba(255,255,255,.24);
  /* Subidos desde .45 y .72 del machote: es el detalle que primero se pierde
     al recomprimirse la pantalla compartida. */
  --dim:rgba(255,255,255,.6); --mid:rgba(255,255,255,.82);
  --radius:16px; --radius-sm:10px;
  /* Escala tipográfica global. La cambia el botón de la barra. */
  --esc:1;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{
  -webkit-font-smoothing:antialiased;
  font-size:calc(16px * var(--esc));
}
body{
  font-family:'Poppins',-apple-system,sans-serif;
  background:var(--black); color:var(--white);
  line-height:1.65; overflow:hidden; height:100vh; height:100dvh;
}
body::before{
  content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
  background-size:256px 256px;
}

/* ── DECK: scroll horizontal ─────────────────────────── */
.deck{
  display:flex; height:100vh; height:100dvh;
  overflow-x:auto; overflow-y:hidden;
  scroll-snap-type:x mandatory;
  scroll-behavior:smooth;
  scrollbar-width:none; -ms-overflow-style:none;
  position:relative; z-index:1;
}
.deck::-webkit-scrollbar{display:none;}
.panel{
  flex:0 0 100vw; width:100vw; height:100%;
  scroll-snap-align:start; scroll-snap-stop:always;
  overflow-y:auto; overflow-x:hidden;
  padding:96px 0 88px;
  position:relative;
}
.panel::-webkit-scrollbar{width:5px;}
.panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px;}
.wrap{max-width:1180px;margin:0 auto;padding:0 40px;}
.wrap-sm{max-width:900px;margin:0 auto;padding:0 40px;}

/* Con la escala alta el texto crece pero el alto de pantalla no: se recupera
   espacio recortando el aire vertical antes que dejar que la lámina se
   desborde por debajo del corte. */
@media (min-width:900px){
  .deck[data-esc="grande"] .panel{padding:84px 0 72px;}
  .deck[data-esc="maxima"] .panel{padding:76px 0 64px;}
  .deck[data-esc="maxima"] .phead{margin-bottom:24px;}
  .deck[data-esc="maxima"] .card{padding:19px;}
  .deck[data-esc="maxima"] .g2,.deck[data-esc="maxima"] .g3{gap:14px;}
}

/* ── Glows ───────────────────────────────────────────── */
.blob{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:-1;}
.blob-pink{background:radial-gradient(circle,rgba(212,104,138,.3) 0%,transparent 68%);}
.blob-blue{background:radial-gradient(circle,rgba(90,110,204,.26) 0%,transparent 68%);}
.blob-yellow{background:radial-gradient(circle,rgba(200,200,0,.16) 0%,transparent 68%);}

/* ── Tipografía ──────────────────────────────────────── */
h1{font-size:clamp(2.2rem,5.5vw,4.2rem);font-weight:800;line-height:1.05;letter-spacing:-.025em;}
h2{font-size:clamp(1.6rem,3.2vw,2.6rem);font-weight:800;line-height:1.12;letter-spacing:-.02em;}
h3{font-size:clamp(1.1rem,1.7vw,1.4rem);font-weight:700;line-height:1.3;}
h4{font-size:0.9rem;font-weight:700;line-height:1.4;}
p{font-weight:300;color:var(--mid);line-height:1.75;}
strong{color:rgba(255,255,255,.96);font-weight:600;}
.grad{background:linear-gradient(135deg,var(--pink) 0%,var(--blue) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.grad-warm{background:linear-gradient(135deg,var(--yellow) 0%,var(--pink) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.eyebrow{display:block;font-size:0.75rem;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;}
.lead{font-size:clamp(1rem,1.5vw,1.12rem);color:var(--mid);max-width:68ch;}
.tiny{font-size:0.8rem;color:var(--dim);line-height:1.7;}

/* ── Panel header ────────────────────────────────────── */
.phead{margin-bottom:34px;}
.pnum{
  display:inline-flex;align-items:center;gap:10px;
  font-size:0.75rem;font-weight:800;letter-spacing:.18em;color:var(--pink);
  margin-bottom:10px;
}
.pnum::after{content:'';width:34px;height:1px;background:linear-gradient(90deg,var(--pink),transparent);}

/* ── Cards ───────────────────────────────────────────── */
.card{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--radius);padding:24px;
  transition:border-color .3s,background .3s,transform .3s;
}
.card:hover{background:rgba(255,255,255,.085);border-color:var(--border-med);}
.card-pink{border-color:rgba(212,104,138,.36);background:rgba(212,104,138,.06);}
.card-blue{border-color:rgba(90,110,204,.36);background:rgba(90,110,204,.06);}
.card-yellow{border-color:rgba(200,200,0,.32);background:rgba(200,200,0,.05);}
.card-green{border-color:rgba(16,185,129,.36);background:rgba(16,185,129,.06);}
.card-sm{padding:17px;border-radius:var(--radius-sm);}

/* ── Grids ───────────────────────────────────────────── */
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.g-1-2{display:grid;grid-template-columns:1fr 2fr;gap:26px;}
.g-2-1{display:grid;grid-template-columns:2fr 1fr;gap:26px;}
/* Dos columnas solo cuando hay ancho de sobra. Es para láminas que cargan el
   contenido de dos y en vertical se salen del corte. El primer h3 de la
   segunda columna pierde su margen superior: ahí ya no separa nada. */
/* Asimétrica a propósito: la columna ancha lleva la rejilla de tres tarjetas.
   Partida en dos mitades iguales, esas tarjetas quedaban de 170px y el texto
   se desdoblaba tanto que la lámina crecía más que apilada. Medido: 1fr/1fr
   deja 472px fuera del corte; 1.35fr/1fr con las tarjetas apretadas, 257. */
.par{display:grid;grid-template-columns:1fr;gap:24px;}
@media (min-width:1100px){
  .par{grid-template-columns:1.35fr 1fr;gap:26px;}
  .par>div>h3:first-child{margin-top:0!important;}
  .par .g3{gap:12px;}
  .par .card{padding:18px;}
  /* Una rejilla de dos dentro de una columna de 490px da cajas de 230px:
     el texto se vuelve una tira vertical. Dentro de .par van apiladas. */
  .par .g2{grid-template-columns:1fr;}
}

/* ── Badges ──────────────────────────────────────────── */
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:100px;
  font-size:0.75rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;
}
.b-pink{background:rgba(212,104,138,.18);color:#e88bab;border:1px solid rgba(212,104,138,.34);}
.b-blue{background:rgba(90,110,204,.18);color:#9aa8ef;border:1px solid rgba(90,110,204,.34);}
.b-yellow{background:rgba(200,200,0,.15);color:#dede3c;border:1px solid rgba(200,200,0,.32);}
.b-green{background:rgba(16,185,129,.16);color:#45dda6;border:1px solid rgba(16,185,129,.34);}
.b-gray{background:rgba(255,255,255,.08);color:var(--mid);border:1px solid var(--border);}

/* ── Stats ───────────────────────────────────────────── */
.stat{background:var(--glass-deep);border:1px solid var(--border);border-radius:var(--radius-sm);padding:18px;}
.stat-v{font-size:clamp(1.5rem,2.6vw,2.1rem);font-weight:800;line-height:1.05;letter-spacing:-.02em;}
.stat-l{font-size:0.75rem;color:var(--dim);text-transform:uppercase;letter-spacing:.1em;margin-top:6px;font-weight:600;}

/* ── Tabla ───────────────────────────────────────────── */
.tbl{width:100%;border-collapse:collapse;font-size:0.88rem;}
.tbl th{
  text-align:left;padding:11px 13px;font-size:0.75rem;font-weight:800;
  text-transform:uppercase;letter-spacing:.1em;color:var(--dim);
  border-bottom:1px solid var(--border-med);white-space:nowrap;
}
.tbl td{padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.08);color:var(--mid);vertical-align:top;}
.tbl tbody tr:last-child td{border-bottom:none;}
.tbl tbody tr:hover td{background:rgba(255,255,255,.04);}
.tbl-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--glass-deep);}
.tbl-wrap::-webkit-scrollbar{height:5px;}
.tbl-wrap::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px;}

/* ── Quote / voz de cliente ──────────────────────────── */
.quote{
  border-left:2px solid var(--pink);padding:3px 0 3px 16px;
  font-size:0.9rem;font-style:italic;color:rgba(255,255,255,.86);line-height:1.7;
}
.quote-src{display:block;font-style:normal;font-size:0.75rem;color:var(--dim);margin-top:6px;letter-spacing:.03em;}

/* ── Listas ──────────────────────────────────────────── */
.lst{list-style:none;display:grid;gap:9px;}
.lst li{position:relative;padding-left:22px;font-size:0.9rem;color:var(--mid);line-height:1.65;font-weight:300;}
.lst li::before{
  content:'';position:absolute;left:0;top:9px;
  width:6px;height:6px;border-radius:50%;background:var(--pink);
}
.lst-blue li::before{background:var(--blue);}
.lst-green li::before{background:var(--green);}
.lst-yellow li::before{background:var(--yellow);}
.lst-x li::before{
  content:'✕';background:none;width:auto;height:auto;top:0;
  color:var(--pink);font-size:0.78rem;font-weight:700;
}
.lst-ok li::before{
  content:'✓';background:none;width:auto;height:auto;top:0;
  color:var(--green);font-size:0.82rem;font-weight:700;
}

/* ── Navegación ──────────────────────────────────────── */
.nav-bar{
  position:fixed;top:0;left:0;right:0;height:62px;z-index:100;
  background:rgba(10,10,10,.82);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 clamp(16px,4vw,40px);gap:16px;
}
.nav-brand{display:flex;align-items:center;gap:13px;min-width:0;}
.nav-logo{height:26px;flex-shrink:0;}
.nav-sep{width:1px;height:19px;background:var(--border-med);flex-shrink:0;}
.nav-ttl{font-size:0.78rem;font-weight:600;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-ttl b{color:var(--white);font-weight:700;}
.nav-ctr{display:flex;align-items:center;gap:9px;flex-shrink:0;}
.nav-count{font-size:0.78rem;font-weight:700;color:var(--dim);letter-spacing:.06em;font-variant-numeric:tabular-nums;}
.nav-count b{color:var(--pink);}
.nav-btn{
  width:33px;height:33px;border-radius:50%;flex-shrink:0;
  background:var(--glass);border:1px solid var(--border);color:var(--white);
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .25s,border-color .25s,opacity .25s;
}
.nav-btn:hover:not(:disabled){background:rgba(212,104,138,.16);border-color:rgba(212,104,138,.42);}
.nav-btn:disabled{opacity:.26;cursor:not-allowed;}
/* El botón de escala muestra el multiplicador vigente, no un icono: en una
   videollamada el operador necesita saber de un vistazo en qué paso está. */
.nav-btn-txt{
  width:auto;min-width:42px;padding:0 11px;border-radius:100px;
  font-size:0.75rem;font-weight:700;letter-spacing:.02em;font-family:inherit;
  font-variant-numeric:tabular-nums;
}
.nav-btn-txt.on{background:rgba(212,104,138,.2);border-color:rgba(212,104,138,.5);color:#f0a2bd;}

/* ── Progreso ────────────────────────────────────────── */
.prog{position:fixed;top:62px;left:0;right:0;height:2px;background:rgba(255,255,255,.08);z-index:100;}
.prog-fill{height:100%;background:linear-gradient(90deg,var(--pink),var(--blue));width:0;transition:width .3s ease;}

/* ── Dots ────────────────────────────────────────────── */
.dots{
  position:fixed;bottom:0;left:0;right:0;height:52px;z-index:100;
  background:linear-gradient(to top,rgba(10,10,10,.94),transparent);
  display:flex;align-items:center;justify-content:center;gap:6px;
  padding:0 20px;overflow-x:auto;scrollbar-width:none;
}
.dots::-webkit-scrollbar{display:none;}
.dot{
  width:7px;height:7px;border-radius:50%;flex-shrink:0;
  background:rgba(255,255,255,.24);border:none;cursor:pointer;padding:0;
  transition:background .25s,width .25s,transform .25s;
}
.dot:hover{background:rgba(255,255,255,.5);transform:scale(1.3);}
.dot.on{background:var(--pink);width:22px;border-radius:4px;}

/* ── Hint swipe ──────────────────────────────────────── */
.hint{
  position:fixed;bottom:60px;right:24px;z-index:99;
  font-size:0.75rem;color:var(--dim);letter-spacing:.08em;
  display:flex;align-items:center;gap:7px;
  animation:fade 3.5s ease-in-out infinite;pointer-events:none;
}
@keyframes fade{0%,100%{opacity:.32}50%{opacity:.85}}

/* ── Aviso de contenido cortado ──────────────────────── */
/* En una videollamada la audiencia no puede desplazarse: si la lámina sigue
   por debajo del corte y el operador no lo sabe, ese contenido no se presenta.
   El aviso solo aparece cuando el panel activo desborda y aún no se llegó
   al final. */
.mas{
  position:fixed;bottom:58px;left:50%;transform:translateX(-50%);
  z-index:99;display:none;align-items:center;gap:7px;
  padding:5px 14px;border-radius:100px;
  background:rgba(212,104,138,.18);border:1px solid rgba(212,104,138,.42);
  color:#f0a2bd;font-size:0.75rem;font-weight:700;letter-spacing:.05em;
  pointer-events:none;
}
.mas.on{display:flex;}

/* ── Diagrama ciclo ──────────────────────────────────── */
.flow{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:8px;}
.flow::-webkit-scrollbar{height:5px;}
.flow::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:3px;}
.flow-step{flex:1;min-width:170px;position:relative;padding:0 9px;}
.flow-step:not(:last-child)::after{
  content:'';position:absolute;right:-6px;top:34px;
  width:12px;height:12px;border-top:1.5px solid rgba(212,104,138,.45);
  border-right:1.5px solid rgba(212,104,138,.45);transform:rotate(45deg);z-index:2;
}
.flow-box{
  background:var(--glass);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:15px;height:100%;
}
.flow-n{
  width:26px;height:26px;border-radius:50%;
  background:rgba(212,104,138,.18);border:1px solid rgba(212,104,138,.38);
  display:flex;align-items:center;justify-content:center;
  font-size:0.75rem;font-weight:800;color:var(--pink);margin-bottom:10px;
}

/* ── Timeline semanas ────────────────────────────────── */
.week{
  display:grid;grid-template-columns:78px 1fr;gap:16px;
  padding:15px 0;border-bottom:1px solid rgba(255,255,255,.08);
}
.week:last-child{border-bottom:none;}
.week-tag{
  font-size:0.75rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
  color:var(--pink);padding-top:2px;
}

/* ── Barra comparativa ───────────────────────────────── */
.bar-row{display:grid;grid-template-columns:1fr 2.4fr auto;gap:12px;align-items:center;padding:7px 0;font-size:0.84rem;}
.bar-track{height:7px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--pink),var(--blue));}
.bar-val{font-size:0.82rem;font-weight:700;color:var(--white);font-variant-numeric:tabular-nums;white-space:nowrap;}

/* ── Persona ─────────────────────────────────────────── */
.persona-hd{display:flex;align-items:center;gap:18px;margin-bottom:22px;}
.persona-av{
  width:66px;height:66px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:1.6rem;font-weight:800;
}
.av-pink{background:linear-gradient(135deg,rgba(212,104,138,.85),rgba(90,110,204,.6));}
.av-blue{background:linear-gradient(135deg,rgba(90,110,204,.85),rgba(200,200,0,.5));}

/* ── Fuente ──────────────────────────────────────────── */
.src{font-size:0.75rem;color:rgba(255,255,255,.46);margin-top:9px;letter-spacing:.02em;line-height:1.6;}
.src a{color:rgba(255,255,255,.6);text-decoration:underline;text-underline-offset:2px;}

/* ── Alert ───────────────────────────────────────────── */
.alert{
  border-radius:var(--radius-sm);padding:16px 19px;
  border-left:3px solid;font-size:0.88rem;line-height:1.7;
}
.alert-red{background:rgba(212,104,138,.1);border-color:var(--pink);}
.alert-green{background:rgba(16,185,129,.1);border-color:var(--green);}
.alert-yellow{background:rgba(200,200,0,.09);border-color:var(--yellow);}

/* ── Guía metodológica (solo plantilla) ──────────────── */
.guia{
  background:rgba(200,200,0,.06);border:1px dashed rgba(200,200,0,.34);
  border-radius:var(--radius-sm);padding:15px 17px;margin-bottom:14px;
}
.guia-t{
  font-size:0.75rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--yellow);margin-bottom:9px;display:flex;align-items:center;gap:7px;
}
.guia p,.guia li{font-size:0.84rem;color:var(--mid);line-height:1.7;}
.ph{
  color:var(--pink);font-weight:700;background:rgba(212,104,138,.14);
  padding:1px 6px;border-radius:4px;font-size:.93em;
}
.fuente-lst{list-style:none;display:grid;gap:6px;margin-top:8px;}
.fuente-lst li{position:relative;padding-left:18px;font-size:0.8rem;}
.fuente-lst li::before{content:'→';position:absolute;left:0;color:var(--yellow);font-weight:700;}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width:1024px){
  .g4{grid-template-columns:repeat(2,1fr);}
  .g-1-2,.g-2-1{grid-template-columns:1fr;}
}
@media (max-width:768px){
  /* En pantalla chica la escala del operador estorba: el ancho manda. */
  html{font-size:16px;}
  h1{font-size:clamp(1.85rem,7.6vw,2.6rem);}
  h2{font-size:clamp(1.35rem,5.6vw,1.9rem);}
  .dot{width:6px;height:6px;}
  .dot.on{width:16px;}
  .dots{gap:5px;height:46px;}
  .panel{padding:82px 0 70px;}
  .wrap,.wrap-sm{padding:0 22px;}
  .g2,.g3,.g4{grid-template-columns:1fr;gap:14px;}
  .card{padding:19px;}
  .phead{margin-bottom:26px;}
  .nav-ttl{display:none;}
  .nav-sep{display:none;}
  .nav-btn-txt{display:none;}
  .hint{display:none;}
  .week{grid-template-columns:1fr;gap:7px;}
  .flow-step{min-width:200px;}
  .persona-hd{gap:14px;}
  .persona-av{width:54px;height:54px;font-size:1.3rem;}
  .bar-row{grid-template-columns:1fr;gap:5px;}
}
@media (max-width:420px){
  .wrap,.wrap-sm{padding:0 17px;}
  .nav-bar{height:56px;}
  .prog{top:56px;}
  .panel{padding:74px 0 70px;}
}
@media (prefers-reduced-motion:reduce){
  .deck{scroll-behavior:auto;}
  *{animation:none!important;transition:none!important;}
}
`;
