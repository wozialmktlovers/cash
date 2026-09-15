// Reglas puras del flujo de etapas por cliente (spec §3). Sin acceso a base de
// datos: los tipos Etapa/Estado/Accion se definen aquí como uniones a partir
// de las constantes, en paralelo a los enums de Postgres que agrega B1.

export const ETAPAS = ['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana'] as const;
export const ESTADOS = ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const;
export const ACCIONES = ['iniciar', 'solicitar', 'aprobar', 'pedir_cambios', 'reabrir'] as const;

export type Etapa = (typeof ETAPAS)[number];
export type Estado = (typeof ESTADOS)[number];
export type Accion = (typeof ACCIONES)[number];
export type Rol = 'admin' | 'operador' | 'cliente';
export type TipoDocumento = 'research' | 'pilares' | 'growth';

/** Peso de cada estado para el % de avance del cliente. */
export const PESOS: Record<Estado, number> = {
  no_iniciada: 0,
  en_proceso: 25,
  en_revision: 50,
  con_cambios: 60,
  aprobada: 100,
};

/** Nombre visible de cada etapa. */
export const NOMBRE_ETAPA: Record<Etapa, string> = {
  investigacion: 'Investigación',
  pilares: 'Mapa de pilares',
  desarrollo_mensual: 'Desarrollo mensual',
  manual_campana: 'Manual de campaña',
};

/** Etiqueta del estado tal como la ve el cliente en el portal. */
export const ESTADO_CLIENTE: Record<Estado, string> = {
  no_iniciada: 'Por iniciar',
  en_proceso: 'En preparación',
  en_revision: 'En revisión',
  con_cambios: 'En preparación',
  aprobada: 'Listo',
};

/** Etiqueta interna del estado (Studio, eventos, mensajes de error). */
export const ETIQUETA_ESTADO_ETAPA: Record<Estado, string> = {
  no_iniciada: 'No iniciada',
  en_proceso: 'En proceso',
  en_revision: 'En revisión',
  con_cambios: 'Con cambios',
  aprobada: 'Aprobada',
};

const DOCUMENTO_POR_ETAPA: Record<Etapa, TipoDocumento | null> = {
  investigacion: 'research',
  pilares: 'pilares',
  desarrollo_mensual: null,
  manual_campana: 'growth',
};

const ETAPA_POR_TIPO_DOCUMENTO: Record<TipoDocumento, Etapa> = {
  research: 'investigacion',
  pilares: 'pilares',
  growth: 'manual_campana',
};

export function tipoDocumentoDe(etapa: Etapa): TipoDocumento | null {
  return DOCUMENTO_POR_ETAPA[etapa];
}

export function etapaDeTipo(tipo: TipoDocumento): Etapa {
  return ETAPA_POR_TIPO_DOCUMENTO[tipo];
}

export type EtapaCliente = {
  id: string;
  etapa: Etapa;
  contratada: boolean;
  interna: boolean;
  estado: Estado;
  documentoId: string | null;
};

/**
 * Etapas que cuentan en el % de avance: contratadas, no internas y —
 * ruling del controller (menores, punto 5)— sin `desarrollo_mensual`
 * mientras no tenga generador («Próximamente» — ver `dependenciasCumplidas`
 * más abajo). Sin esta exclusión, contratar `desarrollo_mensual` deja el
 * avance atorado en ≤75% para siempre, porque su estado nunca puede pasar de
 * `no_iniciada` (peso 0) hasta que exista el generador. La marca de
 * «próximamente» ya usada en `portal.ts`/`clientes/[id].astro`
 * (`etapa === 'desarrollo_mensual'`) es la misma que se usa aquí — no hay
 * una bandera dedicada, así que se reutiliza ese criterio.
 *
 * Genérica sobre `T` (no exige `EtapaCliente` completo) para que también la
 * use `carga()` en `src/lib/desempeno.ts` (M3, punto 6 del controlador):
 * esas filas no traen `documentoId`, pero sí `contratada`/`interna`/`etapa`.
 * Antes ese módulo tenía su propio filtro que SÍ contaba
 * `desarrollo_mensual`, así que el tablero de desempeño y el portal podían
 * mostrar un % distinto para el mismo cliente — compartir este filtro (en
 * vez de reimplementarlo) evita que un cambio futuro en una de las dos
 * reglas desalinee otra vez a las dos pantallas.
 */
export function etapasParaAvance<T extends { contratada: boolean; interna: boolean; etapa: Etapa }>(etapas: T[]): T[] {
  return etapas.filter((e) => e.contratada && !e.interna && e.etapa !== 'desarrollo_mensual');
}

/**
 * % de avance: promedio redondeado del peso de las etapas visibles
 * (`etapasParaAvance`); 0 si no hay ninguna.
 *
 * Recibe solo `contratada`/`interna`/`etapa`/`estado` (no `EtapaCliente`
 * completo) para que también la use directamente la tabla «Por cliente» de
 * `src/pages/desempeno.astro` (M3, punto 7 del controlador), cuyas filas
 * (`EtapaM`, `src/lib/desempeno.ts`) no traen `documentoId`. Esa tabla tenía
 * su propia `avanceDeCliente` que SÍ contaba `desarrollo_mensual`: el mismo
 * cliente podía ver un % distinto en el portal, en la tarjeta de carga del
 * tablero (`carga()`, punto 6) y en esta tabla.
 */
export function avanceCliente(etapas: Pick<EtapaCliente, 'contratada' | 'interna' | 'etapa' | 'estado'>[]): number {
  const visibles = etapasParaAvance(etapas);
  if (visibles.length === 0) return 0;
  const suma = visibles.reduce((acc, e) => acc + PESOS[e.estado], 0);
  return Math.round(suma / visibles.length);
}

/** Etapas contratadas y no internas, en el orden de ETAPAS. */
export function etapasVisiblesCliente(etapas: EtapaCliente[]): EtapaCliente[] {
  const orden = new Map(ETAPAS.map((e, i) => [e, i]));
  return etapas.filter((e) => e.contratada && !e.interna).sort((a, b) => (orden.get(a.etapa) ?? 0) - (orden.get(b.etapa) ?? 0));
}

/**
 * Dependencias para poder trabajar una etapa:
 * - investigacion: siempre ok.
 * - pilares y manual_campana: necesitan una investigación con datos; si la investigación
 *   está contratada (no interna), además debe estar aprobada.
 * - manual_campana: además necesita pilares aprobada, solo si pilares está contratada.
 * - desarrollo_mensual: todavía no se puede iniciar (Próximamente).
 */
export function dependenciasCumplidas(etapa: Etapa, etapas: EtapaCliente[], hayInvestigacionConDatos: boolean): { ok: boolean; razon: string } {
  if (etapa === 'investigacion') return { ok: true, razon: '' };

  if (etapa === 'desarrollo_mensual') {
    return { ok: false, razon: 'Próximamente: esta etapa todavía no está disponible.' };
  }

  if (!hayInvestigacionConDatos) {
    return { ok: false, razon: 'Falta completar la investigación antes de continuar.' };
  }

  const investigacion = etapas.find((e) => e.etapa === 'investigacion');
  if (investigacion && investigacion.contratada && !investigacion.interna && investigacion.estado !== 'aprobada') {
    return { ok: false, razon: 'La investigación contratada debe estar aprobada antes de continuar.' };
  }

  if (etapa === 'manual_campana') {
    const pilares = etapas.find((e) => e.etapa === 'pilares');
    if (pilares && pilares.contratada && !pilares.interna && pilares.estado !== 'aprobada') {
      return { ok: false, razon: 'El mapa de pilares debe estar aprobado antes de continuar.' };
    }
  }

  return { ok: true, razon: '' };
}

/**
 * Decide si `POST /api/jobs` puede encolar la generación del documento de
 * `etapa` para este cliente (fix I1, punto 1). Antes de este chequeo, la
 * ruta insertaba el job sin mirar nada: un operador podía regenerar el
 * documento de una etapa `en_revision` (reemplazando justo lo que el admin
 * está por aprobar) o `aprobada` (sin pasar por «reabrir»), o saltarse una
 * etapa sin sus dependencias. Los tres bloqueos, en orden:
 * - ni contratada ni interna: no hay nada que generar (una etapa interna sí
 *   deja pasar, porque alimenta a otra: investigación interna para pilares);
 * - `en_revision` o `aprobada`: hay que resolver la revisión o reabrir antes
 *   de reemplazar el documento;
 * - `dependenciasCumplidas`: sin la investigación (y, para el manual, sin
 *   pilares) no hay sobre qué generar.
 */
export function puedeGenerar(
  etapa: Etapa,
  etapas: EtapaCliente[],
  hayInvestigacionConDatos: boolean,
): { ok: boolean; razon: string } {
  const fila = etapas.find((e) => e.etapa === etapa);
  if (!fila || (!fila.contratada && !fila.interna)) {
    return { ok: false, razon: `${NOMBRE_ETAPA[etapa]} no está contratada.` };
  }

  if (fila.estado === 'en_revision') {
    return { ok: false, razon: 'Esta etapa está en revisión: no se puede reemplazar el documento que el admin está revisando.' };
  }
  if (fila.estado === 'aprobada') {
    return { ok: false, razon: 'Esta etapa ya está aprobada: hay que reabrirla antes de generar de nuevo.' };
  }

  return dependenciasCumplidas(etapa, etapas, hayInvestigacionConDatos);
}

/** Lo mínimo de una etapa (o de su versión aprobada) para decidir si un documento se puede compartir. */
export type DocumentoDeEtapa = { documentoTipo: TipoDocumento | null; documentoId: string | null };

/**
 * Decide si `POST /api/share` puede crear un link público `/p/` para este
 * documento (fix menores M2, punto 1). Antes cualquier operador podía
 * publicar un borrador: el link público no pasa por el flujo de revisión, así
 * que el cliente (o quien reciba el link) veía algo que el admin todavía no
 * había autorizado. Ruling del controlador:
 * - admin: siempre puede (es quien aprueba, decide qué sale);
 * - operador: solo si la etapa del documento está `aprobada`, la etapa
 *   apunta a ESTE documento como vigente y la versión aprobada registrada es
 *   de este mismo documento — una versión vieja de una etapa aprobada no es
 *   lo que se autorizó;
 * - cliente: nunca (no llega a esta ruta, pero la regla no lo deja pasar).
 * Los links ya creados no se tocan: esta regla solo mira la creación.
 */
export function puedeCompartir(o: {
  rol: Rol;
  tipo: TipoDocumento;
  documentoId: string;
  etapa: ({ estado: Estado } & DocumentoDeEtapa) | null;
  versionAprobada: DocumentoDeEtapa | null;
}): { ok: boolean; razon: string } {
  if (o.rol === 'admin') return { ok: true, razon: '' };
  if (o.rol !== 'operador') return { ok: false, razon: 'No tienes permiso para crear links públicos.' };

  if (!o.etapa) {
    return { ok: false, razon: 'Solo se pueden compartir documentos aprobados: este documento no tiene etapa.' };
  }
  if (o.etapa.estado !== 'aprobada') {
    return {
      ok: false,
      razon: `Solo se pueden compartir documentos aprobados: la etapa está «${ETIQUETA_ESTADO_ETAPA[o.etapa.estado]}». Pide a un administrador que lo apruebe o que cree el link.`,
    };
  }

  const esEste = (d: DocumentoDeEtapa | null) => !!d && d.documentoTipo === o.tipo && d.documentoId === o.documentoId;
  if (!esEste(o.etapa) || !esEste(o.versionAprobada)) {
    return { ok: false, razon: 'Este documento no es la versión aprobada de la etapa: comparte la versión vigente.' };
  }

  return { ok: true, razon: '' };
}

/** Plan de contratación de una sola etapa, tal como lo devuelve `planContratacion` (src/flujo/servicio.ts). */
export type PlanEtapa = { etapa: Etapa; contratada: boolean; interna: boolean };

/** `EtapaCliente` más `versionAprobadaId`: lo que hace falta para saber si una investigación ya es visible-y-aprobada para el cliente. */
export type EtapaClienteVersion = EtapaCliente & { versionAprobadaId: string | null };

export type CambioRiesgoso = { etapa: Etapa; razon: string };

/**
 * Cambios de contratación que un operador NO puede hacer (regla del dueño,
 * fix I1 punto 3): descontratar una etapa que ya arrancó (cualquier estado
 * distinto de `no_iniciada` implica trabajo hecho, o un documento que el
 * cliente ya pudo haber visto) y volver interna una investigación que ya
 * tiene una versión aprobada visible para el cliente (ocultársela de golpe
 * le quita algo que ya vio). El admin sí puede las dos cosas — quien llama
 * (`api/clientes/[id]/etapas.ts`) usa esta misma lista para registrar el
 * cambio como evento cuando quien lo aplicó es admin.
 *
 * Pura y sin conocer el rol: decide únicamente QUÉ cambios son riesgosos:
 * quien llama decide qué hacer con la lista según quién la pidió.
 */
export function cambiosContratacionRiesgosos(actuales: EtapaClienteVersion[], plan: PlanEtapa[]): CambioRiesgoso[] {
  const riesgos: CambioRiesgoso[] = [];

  for (const p of plan) {
    const actual = actuales.find((e) => e.etapa === p.etapa);
    if (!actual) continue;

    if (actual.contratada && !p.contratada && actual.estado !== 'no_iniciada') {
      riesgos.push({
        etapa: p.etapa,
        razon: `No puedes descontratar ${NOMBRE_ETAPA[p.etapa]}: su estado es «${ETIQUETA_ESTADO_ETAPA[actual.estado]}», no «${ETIQUETA_ESTADO_ETAPA.no_iniciada}».`,
      });
      continue;
    }

    if (p.etapa === 'investigacion' && actual.contratada && !actual.interna && p.interna && actual.versionAprobadaId) {
      riesgos.push({
        etapa: p.etapa,
        razon: 'No puedes volver interna la investigación: ya tiene una versión aprobada visible para el cliente.',
      });
    }
  }

  return riesgos;
}

function razonEstadoInvalido(accion: Accion, actual: Estado): string {
  return `No se puede ${accion.replace(/_/g, ' ')} desde ${ETIQUETA_ESTADO_ETAPA[actual]}`;
}

/** Transición de estado (tabla del spec §3) según etapa, acción, rol y contexto. */
export function aplicarAccion(o: {
  etapa: EtapaCliente;
  accion: Accion;
  rol: Rol;
  esOperadorAsignado: boolean;
  comentariosAbiertos: number;
  comentarioGeneral: string;
  dependencias: { ok: boolean; razon: string };
}): { ok: true; nuevo: Estado } | { ok: false; razon: string } {
  const { etapa, accion, rol, esOperadorAsignado, comentariosAbiertos, comentarioGeneral, dependencias } = o;
  const actual = etapa.estado;

  // El cliente nunca actúa aquí: sus comentarios pasan por estadoTrasComentarioCliente.
  if (rol === 'cliente') return { ok: false, razon: 'No tienes permiso para esta acción.' };

  // Un operador solo puede actuar sobre los clientes que tiene asignados.
  if (rol === 'operador' && !esOperadorAsignado) return { ok: false, razon: 'No tienes este cliente asignado' };

  switch (accion) {
    case 'iniciar': {
      if (actual !== 'no_iniciada') return { ok: false, razon: razonEstadoInvalido(accion, actual) };
      if (!dependencias.ok) return { ok: false, razon: dependencias.razon };
      return { ok: true, nuevo: 'en_proceso' };
    }

    case 'solicitar': {
      if (actual !== 'en_proceso' && actual !== 'con_cambios') return { ok: false, razon: razonEstadoInvalido(accion, actual) };
      if (!etapa.documentoId) return { ok: false, razon: 'Esta etapa aún no tiene documento' };
      if (comentariosAbiertos > 0) return { ok: false, razon: 'Primero hay que resolver los comentarios pendientes' };
      return { ok: true, nuevo: 'en_revision' };
    }

    case 'aprobar': {
      if (rol !== 'admin') return { ok: false, razon: 'Solo un administrador puede aprobar' };
      if (actual !== 'en_revision') return { ok: false, razon: razonEstadoInvalido(accion, actual) };
      return { ok: true, nuevo: 'aprobada' };
    }

    case 'pedir_cambios': {
      if (rol !== 'admin') return { ok: false, razon: 'Solo un administrador puede pedir cambios' };
      if (actual !== 'en_revision') return { ok: false, razon: razonEstadoInvalido(accion, actual) };
      if (comentariosAbiertos <= 0 && comentarioGeneral.trim() === '') {
        return { ok: false, razon: 'Deja al menos un comentario con los cambios' };
      }
      return { ok: true, nuevo: 'con_cambios' };
    }

    case 'reabrir': {
      if (rol !== 'admin') return { ok: false, razon: 'Solo un administrador puede reabrir' };
      if (actual !== 'aprobada') return { ok: false, razon: razonEstadoInvalido(accion, actual) };
      if (comentarioGeneral.trim() === '') {
        return { ok: false, razon: 'Deja al menos un comentario con los cambios' };
      }
      return { ok: true, nuevo: 'con_cambios' };
    }
  }

  // Inalcanzable: Accion es una unión cerrada y todos los casos regresan arriba.
  throw new Error(`Acción desconocida: ${accion}`);
}

/** Estado tras registrar un entregable generado: no_iniciada→en_proceso; aprobada→con_cambios (hay que reautorizar); el resto se conserva. */
export function estadoTrasGenerar(actual: Estado): Estado {
  if (actual === 'no_iniciada') return 'en_proceso';
  if (actual === 'aprobada') return 'con_cambios';
  return actual;
}

/** Estado tras un comentario del cliente: en manual_campana o desarrollo_mensual, una etapa aprobada vuelve a con_cambios; el resto se conserva. */
export function estadoTrasComentarioCliente(etapa: Etapa, actual: Estado): Estado {
  if ((etapa === 'manual_campana' || etapa === 'desarrollo_mensual') && actual === 'aprobada') return 'con_cambios';
  return actual;
}

/** Quién puede comentar: admin siempre; operador solo si tiene el cliente asignado; cliente solo en manual_campana y desarrollo_mensual. */
export function puedeComentar(rol: Rol, esOperadorAsignado: boolean, etapa: Etapa): boolean {
  if (rol === 'admin') return true;
  if (rol === 'operador') return esOperadorAsignado;
  return etapa === 'manual_campana' || etapa === 'desarrollo_mensual';
}
