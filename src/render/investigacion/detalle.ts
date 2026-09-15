import type { Investigacion, Competencia, Audiencia, Canales, Mercado, Sintesis, Competidor } from '@/research/schemas';
import { escapar, fuente, lista, tabla, sinDatos } from './comunes';

type Etapa<T> = { estado: 'ok'; datos: T } | { estado: 'vacio'; razon: string } | undefined;
const datos = <T>(e: Etapa<T>): T | null => (e && e.estado === 'ok' ? e.datos : null);

const filaCompetidor = (c: Competidor) =>
  [escapar(c.nombre), escapar(c.producto), escapar(c.precio), escapar(c.modalidad), escapar(c.aval), fuente(c.fuente)];

function competencia(c: Competencia | null): string {
  if (!c) return `<h3>Competencia</h3>${sinDatos()}`;
  const enc = ['Quién', 'Qué ofrece', 'Precio', 'Modalidad', 'Aval', 'Fuente'];
  return `<h3>Competencia</h3>
    ${c.directos.length ? `<h4>Directa</h4>${tabla(enc, c.directos.map(filaCompetidor))}` : ''}
    ${c.indirectos.length ? `<h4>Otras opciones que compiten por el mismo presupuesto</h4>${tabla(enc, c.indirectos.map(filaCompetidor))}` : ''}
    ${c.referentes.length ? `<h4>Cuentas de referencia</h4>${tabla(['Cuenta', 'Seguidores', 'País', 'Fuente'],
      c.referentes.map((r) => [escapar(r.cuenta), escapar(r.seguidores.toLocaleString('es-MX')), escapar(r.pais), fuente(r.fuente)]))}` : ''}
    ${c.hallazgos.length ? `<h4>Lo que muestra</h4>${lista(c.hallazgos)}` : ''}`;
}

function audiencia(a: Audiencia | null): string {
  if (!a) return `<h3>Audiencia</h3>${sinDatos()}`;
  const citas = (cs: Audiencia['dolores']) => cs.map((c) =>
    `<blockquote class="cita"><p>«${escapar(c.texto)}»</p><p class="suave">${escapar(c.contexto)} · ${fuente(c.fuente)}</p></blockquote>`).join('');
  return `<h3>Audiencia</h3>
    ${a.dolores.length ? `<h4>Lo que le duele, en sus palabras</h4>${citas(a.dolores)}` : ''}
    ${a.aspiraciones.length ? `<h4>Lo que desea</h4>${citas(a.aspiraciones)}` : ''}
    <h4>Lo que más la frena</h4><p><b>${escapar(a.miedoPrincipal.nombre)}.</b> ${escapar(a.miedoPrincipal.evidencia)} ${fuente(a.miedoPrincipal.fuente)}</p>
    <h4>Qué cree que está comprando</h4><p>${escapar(a.unidadDeCompra)}</p>`;
}

function canales(c: Canales | null): string {
  if (!c) return `<h3>Canales</h3>${sinDatos()}`;
  return `<h3>Canales</h3>
    ${tabla(['Plataforma', 'Alcance', 'Notas', 'Fuente'], c.plataformas.map((p) => [escapar(p.nombre), escapar(p.alcance), escapar(p.notas), fuente(p.fuente)]))}
    ${c.formatos.length ? `<h4>Formatos</h4>${lista(c.formatos)}` : ''}
    <h4>Horarios</h4><p>${escapar(c.horarios)}</p>
    ${c.tendencias.length ? `<h4>Tendencias</h4>${lista(c.tendencias)}` : ''}
    ${c.advertenciaRegulatoria ? `<h4>Advertencia</h4><p>${escapar(c.advertenciaRegulatoria)}</p>` : ''}`;
}

function mercado(m: Mercado | null): string {
  if (!m) return `<h3>Mercado</h3>${sinDatos()}`;
  return `<h3>Mercado</h3>
    ${tabla(['Dato', 'Valor', 'Fuente'], m.datos.map((d) => [escapar(d.etiqueta), escapar(d.valor), fuente(d.fuente)]))}
    ${m.salarios.length ? `<h4>Salarios</h4>${tabla(['Puesto', 'Rango', 'Fuente'], m.salarios.map((s) => [escapar(s.puesto), escapar(s.rango), fuente(s.fuente)]))}` : ''}
    ${m.regulacion.length ? `<h4>Regulación</h4>${tabla(['Norma', 'Qué implica', 'Fuente'], m.regulacion.map((r) => [escapar(r.norma), escapar(r.implicacion), fuente(r.fuente)]))}` : ''}
    ${m.crecimiento ? `<h4>Crecimiento</h4><p>${escapar(m.crecimiento)}</p>` : ''}`;
}

export function detalleInvestigacion(inv: Investigacion, abierto: boolean): string {
  return `<details class="detalle"${abierto ? ' open' : ''}>
    <summary>Ver el detalle de la investigación</summary>
    ${competencia(datos(inv.competencia))}
    ${audiencia(datos(inv.audiencia))}
    ${canales(datos(inv.canales))}
    ${mercado(datos(inv.mercado))}
  </details>`;
}

/** Respaldo cuando aún no hay lectura: la síntesis estratégica, en continuo. */
export function sintesisContinua(s: Sintesis | null): string {
  if (!s) return '';
  const tipos: Record<string, string> = { prioritario: 'Prioridad', expansion: 'Después', descartado: 'Descartado' };
  return `<section>
    <h2>Lo más importante</h2>
    ${s.hallazgos.map((h) => `<article class="tarjeta"><h3>${escapar(h.titulo)}</h3><p>${escapar(h.texto)}</p></article>`).join('')}
    <div class="bloque tarjeta"><h3>${escapar(s.posicionamiento.frase)}</h3><p>${escapar(s.posicionamiento.sustento)}</p></div>
    <div class="bloque">
      ${s.focos.map((f) => `<article class="tarjeta"><p class="eyebrow">${escapar(tipos[f.tipo] ?? f.tipo)}</p><h3>${escapar(f.nombre)}</h3><p>${escapar(f.razon)}</p></article>`).join('')}
    </div>
  </section>`;
}
