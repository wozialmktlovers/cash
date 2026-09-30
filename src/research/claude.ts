import { pedirJsonAnthropic } from './proveedores/anthropic';
import { pedirJsonOpenAI } from './proveedores/openai';
import {
  MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO, extraerJson, SISTEMA_CORRECCION,
  type PedirJsonOpts, type ResultadoJson,
} from './proveedores/comun';

/**
 * Fachada de `pedirJson`. Todos los agentes (`src/research/agents/*.ts`,
 * `src/growth/agents/*.ts`, `src/contenido/mes/agente.ts`,
 * `src/contenido/agentes.ts`, `src/pilares/agentes.ts`) siguen importando
 * `pedirJson` de aquí, con la misma firma de siempre: no saben ni necesitan
 * saber qué proveedor de IA atiende la petición.
 *
 * La implementación real vive en `./proveedores/anthropic.ts` (el código que
 * ya corría en producción, sin cambios de comportamiento) y en
 * `./proveedores/openai.ts` (nuevo). Esta fachada solo decide cuál de las dos
 * llamar, según `PROVEEDOR_IA`.
 */

export type { ResultadoJson } from './proveedores/comun';
export { extraerJson, MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO, SISTEMA_CORRECCION };

type Proveedor = 'anthropic' | 'openai';

function normalizar(v: string | undefined): Proveedor | undefined {
  const t = (v ?? '').trim().toLowerCase();
  if (t === 'openai') return 'openai';
  if (t === 'anthropic') return 'anthropic';
  return undefined; // vacío, no definida o con un valor que no reconocemos
}

/**
 * Qué proveedor atiende esta llamada.
 *
 * - `PROVEEDOR_IA` es la variable global: "anthropic" (por omisión) u
 *   "openai". Alcanza para el caso de uso pedido (correr todo un lado contra
 *   el otro para comparar calidad).
 * - `PROVEEDOR_IA_BUSQUEDA`, siguiendo el mismo patrón de override por grupo
 *   que ya existe con `MODEL_BUSQUEDA`, manda SOLO cuando `buscarWeb` es
 *   true (las cuatro etapas de investigación con búsqueda web), por si hace
 *   falta mezclar proveedores en vez de cambiar todo de golpe. No hay un
 *   `PROVEEDOR_IA_SYNTHESIS` ni equivalentes por ahora: no complicar de más
 *   cuando `PROVEEDOR_IA` global ya cubre el caso de uso.
 * - Cualquier valor que no sea exactamente "openai" (vacía, typo, no
 *   definida) cae en "anthropic": el comportamiento de hoy no debe romperse
 *   por un descuido en la configuración.
 */
export function elegirProveedor(buscarWeb: boolean): Proveedor {
  const porGrupo = buscarWeb ? normalizar(process.env.PROVEEDOR_IA_BUSQUEDA) : undefined;
  return porGrupo ?? normalizar(process.env.PROVEEDOR_IA) ?? 'anthropic';
}

export async function pedirJson<T>(opts: PedirJsonOpts<T>): Promise<ResultadoJson<T>> {
  const proveedor = elegirProveedor(opts.buscarWeb ?? false);
  return proveedor === 'openai' ? pedirJsonOpenAI(opts) : pedirJsonAnthropic(opts);
}
