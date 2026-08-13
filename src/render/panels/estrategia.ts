import type { Sintesis } from '@/research/schemas';
import { cabecera, escapar, lista, siVacio, tabla, tarjeta } from './comunes';

const COLOR_FOCO: Record<string, string> = {
  prioritario: 'card-green',
  expansion: 'card-blue',
  descartado: 'card-yellow',
};

const BADGE_FOCO: Record<string, string> = {
  prioritario: 'b-green',
  expansion: 'b-blue',
  descartado: 'b-gray',
};

// ── 11 · Recomendación de foco ───────────────────────────────────────
export function panelFoco(s: Sintesis): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('11 · Recomendación de foco', 'Dónde debe pararse el cliente')}
    <div class="card card-pink" style="margin-top:22px;">
      <h3>Posicionamiento</h3>
      <p style="font-size:1.19rem;line-height:1.45;margin-top:8px;">«${escapar(s.posicionamiento.frase)}»</p>
      <p class="tiny" style="margin-top:12px;">${escapar(s.posicionamiento.sustento)}</p>
    </div>
    <div class="g3" style="margin-top:18px;">
      ${s.focos.map((f) => tarjeta(
        f.nombre,
        `<div class="badge ${BADGE_FOCO[f.tipo] ?? 'b-gray'}">${escapar(f.tipo)}</div>
         <p style="margin-top:8px;">${escapar(f.razon)}</p>`,
        COLOR_FOCO[f.tipo] ?? '',
      )).join('')}
    </div>
  </div></section>`;
}

// ── 12 · Desarrollo de la oferta ─────────────────────────────────────
export function panelOferta(s: Sintesis): string {
  const o = s.oferta;
  return `<section class="panel"><div class="wrap">
    ${cabecera('12 · Desarrollo de la oferta', 'Qué se vende de verdad')}
    <div class="alert alert-red" style="margin-top:22px;">
      <strong>El problema real.</strong> ${escapar(o.problemaReal)}
    </div>
    <div class="g2" style="margin-top:16px;">
      ${tarjeta(
        'Activos sin explotar',
        lista(o.activosSinExplotar, 'lst lst-ok') + siVacio(o.activosSinExplotar, 'No se identificaron activos desaprovechados.'),
        'card-green',
      )}
      ${tarjeta(
        'Falta construir',
        lista(o.faltaConstruir, 'lst lst-x') + siVacio(o.faltaConstruir, 'No se identificaron faltantes.'),
        'card-yellow',
      )}
    </div>
  </div></section>`;
}

// ── 13 · Arquitectura de precios ─────────────────────────────────────
export function panelPrecios(s: Sintesis): string {
  const p = s.precios;

  if (!p) {
    return `<section class="panel"><div class="wrap">
      ${cabecera('13 · Arquitectura de precios', 'Cuánto y cómo se cobra')}
      <div class="alert alert-yellow" style="margin-top:22px;">
        <strong>Sin datos.</strong> La síntesis no propuso arquitectura de precios:
        no había suficiente información de mercado ni de competencia para sostenerla.
      </div>
    </div></section>`;
  }

  return `<section class="panel"><div class="wrap">
    ${cabecera('13 · Arquitectura de precios', 'Cuánto y cómo se cobra')}
    <div class="alert" style="margin-top:22px;"><strong>Diagnóstico.</strong> ${escapar(p.diagnostico)}</div>
    <div style="margin-top:16px;">
      ${tabla(['Plan', 'Monto', 'Total'], p.propuesta.map((x) => [
        `<strong>${escapar(x.plan)}</strong>`,
        escapar(x.monto),
        `<strong style="color:var(--pink);">${escapar(x.total)}</strong>`,
      ]))}
      ${siVacio(p.propuesta, 'No se propuso una estructura de planes.')}
    </div>
    ${p.riesgos.length ? `<div class="g2" style="margin-top:8px;">${p.riesgos.map((r) => `<div class="alert alert-red">${escapar(r)}</div>`).join('')}</div>` : ''}
  </div></section>`;
}

// ── 14 · Transformación para venta digital ───────────────────────────
export function panelTraduccion(s: Sintesis): string {
  const o = s.oferta;
  return `<section class="panel"><div class="wrap">
    ${cabecera('14 · Transformación para venta digital', 'De características a oferta')}
    <div style="margin-top:22px;">
      ${tabla(['Como se dice hoy', 'Como debería decirse', 'Por qué'], o.traduccion.map((t) => [
        `<span class="tiny">${escapar(t.antes)}</span>`,
        `<strong>${escapar(t.despues)}</strong>`,
        `<span class="tiny">${escapar(t.porQue)}</span>`,
      ]))}
      ${siVacio(o.traduccion, 'No se propusieron traducciones de mensaje.')}
    </div>
    <div class="card card-pink" style="margin-top:18px;text-align:center;">
      <p class="tiny">Titular propuesto</p>
      <p style="font-size:1.6rem;font-weight:700;line-height:1.25;margin-top:8px;">${escapar(o.titularFinal)}</p>
    </div>
  </div></section>`;
}

// ── 15 · Ciclo de compra ─────────────────────────────────────────────
export function panelCiclo(s: Sintesis): string {
  const c = s.ciclo;
  return `<section class="panel"><div class="wrap">
    ${cabecera('15 · Ciclo de compra', 'Cómo decide', escapar(c.tipo))}
    <div class="flow" style="margin-top:22px;">
      ${c.etapas.map((e, i) => `
        <div class="flow-step">
          <div class="flow-n">${i + 1}</div>
          <div class="flow-box">
            <h3>${escapar(e.nombre)}</h3>
            <p class="tiny" style="margin-top:6px;">${escapar(e.quePiensa)}</p>
            <p style="margin-top:8px;">«${escapar(e.fraseTipo)}»</p>
          </div>
        </div>`).join('')}
    </div>
  </div></section>`;
}

// ── 16 · Mapeo y fricciones ──────────────────────────────────────────
export function panelFricciones(s: Sintesis): string {
  const c = s.ciclo;
  return `<section class="panel"><div class="wrap">
    ${cabecera('16 · Mapeo y fricciones', 'Qué frena y qué acelera')}
    <div class="g2" style="margin-top:22px;">
      ${tarjeta(
        'Fricciones',
        lista(c.fricciones, 'lst lst-x') + siVacio(c.fricciones, 'No se identificaron fricciones.'),
        'card-pink',
      )}
      ${tarjeta(
        'Aceleradores',
        lista(c.aceleradores, 'lst lst-ok') + siVacio(c.aceleradores, 'No se identificaron aceleradores.'),
        'card-green',
      )}
    </div>
  </div></section>`;
}

// ── 17 · Cierre de la fase 1 ─────────────────────────────────────────
export function panelCierre(s: Sintesis): string {
  return `<section class="panel"><div class="wrap">
    ${cabecera('17 · Cierre de la fase 1', 'Lo que esta investigación no pudo responder')}
    <div style="margin-top:22px;">
      ${s.pendientes.map((p) => `<div class="alert alert-yellow" style="margin-bottom:10px;">${escapar(p)}</div>`).join('')}
      ${siVacio(s.pendientes, 'La síntesis no declaró pendientes. Conviene revisarlo: una investigación sin huecos suele significar que no se buscó lo suficiente.')}
    </div>
    <p class="hint" style="margin-top:20px;">
      Nada de este documento es una proyección: es lo que hay publicado y verificable
      a la fecha de corte. Lo que no se pudo verificar está declarado arriba.
    </p>
  </div></section>`;
}
