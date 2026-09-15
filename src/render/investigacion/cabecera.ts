import type { OpcionesBarra } from '@/render/barra-operador';
import { cabeceraDocumento as cabeceraEditorial, SCRIPT_CABECERA } from '@/render/editorial/cabecera';
import type { MetaInvestigacion } from './documento';

export { SCRIPT_CABECERA };

/**
 * Cabecera de la investigación: envoltorio delgado sobre la base editorial
 * (`src/render/editorial/cabecera.ts`) con la etiqueta fija «Investigación».
 */
export function cabeceraDocumento(meta: MetaInvestigacion, operador?: OpcionesBarra): string {
  return cabeceraEditorial({ etiqueta: 'Investigación', cliente: meta.cliente, operador });
}
