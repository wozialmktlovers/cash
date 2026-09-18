import type { MapaPilares } from '@/pilares/schemas';
import type { OpcionesBarra } from '@/render/barra-operador';
import type { AvanceTema } from '@/pilares/avance';
import type { FlujoDatos } from '@/render/editorial/flujo-cliente';
import { todosLosTemas } from '@/pilares/revision';
import { envolverDocumento } from '@/render/editorial/comunes';
import { ESTILOS_PILARES } from './estilos';
import { seccionPortada, seccionPartida, seccionPrincipios, seccionPilares, seccionMix, seccionConversion, seccionCierre } from './secciones';
import { seccionBanco } from './banco';
import { SCRIPT_PILARES } from './script';

export { SCRIPT_PILARES };

export type MetaPilares = {
  cliente: string; fecha: string;
  /**
   * Destino del logo de la cabecera: `/` en la vista interna, el `/portal`
   * de quien mira en el portal. Ausente en el enlace público (`/p/...`), donde
   * el logo queda sin enlace — ver `cabeceraDocumento`.
   */
  inicio?: string;
};
export type OpcionesPilares = {
  operador?: OpcionesBarra;
  avance?: Record<string, AvanceTema>;
  resultId?: string;
  /** Solo en la vista interna: marca `data-editable` en el texto de la estrategia y del banco. */
  editable?: boolean;
  /** Solo en la vista interna: marca `data-ancla` en secciones, tarjetas y temas (B7, spec §3). Nunca en `/p/...`. */
  anclas?: boolean;
  flujo?: FlujoDatos;
  /**
   * Enlace «← Mi portal» — solo en el portal del cliente (C2, spec §4).
   * `vistaPrevia` (fix menores, punto 3) agrega la banda de aviso para
   * admin/operador previsualizando el documento del cliente.
   */
  volver?: { href: string; texto: string; vistaPrevia?: boolean };
};

const INDICE: [string, string, string][] = [
  ['01', 'partida', 'Punto de partida'],
  ['02', 'principios', 'No negociables'],
  ['03', 'pilares', 'Los 5 pilares'],
  ['04', 'mix', 'Mix editorial'],
  ['05', 'conversion', 'Conversión'],
  ['06', 'banco', 'Banco de temas'],
];

/**
 * Documento del mapa de pilares: estrategia, banco de 300 temas filtrable y,
 * en la vista interna (cuando llega `operador`), avance por tema con
 * guardado por PATCH. Sin `operador` es exactamente lo que ve el cliente por
 * el link público: sin estados, notas, emails ni supuestos.
 */
export function renderizarPilares(mapa: MapaPilares, meta: MetaPilares, opciones?: OpcionesPilares): string {
  const interna = Boolean(opciones?.operador);
  const temas = todosLosTemas(mapa.pilares);

  const avanceGlobal = interna
    ? {
        total: temas.length,
        hechos: temas.filter((t) => {
          const e = opciones?.avance?.[t.id]?.estado;
          return e === 'desarrollado' || e === 'publicado';
        }).length,
      }
    : null;

  const editable = Boolean(opciones?.editable);
  const anclas = Boolean(opciones?.anclas);

  const cuerpo = [
    seccionPortada({ cliente: meta.cliente, fecha: meta.fecha, resumen: mapa.estrategia.resumen, totalTemas: temas.length, avanceGlobal, editable, anclas }),
    seccionPartida(mapa.estrategia, editable, anclas),
    seccionPrincipios(mapa.estrategia, editable, anclas),
    seccionPilares(mapa.estrategia, editable, anclas),
    // `mapa.revision` puede faltar en un dato viejo o corrupto: con
    // encadenamiento opcional se trata como si no hubiera revisión que
    // mostrar, en vez de tronar con un 500 (fix menores, punto 1).
    seccionMix(mapa.estrategia, interna, interna ? (mapa.revision?.mixReal ?? null) : null, interna ? (mapa.revision?.fueraDeMargen ?? []) : [], editable, anclas),
    seccionConversion(mapa.estrategia, editable, anclas),
    seccionBanco({ mapa, interna, clienteId: opciones?.operador?.clienteId, avance: opciones?.avance, resultId: opciones?.resultId, editable, anclas }),
    seccionCierre(mapa.estrategia, interna, editable),
  ].join('\n');

  return envolverDocumento({
    titulo: `Mapa de pilares · ${meta.cliente}`,
    etiqueta: 'Mapa de pilares',
    cliente: meta.cliente,
    fecha: meta.fecha,
    estilos: ESTILOS_PILARES,
    indice: INDICE,
    cuerpo,
    operador: opciones?.operador,
    scriptsExtra: SCRIPT_PILARES,
    flujo: opciones?.flujo,
    volver: opciones?.volver,
    inicio: meta.inicio,
  });
}
