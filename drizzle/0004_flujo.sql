CREATE TYPE "public"."accion_etapa" AS ENUM('iniciar', 'solicitar', 'aprobar', 'pedir_cambios', 'reabrir');--> statement-breakpoint
CREATE TYPE "public"."estado_comentario" AS ENUM('abierto', 'atendido', 'descartado');--> statement-breakpoint
CREATE TYPE "public"."estado_etapa" AS ENUM('no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada');--> statement-breakpoint
CREATE TYPE "public"."etapa_cliente" AS ENUM('investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana');--> statement-breakpoint
CREATE TYPE "public"."motivo_version" AS ENUM('generado', 'edicion', 'aprobada', 'restaurada');--> statement-breakpoint
CREATE TABLE "cliente_etapas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"etapa" "etapa_cliente" NOT NULL,
	"contratada" boolean DEFAULT true NOT NULL,
	"interna" boolean DEFAULT false NOT NULL,
	"estado" "estado_etapa" DEFAULT 'no_iniciada' NOT NULL,
	"documento_tipo" "documento_tipo",
	"documento_id" uuid,
	"version_aprobada_id" uuid,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_etapas_client_id_etapa_unique" UNIQUE("client_id","etapa")
);
--> statement-breakpoint
CREATE TABLE "comentarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etapa_id" uuid NOT NULL,
	"documento_tipo" "documento_tipo" NOT NULL,
	"documento_id" uuid NOT NULL,
	"version_numero" integer NOT NULL,
	"ancla" text NOT NULL,
	"texto" text NOT NULL,
	"autor_id" uuid,
	"autor_rol" "usuario_rol" NOT NULL,
	"estado" "estado_comentario" DEFAULT 'abierto' NOT NULL,
	"respuesta_de" uuid,
	"resuelto_por" uuid,
	"resuelto_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documento_versiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_tipo" "documento_tipo" NOT NULL,
	"documento_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"datos" jsonb NOT NULL,
	"motivo" "motivo_version" NOT NULL,
	"autor_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_versiones_documento_tipo_documento_id_numero_unique" UNIQUE("documento_tipo","documento_id","numero")
);
--> statement-breakpoint
CREATE TABLE "etapa_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etapa_id" uuid NOT NULL,
	"accion" text NOT NULL,
	"de" "estado_etapa",
	"a" "estado_etapa" NOT NULL,
	"usuario_id" uuid,
	"comentario" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"enlace" text,
	"leida_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cliente_etapas" ADD CONSTRAINT "cliente_etapas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cliente_etapas" ADD CONSTRAINT "cliente_etapas_version_aprobada_id_documento_versiones_id_fk" FOREIGN KEY ("version_aprobada_id") REFERENCES "public"."documento_versiones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_etapa_id_cliente_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."cliente_etapas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_respuesta_de_comentarios_id_fk" FOREIGN KEY ("respuesta_de") REFERENCES "public"."comentarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_resuelto_por_users_id_fk" FOREIGN KEY ("resuelto_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_versiones" ADD CONSTRAINT "documento_versiones_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_eventos" ADD CONSTRAINT "etapa_eventos_etapa_id_cliente_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."cliente_etapas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_eventos" ADD CONSTRAINT "etapa_eventos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comentarios_etapa_id_idx" ON "comentarios" USING btree ("etapa_id");--> statement-breakpoint
CREATE INDEX "etapa_eventos_etapa_id_creado_en_idx" ON "etapa_eventos" USING btree ("etapa_id","creado_en");--> statement-breakpoint
CREATE INDEX "notificaciones_usuario_id_leida_en_idx" ON "notificaciones" USING btree ("usuario_id","leida_en");--> statement-breakpoint
-- Etapas de los clientes que ya existían: todas contratadas menos el desarrollo mensual, que aún no existe.
INSERT INTO "cliente_etapas" ("client_id","etapa","contratada","interna","estado")
SELECT c."id", e."etapa"::"etapa_cliente", e."etapa" <> 'desarrollo_mensual', false, 'no_iniciada'
FROM "clients" c CROSS JOIN (VALUES ('investigacion'),('pilares'),('desarrollo_mensual'),('manual_campana')) AS e("etapa")
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Si ya había un documento, la etapa arranca en proceso con el más reciente como vigente.
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='research', "documento_id"=r."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "research_results" ORDER BY "client_id","version" DESC) r
WHERE ce."client_id"=r."client_id" AND ce."etapa"='investigacion';--> statement-breakpoint
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='growth', "documento_id"=g."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "growth_results" ORDER BY "client_id","version" DESC) g
WHERE ce."client_id"=g."client_id" AND ce."etapa"='manual_campana';--> statement-breakpoint
UPDATE "cliente_etapas" ce SET "estado"='en_proceso', "documento_tipo"='pilares', "documento_id"=p."id"
FROM (SELECT DISTINCT ON ("client_id") "id","client_id" FROM "pilares_results" ORDER BY "client_id","version" DESC) p
WHERE ce."client_id"=p."client_id" AND ce."etapa"='pilares';