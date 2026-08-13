import { escapar, cabeceraSeccion, hueco } from './comunes';
import type { Growth } from '@/growth/schemas';

export function seccionPrompts(g: Partial<Growth>, huecos: Record<string, string>): string {
  const p = g.promptsImagen;
  const cuerpo = p
    ? `
      <div class="alert alert-red" style="margin-top:var(--e2);">
        <strong>Regla que no se rompe: la cara del cliente no se genera con IA.</strong>
        Es una persona real y su credibilidad es el activo central de la campaña. Todos los prompts de abajo producen fondos, texturas y escenas sin rostros identificables. La foto real se fotografía aparte y se compone encima.
      </div>
      <h3 style="margin-top:var(--e3);">Prompt base · anteponer a todos</h3>
      <div class="pre">${escapar(p.base)}</div>
      <h3 style="margin-top:var(--e3);">Uno por pieza</h3>
      ${p.porCreativo.map((t, i) => {
        const c = g.creativos?.[i];
        const etiqueta = c ? `Grupo ${c.grupo.toUpperCase()} · ${c.formato} · ${c.ratio}` : `Pieza ${i + 1}`;
        return `<div class="kv"><div class="kv-k">${escapar(etiqueta)}</div><div class="pre">${escapar(t)}</div></div>`;
      }).join('')}`
    : `<div style="margin-top:var(--e2);">${hueco(huecos.prompts ?? 'Los prompts no se generaron.')}</div>`;

  return `${cabeceraSeccion({
    numero: '03', kicker: 'Producción', titulo: 'Prompts para generar las piezas',
    lead: 'En inglés, listos para pegar en Midjourney, DALL·E, Firefly o Ideogram.',
  })}${cuerpo}`;
}
