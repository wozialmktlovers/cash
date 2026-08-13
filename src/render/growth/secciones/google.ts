import { escapar, cabeceraSeccion, tablaGrowth, chips, hueco, listaGrowth } from './comunes';
import type { Growth } from '@/growth/schemas';

const NOMBRE: Record<string, string> = {
  marca: 'Marca', categoria: 'Categoría', precio: 'Precio', geo: 'Geografía', contenido: 'Contenido',
};
const ORDEN: Record<string, number> = { marca: 1, categoria: 2, precio: 3, geo: 4, contenido: 5 };

/**
 * Google Ads. Los títulos y descripciones van por campaña, no en una bolsa
 * común: cada intención de búsqueda merece su propio anuncio, y mezclarlos
 * obliga a reescribirlos al cargarlos.
 */
export function seccionGoogle(g: Partial<Growth>, huecos: Record<string, string>): string {
  const cab = cabeceraSeccion({
    numero: '04', kicker: 'Google Ads', titulo: 'Estructura y keywords',
    lead: 'Meta genera demanda; Google la cosecha. Aquí solo se puja por intención, nunca por curiosidad.',
  });

  const a = g.googleAmpliado;
  if (!a) {
    const basico = g.googleKeywords?.length
      ? g.googleKeywords.map((k) => `
          <div class="grp" style="margin-top:14px;">
            <div class="grp-hd"><span class="chip chip-k">${escapar(k.clave)}</span></div>
            <div class="grp-bd">${chips(k.keywords)}
              <div class="tiny" style="margin:12px 0 6px;">Negativas</div>${chips(k.negativas, 'chip chip-x')}</div>
          </div>`).join('')
      : hueco(huecos.google ?? 'Las campañas de Search no se generaron.');
    return `${cab}<div style="margin-top:20px;">${basico}</div>`;
  }

  const contar = (t: string, max: number) =>
    `<div class="kv"><div class="kv-k"><span class="badge ${t.length > max ? 'b-pink' : 'b-gray'}">${t.length}/${max}</span></div><div class="copy">${escapar(t)}</div></div>`;

  const campanas = [...a.campanas]
    .sort((x, y) => ORDEN[x.clave] - ORDEN[y.clave])
    .map((c) => `
      <div class="grp" style="margin-top:18px;">
        <div class="grp-hd">
          <span class="chip chip-k">G${ORDEN[c.clave]} · ${escapar(NOMBRE[c.clave])}</span>
          <span class="badge b-gray" style="margin-left:8px;">${escapar(c.presupuesto)}</span>
          <span class="tiny" style="margin-left:8px;">${escapar(c.concordancia)}</span>
        </div>
        <div class="grp-bd">
          <div class="tiny" style="margin-bottom:6px;">Keywords</div>
          ${chips(c.keywords)}
          <div class="tiny" style="margin:12px 0 6px;">Negativas</div>
          ${c.negativas.length ? chips(c.negativas, 'chip chip-x') : '<p class="tiny">Hereda las de la lista compartida.</p>'}
          <div class="tiny" style="margin:14px 0 6px;">Títulos · máximo 30 caracteres</div>
          ${c.titulares.map((t) => contar(t, 30)).join('')}
          <div class="tiny" style="margin:14px 0 6px;">Descripciones · máximo 90 caracteres</div>
          ${c.descripciones.map((t) => contar(t, 90)).join('')}
        </div>
      </div>`).join('');

  return `${cab}
    <div class="g2" style="margin-top:20px;">
      <div class="card card-yellow">
        <h4>Los dos datos que ordenan la puja</h4>
        <div style="margin-top:10px;">${listaGrowth(a.hallazgos, 'lst lst-yellow')}</div>
      </div>
      <div class="card">
        <h4>Configuración obligatoria</h4>
        <div style="margin-top:10px;">${listaGrowth(a.configuracionObligatoria, 'lst lst-blue')}</div>
      </div>
    </div>
    ${campanas}`;
}
