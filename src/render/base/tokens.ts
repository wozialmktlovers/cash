// Tokens y cimientos compartidos por el deck y el manual de campaña.
// Aquí vive la escala de videollamada: los dos documentos se presentan
// compartiendo pantalla, así que ninguno puede quedarse sin ella.

export const TOKENS = `
:root{
  --black:#0a0a0a; --white:#fff;
  --pink:#d4688a; --blue:#5a6ecc; --yellow:#c8c800; --green:#10b981;
  --glass:rgba(255,255,255,.06); --glass-deep:rgba(255,255,255,.03);
  --border:rgba(255,255,255,.14); --border-med:rgba(255,255,255,.24);
  /* Subidos desde .45 y .72 del machote: es el detalle que primero se pierde
     al recomprimirse la pantalla compartida. */
  --dim:rgba(255,255,255,.6); --mid:rgba(255,255,255,.82);
  --radius:16px; --radius-sm:10px;
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
  background:var(--black); color:var(--white);
  line-height:1.65; overflow:hidden; height:100vh; height:100dvh;
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
