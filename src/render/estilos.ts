// Envase del deck: cómo se recorre la presentación de 17 paneles.
// Los tokens y los componentes compartidos con el manual de campaña viven en
// `base/`. Aquí solo queda lo que el Growth no usa porque no es un deck:
// scroll horizontal, láminas, puntos, barra de navegación y aviso de corte.
//
// Origen del diseño: Wozial/estrategias/machote-social-research-wozial.html

import { TOKENS, CSS_COMUN } from './base';

const CSS_DECK = `
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

@media (max-width:768px){
  .dot{width:6px;height:6px;}
  .dot.on{width:16px;}
  .dots{gap:5px;height:46px;}
  .panel{padding:82px 0 70px;}
  .nav-ttl{display:none;}
  .nav-sep{display:none;}
  .nav-btn-txt{display:none;}
  .hint{display:none;}
}
@media (max-width:420px){
  .nav-bar{height:56px;}
  .prog{top:56px;}
  .panel{padding:74px 0 70px;}
}
@media (prefers-reduced-motion:reduce){
  .deck{scroll-behavior:auto;}
}
`;

export const ESTILOS = `${TOKENS}
${CSS_COMUN}
${CSS_DECK}`;
