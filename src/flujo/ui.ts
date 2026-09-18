// Reglas puras para decidir qué botones se muestran en la línea de etapas de
// la ficha (spec §3, sección UI de la tarjeta). No toca la base de datos: el
// llamador (la página) ya cargó la etapa, el rol, los comentarios abiertos y
// si hay investigación con datos, y aquí solo se decide, en «modo prueba»,
// qué acciones de `aplicarAccion` pasarían — así la interfaz nunca ofrece un
// botón que el servidor fuera a rechazar por rol o por estado.

import {
  aplicarAccion, dependenciasCumplidas,
  type Accion, type Estado, type EtapaCliente, type Rol,
} from './reglas';

export type ColorEstado = 'gris' | 'azul' | 'amarillo' | 'rosa' | 'verde';

/** Color del chip de estado (spec §3: gris, azul, amarillo, rosa, verde, en el orden de ESTADOS). */
export const COLOR_ESTADO: Record<Estado, ColorEstado> = {
  no_iniciada: 'gris',
  en_proceso: 'azul',
  en_revision: 'amarillo',
  con_cambios: 'rosa',
  aprobada: 'verde',
};

export type MarcaEtapa = 'interna' | 'no_contratada' | null;

/** La marca «Interna» o «No contratada» de la tarjeta; null si está contratada y no es interna. */
export function marcaEtapa(e: Pick<EtapaCliente, 'contratada' | 'interna'>): MarcaEtapa {
  if (e.interna) return 'interna';
  if (!e.contratada) return 'no_contratada';
  return null;
}

export type BotonEtapa =
  | { id: 'generar' }
  | { id: 'iniciar' }
  | { id: 'ver' }
  | { id: 'solicitar'; disabled: boolean; razon: string }
  | { id: 'aprobar'; disabled: boolean; razon: string }
  | { id: 'pedir_cambios'; requiereComentario: boolean }
  | { id: 'reabrir' };

/**
 * Botones de la tarjeta de una etapa, ya filtrados por lo que ese usuario
 * puede hacer ahora mismo. `desarrollo_mensual` nunca trae botones (tarjeta
 * «Próximamente»).
 *
 * Para «Pedir cambios» y «Reabrir», que piden un comentario general en un
 * `dialog`, la prueba usa un comentario de relleno no vacío: el contenido
 * real lo escribe el usuario al enviar, así que aquí solo importa si el rol
 * y el estado dejan pasar la acción (el `dialog` decide después si el
 * textarea es obligatorio, espejando la regla del servidor).
 *
 * Para «Solicitar autorización», el brief pide una excepción: si lo único
 * que bloquea la acción son los comentarios abiertos, el botón se muestra
 * igual, pero deshabilitado y con la razón — no se oculta como el resto.
 *
 * Autorización en un paso: un admin, en `en_proceso`/`con_cambios`, ve
 * «Autorizar» (`aprobar`) directamente y NO «Solicitar autorización» —
 * pedirse permiso a sí mismo sobraba, y era justo lo que hacía parecer que
 * el botón de autorizar no existía. `aplicarAccion` le exige lo mismo que a
 * `solicitar`, así que aquí se aplica la misma excepción: si solo lo frenan
 * los comentarios abiertos, se muestra deshabilitado con la razón. El
 * operador no cambia: sigue viendo «Solicitar autorización».
 */
export function botonesEtapa(o: {
  etapa: EtapaCliente;
  rol: Rol;
  esOperadorAsignado: boolean;
  comentariosAbiertos: number;
  hayInvestigacionConDatos: boolean;
  etapasCliente: EtapaCliente[];
}): BotonEtapa[] {
  const { etapa, rol, esOperadorAsignado, comentariosAbiertos, hayInvestigacionConDatos, etapasCliente } = o;
  if (etapa.etapa === 'desarrollo_mensual') return [];

  const dependencias = dependenciasCumplidas(etapa.etapa, etapasCliente, hayInvestigacionConDatos);
  const prueba = (accion: Accion, comentariosAbiertosPrueba: number, comentarioGeneral: string) =>
    aplicarAccion({ etapa, accion, rol, esOperadorAsignado, comentariosAbiertos: comentariosAbiertosPrueba, comentarioGeneral, dependencias });

  const botones: BotonEtapa[] = [];

  if (dependencias.ok) botones.push({ id: 'generar' });
  if (prueba('iniciar', comentariosAbiertos, '').ok) botones.push({ id: 'iniciar' });
  if (etapa.documentoId) botones.push({ id: 'ver' });

  const autorizaDirecto = rol === 'admin' && (etapa.estado === 'en_proceso' || etapa.estado === 'con_cambios');

  if (!autorizaDirecto) {
    const solicitarReal = prueba('solicitar', comentariosAbiertos, '');
    if (solicitarReal.ok) {
      botones.push({ id: 'solicitar', disabled: false, razon: '' });
    } else {
      const solicitarSinComentarios = prueba('solicitar', 0, '');
      if (solicitarSinComentarios.ok) botones.push({ id: 'solicitar', disabled: true, razon: solicitarReal.razon });
    }
  }

  const aprobarReal = prueba('aprobar', comentariosAbiertos, '');
  if (aprobarReal.ok) {
    botones.push({ id: 'aprobar', disabled: false, razon: '' });
  } else if (autorizaDirecto && prueba('aprobar', 0, '').ok) {
    botones.push({ id: 'aprobar', disabled: true, razon: aprobarReal.razon });
  }
  if (prueba('pedir_cambios', comentariosAbiertos, 'x').ok) {
    botones.push({ id: 'pedir_cambios', requiereComentario: comentariosAbiertos <= 0 });
  }
  if (prueba('reabrir', comentariosAbiertos, 'x').ok) botones.push({ id: 'reabrir' });

  return botones;
}
