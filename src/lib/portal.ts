// Portada del portal del cliente (spec §4, C1). `resumenPortal` es pura (sin
// acceso a base de datos), para poder probarla en aislamiento; `clientePortal`
// y `actividadPortal` sí tocan la base y viven aparte a propósito, siguiendo
// el mismo reparto que src/flujo/reglas.ts (puro) y src/flujo/servicio.ts
// (base de datos).

import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, comentarios, etapaEventos } from '@/db';
import {
  ETAPAS, NOMBRE_ETAPA, ESTADO_CLIENTE, etapasVisiblesCliente, avanceCliente, puedeComentar,
  type Etapa, type EtapaCliente,
} from '@/flujo/reglas';
import { clienteVisible, type Cliente } from '@/lib/visibilidad';
import type { UsuarioSesion } from '@/lib/permisos';

/** Número fijo (1–4) de cada etapa según el orden de ETAPAS, para las tarjetas del portal. */
const NUMERO_ETAPA: Record<Etapa, number> = Object.fromEntries(ETAPAS.map((e, i) => [e, i + 1])) as Record<Etapa, number>;

export type EtapaClientePortal = EtapaCliente & { versionAprobadaId: string | null; actualizadoEn: Date };

export type TarjetaPortal = {
  etapaId: string;
  numero: number;
  etapa: Etapa;
  nombre: string;
  estadoCliente: string;
  actualizadoEn: Date;
  listo: boolean;
  puedeComentar: boolean;
  proximamente: boolean;
};

export type ResumenPortal = { avance: number; tarjetas: TarjetaPortal[] };

/**
 * Avance y tarjetas de la portada: solo las etapas contratadas y no internas
 * (spec §4), en el orden de ETAPAS. Pura: usa `etapasVisiblesCliente`,
 * `avanceCliente`, `ESTADO_CLIENTE` y `puedeComentar('cliente', false, etapa)`.
 * `listo` = hay `versionAprobadaId`; `proximamente` = `desarrollo_mensual`.
 */
export function resumenPortal(etapas: EtapaClientePortal[]): ResumenPortal {
  const avance = avanceCliente(etapas);
  const visibles = etapasVisiblesCliente(etapas) as EtapaClientePortal[];

  const tarjetas: TarjetaPortal[] = visibles.map((e) => ({
    etapaId: e.id,
    numero: NUMERO_ETAPA[e.etapa],
    etapa: e.etapa,
    nombre: NOMBRE_ETAPA[e.etapa],
    estadoCliente: ESTADO_CLIENTE[e.estado],
    actualizadoEn: e.actualizadoEn,
    listo: Boolean(e.versionAprobadaId),
    puedeComentar: puedeComentar('cliente', false, e.etapa),
    proximamente: e.etapa === 'desarrollo_mensual',
  }));

  return { avance, tarjetas };
}

export type ClientePortal = { cliente: Cliente; vistaPrevia: boolean };

/**
 * Quién puede abrir /portal y de qué cliente:
 * - `cliente`: ve el suyo (`null` si su cuenta no tiene `clientId` — dato
 *   inconsistente que no debería pasar, pero no debe tronar).
 * - `admin` o el operador asignado: cualquier cliente con `?cliente=<uuid>`,
 *   en modo vista previa.
 * - Cualquier otro caso (uuid inválido, cliente no asignado, sin `?cliente`
 *   para un rol interno): `null` — la página responde 404.
 *
 * `clienteVisible` ya revisa forma de UUID y permiso (admin siempre; operador
 * solo si `operadorId` es el suyo), así que aquí no se repite esa lógica.
 */
export async function clientePortal(usuario: UsuarioSesion, query: URLSearchParams): Promise<ClientePortal | null> {
  if (usuario.rol === 'cliente') {
    if (!usuario.clientId) return null;
    const cliente = await clienteVisible(usuario, usuario.clientId);
    return cliente ? { cliente, vistaPrevia: false } : null;
  }

  const clienteId = query.get('cliente') ?? '';
  const cliente = await clienteVisible(usuario, clienteId);
  return cliente ? { cliente, vistaPrevia: true } : null;
}

export type EventoActividad = { id: string; etiqueta: string; creadoEn: Date };

// Artículo y concordancia de género de «listo/lista» por etapa (fix wave de
// revisión final: «{Etapa} está listo para ti» sonaba mal en «Investigación
// está listo» — se prefirió el mapa de artículos explícito sobre una regla
// genérica de género gramatical, que no existe de forma confiable en JS).
const ARTICULO_ETAPA: Record<Etapa, 'la' | 'el'> = {
  investigacion: 'la',
  pilares: 'el',
  desarrollo_mensual: 'el',
  manual_campana: 'el',
};
const LISTO_ETAPA: Record<Etapa, 'lista' | 'listo'> = {
  investigacion: 'lista',
  pilares: 'listo',
  desarrollo_mensual: 'listo',
  manual_campana: 'listo',
};

/** «la Investigación ya está lista para ti» / «el Manual de campaña ya está listo para ti». Pura, para poder probarla sin tocar la base. */
export function fraseEtapaLista(etapa: Etapa): string {
  return `${ARTICULO_ETAPA[etapa]} ${NOMBRE_ETAPA[etapa]} ya está ${LISTO_ETAPA[etapa]} para ti`;
}

/**
 * Actividad reciente de la portada (ruling C1 #4): las últimas 8 entradas
 * visibles para el cliente, mezclando dos fuentes —
 * - aprobaciones (`accion = 'aprobar'`) de las etapas visibles, con
 *   `fraseEtapaLista`;
 * - respuestas del equipo (autor no-cliente) a comentarios que dejó un
 *   cliente (`respuestaDe` apunta a un comentario con `autorRol = 'cliente'`).
 *
 * Nunca otras transiciones ni comentarios internos. Dos consultas en
 * paralelo, sin N+1: nunca una por etapa ni una por comentario.
 *
 * `usuarioId`/`vistaPrevia` (fix wave): en el portal real, las respuestas
 * solo cuentan si el comentario padre lo dejó ESTE usuario — un cliente no
 * debe ver la actividad de otro usuario de la misma empresa. En vista previa
 * interna (admin/operador) no hay «este usuario» del lado del cliente: se
 * muestra la actividad de toda la empresa, igual que antes de este fix.
 */
export async function actividadPortal(
  etapasVisibles: { id: string; etapa: Etapa }[],
  usuarioId: string,
  vistaPrevia: boolean,
): Promise<EventoActividad[]> {
  const etapaIds = etapasVisibles.map((e) => e.id);
  if (etapaIds.length === 0) return [];
  const etapaDe = new Map(etapasVisibles.map((e) => [e.id, e.etapa]));
  const nombreDe = new Map(etapasVisibles.map((e) => [e.id, NOMBRE_ETAPA[e.etapa]]));

  // Alias del propio `comentarios` para el auto-join: el padre es el
  // comentario del cliente al que responde el equipo.
  const comentarioPadre = alias(comentarios, 'comentario_padre');

  const condicionRespuestas = vistaPrevia
    ? and(
        inArray(comentarios.etapaId, etapaIds),
        eq(comentarioPadre.autorRol, 'cliente'),
        ne(comentarios.autorRol, 'cliente'),
      )
    : and(
        inArray(comentarios.etapaId, etapaIds),
        eq(comentarioPadre.autorRol, 'cliente'),
        eq(comentarioPadre.autorId, usuarioId),
        ne(comentarios.autorRol, 'cliente'),
      );

  const [aprobaciones, respuestas] = await Promise.all([
    db.select({ etapaId: etapaEventos.etapaId, creadoEn: etapaEventos.creadoEn })
      .from(etapaEventos)
      .where(and(inArray(etapaEventos.etapaId, etapaIds), eq(etapaEventos.accion, 'aprobar')))
      .orderBy(desc(etapaEventos.creadoEn))
      .limit(8),
    db.select({ id: comentarios.id, etapaId: comentarios.etapaId, creadoEn: comentarios.creadoEn })
      .from(comentarios)
      .innerJoin(comentarioPadre, eq(comentarios.respuestaDe, comentarioPadre.id))
      .where(condicionRespuestas)
      .orderBy(desc(comentarios.creadoEn))
      .limit(8),
  ]);

  const eventos: EventoActividad[] = [
    ...aprobaciones.map((a) => ({
      id: `aprobacion-${a.etapaId}-${a.creadoEn.getTime()}`,
      etiqueta: etapaDe.has(a.etapaId) ? fraseEtapaLista(etapaDe.get(a.etapaId)!) : 'Tu etapa ya está lista para ti',
      creadoEn: a.creadoEn,
    })),
    ...respuestas.map((r) => ({
      id: `respuesta-${r.id}`,
      etiqueta: `El equipo respondió tu observación en ${nombreDe.get(r.etapaId) ?? 'tu etapa'}`,
      creadoEn: r.creadoEn,
    })),
  ];

  return eventos.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime()).slice(0, 8);
}
