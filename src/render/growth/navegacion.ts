/**
 * Navegación del manual de campaña.
 *
 * No es la del deck: aquí no se pasan láminas, se lee de corrido. Lo que hace
 * falta es saber en qué sección estás (scroll-spy sobre el nav de anclas),
 * cuánto llevas leído, y los mismos controles de videollamada que el deck,
 * porque este documento también se presenta compartiendo pantalla.
 *
 * Sin backticks ni interpolaciones dentro del literal: cortarían la cadena y
 * el documento saldría sin navegación sin que fallara ningún test de tipos.
 */
export const NAVEGACION_GROWTH = `
(function(){
  var secciones=document.querySelectorAll('.sec');
  if(!secciones.length) return;
  var enlaces=document.querySelectorAll('.nav-links a');
  var fill=document.getElementById('pf');

  // ── Progreso de lectura ──────────────────────────────
  function progreso(){
    if(!fill) return;
    var alto=document.documentElement.scrollHeight-window.innerHeight;
    var pct=alto>0 ? (window.scrollY/alto)*100 : 100;
    fill.style.width=Math.max(0,Math.min(100,pct))+'%';
  }

  // ── Scroll-spy ───────────────────────────────────────
  // Se marca la sección cuyo inicio quedó más arriba sin pasarse del tercio
  // superior de la ventana. Con IntersectionObserver a secas, dos secciones
  // visibles a la vez encienden las dos y el operador no sabe dónde está.
  function activa(){
    var y=window.scrollY+window.innerHeight/3;
    var actual=secciones[0];
    for(var i=0;i<secciones.length;i++){
      if(secciones[i].offsetTop<=y) actual=secciones[i];
    }
    for(var k=0;k<enlaces.length;k++){
      var href=enlaces[k].getAttribute('href')||'';
      enlaces[k].classList.toggle('on', href==='#'+actual.id);
    }
  }

  var pendiente=false;
  window.addEventListener('scroll',function(){
    if(pendiente) return;
    pendiente=true;
    requestAnimationFrame(function(){ progreso(); activa(); pendiente=false; });
  },{passive:true});

  // ── Escala tipográfica para pantalla compartida ──────
  var PASOS=[
    {k:'normal', v:1,    ttl:'Tamano normal'},
    {k:'grande', v:1.18, ttl:'Texto grande, para compartir pantalla'},
    {k:'maxima', v:1.36, ttl:'Texto maximo, videollamada en ventana chica'}
  ];
  var esc=document.getElementById('escala');
  var p=0;
  try{
    var guardado=localStorage.getItem('wozial-esc');
    for(var q=0;q<PASOS.length;q++) if(PASOS[q].k===guardado) p=q;
  }catch(e){}

  function aplicarEscala(){
    var paso=PASOS[p];
    document.documentElement.style.setProperty('--esc',String(paso.v));
    if(esc){
      esc.textContent=String(paso.v)+'x';
      esc.title=paso.ttl;
      esc.classList.toggle('on',p>0);
    }
    try{ localStorage.setItem('wozial-esc',paso.k); }catch(e){}
    progreso();
  }
  function moverEscala(d){
    p=Math.max(0,Math.min(PASOS.length-1,p+d));
    aplicarEscala();
  }
  if(esc) esc.onclick=function(){ p=(p+1)%PASOS.length; aplicarEscala(); };

  // ── Pantalla completa ────────────────────────────────
  var pant=document.getElementById('pantalla');
  function alternarPantalla(){
    if(document.fullscreenElement){ document.exitFullscreen(); }
    else if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(function(){});
    }
  }
  if(pant) pant.onclick=alternarPantalla;

  document.addEventListener('keydown',function(e){
    if(e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if(e.key==='+'||e.key==='='){e.preventDefault();moverEscala(1);}
    if(e.key==='-'||e.key==='_'){e.preventDefault();moverEscala(-1);}
    if(e.key==='0'){e.preventDefault();p=0;aplicarEscala();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();alternarPantalla();}
  });

  aplicarEscala();
  progreso();
  activa();
})();
`;
