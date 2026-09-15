import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric, pgEnum, primaryKey, unique, index, type AnyPgColumn } from 'drizzle-orm/pg-core';

export const jobEstado = pgEnum('job_estado', ['encolado','corriendo','completado','fallido','cancelado']);
export const linkTipo = pgEnum('link_tipo', ['sitio','instagram','facebook','tiktok','youtube','ventas','otro']);
export const extraccionEstado = pgEnum('extraccion_estado', ['pendiente','ok','fallo','no_aplica']);
/** Los documentos que produce el sistema. Un job y un link saben cuál es el suyo. */
export const documentoTipo = pgEnum('documento_tipo', ['research','growth','pilares']);
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

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  rol: usuarioRol('rol').notNull().default('operador'),
  nombre: text('nombre'),
  // Sin .references aquí: clients se declara más abajo en el archivo. La FK
  // se agrega a mano en la migración generada.
  clientId: uuid('client_id'),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
  // Una de las acciones de accionEtapa, o 'generado' / 'comentario_cliente'.
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
