import { escapar, cabeceraSeccion, tablaGrowth, hueco, chips, listaGrowth } from './comunes';
import type { Growth } from '@/growth/schemas';

/**
 * Meta Ads. No es un resumen de campañas: es la hoja de captura del
 * administrador de anuncios. El machote lo pide literal —«todos los campos,
 * con el valor exacto a capturar en cada uno»— y esa es la diferencia entre
 * un documento que se lee y uno que se ejecuta sin volver a pensar nada.
 */
export function seccionMeta(g: Partial<Growth>, huecos: Record<string, string>): string {
  const cab = cabeceraSeccion({
    numero: '01', kicker: 'Meta Ads', titulo: 'Estructura, audiencia y segmentación',
    lead: 'Todos los campos que pide el administrador de anuncios, con el valor exacto a capturar en cada uno.',
  });

  const s = g.segmentacion;

  const campanas = g.campanasMeta?.length
    ? tablaGrowth(['Grupo', 'Campaña', 'Objetivo', 'Audiencia', 'Ángulo'],
        g.campanasMeta.map((c) => [
          `<span class="badge b-pink">${escapar(c.grupo.toUpperCase())}</span>`,
          `<strong>${escapar(c.nombre)}</strong>`,
          escapar(c.objetivo),
          `<span class="tiny">${escapar(c.audiencia)}</span>`,
          escapar(c.angulo),
        ]))
    : hueco(huecos.estructura ?? 'La estructura de campaña no se generó.');

  if (!s) {
    return `${cab}
      <div style="margin-top:var(--e3);">${campanas}</div>
      <div style="margin-top:var(--e2);">${hueco(huecos.segmentacion ?? 'La segmentación detallada no se generó.')}</div>`;
  }

  const perfiles = `<div class="g2">${s.perfiles.map((p, i) => `
    <div class="card ${i === 0 ? 'card-pink' : 'card-blue'}">
      <div class="persona-hd">
        <div class="persona-av ${i === 0 ? 'av-pink' : 'av-blue'}">${escapar(p.inicial)}</div>
        <div>
          <h4>${escapar(p.nombre)} · ${escapar(String(p.edad))} · ${escapar(p.ciudad)}</h4>
          <p class="tiny">${escapar(p.titular)}</p>
          <span class="badge b-gray" style="margin-top:var(--e1);">${escapar(p.etiqueta)}</span>
        </div>
      </div>
      ${p.campos.map((c) =>
        `<div class="kv"><div class="kv-k">${escapar(c.campo)}</div><div>${escapar(c.valor)}</div></div>`,
      ).join('')}
    </div>`).join('')}</div>`;

  const config = tablaGrowth(
    ['Campo', ...(g.campanasMeta?.map((c) => `M${'abc'.indexOf(c.grupo) + 1} · ${c.nombre}`) ?? ['M1', 'M2', 'M3'])],
    s.configuracion.map((f) => [
      `<strong>${escapar(f.campo)}</strong>`, escapar(f.m1), escapar(f.m2), escapar(f.m3),
    ]),
  );

  const capas = `<div class="g3">${s.capas.map((c, i) => `
    <div class="card">
      <h4><span class="grad">Capa ${i + 1}</span> · ${escapar(c.nombre)}</h4>
      <p class="tiny" style="margin:6px 0 10px;">${escapar(c.proposito)}</p>
      ${chips(c.intereses, 'chip chip-k')}
      ${c.nota ? `<p class="tiny" style="margin-top:var(--e1);">${escapar(c.nota)}</p>` : ''}
    </div>`).join('')}</div>`;

  return `${cab}
    <div style="margin-top:var(--e3);">${campanas}</div>

    <h3 style="margin-top:var(--e4);">Perfil del target</h3>
    ${perfiles}
    <div class="alert alert-green" style="margin-top:var(--e2);">${escapar(s.notaSegmentacion)}</div>

    <h3 style="margin-top:var(--e4);">Configuración por campaña</h3>
    ${config}

    <h3 style="margin-top:var(--e4);">Segmentación detallada · intereses y comportamientos</h3>
    <p class="tiny" style="margin-bottom:12px;">Nombres tal como aparecen en el administrador de Meta. Combinar con «y además deben coincidir con» donde se indique, para estrechar sin perder volumen.</p>
    ${capas}

    <div class="g2" style="margin-top:var(--e3);">
      <div class="card">
        <h4>Cómo combinar las capas por conjunto</h4>
        <div style="margin-top:var(--e1);">
          ${tablaGrowth(['Conjunto', 'Combinación'],
            s.combinaciones.map((c) => [`<strong>${escapar(c.conjunto)}</strong>`, escapar(c.combinacion)]))}
        </div>
      </div>
      <div class="card card-pink">
        <h4>Lo que NO hay que segmentar</h4>
        <div style="margin-top:var(--e1);">${listaGrowth(s.noSegmentar, 'lst lst-x')}</div>
      </div>
    </div>

    <h3 style="margin-top:var(--e4);">Audiencias personalizadas y similares</h3>
    ${tablaGrowth(['Audiencia', 'Fuente', 'Ventana', 'Usar en', 'Nombre sugerido'],
      s.audienciasPersonalizadas.map((a) => [
        `<strong>${escapar(a.audiencia)}</strong>`, escapar(a.fuente),
        `<span class="chip">${escapar(a.ventana)}</span>`, escapar(a.usarEn),
        `<code class="pre">${escapar(a.nombreSugerido)}</code>`,
      ]))}

    <div class="g2" style="margin-top:var(--e2);">
      <div class="card">
        <h4>Audiencias similares</h4>
        <div style="margin-top:var(--e1);">
          ${tablaGrowth(['Semilla', '%', 'Cuándo'],
            s.audienciasSimilares.map((a) => [
              `<strong>${escapar(a.semilla)}</strong>`,
              `<span class="chip">${escapar(a.porcentaje)}</span>`, escapar(a.cuando)]))}
        </div>
      </div>
      <div class="card">
        <h4>Geografía</h4>
        <div style="margin-top:var(--e1);">
          ${s.geografia.map((z) =>
            `<div class="kv"><div class="kv-k">${escapar(z.zona)}</div><div>${escapar(z.detalle)}</div></div>`).join('')}
        </div>
      </div>
    </div>`;
}
