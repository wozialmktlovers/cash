import { escapar } from '@/render/panels/comunes';

export type OpcionesBarra = {
  clienteId: string;
  clienteNombre: string;
  documentoId: string;
  version: number;
  tipo: 'research' | 'growth';
  tokenActivo: string | null;
  base: string;
};

/**
 * Barra de operador. Solo aparece en la vista interna; el link público sirve
 * el documento sin ella.
 *
 * Compartida entre la presentación y el manual de campaña porque hace lo
 * mismo en los dos: crear, copiar y revocar el link público. Lo único que
 * cambia es qué elementos fijos hay que bajar para que la barra no los tape,
 * y eso viaja en `tipo`.
 */
export function barraOperador(o: OpcionesBarra): string {
  const url = o.tokenActivo ? `${o.base}/p/${o.tokenActivo}` : '';
  const regenerar = o.tipo === 'growth'
    ? `/clientes/${escapar(o.clienteId)}`
    : `/clientes/${escapar(o.clienteId)}/investigar`;

  // Cada documento tiene su propio envase fijo que hay que desplazar.
  const desplazamiento = o.tipo === 'growth'
    ? `.nav{top:var(--barra-h);}
       .prog{top:calc(var(--barra-h) + 62px);}
       body{padding-top:calc(var(--barra-h) + 64px);}`
    : `.nav-bar{top:var(--barra-h);}
       .prog{top:calc(var(--barra-h) + 62px);}
       .deck{margin-top:var(--barra-h);height:calc(100vh - var(--barra-h));height:calc(100dvh - var(--barra-h));}
       @media (max-width:420px){ .prog{top:calc(var(--barra-h) + 56px);} }`;

  return `
<div id="barra-op">
  <div class="bo-fila">
    <span class="bo-marca">Wozial Studio</span>
    <span class="bo-cliente">${escapar(o.clienteNombre)} · v${o.version}</span>
    <button class="bo-btn bo-menu" id="bo-menu" type="button" aria-expanded="false" aria-controls="bo-panel">Acciones</button>
  </div>
  <div class="bo-panel" id="bo-panel">
    <a class="bo-btn" href="/clientes/${escapar(o.clienteId)}">Cliente</a>
    <a class="bo-btn" href="${regenerar}">Regenerar</a>
    <span class="bo-sep"></span>
    <span id="bo-link" class="bo-link" ${o.tokenActivo ? '' : 'hidden'}>
      <input id="bo-url" readonly value="${escapar(url)}" data-token="${escapar(o.tokenActivo ?? '')}">
      <button class="bo-btn" id="bo-copiar" type="button">Copiar</button>
      <button class="bo-btn bo-peligro" id="bo-revocar" type="button">Revocar</button>
    </span>
    <button class="bo-btn bo-primario" id="bo-crear" type="button" ${o.tokenActivo ? 'hidden' : ''}>Crear link público</button>
    <span class="bo-estado" id="bo-estado"></span>
  </div>
</div>
<style>
  :root{--barra-h:46px;}
  #barra-op [hidden]{display:none !important;}
  #barra-op{position:fixed;top:0;left:0;right:0;z-index:301;
    background:rgba(10,10,10,.94);backdrop-filter:blur(12px);
    border-bottom:1px solid rgba(255,255,255,.14);
    font-family:'Poppins',sans-serif;font-size:0.78rem;}
  #barra-op .bo-fila{display:flex;align-items:center;gap:10px;height:var(--barra-h);padding:0 16px;}
  #barra-op .bo-marca{font-weight:700;letter-spacing:.2em;text-transform:uppercase;
    font-size:0.75rem;color:#d4688a;white-space:nowrap;}
  #barra-op .bo-cliente{color:rgba(255,255,255,.6);flex:1;min-width:0;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  #barra-op .bo-btn{display:inline-block;padding:6px 11px;border-radius:8px;
    border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.82);
    text-decoration:none;cursor:pointer;background:transparent;
    font-family:inherit;font-size:0.78rem;white-space:nowrap;}
  #barra-op .bo-btn:hover{color:#fff;border-color:#d4688a;}
  #barra-op .bo-primario{background:#d4688a;border-color:#d4688a;color:#fff;font-weight:600;}
  #barra-op .bo-peligro{color:#ffb3c8;border-color:rgba(212,104,138,.45);}
  #barra-op .bo-link{display:inline-flex;align-items:center;gap:7px;min-width:0;}
  #barra-op input{width:min(320px,60vw);padding:6px 10px;border-radius:8px;
    border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);
    color:#fff;font-family:inherit;font-size:0.75rem;}
  #barra-op .bo-estado{color:rgba(255,255,255,.6);}
  #barra-op .bo-sep{flex:1;}
  #barra-op .bo-panel{display:none;flex-wrap:wrap;gap:8px;align-items:center;
    padding:12px 16px;border-top:1px solid rgba(255,255,255,.1);background:rgba(10,10,10,.97);}
  #barra-op.abierta .bo-panel{display:flex;}
  @media (min-width:900px){
    #barra-op .bo-menu{display:none;}
    #barra-op{display:flex;align-items:center;}
    #barra-op .bo-fila{flex:0 0 auto;padding-right:10px;}
    #barra-op .bo-panel{display:flex;flex:1;border-top:none;background:transparent;
      padding:0 16px 0 0;height:var(--barra-h);flex-wrap:nowrap;}
  }
  ${desplazamiento}
</style>
<script>
(function(){
  var barra=document.getElementById('barra-op');
  var estado=document.getElementById('bo-estado');
  var envoltura=document.getElementById('bo-link');
  var campo=document.getElementById('bo-url');
  var crear=document.getElementById('bo-crear');
  var menu=document.getElementById('bo-menu');
  var avisar=function(t){estado.textContent=t;setTimeout(function(){estado.textContent='';},2600);};

  menu.addEventListener('click',function(){
    var abierta=barra.classList.toggle('abierta');
    menu.setAttribute('aria-expanded',String(abierta));
    menu.textContent=abierta?'Cerrar':'Acciones';
  });

  crear.addEventListener('click',async function(){
    crear.disabled=true;
    try{
      var res=await fetch('/api/share',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({resultId:'${escapar(o.documentoId)}',tipo:'${o.tipo}'})});
      var b=await res.json();
      if(b.ok){campo.value=b.url;campo.dataset.token=b.token;envoltura.hidden=false;crear.hidden=true;avisar('Link creado.');}
      else{avisar('No se pudo crear.');}
    }catch(e){avisar('Sin conexion.');}
    crear.disabled=false;
  });

  document.getElementById('bo-copiar').addEventListener('click',function(){
    campo.select();
    navigator.clipboard.writeText(campo.value).then(function(){avisar('Copiado.');},function(){avisar('Copia manual.');});
  });

  document.getElementById('bo-revocar').addEventListener('click',async function(){
    try{
      var res=await fetch('/api/share',{method:'DELETE',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token:campo.dataset.token})});
      if(res.ok){envoltura.hidden=true;crear.hidden=false;avisar('Link revocado. Ahora devuelve 404.');}
      else{avisar('No se pudo revocar.');}
    }catch(e){avisar('Sin conexion.');}
  });
})();
</script>`;
}
