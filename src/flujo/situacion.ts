// Qué pasó con una etapa, quién lo hizo, cuándo y qué le toca ahora a quien
// mira. Reglas puras, sin base de datos: la página ya trajo la etapa, el
// último evento que la dejó en su estado (`eventosDeEntrada`,
// src/flujo/servicio.ts) y el responsable del cliente, y aquí solo se decide
// el texto.
//
// **Una sola fuente para las cuatro pantallas** que hablan de esto: la tarjeta
// de la etapa en la ficha (`LineaEtapas.astro`), «Te toca a ti» y «Estado de
// las entregas» del Inicio, y `/pendientes`. El dueño presentó el sistema y lo
// que no se entendía era justo esto: el chip decía «En revisión» igual al que
// había pedido la autorización que al que tenía que darla. Si cada pantalla
// armara su frase, volverían a decir cosas distintas del mismo estado.
//
// El estado en la base NO cambia: esto es solo la etiqueta. Y la etapa
// `desarrollo_mensual` no pasa por aquí más que para su texto de siempre: su
// `en_revision` significa «se le compartió el mes al cliente», no «espera al
// admin» (ver `esperaAutorizacionDelAdmin`, src/lib/pendientes.ts), y no se
// le inventa un flujo de autorización que no tiene.

import { ETIQUETA_ESTADO_ETAPA, type Estado, type Etapa } from './reglas';
import { COLOR_ESTADO, type ColorEstado } from './ui';
import { ZONA_MX } from '@/lib/ui/fecha';

const ETAPA_MENSUAL: Etapa = 'desarrollo_mensual';

/**
 * El evento que dejó a la etapa en su estado actual: el último de
 * `etapa_eventos` cuyo `a` es el estado de hoy (ver `eventosDeEntrada`). El
 * `autor` ya viene con `nombreVisible`; es `null` si el evento no tiene
 * usuario (lo hizo el sistema, o la cuenta se borró).
 */
export type EventoEntrada = {
  accion: string;
  usuarioId: string | null;
  autor: string | null;
  creadoEn: Date;
  comentario: string | null;
};

/** Quién está mirando. El cliente nunca ve estas pantallas. */
export type Mirada = { rol: 'admin' | 'operador'; usuarioId: string };

export type EntradaSituacion = {
  etapa: Etapa;
  estado: Estado;
  actualizadoEn: Date;
  evento: EventoEntrada | null;
  /** Responsable del cliente, ya con `nombreVisible`; `null` si no tiene. */
  operador: string | null;
  /** Comentarios abiertos de primer nivel de la etapa. */
  comentariosAbiertos: number;
};

export type Situacion = {
  /** Texto del chip. */
  chip: string;
  color: ColorEstado;
  /** Le toca actuar a quien mira: el chip va lleno y el recuadro resaltado. */
  destacada: boolean;
  /** El recuadro bajo el chip: qué pasó, quién, cuándo y qué sigue. */
  recuadro: string | null;
  /** Una línea para las listas (Inicio y `/pendientes`). */
  resumen: string;
  /** `con_cambios` a la que se llegó reabriendo una etapa ya autorizada. */
  reabierta: boolean;
};

// ── Fechas ──────────────────────────────────────────────────────────────

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

const anioMx = (d: Date) => new Intl.DateTimeFormat('es-MX', { year: 'numeric', timeZone: ZONA_MX }).format(d);

/** «17 sep», y «17 sep 2025» si no es de este año. En hora de México. */
export function diaCorto(fecha: Date, ahora: Date): string {
  const mismoAnio = anioMx(fecha) === anioMx(ahora);
  return fecha.toLocaleDateString('es-MX', {
    day: 'numeric', month: 'short', ...(mismoAnio ? {} : { year: 'numeric' }), timeZone: ZONA_MX,
  });
}

/**
 * Cuándo pasó, como se dice en voz alta: «hace un momento», «hace 5 minutos»,
 * «hace 3 horas» y, pasado un día, «el 17 sep». Una fecha en el futuro (reloj
 * desfasado entre servidor y base) cuenta como «hace un momento».
 */
export function cuando(fecha: Date, ahora: Date): string {
  const ms = ahora.getTime() - fecha.getTime();
  if (ms < MINUTO) return 'hace un momento';
  if (ms < HORA) {
    const n = Math.floor(ms / MINUTO);
    return n === 1 ? 'hace 1 minuto' : `hace ${n} minutos`;
  }
  if (ms < DIA) {
    const n = Math.floor(ms / HORA);
    return n === 1 ? 'hace 1 hora' : `hace ${n} horas`;
  }
  return `el ${diaCorto(fecha, ahora)}`;
}

// ── Piezas de las frases ────────────────────────────────────────────────

const LARGO_CITA = 160;

/** El comentario del evento entre comillas, en un renglón y recortado. `null` si no hay. */
export function cita(comentario: string | null | undefined): string | null {
  const limpio = (comentario ?? '').replace(/\s+/g, ' ').trim();
  if (!limpio) return null;
  const corto = limpio.length > LARGO_CITA ? `${limpio.slice(0, LARGO_CITA - 1).trimEnd()}…` : limpio;
  return `«${corto}»`;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Quién hizo el evento, visto por quien mira: `'ti'` si fue él mismo, su
 * nombre si se sabe, `null` si no hay evento o no tiene autor. Nunca se
 * inventa un nombre: sin autor, la frase se dice sin él.
 */
function autorPara(evento: EventoEntrada | null, mirada: Mirada): 'ti' | string | null {
  if (!evento) return null;
  if (evento.usuarioId && evento.usuarioId === mirada.usuarioId) return 'ti';
  return evento.autor;
}

/** «Pediste» / «Ana pidió» / «Se pidió», según quién. */
function sujetoVerbo(autor: 'ti' | string | null, tu: string, el: string, impersonal: string): string {
  if (autor === 'ti') return tu;
  if (autor) return `${autor} ${el}`;
  return impersonal;
}

/**
 * Cierra la frase con punto, salvo que la cita ya termine en uno: «… del de
 * mantenimiento.». se leía con puntuación doble.
 */
const punto = (frase: string) => (/[.!?…]»$/.test(frase) ? frase : `${frase}.`);

/**
 * Una frase que pasa a ir detrás de un «·»: «Pediste cambios…» se vuelve
 * «pediste cambios…», pero un nombre propio («Carlos Ruiz pidió…») no se toca.
 */
const enMedio = (frase: string) => (/^(Pediste|Reabriste|Se |El cliente)/.test(frase) ? `${frase[0].toLowerCase()}${frase.slice(1)}` : frase);

/** «: «comentario»» si lo hay; nada si no. Para pegar tras el cuándo. */
const conCita = (comentario: string | null) => {
  const c = cita(comentario);
  return c ? `: ${c}` : '';
};

// ── La situación ────────────────────────────────────────────────────────

/**
 * Chip, recuadro y resumen de una etapa para quien mira.
 *
 * | Estado        | Admin                                   | Operador                           |
 * |---------------|-----------------------------------------|------------------------------------|
 * | en_proceso    | «En proceso · lo lleva {operador}»      | «En tu mesa»                       |
 * | en_revision   | «Espera tu autorización» (le toca)      | «Enviada a autorización»           |
 * | con_cambios   | «Cambios pedidos · esperando a {op.}»   | «Tienes cambios por hacer» (le toca)|
 * | reabierta     | «Reabriste la etapa» / «{N} reabrió…»   | «{N} reabrió la etapa» (le toca)   |
 * | aprobada      | «Autorizada por {ti/N} el {fecha}»      | «Autorizada por {N} el {fecha}»    |
 *
 * El evento solo se usa si es el que corresponde al estado (un `solicitar`
 * para `en_revision`, un `aprobar` para `aprobada`…): si falta o es otro, la
 * frase se queda sin nombre y sin fecha, en vez de atribuirle a alguien algo
 * que no hizo.
 */
export function situacionEtapa(e: EntradaSituacion, mirada: Mirada, ahora: Date): Situacion {
  const base: Situacion = {
    chip: ETIQUETA_ESTADO_ETAPA[e.estado],
    color: COLOR_ESTADO[e.estado],
    destacada: false,
    recuadro: null,
    resumen: ETIQUETA_ESTADO_ETAPA[e.estado],
    reabierta: false,
  };
  const esAdmin = mirada.rol === 'admin';

  // El mes tiene su propio flujo (lote, cliente, plazo): aquí solo se le pone
  // en palabras lo que su estado ya dice, sin autorizaciones de por medio.
  if (e.etapa === ETAPA_MENSUAL) {
    if (e.estado === 'en_revision') return { ...base, resumen: 'Compartido: espera la respuesta del cliente' };
    if (e.estado === 'con_cambios') return { ...base, resumen: 'El cliente pidió cambios' };
    if (e.estado === 'aprobada') return { ...base, resumen: 'Mes aprobado' };
    return base;
  }

  const ev = e.evento;
  const hace = ev ? cuando(ev.creadoEn, ahora) : null;

  switch (e.estado) {
    case 'no_iniciada':
      return base;

    case 'en_proceso': {
      if (esAdmin) {
        const chip = e.operador ? `En proceso · lo lleva ${e.operador}` : 'En proceso';
        return { ...base, chip, resumen: chip };
      }
      return {
        ...base,
        chip: 'En tu mesa',
        recuadro: 'Cuando esté listo, pide autorización.',
        resumen: `En tu mesa desde ${cuando(e.actualizadoEn, ahora)}`,
      };
    }

    case 'en_revision': {
      const solicitud = ev?.accion === 'solicitar' ? ev : null;
      const autor = autorPara(solicitud, mirada);
      const cuandoSolicitud = solicitud ? ` ${hace}` : '';
      if (esAdmin) {
        // Sin evento `solicitar` no hay a quién nombrar ni fecha que dar.
        const quePaso = !solicitud
          ? 'Esta etapa espera tu autorización.'
          : autor === 'ti'
            ? `Pediste autorización${cuandoSolicitud}.`
            : autor
              ? `${autor} te pidió autorización${cuandoSolicitud}.`
              : `Te pidieron autorización${cuandoSolicitud}.`;
        const resumen = !solicitud
          ? `Espera tu autorización desde ${cuando(e.actualizadoEn, ahora)}`
          : quePaso.replace(/\.$/, '');
        return {
          ...base,
          chip: 'Espera tu autorización',
          color: 'rosa',
          destacada: true,
          recuadro: `${quePaso} Revisa el documento y autorízalo o pide cambios.`,
          resumen,
        };
      }
      const quePaso = !solicitud
        ? ''
        : `${sujetoVerbo(autor, 'Pediste', 'pidió', 'Se pidió')} autorización${cuandoSolicitud}. `;
      return {
        ...base,
        chip: 'Enviada a autorización',
        recuadro: `${quePaso}Esperando a que un admin la revise.`,
        resumen: solicitud ? `Enviada a autorización ${hace}` : 'Enviada a autorización',
      };
    }

    case 'con_cambios': {
      const accion = ev?.accion ?? null;
      const autor = autorPara(ev, mirada);
      const porAtender = e.comentariosAbiertos > 0
        ? `${plural(e.comentariosAbiertos, 'comentario', 'comentarios')} por atender.`
        : 'Cuando esté listo, vuelve a pedir autorización.';
      const esperando = e.operador ? `esperando a ${e.operador}` : null;

      if (accion === 'reabrir') {
        const quien = sujetoVerbo(autor, 'Reabriste', 'reabrió', 'Se reabrió');
        const quePaso = punto(`${quien} la etapa ${hace}${conCita(ev!.comentario)}`);
        if (esAdmin) {
          const chip = autor === 'ti' ? 'Reabriste la etapa' : autor ? `${autor} reabrió la etapa` : 'Etapa reabierta';
          return {
            ...base, chip, reabierta: true,
            recuadro: esperando ? `${quePaso} Ahora está ${esperando}.` : quePaso,
            resumen: `${quien} la etapa ${hace}${esperando ? ` · ${esperando[0].toUpperCase()}${esperando.slice(1)}` : ''}`,
          };
        }
        return {
          ...base,
          chip: autor && autor !== 'ti' ? `${autor} reabrió la etapa` : 'Etapa reabierta',
          destacada: true, reabierta: true,
          recuadro: `${quePaso} ${porAtender}`,
          resumen: `${quien} la etapa ${hace}`,
        };
      }

      // Lo que pasó, en una frase, según cómo llegó la etapa a `con_cambios`.
      // Sin evento conocido no se cuenta nada: el chip ya dice el estado.
      let quePaso: string | null = null;
      if (accion === 'pedir_cambios') {
        quePaso = punto(`${sujetoVerbo(autor, 'Pediste', 'pidió', 'Se pidieron')} cambios ${hace}${conCita(ev!.comentario)}`);
      } else if (accion === 'generado') {
        quePaso = `Se generó una versión nueva ${hace} sobre una ya autorizada: hay que volver a autorizarla.`;
      } else if (accion === 'comentario_cliente') {
        quePaso = `${autor && autor !== 'ti' ? autor : 'El cliente'} dejó observaciones ${hace} sobre la versión autorizada.`;
      }
      const lineaQuePaso = quePaso ? quePaso.replace(/: «.*»\.?$/, '').replace(/\.$/, '') : null;

      if (esAdmin) {
        const chip = esperando ? `Cambios pedidos · ${esperando}` : 'Cambios pedidos';
        const cabeza = esperando ? `${esperando[0].toUpperCase()}${esperando.slice(1)}` : 'Cambios pedidos';
        return {
          ...base, chip,
          recuadro: quePaso,
          resumen: lineaQuePaso ? `${cabeza} · ${enMedio(lineaQuePaso)}` : cabeza,
        };
      }
      return {
        ...base,
        chip: 'Tienes cambios por hacer',
        destacada: true,
        recuadro: quePaso ? `${quePaso} ${porAtender}` : porAtender,
        resumen: lineaQuePaso ? `Tienes cambios por hacer · ${lineaQuePaso}` : 'Tienes cambios por hacer',
      };
    }

    case 'aprobada': {
      const autorizacion = ev?.accion === 'aprobar' ? ev : null;
      const autor = autorPara(autorizacion, mirada);
      const el = autorizacion ? ` el ${diaCorto(autorizacion.creadoEn, ahora)}` : '';
      const chip = !autorizacion
        ? 'Autorizada'
        : autor === 'ti'
          ? `Autorizada por ti${el}`
          : autor
            ? `Autorizada por ${autor}${el}`
            : `Autorizada${el}`;
      return { ...base, chip, resumen: chip };
    }
  }
}

/**
 * Lo que pidió el cliente, en los dos pasos donde puede opinar (manual de
 * campaña y desarrollo mensual, `puedeComentar`). `null` si no pidió nada: el
 * recuadro no se pinta.
 */
export function avisoCliente(o: { etapa: Etapa; cliente: string; observaciones: number; piezasConCambios: number }): string | null {
  if (o.etapa === 'manual_campana' && o.observaciones > 0) {
    return `${o.cliente} dejó ${plural(o.observaciones, 'observación', 'observaciones')}.`;
  }
  if (o.etapa === ETAPA_MENSUAL && o.piezasConCambios > 0) {
    return `${o.cliente} pidió cambios en ${plural(o.piezasConCambios, 'pieza', 'piezas')}.`;
  }
  return null;
}

/** Frase de un comentario pendiente: «Ana (cliente) comentó hace 2 horas». */
export function fraseComentario(
  c: { autorId: string | null; autor: string | null; autorRol: string; creadoEn: Date },
  mirada: Mirada,
  ahora: Date,
): string {
  const hace = cuando(c.creadoEn, ahora);
  if (c.autorId && c.autorId === mirada.usuarioId) return `Comentaste ${hace}`;
  // Sin la cuenta de quien lo dejó no se inventa un nombre; del cliente sí se
  // sabe que fue el cliente, por su rol.
  if (!c.autor) return c.autorRol === 'cliente' ? `El cliente comentó ${hace}` : `Comentario sin atender · ${hace}`;
  return `${c.autor}${c.autorRol === 'cliente' ? ' (cliente)' : ''} comentó ${hace}`;
}

/**
 * Orden de los botones cuando la etapa espera la autorización de quien mira:
 * primero revisar el documento, luego «Autorizar» (el principal) y luego
 * «Pedir cambios»; el resto, detrás y en su orden. Cualquier otro caso se
 * queda como lo decidió `botonesEtapa`.
 *
 * «Generar» se quita en ese caso: es un botón lleno que competía con
 * «Autorizar» por ser el principal, y además no sirve —`puedeGenerar`
 * (src/flujo/reglas.ts) no deja regenerar una etapa `en_revision`, así que el
 * servidor lo rechazaba—.
 */
export function ordenBotones<T extends { id: string }>(botones: T[], estado: Estado, rol: Mirada['rol']): T[] {
  if (rol !== 'admin' || estado !== 'en_revision') return botones;
  const primero = ['ver', 'aprobar', 'pedir_cambios'];
  const rango = (b: T) => {
    const i = primero.indexOf(b.id);
    return i === -1 ? primero.length : i;
  };
  return botones.filter((b) => b.id !== 'generar').sort((a, b) => rango(a) - rango(b));
}

/** Las tres columnas del «Estado de las entregas» del Inicio que salen del estado (la cuarta, «Autorizadas este mes», va por fecha). */
export type ColumnaEntrega = 'autorizacion' | 'cambios' | 'proceso';

/**
 * En qué columna del «Estado de las entregas» (Inicio) va una etapa; `null`
 * si en ninguna de las tres que dependen solo del estado.
 *
 * El mes compartido con el cliente (`desarrollo_mensual` en `en_revision`)
 * va en «En proceso», no en «Esperan autorización»: lo que espera es la
 * respuesta del cliente, no a un admin, y en esa columna parecía una
 * autorización pendiente del equipo. Conserva su frase («Compartido: espera
 * la respuesta del cliente», `situacionEtapa`).
 */
export function columnaEntrega(e: { etapa: Etapa; estado: Estado }): ColumnaEntrega | null {
  if (e.estado === 'en_revision') return e.etapa === ETAPA_MENSUAL ? 'proceso' : 'autorizacion';
  if (e.estado === 'con_cambios') return 'cambios';
  if (e.estado === 'en_proceso') return 'proceso';
  return null;
}

/** El estado de la etapa que corresponde a cada motivo de `listarPendientes`. */
const ESTADO_DE_MOTIVO = {
  en_revision: 'en_revision',
  con_cambios: 'con_cambios',
  en_proceso: 'en_proceso',
  // El mes compartido: `en_revision` del lote, que espera al cliente.
  esperando_cliente: 'en_revision',
} as const satisfies Record<string, Estado>;

/**
 * La misma frase de la tarjeta, para un renglón de `/pendientes` o de «Te toca
 * a ti» (`EtapaPendiente` de src/lib/pendientes.ts encaja tal cual). Solo
 * cambia lo que se dice, nunca qué cuenta como pendiente.
 */
export function situacionPendiente(
  p: {
    motivo: keyof typeof ESTADO_DE_MOTIVO; etapa: Etapa; actualizadoEn: Date;
    evento: EventoEntrada | null; operador: string | null; comentariosAbiertos: number;
  },
  mirada: Mirada,
  ahora: Date,
): Situacion {
  return situacionEtapa({
    etapa: p.etapa, estado: ESTADO_DE_MOTIVO[p.motivo], actualizadoEn: p.actualizadoEn,
    evento: p.evento, operador: p.operador, comentariosAbiertos: p.comentariosAbiertos,
  }, mirada, ahora);
}
