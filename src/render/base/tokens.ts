// Tokens y cimientos compartidos por el deck y el manual de campaña.
// Aquí vive la escala de videollamada: los dos documentos se presentan
// compartiendo pantalla, así que ninguno puede quedarse sin ella.

export const TOKENS = `
:root{
  --black:#08080b; --white:#fff;
  --pink:#d4688a; --blue:#5a6ecc; --yellow:#c8c800; --green:#10b981;
  /* Escala de superficies. Antes había un solo negro y todo flotaba al mismo
     valor, así que ninguna sección se separaba de la siguiente. Cuatro
     niveles: suelo, banda de sección, tarjeta y tarjeta elevada. */
  --s0:#08080b; --s1:#0e0e14; --s2:#14141c; --s3:#1c1c26;

  /* Cuerpos de tarjeta a color sólido, sin transparencia ni contorno. Son el
     tono profundo de cada color de marca, no el color a plena saturación:
     blanco sobre #d4688a da 2.6:1, que no es legible y empeora al comprimirse
     el video. Estos pasan de 8:1 y siguen leyéndose como su color. */
  --c-pink:#4a1a2a; --c-blue:#1e2450; --c-yellow:#38380c; --c-green:#0e3a2c;
  --c-pink-hi:#f0a2bd; --c-blue-hi:#a5b2f5; --c-yellow-hi:#e4e44a; --c-green-hi:#4fe0ac;
  --glass:var(--s2); --glass-deep:var(--s1);

  /* Tipografía de evidencia. Lo verificable —fuentes, identificadores, UTMs,
     medidas, conteos— va en monoespaciada; lo juzgado va en Poppins. Es la
     distinción que define este producto, así que la carga la tipografía. */
  --mono:ui-monospace,'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;
  --border:rgba(255,255,255,.14); --border-med:rgba(255,255,255,.24);
  /* Subidos desde .45 y .72 del machote: es el detalle que primero se pierde
     al recomprimirse la pantalla compartida. */
  --dim:rgba(255,255,255,.6); --mid:rgba(255,255,255,.82);
  --radius:16px; --radius-sm:10px;

  /* Escala vertical. Antes los márgenes eran valores sueltos entre 6 y 30px
     sin relación entre sí, y todos cortos: el documento se leía apretado y
     nada indicaba qué separaba de qué. Cinco pasos, y cada salto se nota. */
  --e1:12px;   /* dentro de un bloque */
  --e2:20px;   /* entre elementos hermanos */
  --e3:34px;   /* entre bloques */
  --e4:58px;   /* entre apartados con título propio */
  --e5:110px;  /* aire de sección */
  /* Escala tipográfica global. La cambia el botón de la barra. */
  --esc:1;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{
  -webkit-font-smoothing:antialiased;
  font-size:calc(16px * var(--esc));
}
body{
  font-family:'Poppins',-apple-system,sans-serif;
  background:var(--s0); color:var(--white);
  line-height:1.65;
  /* El alto y el overflow NO van aquí: el deck bloquea el scroll del body
     porque desplaza láminas, y el manual de campaña se lee de corrido y tiene
     que poder desplazarse. Cada envase pone el suyo. */
}
body::before{
  content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.055'/%3E%3C/svg%3E");
  background-size:256px 256px;
}

@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;}
}
`;
