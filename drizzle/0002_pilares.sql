ALTER TYPE "public"."documento_tipo" ADD VALUE 'pilares';--> statement-breakpoint
CREATE TABLE "pilares_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"datos" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pilares_temas" (
	"result_id" uuid NOT NULL,
	"tema_id" text NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"nota" text,
	"actualizado_por" uuid,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pilares_temas_result_id_tema_id_pk" PRIMARY KEY("result_id","tema_id")
);
--> statement-breakpoint
ALTER TABLE "pilares_results" ADD CONSTRAINT "pilares_results_job_id_research_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."research_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilares_results" ADD CONSTRAINT "pilares_results_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilares_temas" ADD CONSTRAINT "pilares_temas_result_id_pilares_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."pilares_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pilares_temas" ADD CONSTRAINT "pilares_temas_actualizado_por_users_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;