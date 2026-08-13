import { escapar, cabeceraSeccion, tablaGrowth, listaGrowth } from './comunes';
import type { UrlEtiquetada } from '@/growth/utm';

/**
 * Trazabilidad. Todo aquí es determinista: la convención sale del machote y
 * las URLs del constructor. Ni una línea la escribe el modelo, y así la
 * nomenclatura sale idéntica para todos los clientes, que es justo lo que se
 * necesita de una nomenclatura.
 */
export function seccionTraza(urls: UrlEtiquetada[]): string {
  const parametros = tablaGrowth(
    ['Parámetro', 'Meta', 'Google', 'Responde a'],
    [
      ['<strong>utm_source</strong>', '<span class="chip">meta</span>', '<span class="chip">google</span>', 'Qué plataforma'],
      ['<strong>utm_medium</strong>', '<span class="chip">paid_social</span>', '<span class="chip">cpc</span>', 'Pagado frente a orgánico'],
      ['<strong>utm_campaign</strong>', '<span class="chip">cliente_periodo</span>', '<span class="chip">cliente_periodo</span>', 'Qué campaña y de qué mes'],
      ['<strong>utm_content</strong>', '<span class="chip">ga_imagen … gc_carrusel</span>', '<span class="chip">g1_marca … g5_contenido</span>', 'Qué creativo o grupo funciona'],
      ['<strong>utm_term</strong>', '<span class="chip">el ángulo</span>', '<span class="chip">{keyword}</span>', 'Qué mensaje o búsqueda convence'],
    ],
  );

  const tabla = tablaGrowth(
    ['Plataforma', 'Pieza', 'URL etiquetada'],
    urls.map((u) => [
      `<span class="badge ${u.plataforma === 'meta' ? 'b-pink' : 'b-blue'}">${escapar(u.plataforma)}</span>`,
      `<strong>${escapar(u.etiqueta)}</strong>`,
      `<code class="pre">${escapar(u.url)}</code>`,
    ]),
  );

  return `
    ${cabeceraSeccion({
      numero: '06', kicker: 'Trazabilidad', titulo: 'Nomenclatura UTM',
      lead: 'Sin esto, el reporte no dice qué funcionó. Con esto, lo dice al tercer día.',
    })}

    <div class="alert alert-red" style="margin-top:var(--e3);">
      <strong>Antes de escribir una sola URL.</strong> Verificar que las páginas de destino existan y respondan 200. Es la comprobación que más se salta y la que más caro sale: una URL rota consume presupuesto sin poder convertir.
    </div>

    ${listaGrowth([
      'Probar cada URL abriéndola en el navegador, no solo mirándola.',
      'Si el sitio corre sobre una plataforma cerrada (Kartra, Wix, Squarespace), no inventar rutas: usar las que la plataforma genera.',
      'Comprobar que la plataforma conserve los UTM al pasar de una página a otra. Varias los pierden en el salto, y ahí se rompe toda la medición.',
    ], 'lst lst-blue')}

    <h3 style="margin-top:var(--e3);">Parámetros</h3>
    ${parametros}

    <h3 style="margin-top:var(--e3);">Reglas de escritura</h3>
    ${listaGrowth([
      'Todo en minúsculas. Meta y meta son dos fuentes distintas en el reporte.',
      'Guion bajo para separar, nunca espacios ni guiones medios.',
      'Sin acentos ni eñes.',
      'En Google se carga una sola vez como sufijo de URL final a nivel cuenta.',
      'En Meta se pega en el campo «Parámetros de URL» de cada anuncio.',
    ], 'lst lst-yellow')}

    <h3 style="margin-top:var(--e3);">Las ${urls.length} URLs</h3>
    ${tabla}

    <div class="alert alert-green" style="margin-top:var(--e2);">
      <strong>Por qué ángulo y formato van separados.</strong> Con utm_content y utm_term en campos distintos se responden tres preguntas por separado: qué mensaje convence, qué formato rinde y qué combinación gana. Mezclarlos en un solo parámetro haría imposible aislar cuál de los dos explica el resultado.
    </div>`;
}
