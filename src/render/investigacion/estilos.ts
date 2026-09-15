// Lo propio de la investigación sobre la base editorial compartida
// (`src/render/editorial/estilos.ts`): gráficas de barras/rangos, perfiles
// del cliente ideal con su cita, pasos de recomendación y los pequeños
// remates (tarjeta de hallazgo, fuente, «sin datos») que no reutiliza el
// mapa de pilares.
//
// Regla de la casa: la separación entre bloques va con gap, nunca con
// «.a + .a { margin }». Ese patrón ya pisó otras reglas dos veces.
import { ESTILOS_EDITORIAL } from '@/render/editorial/estilos';

const INVESTIGACION = `
.hallazgo h3{font-size:1.2rem;}

.perfil{display:grid;gap:14px;grid-template-columns:auto minmax(0,1fr);align-items:start;}
.avatar{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-weight:700;font-size:1.1rem;background:var(--azul-s);color:var(--azul);}
.perfil.primero .avatar{background:var(--rosa-s);color:var(--rosa);}
.perfil .cuerpo{display:grid;gap:10px;}
.cita{font:600 1.15rem/1.45 var(--fuente);color:var(--tinta);border-left:3px solid var(--rosa);padding-left:14px;}
.como-hablarle{padding:14px;border-radius:var(--r-sm);background:var(--gris);font:var(--t-small);font-weight:400;display:grid;gap:4px;}
.seccion.alterna .como-hablarle{background:var(--fondo);}
.como-hablarle b{color:var(--tinta);}

.pasos{list-style:none;display:grid;gap:18px;counter-reset:paso;}
/* Sin grid-template-columns: son las auto-columns quienes reparten el ancho
   entre las columnas que genera grid-auto-flow:column; con un template fijo
   de por medio, auto-fit no tiene filas de sobra que colapsar y se queda en
   una sola columna. */
@media (min-width:1100px){.pasos{grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);}}
.paso{counter-increment:paso;position:relative;display:grid;gap:10px;align-content:start;padding-top:60px;}
.paso::before{content:counter(paso);position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;
  background:var(--rosa);color:var(--sobre-acento);font-weight:700;z-index:1;}
@media (min-width:1100px){.paso::after{content:'';position:absolute;top:21px;left:44px;right:-18px;height:2px;background:var(--linea);}.paso:last-child::after{display:none;}}
.paso dl{display:grid;gap:4px;}
.paso dt{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}

.grafica{background:var(--tarjeta);border:1px solid var(--linea);border-radius:var(--r);padding:24px;display:grid;gap:12px;}
.grafica figcaption{font:var(--t-micro);letter-spacing:.1em;text-transform:uppercase;color:var(--suave);}
.barra-fila{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr) auto;gap:14px;align-items:center;font:var(--t-small);}
.barra-nombre{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.barra-pista{position:relative;height:14px;border-radius:var(--r-pill);background:var(--gris);}
.barra-relleno{position:absolute;inset:0 auto 0 0;border-radius:inherit;background:var(--azul);}
.rango-tramo{position:absolute;top:0;bottom:0;border-radius:inherit;background:var(--verde);}
.rango-punto{position:absolute;top:-3px;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:var(--amarillo);}
.barra-fila.destacada{font-weight:700;color:var(--tinta);}
.barra-fila.destacada .barra-relleno{background:var(--rosa);}
.barra-valor{font-variant-numeric:tabular-nums;font-weight:600;color:var(--tinta);}
@media (max-width:699px){.barra-fila{grid-template-columns:1fr auto;}.barra-pista{grid-column:1/-1;grid-row:2;}}
.dato-grande{font:700 clamp(24px,2.4vw,34px)/1.1 var(--fuente);color:var(--tinta);}

.fuente{font-size:.78rem;color:var(--suave);}
.sin-datos{color:var(--suave);font:var(--t-small);}

@media print{
  .grafica{box-shadow:none;break-inside:avoid;}
}
`;

export const ESTILOS_INVESTIGACION = `${ESTILOS_EDITORIAL}\n${INVESTIGACION}`;
