// Las 41 clases que el deck y el manual de campaña comparten.
// Componentes, no envase: lo que dibuja el contenido. El envase —cómo se
// recorre el documento— vive en cada uno.

export const CSS_COMUN = `
/* ── Caja de contenido ───────────────────────────────── */
/* Compartida: el deck la usa dentro de cada lámina y el manual dentro de
   cada sección. Es el ancho de lectura, no el envase. */
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

@media (max-width:1024px){
  .g4{grid-template-columns:repeat(2,1fr);}
  .g-1-2,.g-2-1{grid-template-columns:1fr;}
}
@media (max-width:768px){
  /* En pantalla chica la escala del operador estorba: el ancho manda. */
  html{font-size:16px;}
  .wrap,.wrap-sm{padding:0 22px;}
  h1{font-size:clamp(1.85rem,7.6vw,2.6rem);}
  h2{font-size:clamp(1.35rem,5.6vw,1.9rem);}
  .g2,.g3,.g4{grid-template-columns:1fr;gap:14px;}
  .card{padding:19px;}
  .phead{margin-bottom:26px;}
  .week{grid-template-columns:1fr;gap:7px;}
  .flow-step{min-width:200px;}
  .persona-hd{gap:14px;}
  .persona-av{width:54px;height:54px;font-size:1.3rem;}
  .bar-row{grid-template-columns:1fr;gap:5px;}
}
@media (max-width:420px){
  .wrap,.wrap-sm{padding:0 17px;}
}
`;
