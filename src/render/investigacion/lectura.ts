import type { Lectura } from '@/research/schemas';
import { iniciales } from '@/lib/ui/cliente-visual';
import { escapar, lista, encabezadoSeccion } from './comunes';

const ETIQUETA: Record<Lectura['descubrimos'][number]['tipo'], string> = {
  a_favor: 'A tu favor',
  cuidar: 'Hay que cuidar',
  oportunidad: 'Oportunidad',
};

export function seccionPortada(o: {
  eyebrow: string; titular: string; resumen: string; cifras: Lectura['cifras']; conIndice: boolean;
}): string {
  const cifras = o.cifras.length
    ? `<div class="cifras">${o.cifras.map((c) => `<div class="cifra-tarjeta ${escapar(c.tono)} aparece">
        <span class="cifra-valor">${escapar(c.valor)}</span>
        <span class="cifra-etiqueta">${escapar(c.etiqueta)}</span>
      </div>`).join('')}</div>`
    : '';
  const accesos = o.conIndice
    ? `<nav class="accesos" aria-label="Ir a">
        <a href="#descubrimos">Qué descubrimos</a><a href="#cliente-ideal">Tu cliente ideal</a>
        <a href="#recomendamos">Qué te recomendamos</a><a href="#detalle">Detalle</a>
      </nav>`
    : '';
  return `<section class="portada" id="inicio">
    <div class="portada-texto">
      <div class="pila"><p class="eyebrow">${escapar(o.eyebrow)}</p><h1>${escapar(o.titular)}</h1></div>
      <p class="resumen">${escapar(o.resumen)}</p>
    </div>
    ${cifras}
    ${accesos}
  </section>`;
}

export function seccionDescubrimos(l: Lectura): string {
  return `<section class="seccion" id="descubrimos" data-seccion>
    ${encabezadoSeccion('01', 'Qué descubrimos', 'Lo más importante de la investigación, en pocas palabras.')}
    <div class="rejilla dos">
      ${l.descubrimos.map((d) => `<article class="tarjeta hallazgo aparece">
        <span class="etiqueta ${escapar(d.tipo)}">${ETIQUETA[d.tipo]}</span>
        <h3>${escapar(d.titulo)}</h3>
        <p>${escapar(d.resumen)}</p>
        <details class="mas"><summary>Ver más</summary><p>${escapar(d.detalle)}</p></details>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionClienteIdeal(l: Lectura): string {
  const c = l.clienteIdeal;
  return `<section class="seccion alterna" id="cliente-ideal" data-seccion>
    ${encabezadoSeccion('02', 'Tu cliente ideal', 'A quién le vendes y qué la mueve.')}
    <div class="rejilla tres">
      <div class="tarjeta aparece"><h3>Quién es</h3><p>${escapar(c.quienEs)}</p></div>
      <div class="tarjeta aparece"><h3>Lo que le preocupa</h3>${lista(c.lePreocupa)}</div>
      <div class="tarjeta aparece"><h3>Lo que quiere lograr</h3>${lista(c.quiereLograr)}</div>
    </div>
    <div class="rejilla dos">
      ${c.perfiles.map((p, i) => `<article class="tarjeta perfil${i === 0 ? ' primero' : ''} aparece">
        <span class="avatar" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>
        <div class="cuerpo">
          <h3>${escapar(p.nombre)}</h3>
          <p class="suave">${escapar(p.descripcion)}</p>
          <blockquote class="cita">«${escapar(p.frase)}»</blockquote>
          <p class="como-hablarle"><b>Cómo hablarle</b>${escapar(p.comoHablarle)}</p>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionRecomendamos(l: Lectura): string {
  const r = l.recomendamos;
  const pendientes = l.faltaConfirmar.length
    ? `<div class="pila aparece"><h3 class="subtitulo">Lo que falta confirmar</h3><div class="suave">${lista(l.faltaConfirmar)}</div></div>`
    : '';
  return `<section class="seccion" id="recomendamos" data-seccion>
    ${encabezadoSeccion('03', 'Qué te recomendamos', 'Qué hacer, en orden de importancia.')}
    <ol class="pasos">
      ${r.pasos.map((p) => `<li class="paso aparece">
        <h3>${escapar(p.titulo)}</h3>
        <dl><dt>Qué hacer</dt><dd>${escapar(p.queHacer)}</dd></dl>
        <dl><dt>Por qué</dt><dd class="suave">${escapar(p.porQue)}</dd></dl>
      </li>`).join('')}
    </ol>
    <div class="pila">
      <h3 class="subtitulo">Dónde anunciarte</h3>
      <div class="rejilla cuatro">
        ${r.dondeAnunciarte.map((d) => `<div class="tarjeta aparece"><p class="dato-grande">${escapar(d.canal)}</p><p class="suave">${escapar(d.porQue)}</p></div>`).join('')}
      </div>
    </div>
    ${r.precio ? `<div class="tarjeta destacado aparece"><h3>Sobre tu precio</h3><p>${escapar(r.precio)}</p></div>` : ''}
    ${pendientes}
  </section>`;
}
