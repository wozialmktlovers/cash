import { and, asc, desc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { db, clienteEtapas, clients, users, comentarios } from '@/db';
import { comentariosAbiertosPorEtapa } from '@/flujo/servicio';
import type { Etapa, TipoDocumento } from '@/flujo/reglas';
import { condicionClientes } from './visibilidad';
import { nombreVisible } from './usuarios';
import type { UsuarioSesion } from './permisos';

/**
 * La etapa que se repite cada mes. Se nombra aquí porque es la única que no
 * habla el idioma de las demás, y de eso dependen las dos condiciones de abajo.
 */
const ETAPA_MENSUAL: Etapa = 'desarrollo_mensual';

/**
 * Lo que de verdad espera la autorización del admin.
 *
 * **`en_revision` quiere decir dos cosas distintas según la etapa, y esta es la
 * línea donde se separan.** En el flujo de siempre (investigación, pilares,
 * manual) `en_revision` es «el operador solicitó y el admin tiene que aprobar
 * o pedir cambios». En el lote mensual, `sincronizarEtapa`
 * (src/contenido/servicio.ts) copia `contenido_lotes.estado` a
 * `cliente_etapas.estado` **sin traducirlo** —a propósito: los dos reusan el
 * enum `estado_etapa`— y ahí `en_revision` significa «se le compartió el mes al
 * CLIENTE y se espera su respuesta». Ninguna de las dos lecturas está mal; lo
 * que estaba mal era contarlas juntas.
 *
 * Sin este `ne`, cada mes compartido caía en «Etapas que esperan tu
 * autorización» de `/pendientes` y en el contador rojo de la barra. El admin no
 * tiene ahí nada que autorizar —`botonesEtapa` (src/flujo/ui.ts) no devuelve
 * ningún botón para esta etapa— y el «Ver» del renglón cae a `/clientes/{id}`
 * porque `desarrollo_mensual` no tiene `documentoId`: entraba solo y no había
 * forma de sacarlo. Es regresión de esta rama: hasta que algo empezó a estampar
 * `compartido_en`, ningún lote llegaba a `en_revision`.
 *
 * **Se exporta y la usan LAS DOS consultas del admin** —el `count` de
 * `contarPendientes` y el `select` de `listarPendientes`—, no dos copias con
 * las mismas tres condiciones. Es el mismo cuidado que ya hubo con el contador
 * de la barra lateral contra la página (fix wave, punto 6): la única manera de
 * que el número rojo, `/pendientes` y el «Te toca a ti» del Inicio no se
 * contradigan es que no haya dos sitios donde equivocarse.
 *
 * Los otros dos estados del lote NO se tocan, y conviene que quede escrito:
 * `con_cambios` (el cliente devolvió el mes) y `en_proceso` (el mes se está
 * armando) significan en el lote exactamente lo mismo que en las demás etapas
 * —le toca al operador—, así que siguen contando tal cual en su camino.
 */
export function esperaAutorizacionDelAdmin(): SQL {
  return and(
    eq(clienteEtapas.estado, 'en_revision'),
    eq(clienteEtapas.contratada, true),
    ne(clienteEtapas.etapa, ETAPA_MENSUAL),
  )!;
}

/**
 * El otro lado de la moneda: el mes ya compartido que espera la respuesta del
 * cliente. Es justo lo que `esperaAutorizacionDelAdmin` deja fuera.
 *
 * **Por qué no desaparece del todo:** que el admin no tenga nada que autorizar
 * no quiere decir que a nadie le importe. El operador que compartió el mes
 * quiere saber que sigue sin contestar —para insistirle al cliente antes de que
 * venza el plazo y el lote se auto-apruebe en silencio (diseño §6)—, y ese dato
 * no se ve en ninguna otra pantalla del Studio.
 *
 * **Por qué tampoco entra en «Te toca a ti»:** no le toca a él. Va en su propio
 * bloque de `/pendientes`, con su propio texto, y **fuera de `total`**, que es
 * lo que alimenta el contador rojo de la barra (`contarPendientes`) y el
 * indicador «Esperan por ti» del Inicio. Meterlo dentro inflaría los tres
 * números con trabajo que el operador no puede hacer, y le devolvería el mismo
 * problema que este arreglo le quita al admin: un renglón que no se puede
 * cerrar.
 *
 * Al admin no se le enseña esta lista: su bandeja es, por diseño, solo lo que
 * tiene que autorizar. Si algún día quiere ver el mes de todos, es una regla
 * nueva y habría que decidir también qué hace con el contador.
 */
export function esperaAlCliente(): SQL {
  return and(
    eq(clienteEtapas.etapa, ETAPA_MENSUAL),
    eq(clienteEtapas.estado, 'en_revision'),
    eq(clienteEtapas.contratada, true),
  )!;
}

/**
 * Conteo barato para el contador de «Pendientes» en la barra de navegación:
 * una sola consulta, sin listar filas — se corre en `Base.astro`, o sea en
 * cada página, así que no puede ser una consulta cara ni disparar varias.
 *
 * Admin cuenta lo que `esperaAutorizacionDelAdmin` define: etapas
 * `en_revision` de todos MENOS el lote mensual, donde ese estado significa que
 * se espera al cliente y no a él. Operador
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
    // La MISMA condición que lista `listarPendientes`, no una copia: es lo que
    // garantiza que el número rojo y la página digan lo mismo.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(clienteEtapas)
      .where(esperaAutorizacionDelAdmin());
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
 *
 * `esperando_cliente` es el raro de la lista y por eso lleva nombre propio en
 * vez de reusar `en_revision`: **nunca aparece en `Pendientes.etapas`**, solo
 * en `Pendientes.esperandoCliente`, porque no es trabajo de quien mira sino un
 * aviso de que su mes sigue sin respuesta (ver `esperaAlCliente`). Confundirlo
 * con `en_revision` es exactamente el error que este arreglo corrige.
 */
export type MotivoPendiente = 'en_revision' | 'con_cambios' | 'en_proceso' | 'esperando_cliente';

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
  /**
   * Meses ya compartidos que siguen esperando la respuesta del cliente
   * (`esperaAlCliente`). Vacía salvo que se pida con `incluirEsperandoCliente`,
   * y solo para el operador.
   *
   * **No entra en `total`, a propósito.** No es trabajo de quien mira: es un
   * aviso. Contarla aquí subiría el contador rojo de la barra y el «Esperan por
   * ti» del Inicio con renglones que el operador no puede cerrar.
   */
  esperandoCliente: EtapaPendiente[];
  /** Cuántas etapas esperan en total, antes de recortar. */
  totalEtapas: number;
  /** Cuántos comentarios esperan en total, antes de recortar. */
  totalComentarios: number;
  /** Cuántos meses esperan al cliente en total, antes de recortar. Fuera de `total`. */
  totalEsperandoCliente: number;
  /** `totalEtapas + totalComentarios`: lo que espera por esta persona. */
  total: number;
};

export type OpcionesPendientes = {
  /** Máximo de etapas a devolver. Sin él, todas. Aplica también a `esperandoCliente`. */
  limite?: number;
  /** Máximo de comentarios a devolver. Sin él, el valor de `limite`; sin ninguno, todos. */
  limiteComentarios?: number;
  /**
   * Traer también los meses que esperan al cliente. Apagado por omisión porque
   * es una consulta más y solo `/pendientes` los pinta: el Inicio enseña «Te
   * toca a ti», y esto justamente no le toca, así que no tiene por qué pagar
   * por traerlo.
   */
  incluirEsperandoCliente?: boolean;
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
 *   responsable de cada uno, porque es a él a quien le toca autorizar. Menos
 *   el lote mensual, donde `en_revision` significa que se espera al cliente y
 *   no a él: el porqué está entero en `esperaAutorizacionDelAdmin`.
 * - **Operador:** sus etapas `con_cambios` (el admin le pidió correcciones),
 *   sus etapas `en_proceso` (todavía sin solicitar) y los comentarios
 *   abiertos de primer nivel de sus clientes. Con
 *   `incluirEsperandoCliente`, además, sus meses compartidos sin respuesta,
 *   aparte y fuera de `total` (ver `esperaAlCliente`).
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
  const { limite, limiteComentarios = limite, incluirEsperandoCliente = false } = opciones;

  let todas: EtapaPendiente[] = [];
  let comentariosPendientes: ComentarioPendiente[] = [];
  let todasEsperandoCliente: EtapaPendiente[] = [];
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
      // La misma condición que cuenta `contarPendientes`; `contratada` ya va
      // dentro de ella.
      .where(esperaAutorizacionDelAdmin())
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

    // Aparte de las dos de arriba y no en el mismo `IN`: no es un motivo más
    // de la misma lista, es otra lista, con otro texto y fuera del total.
    if (incluirEsperandoCliente) {
      const esperando = await db
        .select(CAMPOS_ETAPA)
        .from(clienteEtapas)
        .innerJoin(clients, eq(clients.id, clienteEtapas.clientId))
        .where(and(esperaAlCliente(), cond))
        .orderBy(asc(clienteEtapas.actualizadoEn));
      todasEsperandoCliente = esperando.map((fila) => ({
        ...fila, motivo: 'esperando_cliente' as const, operador: null, comentariosAbiertos: 0,
      }));
    }

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
    esperandoCliente: limite === undefined ? todasEsperandoCliente : todasEsperandoCliente.slice(0, limite),
    totalEtapas: todas.length,
    totalComentarios,
    totalEsperandoCliente: todasEsperandoCliente.length,
    // `esperandoCliente` NO se suma: ver el comentario del tipo `Pendientes`.
    // De esto depende que el contador rojo (`contarPendientes`), esta página y
    // el «Te toca a ti» del Inicio sigan diciendo el mismo número.
    total: todas.length + totalComentarios,
  };
}
