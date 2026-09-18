ALTER TABLE "contenido_piezas" ADD COLUMN "prompt_imagen" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "contenido_piezas" ADD COLUMN "guion" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contenido_piezas" ADD COLUMN "tarjetas" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "research_jobs" ADD COLUMN "parametros" jsonb;