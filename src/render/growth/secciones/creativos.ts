import { escapar, cabeceraSeccion, hueco } from './comunes';
import { RATIO_POR_FORMATO, GRUPOS, FORMATOS, type Growth, type Creativo } from '@/growth/schemas';

const MEDIDAS: Record<string, string> = {
  '1x1': '1080 × 1080 px', '4x5': '1080 × 1350 px', '9x16': '1080 × 1920 px',
};

/**
 * Los nueve espacios de creativo.
 *
 * Los huecos son deterministas: el ratio y las medidas los dicta el formato, y
 * el formato lo dicta la estructura de la casa. Por eso la cuadrícula se rinde
 * completa aunque el agente de creativos haya fallado — el diseñador sigue
 * sabiendo qué piezas necesita y de qué tamaño. Lo único que faltaría son los
 * copys, y eso se declara.
 */
export function seccionCreativos(g: Partial<Growth>, huecos: Record<string, string>): string {
  const porClave = new Map<string, Creativo>();
  for (const c of g.creativos ?? []) porClave.set(`${c.grupo}-${c.formato}`, c);

  const razon = huecos.creativos ?? 'Los textos de anuncio no se generaron.';

  const grupos = GRUPOS.map((grupo) => {
    const piezas = FORMATOS.map((formato) => {
      const c = porClave.get(`${grupo}-${formato}`);
      const ratio = c?.ratio ?? RATIO_POR_FORMATO[formato];
      const medidas = c?.medidas ?? MEDIDAS[ratio];
      const copys = c
        ? `<div class="kv"><div class="kv-k">Opción A</div><div class="copy">${escapar(c.copyA)}</div></div>
           <div class="kv"><div class="kv-k">Opción B</div><div class="copy">${escapar(c.copyB)}</div></div>`
        : `<p class="tiny" style="margin-top:8px;">Sin copy: ${escapar(razon)}</p>`;
      return `<div class="fmt">
        <div class="fmt-hd">
          <div class="slot ar-${escapar(ratio)}">
            <div class="slot-r">${escapar(ratio.replace('x', ':'))}</div>
            <div class="slot-p">${escapar(medidas)}</div>
          </div>
        </div>
        <div class="fmt-bd">
          <h4>${escapar(formato)}</h4>
          ${copys}
        </div>
      </div>`;
    }).join('');

    const angulo = porClave.get(`${grupo}-imagen`)?.angulo;
    return `<div class="grp grp-${escapar(grupo)}">
      <div class="grp-hd">
        <span class="badge b-pink">Grupo ${escapar(grupo.toUpperCase())}</span>
        ${angulo ? `<strong style="margin-left:10px;">${escapar(angulo)}</strong>` : ''}
      </div>
      <div class="grp-bd"><div class="g3">${piezas}</div></div>
    </div>`;
  }).join('');

  return `${cabeceraSeccion({
    numero: '02', kicker: 'Producción', titulo: 'Creativos, copy y espacios',
    lead: 'Nueve piezas: tres ángulos por tres formatos. Cada hueco trae su medida exacta.',
  })}
  ${g.creativos?.length ? '' : `<div style="margin-top:18px;">${hueco(razon)}</div>`}
  <div style="margin-top:20px;">${grupos}</div>`;
}
