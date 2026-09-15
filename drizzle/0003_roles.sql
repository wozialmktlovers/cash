CREATE TYPE "public"."usuario_rol" AS ENUM('admin', 'operador', 'cliente');--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"email" text NOT NULL,
	"rol" "usuario_rol" NOT NULL,
	"client_id" uuid,
	"creado_por" uuid,
	"expira_en" timestamp with time zone NOT NULL,
	"usada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitaciones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "operador_id" uuid;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "creado_por" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rol" "usuario_rol" DEFAULT 'operador' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nombre" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_operador_id_users_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD CONSTRAINT "research_jobs_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade;--> statement-breakpoint
-- Roles de los usuarios que ya existían: el más antiguo administra, los demás operan.
UPDATE "users" SET "rol" = 'admin' WHERE "id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);--> statement-breakpoint
UPDATE "users" SET "rol" = 'operador' WHERE "id" <> (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);--> statement-breakpoint
-- Los clientes existentes quedan a cargo de ese administrador hasta que se reasignen.
UPDATE "clients" SET "operador_id" = (SELECT "id" FROM "users" WHERE "rol" = 'admin' ORDER BY "created_at" ASC LIMIT 1) WHERE "operador_id" IS NULL;