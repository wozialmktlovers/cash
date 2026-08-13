import type { Investigacion } from '@/research/schemas';
import { ESTILOS, NAVEGACION } from './estilos';
import { escapar, panelVacio } from './panels/comunes';
import {
  panelPortada, panelResumen, panelReconocer, panelDolores, panelCanales,
  panelPersona, panelCompetenciaDirecta, panelHallazgo, panelIndirectos,
} from './panels/investigacion';
import {
  panelFoco, panelOferta, panelPrecios, panelTraduccion,
  panelCiclo, panelFricciones, panelCierre,
} from './panels/estrategia';

export { escapar, panelVacio };

/** Devuelve los datos de una etapa, o null si se declaró vacía. */
function datos<T>(etapa: { estado: 'ok'; datos: T } | { estado: 'vacio'; razon: string }): T | null {
  return etapa.estado === 'ok' ? etapa.datos : null;
}

function razon(etapa: { estado: 'ok' } | { estado: 'vacio'; razon: string }): string {
  return etapa.estado === 'vacio' ? etapa.razon : '';
}

export function renderizarPresentacion(
  investigacion: Investigacion,
  meta: { cliente: string; giro: string; fecha: string },
  /** HTML de la barra de operador. Solo se inyecta en la vista interna; el
   *  link público comparte la presentación sin ella. */
  barraOperador = ''
): string {
  const competencia = datos(investigacion.competencia);
  const audiencia = datos(investigacion.audiencia);
  const canales = datos(investigacion.canales);
  const mercado = datos(investigacion.mercado);
  const sintesis = datos(investigacion.sintesis);

  const rSintesis = razon(investigacion.sintesis);
  const rCompetencia = razon(investigacion.competencia);
  const rAudiencia = razon(investigacion.audiencia);

  const paneles = [
    // 01
    panelPortada(meta),
    // 02
    sintesis
      ? panelResumen(sintesis.hallazgos)
      : panelVacio('02 · Resumen', 'Los cuatro hallazgos', rSintesis),
    // 03 — se muestra si hay audiencia o mercado; solo se declara vacío si faltan ambos
    audiencia || mercado
      ? panelReconocer(audiencia, mercado)
      : panelVacio('03 · Reconocer la audiencia', 'A quién le hablas', rAudiencia || razon(investigacion.mercado)),
    // 04
    audiencia
      ? panelDolores(audiencia)
      : panelVacio('04 · Dolores y aspiraciones', 'En sus propias palabras', rAudiencia),
    // 05
    canales
      ? panelCanales(canales)
      : panelVacio('05 · Canales, tendencias e intereses', 'Dónde alcanzarla', razon(investigacion.canales)),
    // 06 y 07
    audiencia?.personas?.[0]
      ? panelPersona(audiencia.personas[0], '06 · Buyer persona 1', 'Prioridad 1', 'card-pink')
      : panelVacio('06 · Buyer persona 1', 'Sin persona definida', rAudiencia || 'La etapa no devolvió las dos personas.'),
    audiencia?.personas?.[1]
      ? panelPersona(audiencia.personas[1], '07 · Buyer persona 2', 'Prioridad 2', 'card-blue')
      : panelVacio('07 · Buyer persona 2', 'Sin persona definida', rAudiencia || 'La etapa no devolvió las dos personas.'),
    // 08, 09 y 10
    competencia
      ? panelCompetenciaDirecta(competencia)
      : panelVacio('08 · Competencia directa', 'El mapa real de precios', rCompetencia),
    competencia
      ? panelHallazgo(competencia)
      : panelVacio('09 · El hallazgo decisivo', 'Qué revela el mapa', rCompetencia),
    competencia
      ? panelIndirectos(competencia)
      : panelVacio('10 · Competencia indirecta y referentes', 'Quién más pelea el presupuesto', rCompetencia),
    // 11 a 17 — todos dependen de la síntesis
    sintesis ? panelFoco(sintesis) : panelVacio('11 · Recomendación de foco', 'Dónde debe pararse el cliente', rSintesis),
    sintesis ? panelOferta(sintesis) : panelVacio('12 · Desarrollo de la oferta', 'Qué se vende de verdad', rSintesis),
    sintesis ? panelPrecios(sintesis) : panelVacio('13 · Arquitectura de precios', 'Cuánto y cómo se cobra', rSintesis),
    sintesis ? panelTraduccion(sintesis) : panelVacio('14 · Transformación para venta digital', 'De características a oferta', rSintesis),
    sintesis ? panelCiclo(sintesis) : panelVacio('15 · Ciclo de compra', 'Cómo decide', rSintesis),
    sintesis ? panelFricciones(sintesis) : panelVacio('16 · Mapeo y fricciones', 'Qué frena y qué acelera', rSintesis),
    sintesis ? panelCierre(sintesis) : panelVacio('17 · Cierre de la fase 1', 'Lo que no se pudo responder', rSintesis),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="es-MX"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Social Research Wozial | ${escapar(meta.cliente)} · ${escapar(meta.giro)}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="mask-icon" href="/favicon.svg" color="#d4688a">
<meta name="theme-color" content="#0a0a0a">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${ESTILOS}</style>
</head><body>
${barraOperador}
<div class="deck" id="deck">${paneles}</div>
<script>${NAVEGACION}</script>
</body></html>`;
}
