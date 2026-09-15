import type { Estrategia, Funcion, Formato } from '@/pilares/schemas';
import { escapar, lista, encabezadoSeccion } from '@/render/editorial/comunes';
import { rutaEditable } from '@/render/editorial/flujo-cliente';

/** Como `lista()`, pero cada `<li>` lleva su propio `data-editable` cuando `editable`. */
function listaEditable(items: string[], editable: boolean, ruta: (indice: number) => string): string {
  if (!items.length) return '';
  return `<ul class="lista">${items.map((i, idx) => `<li${rutaEditable(editable, ruta(idx))}>${escapar(i)}</li>`).join('')}</ul>`;
}

/** Color por número de pilar (1–5), en el orden que fija el spec. */
export const COLOR_PILAR = ['var(--rosa)', 'var(--azul)', 'var(--amarillo)', 'var(--verde)', 'var(--tinta)'];

/** Color y etiqueta por función, también en el orden del spec. */
export const COLOR_FUNCION: Record<Funcion, string> = {
  autoridad: 'var(--azul)',
  conexion: 'var(--rosa)',
  engagement: 'var(--amarillo)',
  prueba_social: 'var(--verde)',
  venta: 'var(--tinta)',
};
export const ETIQUETA_FUNCION: Record<Funcion, string> = {
  autoridad: 'Autoridad',
  conexion: 'Conexión',
  engagement: 'Engagement',
  prueba_social: 'Prueba social',
  venta: 'Venta',
};

const ICONO_REEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 3v18M15 3v18M3 9h6M15 9h6M3 15h6M15 15h6"/></svg>';
const ICONO_CARRUSEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="7" height="12" rx="1.5"/><rect x="8.5" y="4" width="7" height="16" rx="1.5"/><rect x="15" y="6" width="7" height="12" rx="1.5"/></svg>';
const ICONO_STORY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M9 22v-2a3 3 0 0 1 6 0v2"/></svg>';

export const ETIQUETA_FORMATO: Record<Formato, { texto: string; icono: string }> = {
  reel: { texto: 'Reel', icono: ICONO_REEL },
  carrusel: { texto: 'Carrusel', icono: ICONO_CARRUSEL },
  story: { texto: 'Story', icono: ICONO_STORY },
};

/**
 * Cifras de portada: valor grande + etiqueta, mismo componente que la
 * investigación. `variante` es para valores que no son un número corto (p.
 * ej. «Facebook + Instagram»): a ese tamaño de letra, un texto así de largo
 * se sale de la tarjeta, así que baja el tipo y permite que envuelva.
 */
function cifraTarjeta(valor: string, etiqueta: string, variante?: 'cifra-texto'): string {
  return `<div class="cifra-tarjeta${variante ? ` ${variante}` : ''} aparece"><span class="cifra-valor">${escapar(valor)}</span><span class="cifra-etiqueta">${escapar(etiqueta)}</span></div>`;
}

export function seccionPortada(o: {
  cliente: string; fecha: string; resumen: string; totalTemas: number;
  avanceGlobal: { total: number; hechos: number } | null;
  editable?: boolean;
}): string {
  const editable = o.editable ?? false;
  const pct = o.avanceGlobal && o.avanceGlobal.total > 0 ? Math.round((o.avanceGlobal.hechos / o.avanceGlobal.total) * 100) : 0;
  const avance = o.avanceGlobal
    ? `<div class="avance-global aparece">
        <p>${o.avanceGlobal.hechos} de ${o.avanceGlobal.total} desarrollados</p>
        <div class="progreso-pista"><div class="progreso-relleno" style="width:${pct}%"></div></div>
      </div>`
    : '';
  return `<section class="portada" id="inicio">
    <div class="portada-texto">
      <div class="pila"><p class="eyebrow">Mapa de pilares · ${escapar(o.cliente)} · ${escapar(o.fecha)}</p><h1>Mapa de pilares y banco de contenidos</h1></div>
      <p class="resumen"${rutaEditable(editable, 'estrategia.resumen')}>${escapar(o.resumen)}</p>
    </div>
    <div class="cifras">
      ${cifraTarjeta('5', 'pilares')}
      ${cifraTarjeta('15', 'subcategorías')}
      ${cifraTarjeta(String(o.totalTemas), 'temas')}
      ${cifraTarjeta('Facebook + Instagram', 'Canales', 'cifra-texto')}
    </div>
    ${avance}
    <nav class="accesos" aria-label="Ir a">
      <a href="#partida">Punto de partida</a><a href="#principios">No negociables</a><a href="#pilares">Los 5 pilares</a>
      <a href="#mix">Mix editorial</a><a href="#conversion">Conversión</a><a href="#banco">Banco de temas</a>
    </nav>
  </section>`;
}

export function seccionPartida(e: Estrategia, editable = false): string {
  const colores = ['var(--rosa)', 'var(--azul)', 'var(--amarillo)'];
  return `<section class="seccion" id="partida" data-seccion>
    ${encabezadoSeccion('01', 'Punto de partida', 'Las ideas de fondo que sostienen todo el mapa.')}
    <div class="rejilla tres">
      ${e.ideas.map((idea, i) => `<article class="tarjeta idea-tarjeta aparece" style="border-left:4px solid ${colores[i % colores.length]}">
        <h3${rutaEditable(editable, `estrategia.ideas.${i}.titulo`)}>${escapar(idea.titulo)}</h3>
        <p${rutaEditable(editable, `estrategia.ideas.${i}.texto`)}>${escapar(idea.texto)}</p>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionPrincipios(e: Estrategia, editable = false): string {
  return `<section class="seccion alterna" id="principios" data-seccion>
    ${encabezadoSeccion('02', 'No negociables', 'Los principios que guían cada tema del banco.')}
    <div class="rejilla tres">
      ${e.principios.map((p, i) => `<article class="tarjeta principio-tarjeta aparece">
        <span class="principio-num">${String(i + 1).padStart(2, '0')}</span>
        <h3${rutaEditable(editable, `estrategia.principios.${i}.titulo`)}>${escapar(p.titulo)}</h3>
        <p${rutaEditable(editable, `estrategia.principios.${i}.texto`)}>${escapar(p.texto)}</p>
      </article>`).join('')}
    </div>
  </section>`;
}

export function seccionPilares(e: Estrategia, editable = false): string {
  return `<section class="seccion" id="pilares" data-seccion>
    ${encabezadoSeccion('03', 'Los 5 pilares', 'De qué habla cada pilar y cómo se reparte el banco.')}
    <div class="pilares-fila">
      ${e.pilares.map((p, i) => `<article class="tarjeta pilar-tarjeta aparece" style="--color-pilar:${COLOR_PILAR[i]}" data-ir-pilar="${i + 1}" role="button" tabindex="0" aria-label="Ver los temas del pilar ${i + 1}, ${escapar(p.nombre)}, en el banco">
        <span class="pilar-num">${i + 1}</span>
        <h3${rutaEditable(editable, `estrategia.pilares.${i}.nombre`)}>${escapar(p.nombre)}</h3>
        <p class="suave"${rutaEditable(editable, `estrategia.pilares.${i}.pregunta`)}>${escapar(p.pregunta)}</p>
        <ul class="chips">${p.subcategorias.map((s, j) => `<li${rutaEditable(editable, `estrategia.pilares.${i}.subcategorias.${j}.nombre`)}>${escapar(s.nombre)}</li>`).join('')}</ul>
      </article>`).join('')}
    </div>
    <div class="pila">
      <h3 class="subtitulo">Frontera entre pilares</h3>
      <div class="rejilla dos">
        ${e.pilares.map((p, i) => `<div class="tarjeta aparece" style="border-left:4px solid ${COLOR_PILAR[i]}"><h4>${escapar(p.nombre)}</h4><p class="suave"${rutaEditable(editable, `estrategia.pilares.${i}.frontera`)}>${escapar(p.frontera)}</p></div>`).join('')}
      </div>
    </div>
  </section>`;
}

function barraMix(mix: Estrategia['mix'], fueraDeMargen: Funcion[]): string {
  return `<div class="mix-barra" role="img" aria-label="Reparto del mix editorial">
    ${mix.map((m) => `<span class="mix-tramo${fueraDeMargen.includes(m.funcion) ? ' fuera-margen' : ''}" style="width:${m.porcentaje}%;background:${COLOR_FUNCION[m.funcion]}" title="${escapar(ETIQUETA_FUNCION[m.funcion])} · ${m.porcentaje}%"></span>`).join('')}
  </div>`;
}

export function seccionMix(e: Estrategia, interna: boolean, real: Record<Funcion, number> | null, fueraDeMargen: Funcion[], editable = false): string {
  const mixReal = interna && real
    ? `<div class="pila">
        <h3 class="subtitulo">Mix real del banco</h3>
        ${barraMix(e.mix.map((m) => ({ ...m, porcentaje: real[m.funcion] ?? 0 })), fueraDeMargen)}
        ${fueraDeMargen.length ? `<p class="suave">Fuera de margen: ${fueraDeMargen.map((f) => escapar(ETIQUETA_FUNCION[f])).join(', ')}.</p>` : ''}
      </div>`
    : '';
  return `<section class="seccion alterna" id="mix" data-seccion>
    ${encabezadoSeccion('04', 'Mix editorial', 'Cómo se reparte el banco entre función y función.')}
    <div class="pila">
      <h3 class="subtitulo">Mix planeado</h3>
      ${barraMix(e.mix, [])}
    </div>
    <div class="rejilla tres">
      ${e.mix.map((m, i) => `<article class="tarjeta aparece" style="border-left:4px solid ${COLOR_FUNCION[m.funcion]}">
        <span class="etiqueta-funcion ${m.funcion}">${escapar(ETIQUETA_FUNCION[m.funcion])}</span>
        <p class="dato-grande">${m.porcentaje}%</p>
        <p class="suave"${rutaEditable(editable, `estrategia.mix.${i}.descripcion`)}>${escapar(m.descripcion)}</p>
      </article>`).join('')}
    </div>
    ${mixReal}
  </section>`;
}

export function seccionConversion(e: Estrategia, editable = false): string {
  const c = e.conversion;
  return `<section class="seccion" id="conversion" data-seccion>
    ${encabezadoSeccion('05', 'Conversión', 'Cómo se acompaña a quien ya está listo para comprar.')}
    <article class="tarjeta destacado aparece">
      <h3${rutaEditable(editable, 'estrategia.conversion.titulo')}>${escapar(c.titulo)}</h3>
      <p${rutaEditable(editable, 'estrategia.conversion.texto')}>${escapar(c.texto)}</p>
      <ol class="pasos-conversion">
        ${c.pasos.map((p, i) => `<li><h4${rutaEditable(editable, `estrategia.conversion.pasos.${i}.nombre`)}>${escapar(p.nombre)}</h4><p${rutaEditable(editable, `estrategia.conversion.pasos.${i}.texto`)}>${escapar(p.texto)}</p></li>`).join('')}
      </ol>
    </article>
  </section>`;
}

/** Regla especial y supuestos: van antes del pie común (logo + fecha) de `envolverDocumento`. */
export function seccionCierre(e: Estrategia, interna: boolean, editable = false): string {
  const regla = e.reglaEspecial
    ? `<article class="tarjeta destacado aparece"><h3>Regla especial</h3><p${rutaEditable(editable, 'estrategia.reglaEspecial')}>${escapar(e.reglaEspecial)}</p></article>`
    : '';
  const supuestos = interna && e.supuestos.length
    ? `<div class="pila aparece"><h3 class="subtitulo">Supuestos</h3>${listaEditable(e.supuestos, editable, (i) => `estrategia.supuestos.${i}`)}</div>`
    : '';
  if (!regla && !supuestos) return '';
  return `<div class="cierre-mapa">${regla}${supuestos}</div>`;
}

export { escapar, lista };
