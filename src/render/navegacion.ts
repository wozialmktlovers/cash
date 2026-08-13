/**
 * Navegación de la presentación.
 *
 * Deriva de la del machote de Wozial, con una corrección: el original mueve el
 * deck con `scrollTo({behavior:'smooth'})`, y en Chrome eso no hace nada en
 * este contenedor (flex + overflow-x:auto + scroll-snap mandatory). Comprobado
 * en el navegador: `scrollLeft` directo mueve el deck, `behavior:'smooth'` lo
 * deja en cero. El resultado era que el contador se quedaba en 01 y ni las
 * flechas ni los puntos ni el teclado avanzaban.
 *
 * Aquí la animación se hace a mano con requestAnimationFrame, desactivando el
 * scroll-snap y el scroll-behavior mientras dura para que no peleen con ella.
 * El deslizamiento táctil no se toca: ese lo hace el navegador y siempre
 * funcionó.
 */
export const NAVEGACION = `
(function(){
  var deck=document.getElementById('deck');
  if(!deck) return;
  var panels=deck.querySelectorAll('.panel');
  var dots=document.getElementById('dots');
  var cur=document.getElementById('cur');
  var tot=document.getElementById('tot');
  var prev=document.getElementById('prev');
  var next=document.getElementById('next');
  var fill=document.getElementById('progFill');
  var n=panels.length, i=0, anim=0, respaldo=0;

  if(tot) tot.textContent=String(n).padStart(2,'0');

  // La animación se hace a mano: hay que apagar el suavizado del navegador.
  deck.style.scrollBehavior='auto';

  if(dots){
    for(var k=0;k<n;k++){
      var d=document.createElement('button');
      d.className='dot'+(k===0?' on':'');
      d.setAttribute('aria-label','Sección '+(k+1));
      d.dataset.i=k;
      d.onclick=function(){go(+this.dataset.i);};
      dots.appendChild(d);
    }
  }
  var dotEls=dots?dots.querySelectorAll('.dot'):[];

  function go(x){
    i=Math.max(0,Math.min(n-1,x));
    animarHasta(i*(deck.clientWidth||0));
  }

  function animarHasta(destino){
    cancelAnimationFrame(anim);
    var inicio=deck.scrollLeft, delta=destino-inicio;
    if(Math.abs(delta)<2){ deck.scrollLeft=destino; sync(); return; }

    // El snap obligatorio pelea con una animación cuadro a cuadro.
    var snapPrevio=deck.style.scrollSnapType;
    deck.style.scrollSnapType='none';

    var t0=performance.now(), dur=380;
    function paso(t){
      var k=Math.min(1,(t-t0)/dur);
      var e=k<0.5 ? 2*k*k : 1-Math.pow(-2*k+2,2)/2;
      deck.scrollLeft=inicio+delta*e;
      if(k<1){ anim=requestAnimationFrame(paso); }
      else { rematar(destino,snapPrevio); }
    }
    function rematar(d,snap){
      clearTimeout(respaldo);
      cancelAnimationFrame(anim);
      deck.scrollLeft=d;
      deck.style.scrollSnapType=snap;
      sync();
    }
    // El navegador congela requestAnimationFrame en pestañas ocultas. Sin esta
    // red, cambiar de pestaña a mitad de una transición deja el deck a medias y
    // el scroll-snap apagado para siempre: al volver ya no avanza ninguna
    // lámina. El respaldo cierra la animación sí o sí.
    clearTimeout(respaldo);
    respaldo=setTimeout(function(){ rematar(destino,snapPrevio); }, dur+220);
    anim=requestAnimationFrame(paso);
  }

  function sync(){
    var w=deck.clientWidth||1;
    var x=Math.round(deck.scrollLeft/w);
    if(!isFinite(x)||x<0)x=0;
    if(x>n-1)x=n-1;
    i=x;
    if(cur) cur.textContent=String(i+1).padStart(2,'0');
    if(fill) fill.style.width=(n<2?100:(i/(n-1))*100)+'%';
    if(prev) prev.disabled=i===0;
    if(next) next.disabled=i===n-1;
    for(var k=0;k<dotEls.length;k++)dotEls[k].classList.toggle('on',k===i);
    var on=dotEls[i];
    if(on&&dots&&dots.scrollWidth>dots.clientWidth){
      dots.scrollLeft=on.offsetLeft-dots.clientWidth/2+11;
    }
    avisarCorte();
  }

  var t;
  deck.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(sync,60);},{passive:true});
  if(prev) prev.onclick=function(){go(i-1);};
  if(next) next.onclick=function(){go(i+1);};

  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(i+1);}
    if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(i-1);}
    if(e.key==='Home'){e.preventDefault();go(0);}
    if(e.key==='End'){e.preventDefault();go(n-1);}
  });

  window.addEventListener('resize',function(){
    cancelAnimationFrame(anim);
    deck.scrollLeft=i*deck.clientWidth;
    avisarCorte();
  });

  // Rueda vertical al final o al inicio del panel: avanza de lámina.
  deck.addEventListener('wheel',function(e){
    if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    var p=panels[i];
    var arriba=p.scrollTop<=0, abajo=p.scrollTop+p.clientHeight>=p.scrollHeight-2;
    if((e.deltaY>0&&abajo)||(e.deltaY<0&&arriba)){
      if(Math.abs(e.deltaY)<12)return;
      e.preventDefault();
      if(!deck.dataset.lock){
        deck.dataset.lock='1';
        go(i+(e.deltaY>0?1:-1));
        setTimeout(function(){delete deck.dataset.lock;},520);
      }
    }
  },{passive:false});

  // ── Escala tipográfica para pantalla compartida ──────────────
  // Tres pasos. Suben el rem de la raíz, del que cuelgan todos los tamaños de
  // letra; las rejillas y los espesores siguen en px y no se mueven, así que
  // la composición aguanta. Se recuerda entre presentaciones porque el
  // operador suele compartir siempre con el mismo montaje.
  var PASOS=[
    {k:'normal', v:1,    ttl:'Tamaño normal'},
    {k:'grande', v:1.18, ttl:'Texto grande — para compartir pantalla'},
    {k:'maxima', v:1.36, ttl:'Texto máximo — videollamada en ventana chica'}
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
    deck.dataset.esc=paso.k;
    if(esc){
      esc.textContent=String(paso.v)+'×';
      esc.title=paso.ttl;
      esc.classList.toggle('on',p>0);
    }
    try{ localStorage.setItem('wozial-esc',paso.k); }catch(e){}
    // Cambia el alto útil de cada lámina: hay que recalcular el corte y
    // recolocar el deck, que si no queda a medio camino entre dos paneles.
    deck.scrollLeft=i*deck.clientWidth;
    avisarCorte();
  }
  function moverEscala(d){
    p=Math.max(0,Math.min(PASOS.length-1,p+d));
    aplicarEscala();
  }
  if(esc) esc.onclick=function(){ p=(p+1)%PASOS.length; aplicarEscala(); };

  // ── Pantalla completa ────────────────────────────────────────
  // La barra del navegador se come cerca del 15% del alto, y en una
  // videollamada ese alto es justo lo que falta.
  var pant=document.getElementById('pantalla');
  function alternarPantalla(){
    if(document.fullscreenElement){ document.exitFullscreen(); }
    else if(document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(function(){});
    }
  }
  if(pant) pant.onclick=alternarPantalla;

  // ── Aviso de contenido por debajo del corte ──────────────────
  // La audiencia de una videollamada no puede desplazarse: si la lámina sigue
  // hacia abajo y el operador no lo nota, eso no se presenta.
  var mas=document.getElementById('mas');
  function avisarCorte(){
    if(!mas) return;
    // La lámina activa se deduce del scroll, no del índice i: así el aviso es
    // correcto aunque se llame antes de que sync() haya puesto al día el
    // índice, que es lo que pasa mientras dura una transición.
    var w=deck.clientWidth||1;
    var pa=panels[Math.max(0,Math.min(n-1,Math.round(deck.scrollLeft/w)))];
    if(!pa){ mas.classList.remove('on'); return; }
    var desborda=pa.scrollHeight-pa.clientHeight>8;
    var alFinal=pa.scrollTop+pa.clientHeight>=pa.scrollHeight-8;
    mas.classList.toggle('on',desborda&&!alFinal);
  }
  for(var k=0;k<n;k++){
    panels[k].addEventListener('scroll',avisarCorte,{passive:true});
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='+'||e.key==='='){e.preventDefault();moverEscala(1);}
    if(e.key==='-'||e.key==='_'){e.preventDefault();moverEscala(-1);}
    if(e.key==='0'){e.preventDefault();p=0;aplicarEscala();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();alternarPantalla();}
  });

  aplicarEscala();
  sync();
})();
`;
