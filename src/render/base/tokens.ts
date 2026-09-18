// Cimientos propios del manual de campaña, encima de la línea del Studio.
//
// Los colores, la familia tipográfica, los radios y las sombras ya no viven
// aquí: los pone `ESTILOS_EDITORIAL` (src/render/editorial/estilos.ts, que a
// su vez incrusta src/styles/tokens.css), la misma base que ya comparten la
// investigación, el mapa de pilares y el contenido mensual. De ahí viene
// también el modo noche: ningún componente pregunta en qué tema está.
//
// Aquí queda solo lo que es de este documento y de ningún otro:
//
//  - la escala de videollamada (`--esc`), que el operador sube desde la
//    cabecera porque el manual se presenta compartiendo pantalla;
//  - la voz de la evidencia (`--mono`): lo verificable —UTMs, identificadores,
//    medidas, prompts— va en monoespaciada y lo juzgado en Poppins;
//  - la escala vertical (`--e1`…`--e5`), que las secciones usan en línea
//    (`style="margin-top:var(--e3)"`), así que no se puede quitar sin tocar
//    el contenido.

export const TOKENS = `
:root{
  /* Tipografía de evidencia. */
  --mono:ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;

  /* Escala vertical. Cinco pasos, y cada salto se nota. */
  --e1:12px;   /* dentro de un bloque */
  --e2:20px;   /* entre elementos hermanos */
  --e3:34px;   /* entre bloques */
  --e4:58px;   /* entre apartados con título propio */
  --e5:110px;  /* aire de sección */

  /* Escala tipográfica global: la mueve el botón de la cabecera. */
  --esc:1;
}

/* La escala de videollamada multiplica la escala tipográfica del Studio. Los
   tokens --t-* de tokens.css vienen en px (no en rem), así que subir el
   font-size de la raíz por sí solo no los movería: se redeclaran con el
   factor, sin tocar familia, pesos ni interlineados. El término fluido de
   cada clamp se queda igual a propósito — en pantalla chica manda el ancho,
   no la comodidad del operador. */
:root{
  --t-display:700 clamp(calc(30px * var(--esc)),6vw,calc(42px * var(--esc)))/1.06 var(--fuente);
  --t-h1:700 clamp(calc(25px * var(--esc)),5vw,calc(34px * var(--esc)))/1.14 var(--fuente);
  --t-h2:700 clamp(calc(19px * var(--esc)),3.6vw,calc(22px * var(--esc)))/1.2 var(--fuente);
  --t-h3:600 calc(16.5px * var(--esc))/1.25 var(--fuente);
  --t-body:400 calc(15.5px * var(--esc))/1.6 var(--fuente);
  --t-small:500 calc(13px * var(--esc))/1.45 var(--fuente);
  --t-micro:700 calc(11.5px * var(--esc))/1.3 var(--fuente);
}

/* Lo que este documento mide en rem —tamaños del machote que no tienen token
   propio— sigue a la misma escala. */
html{font-size:calc(16px * var(--esc));}
`;
