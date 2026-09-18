import type { Investigacion, Competencia, Audiencia, Canales, Mercado, Sintesis, Competidor } from '@/research/schemas';
import { normalizar } from '@/lib/ui/buscar';
import { escapar, fuente, lista, sinDatos, encabezadoSeccion } from './comunes';
import { filasGrafica, graficaBarras, graficaRangos } from './graficas';
import { rutaEditable, rutaAncla } from '@/render/editorial/flujo-cliente';

type Etapa<T> = { estado: 'ok'; datos: T } | { estado: 'vacio'; razon: string } | undefined;
const datos = <T>(e: Etapa<T>): T | null => (e && e.estado === 'ok' ? e.datos : null);

/** Cobertura de `data-editable` aquí: solo el nombre, el producto y el precio de cada competidor (directo o indirecto) — el resto del detalle (referentes, hallazgos, audiencia, canales, mercado más allá de lo marcado abajo) no lleva marca en esta fase. */
/**
 * Rasgos de la oferta como chips. `duracion`, `modalidad` y `aval` son de las
 * investigaciones pensadas para cursos; las de cualquier giro traen
 * `detalles`. Se muestran los que haya, sin chips vacíos.
 */
export function rasgosCompetidor(c: Partial<Competidor>): string[] {
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return [c.duracion, c.modalidad, c.aval, ...(Array.isArray(c.detalles) ? c.detalles : [])]
    .map(texto)
    .filter(Boolean);
}

function tarjetaCompetidor(c: Competidor, ruta: string, editable: boolean, anclas: boolean): string {
  const rasgos = rasgosCompetidor(c);
  const precio = c.precio?.trim()
    ? `<p class="dato-grande"${rutaEditable(editable, `${ruta}.precio`)}>${escapar(c.precio)}</p>`
    : '<p class="suave">Precio no publicado</p>';
  return `<article class="tarjeta"${rutaAncla(anclas, ruta)}>
    <h4${rutaEditable(editable, `${ruta}.nombre`)}>${escapar(c.nombre)}</h4>
    ${precio}
    ${c.producto?.trim() ? `<p${rutaEditable(editable, `${ruta}.producto`)}>${escapar(c.producto)}</p>` : ''}
    ${rasgos.length ? `<ul class="chips">${rasgos.map((r) => `<li>${escapar(r)}</li>`).join('')}</ul>` : ''}
    ${fuente(c.fuente)}
  </article>`;
}

function panelCompetencia(c: Competencia | null, cliente: string, editable: boolean, anclas: boolean): string {
  if (!c) return sinDatos();
  const clienteN = normalizar(cliente);
  const todos = [...c.directos, ...c.indirectos];
  const filas = filasGrafica(todos, (x) => x.nombre, (x) => x.precio,
    (x) => /\(el cliente\)/i.test(x.nombre) || (clienteN.length > 0 && normalizar(x.nombre).includes(clienteN)));
  return `${graficaBarras(filas, 'Precio de cada opción')}
    ${c.directos.length ? `<div class="pila"><h4>Competencia directa</h4><div class="rejilla tres">${c.directos.map((x, i) => tarjetaCompetidor(x, `competencia.datos.directos.${i}`, editable, anclas)).join('')}</div></div>` : ''}
    ${c.indirectos.length ? `<div class="pila"><h4>Otras opciones que compiten por el mismo presupuesto</h4><div class="rejilla tres">${c.indirectos.map((x, i) => tarjetaCompetidor(x, `competencia.datos.indirectos.${i}`, editable, anclas)).join('')}</div></div>` : ''}
    ${c.referentes.length ? `<div class="pila"><h4>Cuentas de referencia</h4><div class="rejilla cuatro">${c.referentes.map((r) => `<div class="tarjeta">
      <p class="dato-grande">${escapar(r.seguidores.toLocaleString('en-US'))}</p><p>${escapar(r.cuenta)} · ${escapar(r.pais)}</p>${fuente(r.fuente)}</div>`).join('')}</div></div>` : ''}
    ${c.hallazgos.length ? `<div class="tarjeta"><h4>Lo que muestra</h4>${lista(c.hallazgos)}</div>` : ''}`;
}

function panelAudiencia(a: Audiencia | null, editable: boolean): string {
  if (!a) return sinDatos();
  const citas = (cs: Audiencia['dolores']) => cs.map((c) => `<article class="tarjeta">
    <blockquote class="cita">«${escapar(c.texto)}»</blockquote>
    <p class="suave">${escapar(c.contexto)}</p>${fuente(c.fuente)}</article>`).join('');
  const miedo = a.miedoPrincipal;
  return `${miedo ? `<div class="tarjeta destacado"><h3>Lo que más la frena: <span${rutaEditable(editable, 'audiencia.datos.miedoPrincipal.nombre')}>${escapar(miedo.nombre)}</span></h3>
      <p${rutaEditable(editable, 'audiencia.datos.miedoPrincipal.evidencia')}>${escapar(miedo.evidencia)}</p>${fuente(miedo.fuente)}</div>` : ''}
    <div class="rejilla dos">
      <div class="pila"><h4>Lo que le duele, en sus palabras</h4>${citas(a.dolores) || sinDatos()}</div>
      <div class="pila"><h4>Lo que desea</h4>${citas(a.aspiraciones) || sinDatos()}</div>
    </div>
    ${a.unidadDeCompra?.trim() ? `<div class="tarjeta"><h4>Qué cree que está comprando</h4><p${rutaEditable(editable, 'audiencia.datos.unidadDeCompra')}>${escapar(a.unidadDeCompra)}</p></div>` : ''}`;
}

function panelCanales(c: Canales | null, editable: boolean): string {
  if (!c) return sinDatos();
  return `<div class="rejilla tres">${c.plataformas.map((p, i) => `<article class="tarjeta">
      <h4${rutaEditable(editable, `canales.datos.plataformas.${i}.nombre`)}>${escapar(p.nombre)}</h4><p class="dato-grande">${escapar(p.alcance)}</p><p class="suave"${rutaEditable(editable, `canales.datos.plataformas.${i}.notas`)}>${escapar(p.notas)}</p>${fuente(p.fuente)}</article>`).join('')}</div>
    <div class="rejilla dos">
      ${c.formatos.length ? `<div class="tarjeta"><h4>Formatos que funcionan</h4><ul class="chips">${c.formatos.map((f) => `<li>${escapar(f)}</li>`).join('')}</ul></div>` : ''}
      ${c.tendencias.length ? `<div class="tarjeta"><h4>Tendencias</h4><ul class="chips">${c.tendencias.map((t) => `<li>${escapar(t)}</li>`).join('')}</ul></div>` : ''}
      ${c.horarios?.trim() ? `<div class="tarjeta"><h4>Horarios</h4><p${rutaEditable(editable, 'canales.datos.horarios')}>${escapar(c.horarios)}</p></div>` : ''}
      ${c.advertenciaRegulatoria ? `<div class="tarjeta destacado"><h4>Advertencia</h4><p${rutaEditable(editable, 'canales.datos.advertenciaRegulatoria')}>${escapar(c.advertenciaRegulatoria)}</p></div>` : ''}
    </div>`;
}

function panelMercado(m: Mercado | null, editable: boolean): string {
  if (!m) return sinDatos();
  const rangos = filasGrafica(m.salarios, (s) => s.puesto, (s) => s.rango);
  return `<div class="rejilla cuatro">${m.datos.map((d, i) => `<div class="tarjeta">
      <p class="dato-grande"${rutaEditable(editable, `mercado.datos.datos.${i}.valor`)}>${escapar(d.valor)}</p><p${rutaEditable(editable, `mercado.datos.datos.${i}.etiqueta`)}>${escapar(d.etiqueta)}</p>${fuente(d.fuente)}</div>`).join('')}</div>
    ${graficaRangos(rangos, 'Ingreso mensual')}
    ${m.salarios.length ? `<div class="rejilla tres">${m.salarios.map((s, i) => `<div class="tarjeta"><h4${rutaEditable(editable, `mercado.datos.salarios.${i}.puesto`)}>${escapar(s.puesto)}</h4><p class="dato-grande"${rutaEditable(editable, `mercado.datos.salarios.${i}.rango`)}>${escapar(s.rango)}</p>${fuente(s.fuente)}</div>`).join('')}</div>` : ''}
    ${m.regulacion.length ? `<div class="pila"><h4>Regulación</h4><div class="rejilla dos">${m.regulacion.map((r) => `<div class="tarjeta"><h4>${escapar(r.norma)}</h4><p>${escapar(r.implicacion)}</p>${fuente(r.fuente)}</div>`).join('')}</div></div>` : ''}
    ${m.crecimiento ? `<div class="tarjeta destacado"><h3>Crecimiento</h3><p${rutaEditable(editable, 'mercado.datos.crecimiento')}>${escapar(m.crecimiento)}</p></div>` : ''}`;
}

const TEMAS = [
  { clave: 'competencia', nombre: 'Competencia' },
  { clave: 'audiencia', nombre: 'Tu cliente' },
  { clave: 'canales', nombre: 'Canales' },
  { clave: 'mercado', nombre: 'Mercado' },
] as const;

export function seccionDetalle(inv: Investigacion, cliente: string, num: string, editable = false, anclas = false): string {
  const contenido: Record<(typeof TEMAS)[number]['clave'], string> = {
    competencia: panelCompetencia(datos(inv.competencia), cliente, editable, anclas),
    audiencia: panelAudiencia(datos(inv.audiencia), editable),
    canales: panelCanales(datos(inv.canales), editable),
    mercado: panelMercado(datos(inv.mercado), editable),
  };
  // Sin JS los cuatro paneles quedan visibles uno tras otro; el script oculta los no elegidos.
  return `<section class="seccion alterna" id="detalle" data-seccion${rutaAncla(anclas, 'seccion:detalle')}>
    ${encabezadoSeccion(num, 'Detalle de la investigación', 'Los datos que sostienen todo lo anterior, con sus fuentes.')}
    <div>
      <div class="pestanas" role="tablist" aria-label="Detalle por tema">
        ${TEMAS.map((t, i) => `<button type="button" role="tab" id="tab-${t.clave}" aria-controls="panel-${t.clave}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${t.nombre}</button>`).join('')}
      </div>
      ${TEMAS.map((t) => `<div class="panel-tema" role="tabpanel" id="panel-${t.clave}" aria-labelledby="tab-${t.clave}">
        <h3 class="panel-titulo">${t.nombre}</h3>
        ${contenido[t.clave]}
      </div>`).join('')}
    </div>
  </section>`;
}

/** Respaldo cuando aún no hay lectura: la síntesis, con el mismo diseño. */
export function sintesisEditorial(s: Sintesis | null, num: string, editable = false, anclas = false): string {
  if (!s) return '';
  const tipos: Record<string, string> = { prioritario: 'Prioridad', expansion: 'Después', descartado: 'Descartado' };
  return `<section class="seccion" id="sintesis" data-seccion${rutaAncla(anclas, 'seccion:sintesis')}>
    ${encabezadoSeccion(num, 'Lo más importante', 'La síntesis estratégica de la investigación.')}
    <div class="rejilla dos">${s.hallazgos.map((h, i) => `<article class="tarjeta aparece"${rutaAncla(anclas, `sintesis.datos.hallazgos.${i}`)}><h3${rutaEditable(editable, `sintesis.datos.hallazgos.${i}.titulo`)}>${escapar(h.titulo)}</h3><p${rutaEditable(editable, `sintesis.datos.hallazgos.${i}.texto`)}>${escapar(h.texto)}</p></article>`).join('')}</div>
    <div class="tarjeta destacado aparece"><h3${rutaEditable(editable, 'sintesis.datos.posicionamiento.frase')}>${escapar(s.posicionamiento.frase)}</h3><p${rutaEditable(editable, 'sintesis.datos.posicionamiento.sustento')}>${escapar(s.posicionamiento.sustento)}</p></div>
    <div class="rejilla tres">${s.focos.map((f, i) => `<article class="tarjeta aparece"${rutaAncla(anclas, `sintesis.datos.focos.${i}`)}><p class="eyebrow">${escapar(tipos[f.tipo] ?? f.tipo)}</p><h3${rutaEditable(editable, `sintesis.datos.focos.${i}.nombre`)}>${escapar(f.nombre)}</h3><p${rutaEditable(editable, `sintesis.datos.focos.${i}.razon`)}>${escapar(f.razon)}</p></article>`).join('')}</div>
  </section>`;
}
