import type { Investigacion, Sintesis } from '@/research/schemas';
import { lecturaSchema } from '@/research/schemas';
import type { OpcionesBarra } from '@/render/barra-operador';
import type { FlujoDatos } from '@/render/editorial/flujo-cliente';
import { envolverDocumento } from '@/render/editorial/comunes';
import { SCRIPT_EDITORIAL } from '@/render/editorial/interaccion';
import { ESTILOS_INVESTIGACION } from './estilos';
import { seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos } from './lectura';
import { seccionDetalle, sintesisEditorial } from './detalle';

export type MetaInvestigacion = { cliente: string; giro: string; fecha: string };

/**
 * Alias histórico: la interacción (tema, pestañas, índice activo,
 * apariciones e impresión) ahora vive en la base editorial compartida,
 * `SCRIPT_EDITORIAL`, y `envolverDocumento` ya la incluye. Se conserva este
 * nombre porque el link público suelto y otro código siguen esperándolo.
 */
export const SCRIPT_DOCUMENTO = SCRIPT_EDITORIAL;

export function renderizarInvestigacion(
  inv: Investigacion,
  meta: MetaInvestigacion,
  operador?: OpcionesBarra,
  editable = false,
  flujo?: FlujoDatos,
  anclas = false,
): string {
  // No basta con `estado === 'ok'`: los datos guardados pudieron venir de un
  // esquema anterior (v1, sin `cifras`) o llegar corruptos. Si no cumplen el
  // esquema actual, se usa el respaldo en vez de tronar a media renderización.
  const lecturaCruda = inv.lectura?.estado === 'ok' ? inv.lectura.datos : null;
  const parseoLectura = lecturaCruda ? lecturaSchema.safeParse(lecturaCruda) : null;
  const lectura = parseoLectura?.success ? parseoLectura.data : null;
  const sintesis: Sintesis | null = inv.sintesis.estado === 'ok' ? inv.sintesis.datos : null;
  const eyebrow = `Investigación de mercado · ${meta.fecha}`;

  // Sin lectura, el detalle numera según lo que de verdad hay antes: 01 si
  // hay síntesis, si no directamente 01 él mismo. Nunca un salto de 01 a 04.
  const numDetalleRespaldo = sintesis ? '02' : '01';

  const indice: [string, string, string][] = lectura
    ? [['01', 'descubrimos', 'Qué descubrimos'], ['02', 'cliente-ideal', 'Tu cliente ideal'], ['03', 'recomendamos', 'Qué te recomendamos'], ['04', 'detalle', 'Detalle']]
    : [...(sintesis ? [['01', 'sintesis', 'Lo más importante'] as [string, string, string]] : []), [numDetalleRespaldo, 'detalle', 'Detalle']];

  const cuerpo = lectura
    ? [
        seccionPortada({ eyebrow, titular: lectura.portada.titular, resumen: lectura.portada.resumen, cifras: lectura.cifras, conIndice: true, editable, anclas }),
        seccionDescubrimos(lectura, editable, anclas),
        seccionClienteIdeal(lectura, editable, anclas),
        seccionRecomendamos(lectura, editable, anclas),
        seccionDetalle(inv, meta.cliente, '04', editable, anclas),
      ].join('\n')
    : [
        seccionPortada({ eyebrow, titular: meta.cliente, resumen: meta.giro, cifras: [], conIndice: false, editable: false }),
        sintesisEditorial(sintesis, '01', editable, anclas),
        seccionDetalle(inv, meta.cliente, numDetalleRespaldo, editable, anclas),
      ].join('\n');

  return envolverDocumento({
    titulo: `Investigación · ${meta.cliente} · ${meta.giro}`,
    etiqueta: 'Investigación',
    cliente: meta.cliente,
    fecha: meta.fecha,
    estilos: ESTILOS_INVESTIGACION,
    indice,
    cuerpo,
    operador,
    flujo,
  });
}
