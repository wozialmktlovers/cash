import type { Lectura } from '@/research/schemas';
import { iniciales } from '@/lib/ui/cliente-visual';
import { escapar, lista } from './comunes';

const ETIQUETA: Record<Lectura['descubrimos'][number]['tipo'], string> = {
  a_favor: 'A tu favor',
  cuidar: 'Hay que cuidar',
  oportunidad: 'Oportunidad',
};

export function seccionPortada(eyebrow: string, titular: string, resumen: string, conIndice: boolean): string {
  const indice = conIndice
    ? `<nav class="indice" aria-label="Contenido">
        <a href="#descubrimos">Qué descubrimos</a>
        <a href="#cliente-ideal">Tu cliente ideal</a>
        <a href="#recomendamos">Qué te recomendamos</a>
      </nav>`
    : '';
  return `<section class="portada">
    <p class="eyebrow">${escapar(eyebrow)}</p>
    <h1>${escapar(titular)}</h1>
    <p class="resumen">${escapar(resumen)}</p>
    ${indice}
  </section>`;
}

export function seccionDescubrimos(l: Lectura): string {
  return `<section id="descubrimos">
    <h2>Qué descubrimos</h2>
    ${l.descubrimos.map((d) => `<article class="tarjeta">
      <span class="etiqueta ${d.tipo}">${ETIQUETA[d.tipo]}</span>
      <h3>${escapar(d.titulo)}</h3>
      <p>${escapar(d.explicacion)}</p>
    </article>`).join('')}
  </section>`;
}

export function seccionClienteIdeal(l: Lectura): string {
  const c = l.clienteIdeal;
  return `<section id="cliente-ideal">
    <h2>Tu cliente ideal</h2>
    <p>${escapar(c.quienEs)}</p>
    <div class="columnas">
      <div class="tarjeta"><h3>Lo que le preocupa</h3>${lista(c.lePreocupa)}</div>
      <div class="tarjeta"><h3>Lo que quiere lograr</h3>${lista(c.quiereLograr)}</div>
    </div>
    <div class="columnas">
      ${c.perfiles.map((p) => `<article class="tarjeta perfil">
        <span class="avatar" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>
        <div>
          <h3>${escapar(p.nombre)}</h3>
          <p>${escapar(p.descripcion)}</p>
          <p class="como-hablarle"><b>Cómo hablarle</b>${escapar(p.comoHablarle)}</p>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionRecomendamos(l: Lectura): string {
  const r = l.recomendamos;
  return `<section id="recomendamos">
    <h2>Qué te recomendamos</h2>
    <ol class="pasos">
      ${r.pasos.map((p) => `<li class="paso"><div class="cuerpo tarjeta">
        <h3>${escapar(p.titulo)}</h3>
        <dl>
          <dt>Qué hacer</dt><dd>${escapar(p.queHacer)}</dd>
          <dt>Por qué</dt><dd>${escapar(p.porQue)}</dd>
        </dl>
      </div></li>`).join('')}
    </ol>
    <div class="bloque tarjeta">
      <h3>Dónde anunciarte</h3>
      <ul class="lista">${r.dondeAnunciarte.map((d) => `<li><b>${escapar(d.canal)}.</b> ${escapar(d.porQue)}</li>`).join('')}</ul>
    </div>
    ${r.precio ? `<div class="bloque tarjeta"><h3>Sobre tu precio</h3><p>${escapar(r.precio)}</p></div>` : ''}
  </section>`;
}

export function seccionFaltaConfirmar(l: Lectura): string {
  if (!l.faltaConfirmar.length) return '';
  return `<section>
    <h3>Lo que falta confirmar</h3>
    <div class="suave">${lista(l.faltaConfirmar)}</div>
  </section>`;
}
