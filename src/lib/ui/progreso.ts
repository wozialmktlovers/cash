// `@/flujo/reglas` es puro (no toca la base ni el SDK), así que este módulo
// puede importarlo y seguir viajando al navegador con ProgresoJob. Las etapas
// de los pipelines, en cambio, sí hay que copiarlas — ver la nota de abajo.
import {
  ETAPAS, avanceCliente, etapasVisiblesCliente,
  type Estado, type EtapaCliente, type Etapa as EtapaFlujo,
} from '@/flujo/reglas';

export type Etapa = { clave: string; titulo: string; detalle: string };

// Se copian aquí y no se importan de los pipelines porque ProgresoJob corre en
// el navegador y los pipelines arrastran la base y el SDK de Anthropic. La
// prueba compara ambas listas para que no se separen.
const INVESTIGACION: Etapa[] = [
  { clave: 'competencia', titulo: 'Competencia', detalle: 'Precios, competidores directos e indirectos, referentes.' },
  { clave: 'audiencia', titulo: 'Audiencia', detalle: 'Jerga, dolores, aspiraciones y dos personas contrastantes.' },
  { clave: 'canales', titulo: 'Canales', detalle: 'Plataformas, formatos, horarios y advertencias regulatorias.' },
  { clave: 'mercado', titulo: 'Mercado', detalle: 'Datos oficiales, salarios, regulación y crecimiento.' },
  { clave: 'sintesis', titulo: 'Síntesis', detalle: 'Decisiones estratégicas. Espera a las cuatro anteriores.' },
  { clave: 'lectura', titulo: 'Lectura para cliente', detalle: 'Versión en lenguaje sencillo para tu cliente. Espera a la síntesis.' },
];

const GROWTH: Etapa[] = [
  { clave: 'estructura', titulo: 'Estructura', detalle: 'Campañas, conjuntos de anuncios y audiencias.' },
  { clave: 'creativos', titulo: 'Creativos', detalle: 'Anuncios por formato con títulos, textos y llamados a la acción.' },
  { clave: 'google', titulo: 'Google', detalle: 'Palabras clave, grupos y anuncios de búsqueda.' },
  { clave: 'prompts', titulo: 'Prompts', detalle: 'Indicaciones de imagen por pieza. Espera a los creativos.' },
];

const PILARES: Etapa[] = [
  { clave: 'estrategia', titulo: 'Estrategia', detalle: 'Idea rectora, principios, pilares y mix.' },
  { clave: 'pilar1', titulo: 'Pilar 1', detalle: 'Sesenta temas en tres subcategorías.' },
  { clave: 'pilar2', titulo: 'Pilar 2', detalle: 'Sesenta temas en tres subcategorías.' },
  { clave: 'pilar3', titulo: 'Pilar 3', detalle: 'Sesenta temas en tres subcategorías.' },
  { clave: 'pilar4', titulo: 'Pilar 4', detalle: 'Sesenta temas en tres subcategorías.' },
  { clave: 'pilar5', titulo: 'Pilar 5', detalle: 'Sesenta temas en tres subcategorías.' },
  { clave: 'revision', titulo: 'Revisión', detalle: 'Temas repetidos y reparto por función.' },
];

export function etapasDe(tipo: string | undefined): Etapa[] {
  return tipo === 'growth' ? GROWTH : tipo === 'pilares' ? PILARES : INVESTIGACION;
}

export function porcentaje(etapas: Record<string, string>, tipo: string | undefined): number {
  const lista = etapasDe(tipo);
  const listas = lista.filter((e) => etapas[e.clave] === 'ok').length;
  return Math.round((listas / lista.length) * 100);
}

export function transcurrido(desde: Date | string | null, hasta: Date): string | null {
  if (!desde) return null;
  const s = Math.max(0, Math.floor((hasta.getTime() - new Date(desde).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  encolado: 'En cola',
  corriendo: 'Corriendo',
  completado: 'Completado',
  fallido: 'Falló',
  cancelado: 'Cancelado',
};

export const ETIQUETA_ETAPA: Record<string, string> = {
  ok: 'Lista',
  corriendo: 'Corriendo',
  fallo: 'Falló',
  omitido_por_costo: 'Omitida por costo',
};

// ---------------------------------------------------------------------------
// Avance del cliente (tablero e Inicio).

/** Lo mínimo de una etapa contratada para resumir el avance de un cliente. */
export type EtapaResumen = Pick<EtapaCliente, 'etapa' | 'estado' | 'contratada' | 'interna'>;

/** Uno de los cuatro pasos de la tira de avance. `contratada` = visible para el cliente. */
export type PasoAvance = { etapa: EtapaFlujo; estado: Estado; contratada: boolean };

export type ResumenAvance = { porcentaje: number; pasos: PasoAvance[]; pasoActual: PasoAvance | null };

/**
 * Lo que necesita una tarjeta de cliente para pintarse, en una sola pasada:
 *
 * - `porcentaje`: el mismo `avanceCliente` que ve el cliente en su portal, sin
 *   recalcular nada. Hasta A3 había aquí una advertencia:
 *   `etapasParaAvance` dejaba fuera `desarrollo_mensual` mientras no tuviera
 *   generador, así que esa etapa podía ser `pasoActual` sin mover el
 *   porcentaje — y un cliente veía «100%» con el paso 3 en curso. Al entrar
 *   la etapa 3 al flujo, `etapasParaAvance` y `etapasVisiblesCliente` filtran
 *   ya con el mismo criterio (contratada y no interna), y las dos mitades de
 *   este resumen vuelven a hablar del mismo conjunto: el porcentaje llega a
 *   100 exactamente cuando `pasoActual` es `null`.
 * - `pasos`: las cuatro etapas en el orden de `ETAPAS`, incluidas las no
 *   contratadas (la tira las pinta apagadas), con el criterio de
 *   «visible para el cliente» de `etapasVisiblesCliente` — una etapa interna
 *   cuenta como no contratada.
 * - `pasoActual`: el primer paso contratado que no está aprobado, o `null` si
 *   no hay ninguno (ni etapas contratadas, o todas aprobadas).
 *
 * Pura, como `resumenPortal`: la consulta vive en `src/flujo/servicio.ts`.
 */
export function resumenAvance(etapas: EtapaResumen[]): ResumenAvance {
  const porEtapa = new Map(etapas.map((e) => [e.etapa, e]));
  const visibles = new Set(etapasVisiblesCliente(etapas).map((e) => e.etapa));

  const pasos: PasoAvance[] = ETAPAS.map((etapa) => ({
    etapa,
    estado: porEtapa.get(etapa)?.estado ?? 'no_iniciada',
    contratada: visibles.has(etapa),
  }));

  return {
    porcentaje: avanceCliente(etapas),
    pasos,
    pasoActual: pasos.find((p) => p.contratada && p.estado !== 'aprobada') ?? null,
  };
}
