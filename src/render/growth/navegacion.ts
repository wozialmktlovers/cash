/**
 * Controles de videollamada del manual de campaña.
 *
 * Lo que antes hacía este script —barra de anclas, progreso de lectura,
 * scroll-spy— lo pone ahora la base editorial: `SCRIPT_CABECERA_BASE` lleva el
 * progreso en la cápsula y `SCRIPT_EDITORIAL` enciende la entrada del índice
 * lateral por la que vas pasando. Aquí queda solo lo que es de este documento
 * y de ningún otro: se presenta compartiendo pantalla, así que el operador
 * sube el tipo y lo pone a pantalla completa sin salir del manual.
 *
 * Sin backticks ni interpolaciones dentro del literal: cortarían la cadena y
 * el documento saldría sin controles sin que fallara ningún test de tipos.
 */
export const NAVEGACION_GROWTH = `
(function(){
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

  // En pantalla chica la escala del operador estorba: manda el ancho. Los dos
  // botones ya se ocultan por CSS bajo 900px; esto evita además que una
  // escala guardada en el escritorio llegue agrandando el texto en celular.
  var anchoSuficiente=window.matchMedia ? window.matchMedia('(min-width:900px)') : null;
  function cabe(){ return !anchoSuficiente || anchoSuficiente.matches; }

  function aplicarEscala(){
    var paso=PASOS[p];
    document.documentElement.style.setProperty('--esc', cabe() ? String(paso.v) : '1');
    if(esc){
      esc.textContent=String(paso.v)+'x';
      esc.title=paso.ttl;
      esc.classList.toggle('on',p>0);
    }
    try{ localStorage.setItem('wozial-esc',paso.k); }catch(e){}
  }
  function moverEscala(d){
    p=Math.max(0,Math.min(PASOS.length-1,p+d));
    aplicarEscala();
  }
  if(esc) esc.onclick=function(){ p=(p+1)%PASOS.length; aplicarEscala(); };
  if(anchoSuficiente&&anchoSuficiente.addEventListener) anchoSuficiente.addEventListener('change',aplicarEscala);

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
    // Modo edición (B6, SCRIPT_FLUJO): mientras se edita un [data-editable]
    // (contenteditable), 'f'/'0'/'+'/'-' son texto, no atajos de la barra.
    if(e.target && e.target.isContentEditable) return;
    if(document.documentElement.classList.contains('modo-edicion')) return;
    // Modo Comentar (B7): mismo criterio, aunque el recuadro flotante ya se
    // filtra arriba por ser un <textarea> — cubre además cualquier otra tecla
    // mientras se está anotando el documento.
    if(document.documentElement.classList.contains('modo-comentar')) return;
    if(e.key==='+'||e.key==='='){e.preventDefault();moverEscala(1);}
    if(e.key==='-'||e.key==='_'){e.preventDefault();moverEscala(-1);}
    if(e.key==='0'){e.preventDefault();p=0;aplicarEscala();}
    if(e.key==='f'||e.key==='F'){e.preventDefault();alternarPantalla();}
  });

  aplicarEscala();

  // ── Copiar (sección A: copys y briefs visuales) ──────
  // El botón apunta por id al texto que copia. En file:// o http sin TLS no
  // hay navigator.clipboard, así que cae a execCommand con un textarea
  // oculto; si eso también falla, lo dice en vez de fingir que copió.
  function copiaVieja(texto,listo){
    var area=document.createElement('textarea');
    area.value=texto;
    area.setAttribute('readonly','readonly');
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.select();
    var ok=false;
    try{ ok=document.execCommand('copy'); }catch(e){ ok=false; }
    document.body.removeChild(area);
    listo(ok);
  }
  function alPortapapeles(texto,listo){
    if(navigator.clipboard&&window.isSecureContext){
      navigator.clipboard.writeText(texto).then(function(){listo(true);},function(){copiaVieja(texto,listo);});
      return;
    }
    copiaVieja(texto,listo);
  }
  var copiadores=document.querySelectorAll('[data-copiar]');
  for(var c=0;c<copiadores.length;c++){
    (function(boton){
      boton.addEventListener('click',function(){
        var destino=document.getElementById(boton.getAttribute('data-copiar'));
        if(!destino) return;
        var etiqueta=boton.querySelector('[data-copiar-texto]')||boton;
        alPortapapeles(destino.textContent,function(ok){
          etiqueta.textContent=ok?'Copiado':'Selecciona y copia';
          setTimeout(function(){ etiqueta.textContent='Copiar'; },2000);
        });
      });
    })(copiadores[c]);
  }
})();
`;
