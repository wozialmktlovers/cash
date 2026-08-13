CREATE TYPE "public"."documento_tipo" AS ENUM('research', 'growth');--> statement-breakpoint
CREATE TABLE "growth_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"datos" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "tipo" "documento_tipo" DEFAULT 'research' NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" DROP CONSTRAINT "share_links_result_id_research_results_id_fk";
--> statement-breakpoint
ALTER TABLE "share_links" ALTER COLUMN "result_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "share_links" ADD COLUMN "documento_tipo" "documento_tipo" DEFAULT 'research' NOT NULL;--> statement-breakpoint

-- La columna entra nullable, se rellena y solo entonces se vuelve obligatoria.
-- Drizzle la generaba directamente NOT NULL, y eso revienta contra una tabla
-- que ya tiene filas: no hay valor para las existentes. Los links repartidos
-- antes de este cambio heredan su result_id y siguen resolviendo.
ALTER TABLE "share_links" ADD COLUMN "documento_id" uuid;--> statement-breakpoint
UPDATE "share_links" SET "documento_id" = "result_id" WHERE "documento_id" IS NULL;--> statement-breakpoint
DELETE FROM "share_links" WHERE "documento_id" IS NULL;--> statement-breakpoint
ALTER TABLE "share_links" ALTER COLUMN "documento_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "growth_results" ADD CONSTRAINT "growth_results_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_results" ADD CONSTRAINT "growth_results_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
