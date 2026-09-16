import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, clienteEtapas, clients, users, comentarios } from '@/db';
import { comentariosAbiertosPorEtapa } from '@/flujo/servicio';
import type { Etapa, TipoDocumento } from '@/flujo/reglas';
import { condicionClientes } from './visibilidad';
import { nombreVisible } from './usuarios';
import type { UsuarioSesion } from './permisos';

/**
 * Conteo barato para el contador de «Pendientes» en la barra de navegación:
 * una sola consulta, sin listar filas — se corre en `Base.astro`, o sea en
 * cada página, así que no puede ser una consulta cara ni disparar varias.
 *
 * Admin cuenta etapas `en_revision` de todos (le toca decidir). Operador
 * cuenta exactamente lo que `/pendientes` le lista (spec §3, tabla
 * «Pendientes»): sus etapas `con_cambios`, sus etapas `en_proceso` (que
 * todavía no se solicitaron) y los comentarios abiertos de primer nivel en
 * sus clientes — antes esto solo contaba `con_cambios`, así que el número de
 * la barra lateral se quedaba corto contra lo que la página realmente
 * mostraba (fix wave, punto 6). Las dos partes van en una sola consulta, con
 * dos subconsultas de `count` sumadas, para no disparar varias por página.
 * El cliente nunca ve esta página, así que da 0.
 *
 * Las tres partes filtran `contratada = true` (fix I1, punto 3): una etapa
 * descontratada no debe aparecer como pendiente de nadie, aunque su `estado`
 * haya quedado en `en_revision`/`con_cambios`/`en_proceso` de cuando sí lo
 * estaba — descontratar no toca `estado`, solo `contratada`.
 */
export async function contarPendientes(usuario: UsuarioSesion): Promise<number> {
  if (usuario.rol === 'admin') {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(clienteEtapas)
      .where(and(eq(clienteEtapas.estado, 'en_revision'), eq(clienteEtapas.contratada, true)));
    return n;
  }

  if (usuario.rol === 'operador') {
    // `cond` filtra por `clients.operadorId`, sin alias: las dos subconsultas
    // de abajo se apoyan en eso, cada una con su propio JOIN a `clients` sin
    // renombrarla, para que la condición siga apuntando a la tabla correcta
    // en ambas. Un SELECT escalar (sin FROM propio, solo las dos subconsultas
    // sumadas) — `db.execute`, no `db.select().from(...)`, porque no hay una
    // sola tabla que encabece la consulta.
    const cond = condicionClientes(usuario);
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT
        (SELECT count(*)::int FROM ${clienteEtapas}
           INNER JOIN ${clients} ON ${clients.id} = ${clienteEtapas.clientId}
          WHERE ${clienteEtapas.estado} IN ('con_cambios', 'en_proceso') AND ${clienteEtapas.contratada} = true AND (${cond}))
        +
        (SELECT count(*)::int FROM ${comentarios}
           INNER JOIN ${clienteEtapas} ON ${clienteEtapas.id} = ${comentarios.etapaId}
           INNER JOIN ${clients} ON ${clients.id} = ${clienteEtapas.clientId}
          WHERE ${comentarios.estado} = 'abierto' AND ${comentarios.respuestaDe} IS NULL AND ${clienteEtapas.contratada} = true AND (${cond}))
        AS n
    `);
    return n;
  }

  return 0;
}

/**
 * Por qué una etapa está esperando. Lo que hace falta para que quien la
 * reciba (la página `/pendientes` o el Inicio) pueda separarlas en grupos sin
 * volver a consultar ni adivinar por el estado: `en_revision` solo le sale al
 * admin, `con_cambios` y `en_proceso` solo al operador.
 */
export type MotivoPendiente = 'en_revision' | 'con_cambios' | 'en_proceso';

export type EtapaPendiente = {
  id: string;
  motivo: MotivoPendiente;
  etapa: Etapa;
  actualizadoEn: Date;
  documentoTipo: TipoDocumento | null;
  documentoId: string | null;
  clientId: string;
  cliente: string;
  /**
   * Responsable del cliente, ya formateado. Solo lo trae el camino del admin
   * (es su columna «Operador»); en el del operador siempre es `null`, porque
   * el responsable es quien mira. `null` en el camino del admin significa
   * «Sin asignar», no un nombre vacío.
   */
  operador: string | null;
  /**
   * Comentarios abiertos de primer nivel de esta etapa. Solo se cuenta para
   * las `con_cambios` (es el único grupo que lo enseña); el resto va en 0.
   */
  comentariosAbiertos: number;
};

export type ComentarioPendiente = {
  id: string;
  texto: string;
  creadoEn: Date;
  etapa: Etapa;
  clientId: string;
  cliente: string;
};

export type Pendientes = {
  /** Ordenadas por antigüedad, lo más viejo arriba. Recortadas a `limite`. */
  etapas: EtapaPendiente[];
  /** De la más reciente a la más vieja. Recortados a `limiteComentarios`. */
  comentarios: ComentarioPendiente[];
  /** Cuántas etapas esperan en total, antes de recortar. */
  totalEtapas: number;
  /** Cuántos comentarios esperan en total, antes de recortar. */
  totalComentarios: number;
  /** `totalEtapas + totalComentarios`: lo que espera por esta persona. */
  total: number;
};

export type OpcionesPendientes = {
  /** Máximo de etapas a devolver. Sin él, todas. */
  limite?: number;
  /** Máximo de comentarios a devolver. Sin él, el valor de `limite`; sin ninguno, todos. */
  limiteComentarios?: number;
};

const CAMPOS_ETAPA = {
  id: clienteEtapas.id, etapa: clienteEtapas.etapa, actualizadoEn: clienteEtapas.actualizadoEn,
  documentoTipo: clienteEtapas.documentoTipo, documentoId: clienteEtapas.documentoId,
  clientId: clients.id, cliente: clients.nombre,
};

/**
 * Lo que espera por `usuario`: las etapas y los comentarios que le toca
 * atender. Vivía dentro de `/pendientes`; se sacó aquí porque el Inicio
 * necesita lo mismo con un límite chico, y duplicar las reglas (etapa
 * contratada, rol de quien mira, comentarios sin atender) habría dejado dos
 * versiones destinadas a desalinearse — igual que le pasó al contador de la
 * barra lateral contra la página (fix wave, punto 6).
 *
 * El criterio es exactamente el que ya tenía la página:
 *
 * - **Admin:** las etapas `en_revision` de todos los clientes, con el
 *   responsable de cada uno, porque es a él a quien le toca autorizar.
 * - **Operador:** sus etapas `con_cambios` (el admin le pidió correcciones),
 *   sus etapas `en_proceso` (todavía sin solicitar) y los comentarios
 *   abiertos de primer nivel de sus clientes.
 * - **Cliente:** nada. Nunca llega a estas pantallas.
 *
 * Los tres caminos filtran `contratada = true` (fix I1, punto 3): una etapa
 * descontratada no es pendiente de nadie, aunque su `estado` haya quedado en
 * `en_revision`/`con_cambios`/`en_proceso` de cuando sí lo estaba.
 *
 * Nota de alcance: el admin **no** recibe comentarios, igual que hoy — su
 * lista en `/pendientes` y su número en la barra lateral solo cuentan
 * `en_revision`. El diseño del Inicio (§2) sí querría enseñárselos; eso es
 * una regla nueva, no parte de esta extracción, y habría que cambiar también
 * `contarPendientes` para que los tres números cuadren.
 *
 * Los límites se aplican distinto a propósito. Las etapas se traen completas
 * y se recortan en memoria: son pocas (`/pendientes` las lista todas sin
 * paginar) y así `totalEtapas` sale sin una segunda consulta. Los comentarios
 * sí se recortan en SQL, porque pueden ser muchos, y por eso su total va en
 * una consulta aparte de `count`.
 */
export async function listarPendientes(usuario: UsuarioSesion, opciones: OpcionesPendientes = {}): Promise<Pendientes> {
  const { limite, limiteComentarios = limite } = opciones;

  let todas: EtapaPendiente[] = [];
  let comentariosPendientes: ComentarioPendiente[] = [];
  let totalComentarios = 0;

  // Una etapa descontratada no cuenta como pendiente de nadie (fix I1, punto
  // 3): descontratar no toca `estado`, así que sin este filtro una etapa
  // `en_revision`/`con_cambios`/`en_proceso` de cuando sí estaba contratada
  // seguiría apareciendo aquí.
  const contratada = eq(clienteEtapas.contratada, true);

  if (usuario.rol === 'admin') {
    const filasEnRevision = await db
      .select({
        ...CAMPOS_ETAPA,
        operadorNombre: users.nombre, operadorApellido: users.apellido, operadorEmail: users.email,
      })
      .from(clienteEtapas)
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .leftJoin(users, eq(users.id, clients.operadorId))
      .where(and(eq(clienteEtapas.estado, 'en_revision'), contratada))
      .orderBy(asc(clienteEtapas.actualizadoEn));

    // El `leftJoin` deja las tres columnas del operador en NULL cuando el cliente
    // no tiene responsable: eso es «Sin asignar», no un nombre vacío.
    todas = filasEnRevision.map(({ operadorNombre, operadorApellido, operadorEmail, ...fila }) => ({
      ...fila,
      motivo: 'en_revision' as const,
      operador: operadorEmail === null ? null : nombreVisible({ nombre: operadorNombre, apellido: operadorApellido, email: operadorEmail }),
      comentariosAbiertos: 0,
    }));
  } else if (usuario.rol === 'operador') {
    const cond = condicionClientes(usuario);

    const conCambios = await db
      .select(CAMPOS_ETAPA)
      .from(clienteEtapas)
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .where(and(eq(clienteEtapas.estado, 'con_cambios'), contratada, cond))
      .orderBy(asc(clienteEtapas.actualizadoEn));

    const enProceso = await db
      .select(CAMPOS_ETAPA)
      .from(clienteEtapas)
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .where(and(eq(clienteEtapas.estado, 'en_proceso'), contratada, cond))
      .orderBy(asc(clienteEtapas.actualizadoEn));

    // Dos consultas y no una con `estado IN (...)`: cada grupo se enseña por
    // separado en `/pendientes` y así el orden dentro de cada uno es el que
    // decidió Postgres para esa consulta, igual que antes de extraer esto.
    todas = [
      ...conCambios.map((fila) => ({ ...fila, motivo: 'con_cambios' as const, operador: null, comentariosAbiertos: 0 })),
      ...enProceso.map((fila) => ({ ...fila, motivo: 'en_proceso' as const, operador: null, comentariosAbiertos: 0 })),
    ];
    // Lo más viejo arriba, mezclando los dos grupos. `sort` es estable, así
    // que dos etapas con la misma fecha conservan el orden en que vinieron de
    // su consulta: quien filtre por `motivo` recupera cada lista tal cual.
    todas.sort((a, b) => a.actualizadoEn.getTime() - b.actualizadoEn.getTime());

    const condicionComentarios = and(eq(comentarios.estado, 'abierto'), isNull(comentarios.respuestaDe), contratada, cond);

    const comentariosQuery = db
      .select({
        id: comentarios.id, texto: comentarios.texto, creadoEn: comentarios.creadoEn,
        etapa: clienteEtapas.etapa, clientId: clients.id, cliente: clients.nombre,
      })
      .from(comentarios)
      .innerJoin(clienteEtapas, eq(clienteEtapas.id, comentarios.etapaId))
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .where(condicionComentarios)
      .orderBy(desc(comentarios.creadoEn));
    comentariosPendientes = limiteComentarios === undefined ? await comentariosQuery : await comentariosQuery.limit(limiteComentarios);

    // Cuenta aparte (barata, sin traer filas) para saber si la lista de arriba
    // se quedó corta y hay que ofrecer «Ver todos».
    const [{ n: totalN }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(comentarios)
      .innerJoin(clienteEtapas, eq(clienteEtapas.id, comentarios.etapaId))
      .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
      .where(condicionComentarios);
    totalComentarios = totalN;
  }

  const etapas = limite === undefined ? todas : todas.slice(0, limite);

  // Mismo conteo que usa la ficha del cliente (fix wave, punto 6): una sola
  // consulta agrupada, en vez de reimplementarla aquí con su propio filtro de
  // ids. Solo para las `con_cambios`, que son las que lo enseñan, y después de
  // recortar, para no contar comentarios de etapas que nadie va a ver. Con la
  // lista vacía (el camino del admin) no consulta nada.
  const conCambiosVisibles = etapas.filter((e) => e.motivo === 'con_cambios');
  const conteoPorEtapa = await comentariosAbiertosPorEtapa(conCambiosVisibles);
  for (const e of conCambiosVisibles) e.comentariosAbiertos = conteoPorEtapa.get(e.id) ?? 0;

  return {
    etapas,
    comentarios: comentariosPendientes,
    totalEtapas: todas.length,
    totalComentarios,
    total: todas.length + totalComentarios,
  };
}
