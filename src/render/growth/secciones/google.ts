import { escapar, cabeceraSeccion, tablaGrowth, chips, hueco } from './comunes';
import type { Growth } from '@/growth/schemas';

export function seccionGoogle(g: Partial<Growth>, huecos: Record<string, string>): string {
  const razon = huecos.estructura ?? huecos.google ?? 'Las campañas de Search no se generaron.';

  const estructura = g.campanasGoogle?.length
    ? tablaGrowth(['Clave', 'Campaña', 'Intención de quien busca'],
        g.campanasGoogle.map((c) => [
          `<span class="chip chip-k">${escapar(c.clave)}</span>`,
          `<strong>${escapar(c.nombre)}</strong>`,
          escapar(c.intencion),
        ]))
    : hueco(razon);

  const keywords = g.googleKeywords?.length
    ? g.googleKeywords.map((k) => `
        <div class="grp" style="margin-top:14px;">
          <div class="grp-hd"><span class="chip chip-k">${escapar(k.clave)}</span></div>
          <div class="grp-bd">
            <div class="tiny" style="margin-bottom:6px;">Keywords</div>
            ${chips(k.keywords)}
            <div class="tiny" style="margin:12px 0 6px;">Negativas</div>
            ${k.negativas.length ? chips(k.negativas, 'chip chip-x') : '<p class="tiny">Ninguna declarada.</p>'}
          </div>
        </div>`).join('')
    : hueco(huecos.google ?? 'Las keywords no se generaron.');

  return `${cabeceraSeccion({
    numero: '04', kicker: 'Google Ads', titulo: 'Estructura y keywords',
    lead: 'Cinco campañas por intención, no por producto: quien busca la marca ya decidió.',
  })}
  <div style="margin-top:20px;">${estructura}</div>
  <h3 style="margin-top:26px;">Keywords y negativas</h3>
  ${keywords}
  <div class="alert alert-yellow" style="margin-top:18px;">
    <strong>Las negativas valen tanto como las keywords.</strong> Sin ellas el presupuesto se va en búsquedas que nunca compran, y eso no aparece como error: aparece como un costo por conversión alto que parece culpa del anuncio.
  </div>`;
}
