import { escapar, filas, listaGrowth, hueco } from './comunes';
import type { Growth } from '@/growth/schemas';

export type MetaManual = {
  cliente: string; producto: string; fecha: string;
  investigacionParcial?: boolean;
};

/**
 * Portada y bloqueantes.
 *
 * Los contadores se derivan de la estructura, no se escriben a mano: «3+5» sale
 * de cuántas campañas hay, «9» de cuántos creativos y las URLs del constructor
 * de UTM. Si algún día cambia el estándar de la casa, la portada lo refleja
 * sola en vez de mentir.
 */
export function seccionPortada(
  g: Partial<Growth>,
  meta: MetaManual,
  totalUrls: number,
  huecos: Record<string, string> = {},
): string {
  const nMeta = g.campanasMeta?.length ?? 0;
  const nGoogle = g.campanasGoogle?.length ?? 0;
  const nCre = g.creativos?.length ?? 0;

  const stat = (v: string, l: string) =>
    `<div class="stat"><div class="stat-v">${escapar(v)}</div><div class="stat-l">${escapar(l)}</div></div>`;

  const aviso = meta.investigacionParcial
    ? `<div class="alert alert-yellow" style="margin-top:18px;"><strong>La investigación de origen venía incompleta.</strong> Esta campaña se construyó sobre los datos que sí había. Los apartados afectados lo declaran, y lo que falta por averiguar está en los bloqueantes.</div>`
    : '';

  return `
    <span class="eyebrow">Growth Wozial · Manual de campaña</span>
    <h1><span class="grad">${escapar(meta.producto)}</span></h1>
    <p class="lead" style="margin-top:10px;">Todo lo necesario para montar, etiquetar y medir. Sin relleno.</p>
    ${aviso}
    <div class="g4" style="margin-top:26px;">
      ${stat(`${nMeta}+${nGoogle}`, 'Campañas Meta + Google')}
      ${stat(String(nCre), 'Creativos Meta')}
      ${stat(String(totalUrls), 'URLs etiquetadas')}
      ${stat(String(g.semanas ?? '—'), 'Semanas')}
    </div>

    <h3 style="margin-top:30px;">Bloqueantes · sin esto no se arranca</h3>
    ${g.bloqueantes?.length
      ? listaGrowth(g.bloqueantes, 'lst lst-x')
      : hueco(huecos.estructura ?? 'No se determinaron los bloqueantes.')}

    <h3 style="margin-top:24px;">Reglas de copy · aplican a todo</h3>
    ${g.reglasCopy?.length
      ? listaGrowth(g.reglasCopy, 'lst lst-yellow')
      : hueco(huecos.estructura ?? 'No se determinaron las reglas de copy.')}

    <div style="margin-top:24px;">
      ${filas([['Cliente', meta.cliente], ['Fecha de corte', meta.fecha]])}
    </div>`;
}
