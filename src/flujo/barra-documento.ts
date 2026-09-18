// La barra de acción de la etapa DENTRO del documento (investigación, mapa de
// pilares, manual de campaña). La gente revisa el documento ahí, no en la
// ficha, y ahí no había cómo avanzar la etapa: el dueño lo reportó con el
// manual de campaña de un cliente en `en_proceso` que ni el operador ni el
// admin podían mover sin volver a la ficha.
//
// Reglas puras, sin base de datos. **No decide permisos por su cuenta**: los
// botones salen de `botonesEtapa` (src/flujo/ui.ts), que prueba cada acción
// con `aplicarAccion` —exactamente lo que ve la tarjeta de la ficha—, y las
// frases de `situacionEtapa` (src/flujo/situacion.ts), para que la barra diga
// lo mismo que la tarjeta. Aquí solo se elige qué parte de eso cabe en una
// barra y cómo se ordena.

import { botonesEtapa } from './ui';
import { situacionEtapa, type EventoEntrada, type Mirada } from './situacion';
import { NOMBRE_ETAPA, type EtapaCliente, type Rol } from './reglas';

export type BotonBarra =
  | { id: 'aprobar'; disabled: boolean; razon: string }
  | { id: 'solicitar'; disabled: boolean; razon: string }
  | { id: 'pedir_cambios'; requiereComentario: boolean };

export type BarraEtapa = {
  etapaId: string;
  /** «Manual de campaña», para los diálogos («¿Autorizar «…»?»). */
  etapaNombre: string;
  /**
   * `le-toca`: a quien mira le toca actuar (rosa del sistema, como el chip
   * lleno de la tarjeta). `informa`: estado en curso, sin urgencia.
   * `discreta`: ya autorizada, una línea y nada más.
   */
  tono: 'le-toca' | 'informa' | 'discreta';
  titulo: string;
  detalle: string | null;
  /**
   * Comentarios abiertos que frenan «Solicitar autorización» / «Autorizar»:
   * con más de cero, la barra ofrece «Ir al primero» (el mismo recorrido del
   * aviso de comentarios) y el script la actualiza en vivo al atenderlos.
   */
  comentariosPorAtender: number;
  botones: BotonBarra[];
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «Tienes 2 comentarios por atender»: el mismo texto que arma el script al actualizar el conteo. */
export function textoComentariosPorAtender(n: number): string {
  return `Tienes ${plural(n, 'comentario', 'comentarios')} por atender`;
}

/**
 * La barra para quien mira, o `null` si no lleva ninguna:
 * - el cliente (portal) nunca; el enlace público ni siquiera llega aquí;
 * - `desarrollo_mensual`, que tiene su propia pantalla del mes;
 * - un documento que ya no es el vigente de su etapa: la transición actúa
 *   sobre el vigente, y autorizar desde una versión vieja autorizaría otra;
 * - una etapa `no_iniciada` (no hay nada que avanzar desde el documento).
 */
export function barraEtapaDocumento(o: {
  etapa: EtapaCliente & { actualizadoEn: Date };
  rol: Rol;
  usuarioId: string;
  esOperadorAsignado: boolean;
  esDocumentoVigente: boolean;
  /** Comentarios abiertos de primer nivel de la etapa (`comentariosAbiertosPorEtapa`), igual que la ficha. */
  comentariosAbiertos: number;
  etapasCliente: EtapaCliente[];
  /** El evento que dejó a la etapa en su estado (`eventosDeEntrada`). */
  evento: EventoEntrada | null;
  /** Responsable del cliente, ya con `nombreVisible`. */
  operador: string | null;
  ahora: Date;
}): BarraEtapa | null {
  const { etapa, rol, comentariosAbiertos } = o;
  if (rol === 'cliente') return null;
  if (etapa.etapa === 'desarrollo_mensual') return null;
  if (!o.esDocumentoVigente) return null;
  if (etapa.estado === 'no_iniciada') return null;

  const mirada: Mirada = { rol, usuarioId: o.usuarioId };
  const situacion = situacionEtapa({
    etapa: etapa.etapa, estado: etapa.estado, actualizadoEn: etapa.actualizadoEn,
    evento: o.evento, operador: o.operador, comentariosAbiertos,
  }, mirada, o.ahora);

  const base = { etapaId: etapa.id, etapaNombre: NOMBRE_ETAPA[etapa.etapa] };

  if (etapa.estado === 'aprobada') {
    return { ...base, tono: 'discreta', titulo: situacion.chip, detalle: null, comentariosPorAtender: 0, botones: [] };
  }

  // Los mismos botones que la tarjeta de la ficha. `hayInvestigacionConDatos`
  // solo cuenta para «Generar»/«Iniciar», que la barra no ofrece.
  const todos = botonesEtapa({
    etapa, rol, esOperadorAsignado: o.esOperadorAsignado, comentariosAbiertos,
    hayInvestigacionConDatos: true, etapasCliente: o.etapasCliente,
  });
  // Primero «Autorizar» (el principal), luego «Pedir cambios» o «Solicitar».
  const orden = ['aprobar', 'solicitar', 'pedir_cambios'];
  const botones = todos
    .filter((b): b is BotonBarra => orden.includes(b.id))
    .sort((a, b) => orden.indexOf(a.id) - orden.indexOf(b.id));

  // Si algún botón está frenado solo por comentarios abiertos (la excepción
  // de `botonesEtapa`), la barra lleva al recorrido de comentarios.
  const frenadoPorComentarios = comentariosAbiertos > 0
    && botones.some((b) => (b.id === 'aprobar' || b.id === 'solicitar') && b.disabled);
  const comentariosPorAtender = frenadoPorComentarios ? comentariosAbiertos : 0;

  if (etapa.estado === 'en_revision') {
    return {
      ...base,
      tono: situacion.destacada ? 'le-toca' : 'informa',
      titulo: rol === 'admin' ? situacion.chip : `${situacion.chip} · esperando al admin`,
      detalle: situacion.recuadro,
      comentariosPorAtender: 0,
      botones,
    };
  }

  // en_proceso / con_cambios.
  if (rol === 'operador' && comentariosPorAtender > 0) {
    // El recuadro de la tarjeta cierra con «N comentarios por atender.» (o
    // «Cuando esté listo, pide autorización.» en `en_proceso`): aquí el
    // conteo ya es el título, así que solo queda lo que pasó, si lo hay.
    const quePaso = etapa.estado === 'con_cambios' && situacion.recuadro
      ? situacion.recuadro.replace(/\s*\d+ comentarios? por atender\.$/, '').trim() || null
      : null;
    return {
      ...base, tono: 'le-toca', titulo: textoComentariosPorAtender(comentariosPorAtender),
      detalle: quePaso, comentariosPorAtender, botones,
    };
  }

  return {
    ...base,
    tono: situacion.destacada || botones.some((b) => b.id === 'aprobar' && !b.disabled) ? 'le-toca' : 'informa',
    titulo: situacion.chip,
    detalle: situacion.recuadro,
    comentariosPorAtender,
    botones,
  };
}
