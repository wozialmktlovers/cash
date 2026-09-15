import { FUNCIONES, FORMATOS, ESTADOS_TEMA, type MapaPilares, type PilarMapa, type Tema, type EstadoTema, type Estrategia } from '@/pilares/schemas';
import type { AvanceTema } from '@/pilares/avance';
import { escapar, encabezadoSeccion } from '@/render/editorial/comunes';
import { rutaEditable, rutaAncla } from '@/render/editorial/flujo-cliente';
import { normalizar } from '@/lib/ui/buscar';
import { COLOR_PILAR, ETIQUETA_FUNCION, ETIQUETA_FORMATO } from './secciones';

// SCRIPT_PILARES (script.ts) trae su propia copia de este mapa en JS puro,
// porque el estado cambia de nombre en el navegador sin volver a pasar por
// este archivo. Si cambian los nombres o el orden de ESTADOS_TEMA aquí,
// hay que actualizar también ese mapa.
const ETIQUETA_ESTADO: Record<EstadoTema, string> = {
  pendiente: 'Pendiente',
  en_desarrollo: 'En desarrollo',
  desarrollado: 'Desarrollado',
  publicado: 'Publicado',
};

/** Fecha corta, coherente con el resto del documento (que ya recibe `fecha` como YYYY-MM-DD). */
function fechaCorta(iso: string): string {
  return iso.slice(0, 10);
}

function contarAvance(temas: Tema[], avance?: Record<string, AvanceTema>): { total: number; hechos: number } {
  const hechos = temas.filter((t) => {
    const e = avance?.[t.id]?.estado;
    return e === 'desarrollado' || e === 'publicado';
  }).length;
  return { total: temas.length, hechos };
}

function tarjetaTema(t: Tema, pilarNum: number, subNombre: string, interna: boolean, avance?: Record<string, AvanceTema>, ruta?: string, anclas = false): string {
  const av = avance?.[t.id];
  const estado: EstadoTema = av?.estado ?? 'pendiente';
  const busqueda = normalizar([t.id, t.texto, subNombre, ETIQUETA_FUNCION[t.funcion], ETIQUETA_FORMATO[t.formato].texto].join(' '));
  const atributos = [
    `data-tema="${escapar(t.id)}"`,
    `data-pilar="${pilarNum}"`,
    `data-subcategoria="${escapar(subNombre)}"`,
    `data-funcion="${t.funcion}"`,
    `data-formato="${t.formato}"`,
    `data-busqueda="${escapar(busqueda)}"`,
  ];
  if (interna) atributos.push(`data-estado="${estado}"`);
  // Ancla del tema (B7, spec §3: `tema:<id>`), no la ruta del JSON: los
  // temas del banco se identifican por su código (P2-S1-07), estable aunque
  // el mapa se regenere, a diferencia de su índice dentro del arreglo.
  if (anclas) atributos.push(`data-ancla="${escapar(`tema:${t.id}`)}"`);

  // Casilla «Elegir tema»: checada cuando el estado ya no es pendiente (sea
  // por la propia casilla o por el botón de estado, que la siguen a la
  // inversa). Envuelta en <label> con área de 44×44, sin duplicar el `id`
  // por tarjeta: el nombre accesible sale directo del aria-label del input
  // (spec del pedido, regla 1). Solo en la interna, igual que el resto de
  // los controles: el link público nunca elige ni guarda estado.
  const controles = interna
    ? `<div class="tema-controles">
        <label class="tema-elegir-envoltura">
          <input type="checkbox" class="tema-elegir" aria-label="Elegir tema ${escapar(t.id)}"${estado !== 'pendiente' ? ' checked' : ''}>
        </label>
        <button type="button" class="boton-estado" data-estado-actual="${estado}">${escapar(ETIQUETA_ESTADO[estado])}</button>
        <button type="button" class="boton-nota${av?.nota ? ' con-nota' : ''}" data-nota="${escapar(av?.nota ?? '')}" data-tema-titulo="${escapar(t.texto)}" aria-label="Nota del tema ${escapar(t.id)}" aria-haspopup="dialog">Nota</button>
      </div>
      ${av ? `<p class="tema-meta suave">${escapar(av.actualizadoPor ?? 'Sin autor')} · ${escapar(fechaCorta(av.actualizadoEn))}</p>` : ''}`
    : '';

  // Tachado (regla 3): desarrollado/publicado se marcan `.tema-tachado`
  // (texto en línea encima, atenuado); en_desarrollo se marca `.tema-elegido`
  // (filo de color) para que se note que ya se eligió pero falta terminarlo.
  // Solo en la interna: la pública nunca lleva estado, así que tampoco estas
  // clases (evita que alguien las lea como pista de avance real).
  const tachado = interna && (estado === 'desarrollado' || estado === 'publicado');
  const elegido = interna && estado === 'en_desarrollo';
  const claseTarjeta = `tema-tarjeta${tachado ? ' tema-tachado' : ''}${elegido ? ' tema-elegido' : ''}`;

  return `<article class="${claseTarjeta}" ${atributos.join(' ')}>
    <p class="tema-id">${escapar(t.id)}</p>
    <div class="tema-etiquetas">
      <span class="etiqueta-funcion ${t.funcion}">${escapar(ETIQUETA_FUNCION[t.funcion])}</span>
      <span class="etiqueta-formato">${ETIQUETA_FORMATO[t.formato].icono}${escapar(ETIQUETA_FORMATO[t.formato].texto)}</span>
    </div>
    <p class="tema-texto"${rutaEditable(Boolean(ruta), ruta ?? '')}>${escapar(t.texto)}</p>
    ${controles}
  </article>`;
}

/**
 * `indicePilar` es la posición REAL de `p` en `datos.pilares` (el arreglo tal
 * cual se guarda), no `p.numero - 1`: aunque hoy coinciden, la ruta de
 * `data-editable` tiene que navegar el JSON de verdad, no el número visible.
 */
function bloquePilarOk(p: Extract<PilarMapa, { estado: 'ok' }>, indicePilar: number, ep: Estrategia['pilares'][number], interna: boolean, avance?: Record<string, AvanceTema>, editable = false, anclas = false): string {
  const temas = p.subcategorias.flatMap((s) => s.temas);
  return `<details class="pilar-bloque" open data-pilar="${p.numero}" style="--color-pilar:${COLOR_PILAR[p.numero - 1]}">
    <summary class="pilar-cabecera">
      <span class="pilar-num">${p.numero}</span>
      <div class="pilar-info"><h3>${escapar(ep.nombre)}</h3><p class="suave">${escapar(ep.objetivo)}</p></div>
      <span class="pilar-conteo">${temas.length} temas</span>
    </summary>
    <div class="pestanas" role="tablist" aria-label="Subcategorías del pilar ${p.numero}, ${escapar(ep.nombre)}">
      ${p.subcategorias.map((s, i) => `<button type="button" role="tab" id="tab-p${p.numero}-s${i + 1}" aria-controls="panel-p${p.numero}-s${i + 1}" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}">${escapar(s.nombre)}</button>`).join('')}
    </div>
    ${p.subcategorias.map((s, i) => `<div class="panel-tema panel-subcat" role="tabpanel" id="panel-p${p.numero}-s${i + 1}" aria-labelledby="tab-p${p.numero}-s${i + 1}">
      <h4 class="panel-titulo">${escapar(s.nombre)}</h4>
      <div class="rejilla dos">${s.temas.map((t, j) => tarjetaTema(t, p.numero, s.nombre, interna, avance, editable ? `pilares.${indicePilar}.subcategorias.${i}.temas.${j}.texto` : undefined, anclas)).join('')}</div>
    </div>`).join('')}
  </details>`;
}

function bloquePilarVacio(p: Extract<PilarMapa, { estado: 'vacio' }>, ep: Estrategia['pilares'][number], interna: boolean, clienteId?: string): string {
  return `<details class="pilar-bloque vacio" open data-pilar="${p.numero}" style="--color-pilar:${COLOR_PILAR[p.numero - 1]}">
    <summary class="pilar-cabecera">
      <span class="pilar-num">${p.numero}</span>
      <div class="pilar-info"><h3>${escapar(ep.nombre)}</h3></div>
    </summary>
    <div class="pilar-vacio-cuerpo">
      <p>Este pilar no se generó.</p>
      <p class="suave">${escapar(p.razon)}</p>
      ${interna && clienteId ? `<a class="panel-boton" href="/clientes/${escapar(clienteId)}/pilares">Regenerar el mapa</a>` : ''}
    </div>
  </details>`;
}

function avisoRevision(mapa: MapaPilares): string {
  const { duplicadosRestantes, fueraDeMargen } = mapa.revision;
  if (!duplicadosRestantes.length && !fueraDeMargen.length) return '';
  return `<div class="aviso-revision" role="status">
    <p class="suave">Revisión automática: hay puntos a vigilar en este banco.</p>
    ${duplicadosRestantes.length ? `<ul class="lista">${duplicadosRestantes.map(([a, b]) => `<li>Posibles temas parecidos: ${escapar(a)} y ${escapar(b)}</li>`).join('')}</ul>` : ''}
    ${fueraDeMargen.length ? `<p>Fuera de margen del mix: ${fueraDeMargen.map((f) => escapar(ETIQUETA_FUNCION[f])).join(', ')}.</p>` : ''}
  </div>`;
}

function avanceMini(mapa: MapaPilares, avance?: Record<string, AvanceTema>): string {
  return `<div class="avance-mini-grid">
    ${[1, 2, 3, 4, 5].map((n) => {
      const pm = mapa.pilares.find((p) => p.numero === n);
      const temas = pm && pm.estado === 'ok' ? pm.subcategorias.flatMap((s) => s.temas) : [];
      const { total, hechos } = contarAvance(temas, avance);
      const pct = total > 0 ? Math.round((hechos / total) * 100) : 0;
      return `<div class="avance-mini-item" style="--color-pilar:${COLOR_PILAR[n - 1]}">
        <span class="avance-mini-num">${n}</span>
        <p>${hechos} de ${total}</p>
        <div class="progreso-pista"><div class="progreso-relleno" style="width:${pct}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;
}

function herramientas(mapa: MapaPilares, interna: boolean, total: number): string {
  const opcionesPilar = mapa.estrategia.pilares.map((p, i) => `<option value="${i + 1}">${i + 1}. ${escapar(p.nombre)}</option>`).join('');
  const opcionesSub = mapa.estrategia.pilares.flatMap((p, i) => p.subcategorias.map((s) => `<option value="${escapar(s.nombre)}" data-pilar="${i + 1}">${escapar(s.nombre)}</option>`)).join('');
  const opcionesFuncion = FUNCIONES.map((f) => `<option value="${f}">${escapar(ETIQUETA_FUNCION[f])}</option>`).join('');
  const opcionesFormato = FORMATOS.map((f) => `<option value="${f}">${escapar(ETIQUETA_FORMATO[f].texto)}</option>`).join('');
  const opcionesEstado = ESTADOS_TEMA.map((e) => `<option value="${e}">${escapar(ETIQUETA_ESTADO[e])}</option>`).join('');

  // Dos envolturas (`herramientas-fila` y `herramientas-filtros`) para que la
  // barra pueda colapsar los filtros bajo un botón en pantallas angostas sin
  // duplicar marcado: en ≥1100px ambas pasan a `display:contents` en el CSS
  // y todo queda en una sola fila (ver `ESTILOS_PILARES`).
  return `<div class="herramientas">
    <div class="herramientas-fila">
      <input type="search" data-filtro="texto" placeholder="Buscar tema" aria-label="Buscar tema">
      <button type="button" class="btn-filtros" id="btn-filtros" aria-expanded="false" aria-controls="herramientas-filtros">Filtros<span class="filtros-contador" data-filtros-contador aria-hidden="true"></span></button>
      <output data-contador>Mostrando ${total} de ${total}</output>
    </div>
    <div class="herramientas-filtros" id="herramientas-filtros">
      <select data-filtro="pilar" aria-label="Filtrar por pilar"><option value="">Todos los pilares</option>${opcionesPilar}</select>
      <select data-filtro="subcategoria" aria-label="Filtrar por subcategoría"><option value="">Todas las subcategorías</option>${opcionesSub}</select>
      <select data-filtro="funcion" aria-label="Filtrar por función"><option value="">Todas las funciones</option>${opcionesFuncion}</select>
      <select data-filtro="formato" aria-label="Filtrar por formato"><option value="">Todos los formatos</option>${opcionesFormato}</select>
      ${interna ? `<select data-filtro="estado" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${opcionesEstado}</select>` : ''}
      <button type="button" data-accion="limpiar">Limpiar</button>
      ${interna ? `<button type="button" data-accion="csv">Exportar CSV</button>` : ''}
      <button type="button" data-accion="imprimir">Imprimir / PDF</button>
    </div>
  </div>`;
}

function dialogoNota(): string {
  return `<dialog class="panel-nota" id="panel-nota">
    <h3 class="panel-nota-titulo" id="panel-nota-titulo"></h3>
    <textarea id="panel-nota-texto" maxlength="2000" aria-label="Nota del tema"></textarea>
    <div class="panel-filas">
      <button type="button" class="panel-boton panel-primario" id="panel-nota-guardar">Guardar</button>
      <button type="button" class="panel-boton" id="panel-nota-cerrar">Cerrar</button>
    </div>
    <p class="panel-estado" id="panel-nota-estado" role="status" aria-live="polite"></p>
  </dialog>`;
}

export function seccionBanco(o: {
  mapa: MapaPilares;
  interna: boolean;
  clienteId?: string;
  avance?: Record<string, AvanceTema>;
  resultId?: string;
  editable?: boolean;
  anclas?: boolean;
}): string {
  const { mapa, interna } = o;
  const editable = Boolean(o.editable);
  const anclas = Boolean(o.anclas);
  const totalTemas = mapa.pilares.reduce((n, p) => n + (p.estado === 'ok' ? p.subcategorias.reduce((m, s) => m + s.temas.length, 0) : 0), 0);

  const bloques = [1, 2, 3, 4, 5].map((n) => {
    const indicePilar = mapa.pilares.findIndex((x) => x.numero === n);
    const p = indicePilar >= 0 ? mapa.pilares[indicePilar] : { numero: n, estado: 'vacio' as const, razon: 'No se generó este pilar.' };
    const ep = mapa.estrategia.pilares[n - 1];
    return p.estado === 'ok' ? bloquePilarOk(p, indicePilar, ep, interna, o.avance, editable, anclas) : bloquePilarVacio(p, ep, interna, o.clienteId);
  }).join('');

  return `<section class="seccion alterna" id="banco" data-seccion${rutaAncla(anclas, 'seccion:banco')}${interna && o.resultId ? ` data-result-id="${escapar(o.resultId)}"` : ''}>
    ${encabezadoSeccion('06', 'Banco de temas', 'Los 300 temas, filtrables por pilar, subcategoría, función y formato.')}
    ${herramientas(mapa, interna, totalTemas)}
    ${interna ? avanceMini(mapa, o.avance) : ''}
    ${interna ? avisoRevision(mapa) : ''}
    <div class="pilares-bloques">${bloques}</div>
    ${interna ? dialogoNota() : ''}
  </section>`;
}
