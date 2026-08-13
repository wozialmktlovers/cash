import { escapar, cabeceraSeccion, hueco } from './comunes';
import type { Growth } from '@/growth/schemas';

/** Anuncios adaptables. Se muestra el conteo de caracteres: es lo primero que rechaza Google. */
export function seccionRsa(g: Partial<Growth>, huecos: Record<string, string>): string {
  const r = g.rsa;
  if (!r) {
    return `${cabeceraSeccion({ numero: '05', kicker: 'Google Ads', titulo: 'Anuncios adaptables' })}
      <div style="margin-top:18px;">${hueco(huecos.google ?? 'Los anuncios no se generaron.')}</div>`;
  }

  const linea = (t: string, max: number) => {
    const n = t.length;
    const color = n > max ? 'b-pink' : 'b-gray';
    return `<div class="kv">
      <div class="kv-k"><span class="badge ${color}">${n}/${max}</span></div>
      <div class="copy">${escapar(t)}</div>
    </div>`;
  };

  return `${cabeceraSeccion({
    numero: '05', kicker: 'Google Ads', titulo: 'Anuncios adaptables',
    lead: 'Quince titulares y cuatro descripciones. El conteo va a la vista porque el límite es duro.',
  })}
  <h3 style="margin-top:22px;">Titulares · máximo 30 caracteres</h3>
  ${r.titulares.map((t) => linea(t, 30)).join('')}
  <h3 style="margin-top:24px;">Descripciones · máximo 90 caracteres</h3>
  ${r.descripciones.map((d) => linea(d, 90)).join('')}`;
}
