import type { MapaPilares } from '@/pilares/schemas';
import type { OpcionesBarra } from '@/render/barra-operador';
import type { AvanceTema } from '@/pilares/avance';
import { todosLosTemas } from '@/pilares/revision';
import { envolverDocumento } from '@/render/editorial/comunes';
import { ESTILOS_PILARES } from './estilos';
import { seccionPortada, seccionPartida, seccionPrincipios, seccionPilares, seccionMix, seccionConversion, seccionCierre } from './secciones';
import { seccionBanco } from './banco';
import { SCRIPT_PILARES } from './script';

export { SCRIPT_PILARES };

export type MetaPilares = { cliente: string; fecha: string };
export type OpcionesPilares = { operador?: OpcionesBarra; avance?: Record<string, AvanceTema>; resultId?: string };

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

  const cuerpo = [
    seccionPortada({ cliente: meta.cliente, fecha: meta.fecha, resumen: mapa.estrategia.resumen, totalTemas: temas.length, avanceGlobal }),
    seccionPartida(mapa.estrategia),
    seccionPrincipios(mapa.estrategia),
    seccionPilares(mapa.estrategia),
    seccionMix(mapa.estrategia, interna, interna ? mapa.revision.mixReal : null, interna ? mapa.revision.fueraDeMargen : []),
    seccionConversion(mapa.estrategia),
    seccionBanco({ mapa, interna, clienteId: opciones?.operador?.clienteId, avance: opciones?.avance, resultId: opciones?.resultId }),
    seccionCierre(mapa.estrategia, interna),
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
  });
}
