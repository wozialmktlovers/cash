import type { Audiencia, Canales, Competencia, Mercado, Fuente, Persona } from '@/research/schemas';
import { LOGO_WOZIAL } from '../marca';
import { cabecera, escapar, lista, listaFuentes, siVacio, tabla, tarjeta } from './comunes';

// ── 01 · Portada ─────────────────────────────────────────────────────
export function panelPortada(meta: { cliente: string; giro: string; fecha: string }): string {
  return `<section class="panel"><div class="wrap">
    <div style="width:100%;max-width:340px;margin-bottom:30px;">${LOGO_WOZIAL}</div>
    <div class="pnum">01 · Social Research</div>
    <h2>${escapar(meta.cliente)}</h2>
    <p class="lead">${escapar(meta.giro)}</p>
    <div class="card card-pink" style="margin-top:26px;">
      <p class="tiny">Investigación de mercado · Wozial</p>
      <p style="margin-top:6px;">Fecha de corte: <strong>${escapar(meta.fecha)}</strong></p>
      <p class="tiny" style="margin-top:10px;">
        Toda cifra de este documento lleva su fuente. Los apartados sin datos verificables
        se declaran vacíos en lugar de rellenarse.
      </p>
    </div>
  </div></section>`;
}

// ── 02 · Resumen (cuatro hallazgos de la síntesis) ────────────────────
const COLOR_HALLAZGO: Record<string, string> = {
  problema: 'card-yellow',
  bloqueante: 'card-pink',
  oportunidad: 'card-green',
  salida: 'card-blue',
};

export function panelResumen(hallazgos: { tipo: string; titulo: string; texto: string }[]): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('02 · Resumen', 'Los cuatro hallazgos', 'Lo que cambia la decisión, antes del detalle.')}
    <div class="g2" style="margin-top:22px;">
      ${hallazgos.map((h) => tarjeta(
        h.titulo,
        `<div class="badge b-gray">${escapar(h.tipo)}</div><p style="margin-top:8px;">${escapar(h.texto)}</p>`,
        COLOR_HALLAZGO[h.tipo] ?? '',
      )).join('')}
    </div>
  </div></section>`;
}

// ── 03 · Reconocer la audiencia (audiencia + mercado) ─────────────────
export function panelReconocer(a: Audiencia | null, m: Mercado | null): string {
  const fuentes: Fuente[] = [];
  if (a) fuentes.push(a.miedoPrincipal.fuente);
  if (m) fuentes.push(...m.datos.map((d) => d.fuente), ...m.salarios.map((s) => s.fuente));

  const bloqueAudiencia = a ? `
    ${tarjeta('Cómo se nombran', `
      <table class="tbl"><thead><tr><th>Término</th><th>Connotación</th></tr></thead>
      <tbody>${a.escalera.map((e) => `<tr><td><strong>${escapar(e.termino)}</strong></td><td class="tiny">${escapar(e.connotacion)}</td></tr>`).join('')}</tbody></table>
      ${siVacio(a.escalera, 'No se documentó la escalera de términos.')}
    `, 'card-blue')}
    <div class="g3" style="margin-top:16px;">
      ${tarjeta('Jerga del oficio', lista(a.jerga) + siVacio(a.jerga, 'Sin registro.'))}
      ${tarjeta('Jerga de negocio', lista(a.jergaNegocio) + siVacio(a.jergaNegocio, 'Sin registro.'))}
      ${tarjeta('Tono real', lista(a.tono) + siVacio(a.tono, 'Sin registro.'))}
    </div>
    <div class="alert alert-red" style="margin-top:16px;">
      <strong>Miedo principal: ${escapar(a.miedoPrincipal.nombre)}.</strong>
      ${escapar(a.miedoPrincipal.evidencia)}
    </div>
    <div class="alert alert-green" style="margin-top:10px;">
      <strong>Unidad mental de compra.</strong> ${escapar(a.unidadDeCompra)}
    </div>
  ` : '<div class="alert alert-yellow"><strong>Sin datos de audiencia.</strong> Esta etapa no produjo resultados.</div>';

  const bloqueMercado = m ? `
    <h3 style="margin-top:24px;">Tamaño y condiciones del mercado</h3>
    ${tabla(['Dato', 'Valor'], m.datos.map((d) => [`<strong>${escapar(d.etiqueta)}</strong>`, escapar(d.valor)]))}
    ${siVacio(m.datos, 'No se encontraron cifras oficiales con fuente verificable.')}
    ${tabla(['Puesto', 'Rango de ingreso'], m.salarios.map((s) => [`<strong>${escapar(s.puesto)}</strong>`, escapar(s.rango)]))}
    ${siVacio(m.salarios, 'No se encontraron rangos salariales con fuente.')}
    ${m.regulacion.length ? `<div class="g2">${m.regulacion.map((r) => `<div class="alert alert-yellow"><strong>${escapar(r.norma)}.</strong> ${escapar(r.implicacion)}</div>`).join('')}</div>` : ''}
    ${m.crecimiento ? `<p class="hint" style="margin-top:12px;">${escapar(m.crecimiento)}</p>` : '<p class="hint" style="margin-top:12px;">No hay serie histórica que sustente una cifra de crecimiento.</p>'}
  ` : '<p class="hint" style="margin-top:24px;">Sin datos de mercado: la etapa no produjo resultados.</p>';

  // Audiencia y mercado van en columnas, no apilados. Este panel carga el
  // contenido de dos (el machote no tiene lámina propia para el mercado) y en
  // vertical se iba 600px por debajo del corte: en una videollamada la
  // audiencia no puede desplazarse, así que ese tramo sencillamente no se veía.
  return `<section class="panel"><div class="wrap">
    ${cabecera('03 · Reconocer la audiencia', 'A quién le hablas', 'Cómo se nombra, cómo habla y de qué tamaño es.')}
    <div class="par" style="margin-top:22px;">
      <div>${bloqueAudiencia}</div>
      <div>${bloqueMercado}</div>
    </div>
    ${listaFuentes(fuentes)}
  </div></section>`;
}

// ── 04 · Dolores y aspiraciones ──────────────────────────────────────
export function panelDolores(a: Audiencia): string {
  const cita = (c: Audiencia['dolores'][number], color: string) => `
    <div class="card ${color}">
      <p style="font-size:1.06rem;line-height:1.5;">«${escapar(c.texto)}»</p>
      <p class="tiny" style="margin-top:10px;">${escapar(c.contexto)}</p>
      ${c.anonimizada ? '<div class="badge b-gray" style="margin-top:8px;">Anonimizada</div>' : ''}
    </div>`;

  return `<section class="panel"><div class="wrap">
    ${cabecera('04 · Dolores y aspiraciones', 'En sus propias palabras', 'Citas reales, siempre anonimizadas.')}
    <h3 style="margin-top:22px;">Lo que duele</h3>
    <div class="g2">${a.dolores.map((c) => cita(c, 'card-pink')).join('')}</div>
    ${siVacio(a.dolores, 'No se encontraron citas de dolor con fuente verificable.')}
    <h3 style="margin-top:20px;">Lo que se desea</h3>
    <div class="g2">${a.aspiraciones.map((c) => cita(c, 'card-green')).join('')}</div>
    ${siVacio(a.aspiraciones, 'No se encontraron citas de aspiración con fuente verificable.')}
    ${listaFuentes([...a.dolores, ...a.aspiraciones].map((c) => c.fuente))}
  </div></section>`;
}

// ── 05 · Canales, tendencias e intereses ─────────────────────────────
export function panelCanales(c: Canales): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('05 · Canales, tendencias e intereses', 'Dónde alcanzarla', 'Plataformas, formatos y momentos reales de consumo.')}
    <div style="margin-top:22px;">
      ${tabla(['Plataforma', 'Alcance', 'Notas'], c.plataformas.map((p) => [
        `<strong>${escapar(p.nombre)}</strong>`, escapar(p.alcance), `<span class="tiny">${escapar(p.notas)}</span>`,
      ]))}
      ${siVacio(c.plataformas, 'No se verificó ninguna plataforma con fuente.')}
      <div class="g2" style="margin-top:16px;">
        ${tarjeta('Formatos que rinden', lista(c.formatos) + siVacio(c.formatos, 'Sin registro.'), 'card-blue')}
        ${tarjeta('Tendencias del nicho', lista(c.tendencias) + siVacio(c.tendencias, 'Sin registro.'), 'card-green')}
      </div>
      <div class="alert" style="margin-top:16px;"><strong>Horarios.</strong> ${escapar(c.horarios)}</div>
      ${c.advertenciaRegulatoria
        ? `<div class="alert alert-red" style="margin-top:10px;"><strong>Advertencia regulatoria.</strong> ${escapar(c.advertenciaRegulatoria)}</div>`
        : '<p class="hint" style="margin-top:10px;">No se identificaron restricciones publicitarias específicas para este giro.</p>'}
    </div>
    ${listaFuentes(c.plataformas.map((p) => p.fuente))}
  </div></section>`;
}

// ── 06 y 07 · Buyer personas ─────────────────────────────────────────
export function panelPersona(p: Persona, numero: string, prioridad: string, color: string): string {
  const inicial = escapar((p.nombre ?? '?').trim().charAt(0).toUpperCase() || '?');
  const col = (t: string, items: string[]) =>
    `<div><h4 class="tiny">${escapar(t)}</h4>${lista(items)}${siVacio(items, 'Sin registro.')}</div>`;

  return `<section class="panel"><div class="wrap">
    ${cabecera(numero, p.nombre)}
    <div class="card ${color}" style="margin-top:20px;">
      <div class="persona-hd">
        <div class="persona-av av-${color === 'card-pink' ? 'pink' : 'blue'}">${inicial}</div>
        <div>
          <h3 style="margin-bottom:3px;">${escapar(p.nombre)} · ${escapar(p.edad)} · ${escapar(p.ciudad)}</h3>
          <p class="tiny">${escapar(p.situacion)}</p>
        </div>
        <div style="margin-left:auto;" class="badge b-${color === 'card-pink' ? 'pink' : 'blue'}">${escapar(prioridad)}</div>
      </div>
      <div class="g4" style="gap:14px;margin-top:16px;">
        ${col('Demografía', p.demografia)}
        ${col('Comportamiento digital', p.comportamiento)}
        ${col('Dolor', p.dolor)}
        ${col('Objeciones', p.objeciones.map((o) => `«${o}»`))}
      </div>
    </div>
    <div class="g2" style="margin-top:16px;">
      <div class="alert alert-green"><strong>Cómo se le gana.</strong> ${escapar(p.comoSeGana)}</div>
      <div class="alert alert-red"><strong>Su riesgo.</strong> ${escapar(p.riesgo)}</div>
    </div>
  </div></section>`;
}

// ── 08 · Competencia directa ─────────────────────────────────────────
export function panelCompetenciaDirecta(c: Competencia): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('08 · Competencia directa', 'El mapa real de precios', 'Mismo producto, mismo mercado, precios verificados en sitio.')}
    <div style="margin-top:22px;">
      ${tabla(
        ['Competidor', 'Producto', 'Precio', 'Duración', 'Modalidad', 'Aval declarado'],
        c.directos.map((d) => [
          `<strong>${escapar(d.nombre)}</strong>`,
          escapar(d.producto),
          `<strong style="color:var(--pink);">${escapar(d.precio)}</strong>`,
          escapar(d.duracion),
          escapar(d.modalidad),
          `<span class="tiny">${escapar(d.aval)}</span>`,
        ]),
      )}
      ${siVacio(c.directos, 'No se verificó ningún competidor directo con precio publicado. Que el mercado no publique precios ya es un hallazgo: implica venta consultiva y ciclo largo.')}
    </div>
    ${listaFuentes(c.directos.map((d) => d.fuente))}
  </div></section>`;
}

// ── 09 · El hallazgo decisivo ────────────────────────────────────────
export function panelHallazgo(c: Competencia): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('09 · El hallazgo decisivo', 'Qué revela el mapa', 'Lo que el mapa de precios dice y el cliente todavía no usa.')}
    <div style="margin-top:22px;">
      ${c.hallazgos.map((h) => `<div class="alert alert-green" style="margin-bottom:10px;">${escapar(h)}</div>`).join('')}
      ${siVacio(c.hallazgos, 'La investigación de competencia no produjo hallazgos con respaldo suficiente.')}
    </div>
  </div></section>`;
}

// ── 10 · Competencia indirecta y referentes ──────────────────────────
export function panelIndirectos(c: Competencia): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('10 · Competencia indirecta y referentes', 'Quién más pelea el presupuesto')}
    <div style="margin-top:22px;">
      <h3>Alternativas más baratas o fraccionadas</h3>
      ${tabla(['Alternativa', 'Producto', 'Precio', 'Modalidad'], c.indirectos.map((d) => [
        `<strong>${escapar(d.nombre)}</strong>`, escapar(d.producto),
        `<strong>${escapar(d.precio)}</strong>`, escapar(d.modalidad),
      ]))}
      ${siVacio(c.indirectos, 'No se identificaron alternativas indirectas con precio verificable.')}

      <h3 style="margin-top:20px;">Referentes del nicho</h3>
      ${tabla(['Cuenta', 'Seguidores', 'País'], c.referentes.map((r) => [
        `<strong>${escapar(r.cuenta)}</strong>`,
        escapar(r.seguidores.toLocaleString('es-MX')),
        escapar(r.pais),
      ]))}
      ${siVacio(c.referentes, 'No se documentaron referentes con cifras verificables.')}
    </div>
    ${listaFuentes([...c.indirectos.map((d) => d.fuente), ...c.referentes.map((r) => r.fuente)])}
  </div></section>`;
}
