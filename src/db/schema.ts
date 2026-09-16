import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, date, integer, boolean, jsonb, numeric, pgEnum, primaryKey, unique, index, check, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const jobEstado = pgEnum('job_estado', ['encolado','corriendo','completado','fallido','cancelado']);
export const linkTipo = pgEnum('link_tipo', ['sitio','instagram','facebook','tiktok','youtube','ventas','otro']);
export const extraccionEstado = pgEnum('extraccion_estado', ['pendiente','ok','fallo','no_aplica']);
/**
 * Los documentos que produce el sistema. Un job y un link saben cuál es el suyo.
 *
 * `contenido` es el entregable del mes (diseño §7) y es distinto de los otros
 * tres: no vive en una tabla `*_results` con su `datos`, sino que se arma al
 * vuelo desde `contenido_lotes` + `contenido_piezas`. Por eso solo lo usa
 * `share_links.documento_tipo`, donde `documento_id` es el id del LOTE; las
 * otras columnas que comparten este enum (`research_jobs.tipo`,
 * `documento_versiones`, `comentarios`, `cliente_etapas`) no lo van a ver
 * mientras el lote no tenga versiones ni se genere con un job.
 */
export const documentoTipo = pgEnum('documento_tipo', ['research','growth','pilares','contenido']);
/** Admin crea, modifica, autoriza y asigna; operador crea y modifica; cliente solo ve y comenta lo suyo. */
export const usuarioRol = pgEnum('usuario_rol', ['admin', 'operador', 'cliente']);
/** Las cuatro etapas del flujo de trabajo por cliente. */
export const etapaCliente = pgEnum('etapa_cliente', ['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana']);
/** Estado de una etapa dentro del flujo de autorización. */
export const estadoEtapa = pgEnum('estado_etapa', ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada']);
/** Acciones que mueven una etapa de un estado a otro (ver aplicarAccion en src/flujo/reglas.ts). */
export const accionEtapa = pgEnum('accion_etapa', ['iniciar', 'solicitar', 'aprobar', 'pedir_cambios', 'reabrir']);
/** Por qué se guardó una versión de un documento. */
export const motivoVersion = pgEnum('motivo_version', ['generado', 'edicion', 'aprobada', 'restaurada']);
/** Estado de un comentario anclado. */
export const estadoComentario = pgEnum('estado_comentario', ['abierto', 'atendido', 'descartado']);
/** Formato de una pieza de contenido mensual (diseño §4). */
export const formatoPieza = pgEnum('formato_pieza', ['post', 'carrusel', 'reel', 'historia']);
/** Dónde se publica la pieza. `ambas` = Facebook e Instagram. */
export const plataformaPieza = pgEnum('plataforma_pieza', ['facebook', 'instagram', 'ambas']);
/** Lo que el cliente dijo de una pieza al revisarla (diseño §6). */
export const estadoRevisionPieza = pgEnum('estado_revision_pieza', ['pendiente', 'aprobada', 'cambios']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  rol: usuarioRol('rol').notNull().default('operador'),
  nombre: text('nombre'),
  apellido: text('apellido'),
  // Sin .references aquí: clients se declara más abajo en el archivo. La FK
  // se agrega a mano en la migración generada.
  clientId: uuid('client_id'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, () => [
  // Spec §2: `client_id` obligatorio si rol = cliente y nulo si no (fix
  // menores M2, punto 6). Antes solo lo cuidaba el código, y un script que
  // promovía a admin sin limpiar `client_id` dejaba un admin «atado» a un
  // cliente. La migración 0005 corrige las filas existentes antes de añadirlo.
  // Única excepción: un usuario cliente DESACTIVADO puede quedar sin cliente.
  // Es lo que deja el saneo de 0005 (ruling: un cliente sin `client_id` se
  // desactiva, no se borra ni cambia de rol — cambiarle el rol le daría acceso
  // interno si alguien lo reactiva). `validarCambioUsuario` impide reactivarlo.
  check('users_client_id_por_rol', sql`(rol <> 'cliente' AND client_id IS NULL) OR (rol = 'cliente' AND (client_id IS NOT NULL OR activo = false))`),
]);

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  giro: text('giro').notNull(),
  producto: text('producto').notNull(),
  ciudad: text('ciudad'),
  ticket: text('ticket'),
  contacto: text('contacto'),
  notas: text('notas'),
  // El operador que da de alta al cliente queda asignado; el admin reasigna.
  operadorId: uuid('operador_id').references(() => users.id, { onDelete: 'set null' }),
  // Cuántas piezas al mes lleva este cliente, por formato (diseño §3):
  // `{ post: 8, carrusel: 4, reel: 4, historia: 6 }`. Las claves son los
  // valores de `formato_pieza`; una clave ausente es cero. Se guarda en el
  // cliente, no en el lote, y cada lote nuevo lo hereda. Nulo mientras no se
  // contrate la etapa 3. El sistema AVISA si el mes no cuadra, no lo impide.
  paquete: jsonb('paquete'),
  // Días hábiles que tiene el cliente para revisar un lote antes de que se dé
  // por aprobado. Nulo = los 2 de por omisión (diseño §6); la constante vive
  // en el código para no tener que migrar si cambia el valor por omisión.
  diasRevision: integer('dias_revision'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const clientLinks = pgTable('client_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  tipo: linkTipo('tipo').notNull(),
  url: text('url').notNull(),
});

export const clientFiles = pgTable('client_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  nombreOriginal: text('nombre_original').notNull(),
  ruta: text('ruta').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  textoExtraido: text('texto_extraido'),
  estadoExtraccion: extraccionEstado('estado_extraccion').notNull().default('pendiente'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const researchJobs = pgTable('research_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  // La cola es una sola: el mismo worker atiende investigaciones y manuales.
  tipo: documentoTipo('tipo').notNull().default('research'),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  estado: jobEstado('estado').notNull().default('encolado'),
  etapaActual: text('etapa_actual'),
  etapas: jsonb('etapas').notNull().default({}),
  tokensEntrada: integer('tokens_entrada').notNull().default(0),
  tokensSalida: integer('tokens_salida').notNull().default(0),
  costoUsd: numeric('costo_usd', { precision: 10, scale: 4 }).notNull().default('0'),
  // Quién lo mandó a correr, para atribuir el costo.
  creadoPor: uuid('creado_por').references(() => users.id, { onDelete: 'set null' }),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const researchResults = pgTable('research_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const growthResults = pgTable('growth_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pilaresResults = pgTable('pilares_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => researchJobs.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  datos: jsonb('datos').notNull(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Avance del equipo por tema. Solo existe fila para los temas que alguien tocó:
 * sin fila, el tema está pendiente. Así un mapa nuevo no inserta 300 filas vacías.
 */
export const pilaresTemas = pgTable('pilares_temas', {
  resultId: uuid('result_id').notNull().references(() => pilaresResults.id, { onDelete: 'cascade' }),
  temaId: text('tema_id').notNull(),
  estado: text('estado').notNull().default('pendiente'),
  nota: text('nota'),
  actualizadoPor: uuid('actualizado_por').references(() => users.id, { onDelete: 'set null' }),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.resultId, t.temaId] })]);

export const shareLinks = pgTable('share_links', {
  token: text('token').primaryKey(),
  // Apunta a research_results o a growth_results según el tipo, así que no
  // lleva clave foránea: el borrado en cascada se hace a mano.
  documentoId: uuid('documento_id').notNull(),
  documentoTipo: documentoTipo('documento_tipo').notNull().default('research'),
  // Huérfana a propósito. Conservarla hace la migración reversible sin tener
  // que respaldar la tabla, cosa que no se puede sin abrirle red pública a la
  // base. No la usa nadie.
  resultId: uuid('result_id'),
  revocado: boolean('revocado').notNull().default(false),
  visitas: integer('visitas').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** El token viaja solo en el enlace; en la base queda su hash, como una contraseña. */
export const invitaciones = pgTable('invitaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull().unique(),
  email: text('email').notNull(),
  rol: usuarioRol('rol').notNull(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  creadoPor: uuid('creado_por').references(() => users.id, { onDelete: 'set null' }),
  expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
  usadaEn: timestamp('usada_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/** Historial de un documento (research, growth o pilares): una fila por versión guardada. */
export const documentoVersiones = pgTable('documento_versiones', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentoTipo: documentoTipo('documento_tipo').notNull(),
  documentoId: uuid('documento_id').notNull(),
  // Secuencia por documento: 1, 2, 3...
  numero: integer('numero').notNull(),
  datos: jsonb('datos').notNull(),
  motivo: motivoVersion('motivo').notNull(),
  autorId: uuid('autor_id').references(() => users.id, { onDelete: 'set null' }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.documentoTipo, t.documentoId, t.numero)]);

/**
 * Una fila por cliente y etapa: `investigacion`, `pilares`, `desarrollo_mensual`
 * y `manual_campana`. Si la etapa no se contrató pero otra la necesita, queda
 * `interna = true` (no se muestra al cliente ni cuenta en su avance).
 */
export const clienteEtapas = pgTable('cliente_etapas', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  etapa: etapaCliente('etapa').notNull(),
  contratada: boolean('contratada').notNull().default(true),
  interna: boolean('interna').notNull().default(false),
  estado: estadoEtapa('estado').notNull().default('no_iniciada'),
  documentoTipo: documentoTipo('documento_tipo'),
  // El entregable vigente. Sin FK: puede apuntar a research_results, growth_results o pilares_results según documentoTipo.
  documentoId: uuid('documento_id'),
  versionAprobadaId: uuid('version_aprobada_id').references(() => documentoVersiones.id),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.clientId, t.etapa)]);

/** Historial de transiciones de una etapa: quién, cuándo y por qué. */
export const etapaEventos = pgTable('etapa_eventos', {
  id: uuid('id').primaryKey().defaultRandom(),
  etapaId: uuid('etapa_id').notNull().references(() => clienteEtapas.id, { onDelete: 'cascade' }),
  // Una de las acciones de accionEtapa, o 'generado' / 'comentario_cliente' /
  // 'contratacion' (cambio de contratación de admin que un operador no podría hacer).
  accion: text('accion').notNull(),
  de: estadoEtapa('de'),
  a: estadoEtapa('a').notNull(),
  usuarioId: uuid('usuario_id').references(() => users.id, { onDelete: 'set null' }),
  comentario: text('comentario'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('etapa_eventos_etapa_id_creado_en_idx').on(t.etapaId, t.creadoEn)]);

/** Comentario anclado a una parte del documento (sección, tarjeta o tema). */
export const comentarios = pgTable('comentarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  etapaId: uuid('etapa_id').notNull().references(() => clienteEtapas.id, { onDelete: 'cascade' }),
  documentoTipo: documentoTipo('documento_tipo').notNull(),
  documentoId: uuid('documento_id').notNull(),
  versionNumero: integer('version_numero').notNull(),
  ancla: text('ancla').notNull(),
  texto: text('texto').notNull(),
  autorId: uuid('autor_id').references(() => users.id, { onDelete: 'set null' }),
  autorRol: usuarioRol('autor_rol').notNull(),
  estado: estadoComentario('estado').notNull().default('abierto'),
  respuestaDe: uuid('respuesta_de').references((): AnyPgColumn => comentarios.id),
  resueltoPor: uuid('resuelto_por').references(() => users.id, { onDelete: 'set null' }),
  resueltoEn: timestamp('resuelto_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('comentarios_etapa_id_idx').on(t.etapaId)]);

/** Aviso dentro del Studio (y por correo, cuando Resend está configurado). */
export const notificaciones = pgTable('notificaciones', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tipo: text('tipo').notNull(),
  titulo: text('titulo').notNull(),
  texto: text('texto').notNull(),
  enlace: text('enlace'),
  leidaEn: timestamp('leida_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('notificaciones_usuario_id_leida_en_idx').on(t.usuarioId, t.leidaEn)]);

/**
 * Un lote de contenido por cliente y mes (diseño §2). Las otras tres etapas
 * ocurren una vez; esta se repite cada mes, y `cliente_etapas` solo guarda un
 * estado por etapa y cliente. Por eso el mes vive aquí y la fila de
 * `desarrollo_mensual` refleja siempre el lote ACTIVO (el más reciente sin
 * aprobar; si todos están aprobados, el último).
 *
 * `estado` reusa `estado_etapa` a propósito: lo que la etapa muestra es
 * exactamente el estado de su lote activo, así que `sincronizarEtapa` copia el
 * valor sin traducirlo. Se usan cuatro de los cinco: `en_proceso` al crearlo,
 * `en_revision` al compartirlo, `con_cambios` si el cliente pide cambios y
 * `aprobada` cuando todas sus piezas lo están. `no_iniciada` no se usa: un
 * lote que existe ya es trabajo empezado.
 */
export const contenidoLotes = pgTable('contenido_lotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  // El mes del lote, `YYYY-MM`. Texto y no `date` porque es un periodo, no un
  // día: ordena bien alfabéticamente y es lo que viaja en la URL del
  // entregable (`/clientes/[id]/contenido/[periodo]`).
  periodo: text('periodo').notNull(),
  estado: estadoEtapa('estado').notNull().default('en_proceso'),
  // Cuándo se compartió con el cliente. El plazo de revisión cuenta desde
  // aquí, no desde que se creó el lote (diseño §6).
  compartidoEn: timestamp('compartido_en', { withTimezone: true }),
  // Fecha límite ya calculada (compartidoEn + días hábiles del cliente). Se
  // guarda en vez de recalcularla para que la cuenta regresiva que ve el
  // cliente no se mueva si alguien le cambia `dias_revision` a medio mes.
  limiteRevision: timestamp('limite_revision', { withTimezone: true }),
  creadoPor: uuid('creado_por').references(() => users.id, { onDelete: 'set null' }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Un solo lote por cliente y mes. Es la regla que sostiene todo el diseño de
  // §2, así que vive en la base: el 409 de la API es la cortesía, esto es el
  // candado. Sin él, dos operadores creando el lote de septiembre a la vez
  // dejarían al cliente con dos «meses en curso» y un lote activo ambiguo.
  unique('contenido_lotes_client_id_periodo').on(t.clientId, t.periodo),
  // `periodo` es un formato, no texto libre. Se valida aquí igual que el rol y
  // el `client_id` de `users` (migración 0005): la tabla es nueva, no hay
  // filas que sanear antes, y una fila con `2026-9` o `septiembre` rompería el
  // orden del lote activo y la URL del entregable sin que nada se queje.
  // `periodoValido` (tarea A2) dice lo mismo en el código, para el mensaje.
  check('contenido_lotes_periodo_formato', sql`periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
]);

/**
 * Una pieza del lote (diseño §4). El orden lo da `numero`, no la fecha: el
 * operador numera las piezas al planear el mes y la fecha de publicación puede
 * faltar o moverse.
 */
export const contenidoPiezas = pgTable('contenido_piezas', {
  id: uuid('id').primaryKey().defaultRandom(),
  loteId: uuid('lote_id').notNull().references(() => contenidoLotes.id, { onDelete: 'cascade' }),
  numero: integer('numero').notNull(),
  formato: formatoPieza('formato').notNull(),
  plataforma: plataformaPieza('plataforma').notNull(),
  // `date` y no `timestamp`: es el día de publicación, sin hora ni zona.
  fechaPublicacion: date('fecha_publicacion'),
  // El tema del mapa de pilares del que salió, con su id `P{n}-S{m}-{nn}`.
  // Sin FK: `pilares_temas` solo tiene fila para los temas que alguien tocó
  // (ver su comentario), así que el tema puede existir en el mapa y no en la
  // tabla. Opcional: una pieza puede no venir del mapa.
  temaId: text('tema_id'),
  copy: text('copy').notNull().default(''),
  cta: text('cta').notNull().default(''),
  // Los hashtags tal como se copian, en una sola línea. Texto y no arreglo
  // porque el operador los edita y los copia en bloque; nadie los consulta.
  hashtags: text('hashtags').notNull().default(''),
  // El brief visual que el agente escribió para la opción elegida: la
  // indicación para quien haga el arte (diseño §5 y §8, el Studio no genera
  // imágenes). Se guarda en la pieza y no en la propuesta porque las
  // propuestas no se guardan —el operador elige una y la edita—, y sin esta
  // columna el brief se perdía en cuanto se pedía otra tanda.
  briefVisual: text('brief_visual').notNull().default(''),
  // Los artes de la pieza, en orden. El esquema no captura la forma, así que
  // queda escrita aquí: una lista de `{ tipo, fileId }` o `{ tipo, url }`,
  // donde `tipo` es `imagen | video | portada` y se usa `fileId` (un
  // `client_files.id`) si el arte se subió, o `url` si es un enlace externo
  // —el caso del reel alojado fuera—. Cuántos lleva cada formato lo dice el
  // diseño §4: post 1 imagen, carrusel de 2 a 10, reel portada + video o
  // enlace, historia 1 imagen o video. Eso lo cuida el código, no la base.
  arte: jsonb('arte').notNull().default([]),
  estadoCliente: estadoRevisionPieza('estado_cliente').notNull().default('pendiente'),
  // La nota que dejó el cliente al pedir cambios. El comentario anclado vive
  // en `comentarios`; esto es la copia a la mano para pintar la tarjeta.
  notaCliente: text('nota_cliente'),
  revisadoEn: timestamp('revisado_en', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // El número identifica la pieza dentro de su mes («pieza 7 de septiembre»),
  // y es lo que ve el cliente. Dos piezas con el mismo número harían ambigua
  // cualquier referencia, así que no se permite.
  unique('contenido_piezas_lote_id_numero').on(t.loteId, t.numero),
]);
