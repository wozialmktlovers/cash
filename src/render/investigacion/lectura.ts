import type { Lectura } from '@/research/schemas';
import { iniciales } from '@/lib/ui/cliente-visual';
import { escapar, encabezadoSeccion } from './comunes';
import { rutaEditable, rutaAncla } from '@/render/editorial/flujo-cliente';

const ETIQUETA: Record<Lectura['descubrimos'][number]['tipo'], string> = {
  a_favor: 'A tu favor',
  cuidar: 'Hay que cuidar',
  oportunidad: 'Oportunidad',
};

/** Como `lista()`, pero cada `<li>` lleva su propio `data-editable` cuando `editable`. */
function listaEditable(items: string[], editable: boolean, ruta: (indice: number) => string): string {
  if (!items.length) return '';
  return `<ul class="lista">${items.map((i, idx) => `<li${rutaEditable(editable, ruta(idx))}>${escapar(i)}</li>`).join('')}</ul>`;
}

export function seccionPortada(o: {
  eyebrow: string; titular: string; resumen: string; cifras: Lectura['cifras']; conIndice: boolean; editable?: boolean; anclas?: boolean;
}): string {
  const editable = o.editable ?? false;
  const anclas = o.anclas ?? false;
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
  return `<section class="portada" id="inicio"${rutaAncla(anclas, 'seccion:inicio')}>
    <div class="portada-texto">
      <div class="pila"><p class="eyebrow">${escapar(o.eyebrow)}</p><h1${rutaEditable(editable, 'lectura.datos.portada.titular')}>${escapar(o.titular)}</h1></div>
      <p class="resumen"${rutaEditable(editable, 'lectura.datos.portada.resumen')}>${escapar(o.resumen)}</p>
    </div>
    ${cifras}
    ${accesos}
  </section>`;
}

export function seccionDescubrimos(l: Lectura, editable = false, anclas = false): string {
  return `<section class="seccion" id="descubrimos" data-seccion${rutaAncla(anclas, 'seccion:descubrimos')}>
    ${encabezadoSeccion('01', 'Qué descubrimos', 'Lo más importante de la investigación, en pocas palabras.')}
    <div class="rejilla dos">
      ${l.descubrimos.map((d, i) => `<article class="tarjeta hallazgo aparece"${rutaAncla(anclas, `lectura.datos.descubrimos.${i}`)}>
        <span class="etiqueta ${escapar(d.tipo)}">${ETIQUETA[d.tipo]}</span>
        <h3${rutaEditable(editable, `lectura.datos.descubrimos.${i}.titulo`)}>${escapar(d.titulo)}</h3>
        <p${rutaEditable(editable, `lectura.datos.descubrimos.${i}.resumen`)}>${escapar(d.resumen)}</p>
        <details class="mas"><summary>Ver más</summary><p${rutaEditable(editable, `lectura.datos.descubrimos.${i}.detalle`)}>${escapar(d.detalle)}</p></details>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionClienteIdeal(l: Lectura, editable = false, anclas = false): string {
  const c = l.clienteIdeal;
  return `<section class="seccion alterna" id="cliente-ideal" data-seccion${rutaAncla(anclas, 'seccion:cliente-ideal')}>
    ${encabezadoSeccion('02', 'Tu cliente ideal', 'A quién le vendes y qué la mueve.')}
    <div class="rejilla tres">
      <div class="tarjeta aparece"><h3>Quién es</h3><p${rutaEditable(editable, 'lectura.datos.clienteIdeal.quienEs')}>${escapar(c.quienEs)}</p></div>
      <div class="tarjeta aparece"><h3>Lo que le preocupa</h3>${listaEditable(c.lePreocupa, editable, (i) => `lectura.datos.clienteIdeal.lePreocupa.${i}`)}</div>
      <div class="tarjeta aparece"><h3>Lo que quiere lograr</h3>${listaEditable(c.quiereLograr, editable, (i) => `lectura.datos.clienteIdeal.quiereLograr.${i}`)}</div>
    </div>
    <div class="rejilla dos">
      ${c.perfiles.map((p, i) => `<article class="tarjeta perfil${i === 0 ? ' primero' : ''} aparece"${rutaAncla(anclas, `lectura.datos.clienteIdeal.perfiles.${i}`)}>
        <span class="avatar" aria-hidden="true">${escapar(iniciales(p.nombre))}</span>
        <div class="cuerpo">
          <h3${rutaEditable(editable, `lectura.datos.clienteIdeal.perfiles.${i}.nombre`)}>${escapar(p.nombre)}</h3>
          <p class="suave"${rutaEditable(editable, `lectura.datos.clienteIdeal.perfiles.${i}.descripcion`)}>${escapar(p.descripcion)}</p>
          <blockquote class="cita">«<span${rutaEditable(editable, `lectura.datos.clienteIdeal.perfiles.${i}.frase`)}>${escapar(p.frase)}</span>»</blockquote>
          <p class="como-hablarle"><b>Cómo hablarle</b><span${rutaEditable(editable, `lectura.datos.clienteIdeal.perfiles.${i}.comoHablarle`)}>${escapar(p.comoHablarle)}</span></p>
        </div>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionRecomendamos(l: Lectura, editable = false, anclas = false): string {
  const r = l.recomendamos;
  const pendientes = l.faltaConfirmar.length
    ? `<div class="pila aparece"><h3 class="subtitulo">Lo que falta confirmar</h3><div class="suave">${listaEditable(l.faltaConfirmar, editable, (i) => `lectura.datos.faltaConfirmar.${i}`)}</div></div>`
    : '';
  return `<section class="seccion" id="recomendamos" data-seccion${rutaAncla(anclas, 'seccion:recomendamos')}>
    ${encabezadoSeccion('03', 'Qué te recomendamos', 'Qué hacer, en orden de importancia.')}
    <ol class="pasos">
      ${r.pasos.map((p, i) => `<li class="paso aparece"${rutaAncla(anclas, `lectura.datos.recomendamos.pasos.${i}`)}>
        <h3${rutaEditable(editable, `lectura.datos.recomendamos.pasos.${i}.titulo`)}>${escapar(p.titulo)}</h3>
        <dl><dt>Qué hacer</dt><dd${rutaEditable(editable, `lectura.datos.recomendamos.pasos.${i}.queHacer`)}>${escapar(p.queHacer)}</dd></dl>
        <dl><dt>Por qué</dt><dd class="suave"${rutaEditable(editable, `lectura.datos.recomendamos.pasos.${i}.porQue`)}>${escapar(p.porQue)}</dd></dl>
      </li>`).join('')}
    </ol>
    <div class="pila">
      <h3 class="subtitulo">Dónde anunciarte</h3>
      <div class="rejilla cuatro">
        ${r.dondeAnunciarte.map((d, i) => `<div class="tarjeta aparece"${rutaAncla(anclas, `lectura.datos.recomendamos.dondeAnunciarte.${i}`)}><p class="dato-grande"${rutaEditable(editable, `lectura.datos.recomendamos.dondeAnunciarte.${i}.canal`)}>${escapar(d.canal)}</p><p class="suave"${rutaEditable(editable, `lectura.datos.recomendamos.dondeAnunciarte.${i}.porQue`)}>${escapar(d.porQue)}</p></div>`).join('')}
      </div>
    </div>
    ${r.precio ? `<div class="tarjeta destacado aparece"><h3>Sobre tu precio</h3><p${rutaEditable(editable, 'lectura.datos.recomendamos.precio')}>${escapar(r.precio)}</p></div>` : ''}
    ${pendientes}
  </section>`;
}
