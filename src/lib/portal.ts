// Portada del portal del cliente (spec §4, C1). `resumenPortal` es pura (sin
// acceso a base de datos), para poder probarla en aislamiento; `clientePortal`
// y `actividadPortal` sí tocan la base y viven aparte a propósito, siguiendo
// el mismo reparto que src/flujo/reglas.ts (puro) y src/flujo/servicio.ts
// (base de datos).

import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db, comentarios, contenidoLotes, etapaEventos } from '@/db';
import { elegirLoteActivo } from '@/contenido/servicio';
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
  /**
   * Solo en `desarrollo_mensual`: el mes destacado, el que el cliente abre con
   * el botón principal. Es lo que esa etapa tiene en vez de una versión
   * aprobada, porque su entregable no es una fila con `datos` sino un lote con
   * sus piezas (diseño §2).
   */
  lote?: { id: string; periodo: string };
  /**
   * Los demás meses que el cliente ya puede abrir, del más reciente al más
   * viejo. El diseño §2 lo promete con todas sus letras —«los meses anteriores
   * no desaparecen: quedan accesibles y el cliente puede volver a verlos desde
   * su portal»— y sin esta lista era mentira: la portada solo miraba el lote
   * ACTIVO, así que abrir el lote de octubre escondía el de septiembre, que el
   * cliente tenía aprobado y a mano el día anterior.
   */
  mesesAnteriores?: { id: string; periodo: string }[];
};

/**
 * Un mes de contenido tal como la portada del portal necesita verlo (C2).
 *
 * - `compartido` decide si el cliente puede abrirlo: el mes que el operador
 *   todavía está armando no es asunto suyo, así que ni se nombra.
 * - `activo` marca el lote activo del cliente (`elegirLoteActivo`, diseño §2),
 *   que es el que la etapa refleja en `cliente_etapas` y el que se destaca.
 */
export type LotePortal = { id: string; periodo: string; compartido: boolean; activo: boolean };

export type ResumenPortal = { avance: number; tarjetas: TarjetaPortal[] };

/**
 * Avance y tarjetas de la portada: solo las etapas contratadas y no internas
 * (spec §4), en el orden de ETAPAS. Pura: usa `etapasVisiblesCliente`,
 * `avanceCliente`, `ESTADO_CLIENTE` y `puedeComentar('cliente', false, etapa)`.
 *
 * `listo` = hay `versionAprobadaId`… **salvo en `desarrollo_mensual`**, que no
 * tiene versiones: su entregable es el lote del mes, así que ahí «listo» quiere
 * decir que hay **algún** mes ya compartido con el cliente (C2, diseño §2).
 * Por lo mismo, `proximamente` deja de ser «esta etapa siempre» y pasa a ser
 * «esta etapa todavía no tiene ningún mes compartido»: desde C2 el cliente sí
 * entra, revisa y aprueba, y seguir anunciándole «Próximamente» sobre un mes
 * que ya tiene en la mano sería mentirle mientras le corre el plazo.
 *
 * ── Qué mes se destaca, y por qué no siempre es el activo ────────────────
 *
 * El destacado es **el lote activo si está compartido; si no, el mes compartido
 * más reciente**. La segunda mitad es el arreglo: el activo es «el más reciente
 * sin aprobar» (`elegirLoteActivo`), así que en cuanto el operador abre octubre
 * el activo pasa a ser un lote `en_proceso` que el cliente no debe ver — y la
 * portada, que solo miraba ese, volvía a decir «Próximamente» y hacía
 * desaparecer septiembre, que el cliente tenía aprobado. Con esto, lo que se le
 * enseña es siempre el mes más nuevo que puede abrir, y octubre lo sustituye el
 * día que se comparta, ni antes ni después.
 *
 * Se prefiere el activo cuando está compartido para no cambiar nada del caso
 * normal: es el mes que le toca revisar, aunque exista uno posterior ya
 * aprobado (el caso raro de abrir tarde un mes pasado, que `elegirLoteActivo`
 * ya resuelve así).
 *
 * `estadoCliente` sigue saliendo de la etapa, que refleja el lote ACTIVO: si
 * octubre está en proceso, la tarjeta lo dice y de paso deja ver septiembre.
 * Es lo correcto —hay trabajo nuevo— y es justo lo que el diseño §2 previó.
 *
 * Los lotes se pasan aparte y no salen de `etapas` porque `cliente_etapas` no
 * los guarda: la fila de esta etapa refleja el ESTADO del lote activo, no cuál
 * es ni cuántos hay (ver `sincronizarEtapa`, src/contenido/servicio.ts). Quien
 * llama los lee de `contenido_lotes` con `lotesPortal` y esta función sigue
 * siendo pura.
 *
 * **Un mes sin compartir no aparece por ningún lado**: ni destacado, ni en la
 * lista, ni contando para `listo`. Es el único permiso que esta función
 * sostiene, y `/portal/contenido/[loteId]` lo vuelve a comprobar por su cuenta
 * —con 404 si falta `compartido_en`—, porque un enlace que no se pinta sigue
 * pudiéndose escribir a mano.
 */
export function resumenPortal(etapas: EtapaClientePortal[], lotes: LotePortal[] = []): ResumenPortal {
  const avance = avanceCliente(etapas);
  const visibles = etapasVisiblesCliente(etapas) as EtapaClientePortal[];

  // Del más reciente al más viejo. `periodo` es `YYYY-MM`, que se compara como
  // texto igual que cronológicamente, y es único por cliente (restricción de
  // la tabla): no hay empate que desempatar.
  const compartidos = lotes.filter((l) => l.compartido).sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  const destacado = compartidos.find((l) => l.activo) ?? compartidos[0] ?? null;
  const anteriores = compartidos.filter((l) => l !== destacado);
  const mesListo = destacado !== null;

  const tarjetas: TarjetaPortal[] = visibles.map((e) => {
    const esMensual = e.etapa === 'desarrollo_mensual';
    return {
      etapaId: e.id,
      numero: NUMERO_ETAPA[e.etapa],
      etapa: e.etapa,
      nombre: NOMBRE_ETAPA[e.etapa],
      estadoCliente: ESTADO_CLIENTE[e.estado],
      actualizadoEn: e.actualizadoEn,
      listo: esMensual ? mesListo : Boolean(e.versionAprobadaId),
      puedeComentar: puedeComentar('cliente', false, e.etapa),
      proximamente: esMensual && !mesListo,
      ...(esMensual && destacado ? { lote: { id: destacado.id, periodo: destacado.periodo } } : {}),
      ...(esMensual && anteriores.length > 0
        ? { mesesAnteriores: anteriores.map((l) => ({ id: l.id, periodo: l.periodo })) }
        : {}),
    };
  });

  return { avance, tarjetas };
}

/**
 * Los meses de contenido del cliente, como los necesita `resumenPortal`.
 *
 * Trae todos sus lotes en una sola consulta —doce filas por año y cliente— y
 * marca el activo con `elegirLoteActivo`, que es el criterio del diseño §2 y
 * vive en `src/contenido/servicio.ts`: aquí no se reimplementa, se llama.
 *
 * Devuelve también los lotes sin compartir, con `compartido: false`. Podrían
 * filtrarse en el `WHERE`, pero entonces `elegirLoteActivo` decidiría sobre una
 * lista recortada y diría que el activo es septiembre cuando el activo de
 * verdad es octubre. Quien decide qué se enseña es `resumenPortal`, que ya no
 * nombra ningún lote sin compartir.
 */
export async function lotesPortal(clientId: string): Promise<LotePortal[]> {
  const filas = await db
    .select({
      id: contenidoLotes.id,
      periodo: contenidoLotes.periodo,
      estado: contenidoLotes.estado,
      compartidoEn: contenidoLotes.compartidoEn,
    })
    .from(contenidoLotes)
    .where(eq(contenidoLotes.clientId, clientId))
    .orderBy(desc(contenidoLotes.periodo));

  const activo = elegirLoteActivo(filas);
  return filas.map((f) => ({
    id: f.id,
    periodo: f.periodo,
    compartido: f.compartidoEn !== null,
    activo: f.id === activo?.id,
  }));
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
