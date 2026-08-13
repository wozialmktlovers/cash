import { escapar, cabeceraSeccion, tablaGrowth, hueco, chips } from './comunes';
import type { Growth } from '@/growth/schemas';

export function seccionMeta(g: Partial<Growth>, huecos: Record<string, string>): string {
  const cuerpo = g.campanasMeta?.length
    ? `
      ${tablaGrowth(['Grupo', 'Campaña', 'Objetivo', 'Audiencia', 'Ángulo'],
        g.campanasMeta.map((c) => [
          `<span class="badge b-pink">${escapar(c.grupo.toUpperCase())}</span>`,
          `<strong>${escapar(c.nombre)}</strong>`,
          escapar(c.objetivo),
          `<span class="tiny">${escapar(c.audiencia)}</span>`,
          escapar(c.angulo),
        ]))}
      <div class="alert alert-green" style="margin-top:18px;">
        <strong>Por qué tres grupos y no uno.</strong> Tres ángulos separados permiten saber cuál convence antes de gastar el presupuesto entero en el que le gustaba a alguien. Un solo grupo con tres creativos mezcla las señales y no aísla nada.
      </div>`
    : hueco(huecos.estructura ?? 'La estructura de campaña no se generó.');

  return `${cabeceraSeccion({
    numero: '01', kicker: 'Meta Ads', titulo: 'Estructura, audiencia y segmentación',
    lead: 'Los campos que pide el administrador de anuncios, con el valor exacto a capturar.',
  })}
  <div style="margin-top:20px;">${cuerpo}</div>`;
}
