// Los componentes del manual de campaña: lo que dibuja el contenido —tarjetas,
// tablas, listas, avisos, cifras—, no el envase, que ahora lo pone la base
// editorial (`envolverDocumento`).
//
// Todo el color, el tipo, los radios y las sombras salen de los tokens del
// Studio (src/styles/tokens.css, vía `ESTILOS_EDITORIAL`): ni un hex fijo. Es
// lo que hace que el documento tenga modo noche sin una sola regla que
// pregunte en qué tema está, y que una tarjeta de aquí pese lo mismo que una
// de la investigación o del mapa de pilares.
//
// Las clases conservan los nombres del machote (.card, .lst, .tbl, .badge…):
// las escriben las nueve secciones y renombrarlas sería tocar el contenido,
// que es justo lo que este cambio no hace.

export const CSS_COMUN = `
/* ── Caja de contenido ───────────────────────────────── */
/* El ancho de lectura lo da el marco editorial (.pagina, al 85%); .wrap
   envuelve el cuerpo de cada sección y ya no reparte ni ancho ni sangría. */
.wrap,.wrap-sm{max-width:none;margin:0;padding:0;}

/* ── Glows ───────────────────────────────────────────── */
.blob{position:absolute;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:-1;}
.blob-pink{background:radial-gradient(circle,color-mix(in srgb,var(--rosa) 30%,transparent) 0%,transparent 68%);}
.blob-blue{background:radial-gradient(circle,color-mix(in srgb,var(--azul) 26%,transparent) 0%,transparent 68%);}
.blob-yellow{background:radial-gradient(circle,color-mix(in srgb,var(--amarillo) 16%,transparent) 0%,transparent 68%);}

/* ── Tipografía ──────────────────────────────────────── */
/* La escala es la del Studio (--t-*), multiplicada por --esc para la pantalla
   compartida. Antes eran siete clamps propios que no coincidían con los de
   ningún otro documento. */
h1{font:var(--t-display);}
h3{font:var(--t-h3);}
h4{font:var(--t-h3);font-size:calc(14.5px * var(--esc));color:var(--tinta);}
p{color:var(--texto);}
strong{color:var(--tinta);font-weight:600;}
/* El degradado del machote se resuelve en un acento plano: es el mismo rosa
   que ya marca eyebrows, viñetas y filetes en los otros tres entregables, y
   se lee igual de día que de noche (el degradado sobre fondo claro no). */
.grad{color:var(--rosa);}
.grad-warm{color:var(--amarillo);}
.eyebrow{display:block;margin-bottom:14px;}
.lead{font-size:1.06rem;line-height:1.6;color:var(--suave);max-width:68ch;}
.tiny{font:var(--t-small);color:var(--suave);}

/* ── Panel header ────────────────────────────────────── */
.phead{margin-bottom:34px;}
.pnum{display:inline-flex;align-items:center;gap:10px;font:var(--t-micro);letter-spacing:.18em;color:var(--rosa);margin-bottom:10px;}
.pnum::after{content:'';width:34px;height:1px;background:var(--linea);}

/* ── Cards ───────────────────────────────────────────── */
/* Misma tarjeta que .tarjeta en la base editorial: superficie, filo de una
   línea y la sombra del sistema. */
.card{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;position:relative;box-shadow:var(--sombra);}
/* El papel de la tarjeta se lee por su tinte, no por un filete: rosa
   hallazgo, azul mercado, ámbar cautela, verde validado. Los tintes -s son
   los mismos que usa la cabecera de cada pilar en el banco de temas, con su
   par de contraste ya vigilado por tests/lib/ui/contraste.test.ts. */
.card-pink,.card-blue,.card-yellow,.card-green{border-color:transparent;box-shadow:none;}
.card-pink{background:var(--rosa-s);}
.card-blue{background:var(--azul-s);}
.card-yellow{background:var(--amarillo-s);}
.card-green{background:var(--verde-s);}
.card-pink h3,.card-pink h4{color:var(--rosa);}
.card-blue h3,.card-blue h4{color:var(--azul);}
.card-yellow h3,.card-yellow h4{color:var(--amarillo);}
.card-green h3,.card-green h4{color:var(--verde);}
.card-sm{padding:17px;border-radius:var(--r-sm);}

/* ── Grids ───────────────────────────────────────────── */
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.g-1-2{display:grid;grid-template-columns:1fr 2fr;gap:26px;}
.g-2-1{display:grid;grid-template-columns:2fr 1fr;gap:26px;}
.par{display:grid;grid-template-columns:1fr;gap:24px;}
@media (min-width:1100px){
  .par{grid-template-columns:1.35fr 1fr;gap:26px;}
  .par>div>h3:first-child{margin-top:0!important;}
  .par .g3{gap:12px;}
  .par .card{padding:18px;}
  .par .g2{grid-template-columns:1fr;}
}

/* ── Badges ──────────────────────────────────────────── */
/* La etiqueta de la base editorial, con los nombres del machote. */
.badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:var(--r-pill);
  font:var(--t-micro);letter-spacing:.04em;text-transform:uppercase;}
.b-pink{background:var(--rosa-s);color:var(--rosa);}
.b-blue{background:var(--azul-s);color:var(--azul);}
.b-yellow{background:var(--amarillo-s);color:var(--amarillo);}
.b-green{background:var(--verde-s);color:var(--verde);}
/* El gris lleva filo: sobre la tarjeta, su fondo y el de la tarjeta casi
   coinciden y la píldora desaparecía. */
.b-gray{background:var(--gris);color:var(--suave);border:1px solid var(--linea);}

/* ── Stats ───────────────────────────────────────────── */
.stat{background:var(--gris);border:1px solid var(--linea);border-radius:var(--r-sm);padding:18px 18px 16px;position:relative;overflow:hidden;}
.stat::after{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--rosa);}
.stat-v{font-family:var(--mono);font-size:clamp(1.5rem,2.6vw,2.1rem);font-weight:700;line-height:1.05;letter-spacing:-.03em;color:var(--tinta);}
.stat-l{font:var(--t-micro);color:var(--suave);text-transform:uppercase;letter-spacing:.1em;margin-top:6px;}

/* ── Tabla ───────────────────────────────────────────── */
.tbl{width:100%;border-collapse:collapse;font-size:0.88rem;}
/* La cabecera se separa del cuerpo con superficie, no solo con línea. */
.tbl thead{background:var(--gris);}
.tbl th{text-align:left;padding:11px 13px;font:var(--t-micro);text-transform:uppercase;letter-spacing:.1em;color:var(--suave);
  border-bottom:1px solid var(--linea);white-space:nowrap;}
.tbl td{padding:12px 13px;border-bottom:1px solid var(--linea);color:var(--texto);vertical-align:top;}
.tbl tbody tr:last-child td{border-bottom:none;}
.tbl tbody tr:hover td{background:var(--gris);}
.tbl-wrap{overflow-x:auto;border:1px solid var(--linea);border-radius:var(--r-sm);background:var(--tarjeta);}
.tbl-wrap::-webkit-scrollbar{height:5px;}
.tbl-wrap::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--suave) 45%,transparent);border-radius:3px;}
.tbl-bare{border:none;background:none;box-shadow:none;}
.tbl-bare thead th{background:transparent;}

/* ── Quote / voz de cliente ──────────────────────────── */
.quote{border-left:2px solid var(--rosa);padding:3px 0 3px 16px;font-style:italic;color:var(--texto);}
.quote-src{display:block;font-style:normal;font:var(--t-small);color:var(--suave);margin-top:6px;letter-spacing:.03em;}

/* ── Listas ──────────────────────────────────────────── */
/* Misma viñeta que .lista en la base editorial. */
.lst{list-style:none;display:grid;gap:9px;}
.lst li{position:relative;padding-left:22px;color:var(--texto);}
.lst li::before{content:'';position:absolute;left:0;top:.62em;width:8px;height:8px;border-radius:50%;background:var(--rosa);}
.lst-blue li::before{background:var(--azul);}
.lst-green li::before{background:var(--verde);}
.lst-yellow li::before{background:var(--amarillo);}
.lst-x li::before{content:'✕';background:none;width:auto;height:auto;top:0;color:var(--rojo);font-size:0.78rem;font-weight:700;}
.lst-ok li::before{content:'✓';background:none;width:auto;height:auto;top:0;color:var(--verde);font-size:0.82rem;font-weight:700;}

/* ── Diagrama ciclo ──────────────────────────────────── */
.flow{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:8px;}
.flow::-webkit-scrollbar{height:5px;}
.flow::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--suave) 45%,transparent);border-radius:3px;}
.flow-step{flex:1;min-width:170px;position:relative;padding:0 9px;}
.flow-step:not(:last-child)::after{content:'';position:absolute;right:-6px;top:34px;width:12px;height:12px;
  border-top:1.5px solid var(--rosa);border-right:1.5px solid var(--rosa);transform:rotate(45deg);z-index:2;}
.flow-box{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r-sm);padding:15px;height:100%;}
.flow-n{width:26px;height:26px;border-radius:50%;background:var(--rosa-s);display:flex;align-items:center;justify-content:center;
  font:var(--t-micro);color:var(--rosa);margin-bottom:10px;}

/* ── Timeline semanas ────────────────────────────────── */
.week{display:grid;grid-template-columns:78px 1fr;gap:16px;padding:15px 0;border-bottom:1px solid var(--linea);}
.week:last-child{border-bottom:none;}
.week-tag{font:var(--t-micro);letter-spacing:.08em;text-transform:uppercase;color:var(--rosa);padding-top:2px;}

/* ── Barra comparativa ───────────────────────────────── */
.bar-row{display:grid;grid-template-columns:1fr 2.4fr auto;gap:12px;align-items:center;padding:7px 0;font-size:0.84rem;}
.bar-track{height:7px;background:var(--gris);border-radius:4px;overflow:hidden;}
.bar-fill{height:100%;border-radius:4px;background:var(--rosa);}
.bar-val{font-size:0.82rem;font-weight:700;color:var(--tinta);font-variant-numeric:tabular-nums;white-space:nowrap;}

/* ── Persona ─────────────────────────────────────────── */
.persona-hd{display:flex;align-items:center;gap:18px;margin-bottom:22px;}
.persona-av{width:66px;height:66px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;
  font-size:1.6rem;font-weight:800;color:var(--sobre-acento);}
.av-pink{background:var(--rosa);}
.av-blue{background:var(--azul);}

/* ── Fuente ──────────────────────────────────────────── */
.src{font-family:var(--mono);font-size:0.75rem;color:var(--suave);margin-top:9px;line-height:1.7;}
.src a{color:var(--suave);text-decoration:underline;text-underline-offset:2px;}

/* ── Alert ───────────────────────────────────────────── */
/* Cuerpo en el tinte del color y filo a la izquierda en el tono pleno: es
   donde se codifica el tipo de aviso. El texto se queda en el color de
   lectura, que es el par de contraste que los tests vigilan. */
.alert{border-radius:var(--r-sm);padding:16px 19px;border-left:3px solid;color:var(--texto);}
.alert strong{color:var(--tinta);}
.alert-red{background:var(--rojo-s);border-color:var(--rojo);}
.alert-green{background:var(--verde-s);border-color:var(--verde);}
.alert-yellow{background:var(--amarillo-s);border-color:var(--amarillo);}

/* ── Guía metodológica (solo plantilla) ──────────────── */
.guia{background:var(--amarillo-s);border:1px dashed var(--amarillo);border-radius:var(--r-sm);padding:15px 17px;margin-bottom:14px;}
.guia-t{font:var(--t-micro);letter-spacing:.14em;text-transform:uppercase;color:var(--amarillo);margin-bottom:9px;display:flex;align-items:center;gap:7px;}
.guia p,.guia li{color:var(--texto);}
.ph{color:var(--rosa);font-weight:700;background:var(--rosa-s);padding:1px 6px;border-radius:4px;}
.fuente-lst{list-style:none;display:grid;gap:6px;margin-top:8px;}
.fuente-lst li{position:relative;padding-left:18px;font-size:0.8rem;}
.fuente-lst li::before{content:'→';position:absolute;left:0;color:var(--amarillo);font-weight:700;}

@media (max-width:1024px){
  .g4{grid-template-columns:repeat(2,1fr);}
  .g-1-2,.g-2-1{grid-template-columns:1fr;}
}
@media (max-width:768px){
  h1{font-size:clamp(1.85rem,7.6vw,2.6rem);}
  .g2,.g3,.g4{grid-template-columns:1fr;gap:14px;}
  .card{padding:19px;}
  .phead{margin-bottom:26px;}
  .week{grid-template-columns:1fr;gap:7px;}
  .flow-step{min-width:200px;}
  .persona-hd{gap:14px;}
  .persona-av{width:54px;height:54px;font-size:1.3rem;}
  .bar-row{grid-template-columns:1fr;gap:5px;}
}
`;
