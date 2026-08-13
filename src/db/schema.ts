import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, numeric, pgEnum } from 'drizzle-orm/pg-core';

export const jobEstado = pgEnum('job_estado', ['encolado','corriendo','completado','fallido','cancelado']);
export const linkTipo = pgEnum('link_tipo', ['sitio','instagram','facebook','tiktok','youtube','ventas','otro']);
export const extraccionEstado = pgEnum('extraccion_estado', ['pendiente','ok','fallo','no_aplica']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
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
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  estado: jobEstado('estado').notNull().default('encolado'),
  etapaActual: text('etapa_actual'),
  etapas: jsonb('etapas').notNull().default({}),
  tokensEntrada: integer('tokens_entrada').notNull().default(0),
  tokensSalida: integer('tokens_salida').notNull().default(0),
  costoUsd: numeric('costo_usd', { precision: 10, scale: 4 }).notNull().default('0'),
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

export const shareLinks = pgTable('share_links', {
  token: text('token').primaryKey(),
  resultId: uuid('result_id').notNull().references(() => researchResults.id, { onDelete: 'cascade' }),
  revocado: boolean('revocado').notNull().default(false),
  visitas: integer('visitas').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
