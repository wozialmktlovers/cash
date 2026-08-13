// CSS y navegación copiados literalmente del machote de Social Research de Wozial.
// No se reescriben a mano: la presentación debe verse idéntica al machote aprobado.
// Origen: Wozial/estrategias/machote-social-research-wozial.html

export const ESTILOS = `
:root{
  --black:#0a0a0a; --white:#fff;
  --pink:#d4688a; --blue:#5a6ecc; --yellow:#c8c800; --green:#10b981;
  --glass:rgba(255,255,255,.06); --glass-deep:rgba(255,255,255,.03);
  --border:rgba(255,255,255,.12); --border-med:rgba(255,255,255,.2);
  --dim:rgba(255,255,255,.45); --mid:rgba(255,255,255,.72);
  --radius:16px; --radius-sm:10px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{-webkit-font-smoothing:antialiased;}
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
.panel::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px;}
.wrap{max-width:1180px;margin:0 auto;padding:0 40px;}
.wrap-sm{max-width:900px;margin:0 auto;padding:0 40px;}

/* ── Glows ───────────────────────────────────────────── */
.blob{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:-1;}
.blob-pink{background:radial-gradient(circle,rgba(212,104,138,.3) 0%,transparent 68%);}
.blob-blue{background:radial-gradient(circle,rgba(90,110,204,.26) 0%,transparent 68%);}
.blob-yellow{background:radial-gradient(circle,rgba(200,200,0,.16) 0%,transparent 68%);}

/* ── Tipografía ──────────────────────────────────────── */
h1{font-size:clamp(2.2rem,5.5vw,4.2rem);font-weight:800;line-height:1.05;letter-spacing:-.025em;}
h2{font-size:clamp(1.6rem,3.2vw,2.6rem);font-weight:800;line-height:1.12;letter-spacing:-.02em;}
h3{font-size:clamp(1.05rem,1.7vw,1.35rem);font-weight:700;line-height:1.3;}
h4{font-size:14px;font-weight:700;line-height:1.4;}
p{font-weight:300;color:var(--mid);line-height:1.75;}
strong{color:rgba(255,255,255,.95);font-weight:600;}
.grad{background:linear-gradient(135deg,var(--pink) 0%,var(--blue) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.grad-warm{background:linear-gradient(135deg,var(--yellow) 0%,var(--pink) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
.eyebrow{display:block;font-size:10px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--dim);margin-bottom:14px;}
.lead{font-size:clamp(14px,1.5vw,16.5px);color:var(--mid);max-width:70ch;}
.tiny{font-size:12px;color:var(--dim);line-height:1.7;}

/* ── Panel header ────────────────────────────────────── */
.phead{margin-bottom:34px;}
.pnum{
  display:inline-flex;align-items:center;gap:10px;
  font-size:10px;font-weight:800;letter-spacing:.2em;color:var(--pink);
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
.card-pink{border-color:rgba(212,104,138,.32);background:rgba(212,104,138,.05);}
.card-blue{border-color:rgba(90,110,204,.32);background:rgba(90,110,204,.05);}
.card-yellow{border-color:rgba(200,200,0,.28);background:rgba(200,200,0,.04);}
.card-green{border-color:rgba(16,185,129,.32);background:rgba(16,185,129,.05);}
.card-sm{padding:17px;border-radius:var(--radius-sm);}

/* ── Grids ───────────────────────────────────────────── */
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.g-1-2{display:grid;grid-template-columns:1fr 2fr;gap:26px;}
.g-2-1{display:grid;grid-template-columns:2fr 1fr;gap:26px;}

/* ── Badges ──────────────────────────────────────────── */
.badge{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 12px;border-radius:100px;
  font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
}
.b-pink{background:rgba(212,104,138,.16);color:var(--pink);border:1px solid rgba(212,104,138,.3);}
.b-blue{background:rgba(90,110,204,.16);color:#8b9aec;border:1px solid rgba(90,110,204,.3);}
.b-yellow{background:rgba(200,200,0,.13);color:var(--yellow);border:1px solid rgba(200,200,0,.28);}
.b-green{background:rgba(16,185,129,.14);color:#34d399;border:1px solid rgba(16,185,129,.3);}
.b-gray{background:rgba(255,255,255,.07);color:var(--mid);border:1px solid var(--border);}

/* ── Stats ───────────────────────────────────────────── */
.stat{background:var(--glass-deep);border:1px solid var(--border);border-radius:var(--radius-sm);padding:18px;}
.stat-v{font-size:clamp(1.5rem,2.6vw,2.1rem);font-weight:800;line-height:1.05;letter-spacing:-.02em;}
.stat-l{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.11em;margin-top:6px;font-weight:600;}

/* ── Tabla ───────────────────────────────────────────── */
.tbl{width:100%;border-collapse:collapse;font-size:13px;}
.tbl th{
  text-align:left;padding:11px 13px;font-size:9.5px;font-weight:800;
  text-transform:uppercase;letter-spacing:.13em;color:var(--dim);
  border-bottom:1px solid var(--border-med);white-space:nowrap;
}
.tbl td{padding:12px 13px;border-bottom:1px solid rgba(255,255,255,.07);color:var(--mid);vertical-align:top;}
.tbl tbody tr:last-child td{border-bottom:none;}
.tbl tbody tr:hover td{background:rgba(255,255,255,.03);}
.tbl-wrap{overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--glass-deep);}
.tbl-wrap::-webkit-scrollbar{height:5px;}
.tbl-wrap::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:3px;}

/* ── Quote / voz de cliente ──────────────────────────── */
.quote{
  border-left:2px solid var(--pink);padding:3px 0 3px 16px;
  font-size:13.5px;font-style:italic;color:rgba(255,255,255,.8);line-height:1.7;
}
.quote-src{display:block;font-style:normal;font-size:10.5px;color:var(--dim);margin-top:6px;letter-spacing:.04em;}

/* ── Listas ──────────────────────────────────────────── */
.lst{list-style:none;display:grid;gap:9px;}
.lst li{position:relative;padding-left:22px;font-size:13.5px;color:var(--mid);line-height:1.65;font-weight:300;}
.lst li::before{
  content:'';position:absolute;left:0;top:9px;
  width:6px;height:6px;border-radius:50%;background:var(--pink);
}
.lst-blue li::before{background:var(--blue);}
.lst-green li::before{background:var(--green);}
.lst-yellow li::before{background:var(--yellow);}
.lst-x li::before{
  content:'✕';background:none;width:auto;height:auto;top:0;
  color:var(--pink);font-size:11px;font-weight:700;
}
.lst-ok li::before{
  content:'✓';background:none;width:auto;height:auto;top:0;
  color:var(--green);font-size:12px;font-weight:700;
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
.nav-ttl{font-size:11.5px;font-weight:600;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.nav-ttl b{color:var(--white);font-weight:700;}
.nav-ctr{display:flex;align-items:center;gap:9px;flex-shrink:0;}
.nav-count{font-size:11px;font-weight:700;color:var(--dim);letter-spacing:.08em;font-variant-numeric:tabular-nums;}
.nav-count b{color:var(--pink);}
.nav-btn{
  width:33px;height:33px;border-radius:50%;flex-shrink:0;
  background:var(--glass);border:1px solid var(--border);color:var(--white);
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .25s,border-color .25s,opacity .25s;
}
.nav-btn:hover:not(:disabled){background:rgba(212,104,138,.16);border-color:rgba(212,104,138,.42);}
.nav-btn:disabled{opacity:.26;cursor:not-allowed;}

/* ── Progreso ────────────────────────────────────────── */
.prog{position:fixed;top:62px;left:0;right:0;height:2px;background:rgba(255,255,255,.07);z-index:100;}
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
  background:rgba(255,255,255,.2);border:none;cursor:pointer;padding:0;
  transition:background .25s,width .25s,transform .25s;
}
.dot:hover{background:rgba(255,255,255,.45);transform:scale(1.3);}
.dot.on{background:var(--pink);width:22px;border-radius:4px;}

/* ── Hint swipe ──────────────────────────────────────── */
.hint{
  position:fixed;bottom:60px;right:24px;z-index:99;
  font-size:10.5px;color:var(--dim);letter-spacing:.09em;
  display:flex;align-items:center;gap:7px;
  animation:fade 3.5s ease-in-out infinite;pointer-events:none;
}
@keyframes fade{0%,100%{opacity:.32}50%{opacity:.85}}

/* ── Diagrama ciclo ──────────────────────────────────── */
.flow{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:8px;}
.flow::-webkit-scrollbar{height:5px;}
.flow::-webkit-scrollbar-thumb{background:rgba(255,255,255,.16);border-radius:3px;}
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
  background:rgba(212,104,138,.16);border:1px solid rgba(212,104,138,.35);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:800;color:var(--pink);margin-bottom:10px;
}

/* ── Timeline semanas ────────────────────────────────── */
.week{
  display:grid;grid-template-columns:78px 1fr;gap:16px;
  padding:15px 0;border-bottom:1px solid rgba(255,255,255,.07);
}
.week:last-child{border-bottom:none;}
.week-tag{
  font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:var(--pink);padding-top:2px;
}

/* ── Barra comparativa ───────────────────────────────── */
.bar-row{display:grid;grid-template-columns:1fr 2.4fr auto;gap:12px;align-items:center;padding:7px 0;font-size:12.5px;}
.bar-track{height:7px;background:rgba(255,255,255,.07);border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,var(--pink),var(--blue));}
.bar-val{font-size:12px;font-weight:700;color:var(--white);font-variant-numeric:tabular-nums;white-space:nowrap;}

/* ── Persona ─────────────────────────────────────────── */
.persona-hd{display:flex;align-items:center;gap:18px;margin-bottom:22px;}
.persona-av{
  width:66px;height:66px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  font-size:26px;font-weight:800;
}
.av-pink{background:linear-gradient(135deg,rgba(212,104,138,.85),rgba(90,110,204,.6));}
.av-blue{background:linear-gradient(135deg,rgba(90,110,204,.85),rgba(200,200,0,.5));}

/* ── Fuente ──────────────────────────────────────────── */
.src{font-size:10px;color:rgba(255,255,255,.3);margin-top:9px;letter-spacing:.03em;line-height:1.6;}
.src a{color:rgba(255,255,255,.42);text-decoration:underline;text-underline-offset:2px;}

/* ── Alert ───────────────────────────────────────────── */
.alert{
  border-radius:var(--radius-sm);padding:16px 19px;
  border-left:3px solid;font-size:13px;line-height:1.7;
}
.alert-red{background:rgba(212,104,138,.09);border-color:var(--pink);}
.alert-green{background:rgba(16,185,129,.09);border-color:var(--green);}
.alert-yellow{background:rgba(200,200,0,.08);border-color:var(--yellow);}

/* ── Guía metodológica (solo plantilla) ──────────────── */
.guia{
  background:rgba(200,200,0,.06);border:1px dashed rgba(200,200,0,.32);
  border-radius:var(--radius-sm);padding:15px 17px;margin-bottom:14px;
}
.guia-t{
  font-size:9.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
  color:var(--yellow);margin-bottom:9px;display:flex;align-items:center;gap:7px;
}
.guia p,.guia li{font-size:12.5px;color:var(--mid);line-height:1.7;}
.ph{
  color:var(--pink);font-weight:700;background:rgba(212,104,138,.12);
  padding:1px 6px;border-radius:4px;font-size:.93em;
}
.fuente-lst{list-style:none;display:grid;gap:6px;margin-top:8px;}
.fuente-lst li{position:relative;padding-left:18px;font-size:12px;}
.fuente-lst li::before{content:'→';position:absolute;left:0;color:var(--yellow);font-weight:700;}

/* ── Responsive ──────────────────────────────────────── */
@media (max-width:1024px){
  .g4{grid-template-columns:repeat(2,1fr);}
  .g-1-2,.g-2-1{grid-template-columns:1fr;}
}
@media (max-width:768px){
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
  .hint{display:none;}
  .week{grid-template-columns:1fr;gap:7px;}
  .flow-step{min-width:200px;}
  .persona-hd{gap:14px;}
  .persona-av{width:54px;height:54px;font-size:21px;}
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

export const NAVEGACION = `
(function(){
  var deck=document.getElementById('deck');
  var panels=deck.querySelectorAll('.panel');
  var dots=document.getElementById('dots');
  var cur=document.getElementById('cur');
  var tot=document.getElementById('tot');
  var prev=document.getElementById('prev');
  var next=document.getElementById('next');
  var fill=document.getElementById('progFill');
  var n=panels.length, i=0;

  tot.textContent=String(n).padStart(2,'0');

  for(var k=0;k<n;k++){
    var d=document.createElement('button');
    d.className='dot'+(k===0?' on':'');
    d.setAttribute('aria-label','Sección '+(k+1));
    d.dataset.i=k;
    d.onclick=function(){go(+this.dataset.i);};
    dots.appendChild(d);
  }
  var dotEls=dots.querySelectorAll('.dot');

  function go(x){
    i=Math.max(0,Math.min(n-1,x));
    deck.scrollTo({left:i*(deck.clientWidth||0),behavior:'smooth'});
  }
  function sync(){
    var w=deck.clientWidth||1;
    var x=Math.round(deck.scrollLeft/w);
    if(!isFinite(x)||x<0)x=0;
    if(x>n-1)x=n-1;
    if(x===i&&fill.style.width)return;
    i=x;
    cur.textContent=String(i+1).padStart(2,'0');
    fill.style.width=(n<2?100:(i/(n-1))*100)+'%';
    prev.disabled=i===0;
    next.disabled=i===n-1;
    for(var k=0;k<dotEls.length;k++)dotEls[k].classList.toggle('on',k===i);
    var on=dotEls[i];
    if(on&&dots.scrollWidth>dots.clientWidth){
      dots.scrollTo({left:on.offsetLeft-dots.clientWidth/2+11,behavior:'smooth'});
    }
  }
  var t;
  deck.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(sync,60);},{passive:true});
  prev.onclick=function(){go(i-1);};
  next.onclick=function(){go(i+1);};

  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(i+1);}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(i-1);}
    if(e.key==='Home'){e.preventDefault();go(0);}
    if(e.key==='End'){e.preventDefault();go(n-1);}
  });

  window.addEventListener('resize',function(){
    deck.scrollTo({left:i*deck.clientWidth,behavior:'auto'});
  });

  // Rueda vertical → avance horizontal (solo si el panel no scrollea)
  deck.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    var p=panels[i];
    var atTop=p.scrollTop<=0, atBot=p.scrollTop+p.clientHeight>=p.scrollHeight-2;
    if((e.deltaY>0&&atBot)||(e.deltaY<0&&atTop)){
      if(Math.abs(e.deltaY)<12)return;
      e.preventDefault();
      clearTimeout(t);
      if(!deck.dataset.lock){
        deck.dataset.lock='1';
        go(i+(e.deltaY>0?1:-1));
        setTimeout(function(){delete deck.dataset.lock;},520);
      }
    }
  },{passive:false});

  sync();
})();
`;
