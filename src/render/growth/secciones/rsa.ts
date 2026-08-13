import { escapar, cabeceraSeccion, tablaGrowth, hueco } from './comunes';
import type { Growth } from '@/growth/schemas';

/** Extensiones y estacionalidad: cuándo invertir más y qué acompaña a cada anuncio. */
export function seccionRsa(g: Partial<Growth>, huecos: Record<string, string>): string {
  const cab = cabeceraSeccion({
    numero: '05', kicker: 'Google Ads', titulo: 'Extensiones y estacionalidad',
    lead: 'Las extensiones son gratis y suben el CTR. La estacionalidad decide dónde va el presupuesto anual.',
  });

  const a = g.googleAmpliado;
  if (!a) {
    return `${cab}<div style="margin-top:var(--e2);">${hueco(huecos.google ?? 'No se generaron las extensiones ni la estacionalidad.')}</div>`;
  }

  return `${cab}
    <div class="g2" style="margin-top:var(--e3);">
      <div class="card">
        <h4>Extensiones · obligatorias en las cinco campañas</h4>
        <div style="margin-top:var(--e1);">
          ${a.extensiones.map((e) =>
            `<div class="kv"><div class="kv-k">${escapar(e.tipo)}</div><div>${escapar(e.detalle)}</div></div>`).join('')}
        </div>
      </div>
      <div class="card card-pink">
        <h4>Estacionalidad · cuándo invertir más</h4>
        <div style="margin-top:var(--e1);">
          ${tablaGrowth(['Periodo', 'Interés', 'Acción'],
            a.estacionalidad.map((e) => [
              `<strong>${escapar(e.periodo)}</strong>`,
              `<span class="chip">${escapar(e.interes)}</span>`,
              escapar(e.accion)]))}
        </div>
        <p class="tiny" style="margin-top:var(--e2);">${escapar(a.notaEstacionalidad)}</p>
      </div>
    </div>`;
}
