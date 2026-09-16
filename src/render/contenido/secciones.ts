// Portada, 01 · Vista del feed y 02 · Calendario del entregable del mes
// (diseño §7). Las tarjetas grandes de las piezas viven en `./tarjetas.ts`.

import { escapar, encabezadoSeccion } from '@/render/editorial/comunes';
import { avanceRevision } from '@/contenido/reglas';
import { fechaHora } from '@/lib/ui/fecha';
import { nombrePeriodo } from '@/lib/ui/periodo';
import {
  ESTADO, FORMATO, ICONO_SIN_ARTE, REVISION_SOLO_LECTURA,
  diaLargo, esDeFeed, nombreMes, partesPeriodo, porFecha, portadaDe, rutaArte,
  type EstadoRevision, type Formato, type MetaContenido, type PiezaEntregable, type Revision,
} from './datos';

/**
 * Cómo se decide sobre este mes, dicho arriba de todo.
 *
 * En el portal es una instrucción: los botones están abajo, en cada pieza. En
 * el enlace público es lo contrario —aquí no se aprueba— y hay que decirlo con
 * claridad y con el camino, no dejar que el cliente busque unos botones que no
 * existen y concluya que el plazo corre sin que él pueda hacer nada. El porqué
 * de que no existan está en el tipo `Revision` (./datos.ts).
 */
function avisoComoDecidir(revision: Revision): string {
  if (revision.controles) {
    return `<p class="como-decidir">Abajo, en cada pieza, tienes <strong>Aprobar</strong> y <strong>Solicitar cambios</strong>. No hace falta que lo hagas todo de una sentada: cada decisión se guarda al momento y puedes volver cuando quieras.</p>`;
  }
  return `<p class="como-decidir solo-lectura">Este enlace es para leer el mes con calma y enseñárselo a quien quieras. <strong>Para aprobar o pedirnos cambios, entra a <a href="${escapar(revision.accesoHref)}">tu portal</a> con tu acceso</strong>: así queda registrado quién aprobó qué y cuándo. Si no tienes tu acceso, pídenoslo y te lo mandamos.</p>`;
}

/** Cifra grande con su etiqueta: el mismo componente que la portada de los otros documentos. */
function cifraTarjeta(valor: string, etiqueta: string): string {
  return `<div class="cifra-tarjeta aparece"><span class="cifra-valor">${escapar(valor)}</span><span class="cifra-etiqueta">${escapar(etiqueta)}</span></div>`;
}

/**
 * El mensaje al cliente con el plazo y la cuenta regresiva (diseño §6 y §7).
 *
 * Que la auto-aprobación esté escrita aquí, arriba de todo y con la fecha
 * exacta, es justamente el punto: el lote se da por aprobado si nadie contesta,
 * y eso hay que decirlo antes de que ocurra, no después.
 *
 * Mientras el lote no se ha compartido no hay plazo que contar —cuenta desde
 * que se comparte, no desde que se crea—, así que el mensaje lo dice en vez de
 * inventar una fecha.
 */
function mensajeAlCliente(meta: MetaContenido, revision: Revision): string {
  const dias = `${meta.diasRevision} ${meta.diasRevision === 1 ? 'día hábil' : 'días hábiles'}`;
  const mes = nombreMes(meta.periodo);
  const comoDecidir = avisoComoDecidir(revision);

  if (!meta.compartidoEn || !meta.limiteRevision) {
    return `<section class="mensaje-cliente aparece">
      <h2>Tu contenido de ${escapar(mes)} está en camino.</h2>
      <p>Aquí vas a poder revisar pieza por pieza: el arte, el copy, el llamado a la acción y los hashtags de cada publicación del mes.</p>
      <p>El plazo de ${escapar(dias)} para revisarlo empieza a correr cuando te compartamos el mes, no antes. En cuanto eso pase, verás aquí mismo la fecha límite y el tiempo que te queda.</p>
      ${comoDecidir}
    </section>`;
  }

  return `<section class="mensaje-cliente aparece">
    <h2>¡Hola! Tu contenido de ${escapar(mes)} está listo.</h2>
    <p>Terminamos el calendario de publicaciones de ${escapar(mes)} para ${escapar(meta.cliente)}. Revísalo con calma: cada pieza trae su arte, su copy listo para copiar, su llamado a la acción y sus hashtags.</p>
    <p>Tienes <strong>${escapar(dias)}</strong> desde que te lo compartimos para aprobarlo o pedirnos cambios. Si no recibimos respuesta antes de la fecha límite, damos el mes por aprobado y seguimos con la programación, para no retrasar tus publicaciones.</p>
    ${comoDecidir}
    <div class="plazo">
      <div class="plazo-dato">
        <span>Compartido</span>
        <strong>${escapar(fechaHora(meta.compartidoEn))}</strong>
      </div>
      <div class="plazo-dato">
        <span>Fecha límite</span>
        <strong>${escapar(fechaHora(meta.limiteRevision))}</strong>
      </div>
      <div class="plazo-dato cuenta-regresiva" data-limite="${escapar(meta.limiteRevision.toISOString())}">
        <span>Tiempo para revisar</span>
        <strong data-cuenta>${escapar(fechaHora(meta.limiteRevision))}</strong>
      </div>
    </div>
  </section>`;
}

/**
 * Portada: de quién es el mes, el mensaje con el plazo, las cifras por formato
 * y la barra de «14 de 22 aprobadas» (diseño §7).
 */
export function seccionPortada(piezas: PiezaEntregable[], meta: MetaContenido, revision: Revision = REVISION_SOLO_LECTURA): string {
  const avance = avanceRevision(piezas.map((p) => ({ formato: p.formato, estadoCliente: p.estadoCliente })));
  const cuenta = (f: Formato) => piezas.filter((p) => p.formato === f).length;
  // Solo los formatos que este mes trae: una cifra en cero no dice nada y
  // desordena la fila de tarjetas.
  const porFormato = (Object.keys(FORMATO) as Formato[])
    .filter((f) => cuenta(f) > 0)
    .map((f) => cifraTarjeta(String(cuenta(f)), FORMATO[f].plural))
    .join('');

  return `<section class="portada" id="inicio">
    <div class="portada-texto">
      <div class="pila">
        <p class="eyebrow">Contenido mensual · ${escapar(meta.cliente)} · ${escapar(nombrePeriodo(meta.periodo))}</p>
        <h1>Contenido de ${escapar(nombreMes(meta.periodo))}</h1>
      </div>
      <p class="resumen">${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'} para Facebook e Instagram, listas para revisar y programar.</p>
    </div>
    ${mensajeAlCliente(meta, revision)}
    <div class="cifras">
      ${cifraTarjeta(String(piezas.length), piezas.length === 1 ? 'Pieza en total' : 'Piezas en total')}
      ${porFormato}
    </div>
    <div class="avance-revision aparece" data-avance>
      <p class="cuenta" data-avance-cuenta>${avance.aprobadas} de ${avance.total} ${avance.total === 1 ? 'aprobada' : 'aprobadas'}</p>
      <div class="progreso-pista" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Piezas aprobadas" data-avance-pista>
        <div class="progreso-relleno" style="width:${avance.porcentaje}%" data-avance-relleno></div>
      </div>
    </div>
    <nav class="accesos" aria-label="Ir a">
      <a href="#vista-feed">Vista del feed</a><a href="#calendario">Calendario</a><a href="#feed">Contenido de feed</a><a href="#historias">Historias</a>
    </nav>
  </section>`;
}

/** Una celda de la cuadrícula del perfil. */
function celdaFeed(p: PiezaEntregable, base: string): string {
  const src = rutaArte(portadaDe(p), base);
  const cuando = p.fechaPublicacion ? ` del ${diaLargo(p.fechaPublicacion)}` : ' sin fecha todavía';
  const etiqueta = `Contenido ${p.numero}, ${FORMATO[p.formato].texto.toLowerCase()}${cuando}`;
  const dentro = src
    ? `<img src="${escapar(src)}" alt="" loading="lazy" decoding="async">`
    : `<span class="feed-vacia">${ICONO_SIN_ARTE}${p.numero}</span>`;
  return `<a class="feed-celda" href="#pieza-${p.numero}" aria-label="${escapar(etiqueta)}">
    ${dentro}
    <span class="feed-marca" aria-hidden="true">${FORMATO[p.formato].icono}</span>
  </a>`;
}

/**
 * 01 · Vista del feed: la cuadrícula del perfil armada sola con las portadas de
 * las piezas de feed (diseño §7). En el entregable de OLAM era una imagen hecha
 * a mano; aquí sale del lote y siempre está al día.
 *
 * **Orden: de lo más reciente a lo más antiguo**, que es como se ve un perfil
 * de Instagram (lo último publicado queda arriba a la izquierda). Es la única
 * forma de que esta vista signifique lo que promete; el orden de lectura del
 * mes, de principio a fin, lo dan el calendario y las tarjetas. Las piezas que
 * todavía no tienen día van al final, no al principio: no se sabe dónde caerán.
 */
export function seccionFeedVista(piezas: PiezaEntregable[], base: string): string {
  const feed = piezas.filter(esDeFeed);
  const conFecha = feed.filter((p) => p.fechaPublicacion !== null).sort(porFecha).reverse();
  const sinFecha = feed.filter((p) => p.fechaPublicacion === null).sort((a, b) => a.numero - b.numero);
  const celdas = [...conFecha, ...sinFecha];

  const cuerpo = celdas.length
    ? `<div class="feed-perfil">
        <div class="feed-rejilla">${celdas.map((p) => celdaFeed(p, base)).join('')}</div>
        <div class="pila">
          <h3 class="subtitulo">Cómo leerla</h3>
          <ul class="lista">
            <li>Es la retícula del perfil: lo más reciente arriba, como se verá una vez publicado el mes.</li>
            <li>Sirve para revisar el conjunto —color, ritmo, equilibrio entre formatos—, no solo pieza por pieza.</li>
            <li>Toca cualquier cuadro para ir a su tarjeta, con el copy y los datos completos.</li>
            <li>Se arma sola con las portadas del mes: si cambia un arte o una fecha, esta vista cambia con ellos.</li>
          </ul>
        </div>
      </div>`
    : '<p class="vacio-seccion">Todavía no hay piezas de feed en este mes. En cuanto se planeen, la cuadrícula se arma sola.</p>';

  return `<section class="seccion" id="vista-feed" data-seccion>
    ${encabezadoSeccion('01', 'Vista del feed', 'Así se vería el perfil con el contenido del mes ya publicado.')}
    ${cuerpo}
  </section>`;
}

const DIAS_SEMANA: [string, string][] = [
  ['L', 'lunes'], ['M', 'martes'], ['M', 'miércoles'], ['J', 'jueves'],
  ['V', 'viernes'], ['S', 'sábado'], ['D', 'domingo'],
];

/** La píldora de una pieza dentro de su día. */
function piezaDelDia(p: PiezaEntregable): string {
  const etiqueta = `Contenido ${p.numero} · ${FORMATO[p.formato].texto} · ${ESTADO[p.estadoCliente]}`;
  // El título repite lo que los iconos y los colores dicen en corto, y el
  // aria-label lo deja dicho para quien no ve ninguno de los dos.
  return `<a class="dia-pieza ${p.estadoCliente}" href="#pieza-${p.numero}" title="${escapar(etiqueta)}" aria-label="${escapar(etiqueta)}">${FORMATO[p.formato].icono}<span class="dia-pieza-num">${p.numero}</span></a>`;
}

/**
 * 02 · Calendario: el mes con cada pieza en su día, con su icono de formato y
 * su color de estado; al tocar una, lleva a su tarjeta (diseño §7).
 *
 * La semana empieza en lunes, que es como se lee un calendario en México.
 *
 * Una pieza cuya fecha cae FUERA del mes del lote (se movió a la primera semana
 * del siguiente, por ejemplo) no se pierde: baja a la lista de «sin día en este
 * mes» junto con las que todavía no tienen fecha. Dibujarle una casilla a un
 * día que no es de este mes confundiría más de lo que ayuda.
 */
export function seccionCalendario(piezas: PiezaEntregable[], periodo: string): string {
  const p = partesPeriodo(periodo);
  if (!p) return '';

  const prefijo = `${periodo}-`;
  const delMes = piezas.filter((x) => x.fechaPublicacion !== null && x.fechaPublicacion.startsWith(prefijo));
  const fuera = piezas.filter((x) => x.fechaPublicacion === null || !x.fechaPublicacion.startsWith(prefijo))
    .sort((a, b) => a.numero - b.numero);

  const diasEnMes = new Date(Date.UTC(p.anio, p.mes, 0)).getUTCDate();
  // getUTCDay() da 0 para domingo; la semana empieza en lunes, así que se corre.
  const desplazamiento = (new Date(Date.UTC(p.anio, p.mes - 1, 1)).getUTCDay() + 6) % 7;

  const cabezas = DIAS_SEMANA.map(([corta, larga]) =>
    `<div class="calendario-dia-nombre" role="columnheader"><abbr title="${escapar(larga)}">${escapar(corta)}</abbr></div>`).join('');

  const huecos = Array.from({ length: desplazamiento }, () => '<div class="dia vacio" aria-hidden="true"></div>').join('');

  const celdas = Array.from({ length: diasEnMes }, (_, i) => {
    const dia = i + 1;
    const clave = `${periodo}-${String(dia).padStart(2, '0')}`;
    const delDia = delMes.filter((x) => x.fechaPublicacion === clave).sort((a, b) => a.numero - b.numero);
    const finDeSemana = (desplazamiento + i) % 7 >= 5;
    return `<div class="dia${finDeSemana ? ' fin-de-semana' : ''}">
      <span class="dia-numero">${dia}</span>
      ${delDia.map(piezaDelDia).join('')}
    </div>`;
  }).join('');

  const sueltas = fuera.length
    ? `<div class="pila">
        <h3 class="subtitulo">Sin día en este mes</h3>
        <p class="suave">${fuera.length === 1 ? 'Una pieza todavía no tiene fecha dentro de ' : `${fuera.length} piezas todavía no tienen fecha dentro de `}${escapar(nombreMes(periodo))}.</p>
        <div class="sin-fecha">${fuera.map(piezaDelDia).join('')}</div>
      </div>`
    : '';

  return `<section class="seccion alterna" id="calendario" data-seccion>
    ${encabezadoSeccion('02', 'Calendario', 'Cada pieza en su día. Toca una para ir a su tarjeta.')}
    <div class="calendario" role="grid" aria-label="Calendario de ${escapar(nombrePeriodo(periodo))}">
      ${cabezas}${huecos}${celdas}
    </div>
    <div class="leyenda">
      ${(Object.keys(FORMATO) as Formato[]).map((f) => `<span class="leyenda-item">${FORMATO[f].icono}${escapar(FORMATO[f].texto)}</span>`).join('')}
      ${(['pendiente', 'aprobada', 'cambios'] as EstadoRevision[]).map((e) => `<span class="leyenda-item"><span class="leyenda-punto ${e}"></span>${escapar(ESTADO[e])}</span>`).join('')}
    </div>
    ${sueltas}
  </section>`;
}
