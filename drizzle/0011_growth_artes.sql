-- El arte de cada anuncio del manual de campaña, fuera de `growth_results.datos`
-- (ver el comentario de `growthArtes` en src/db/schema.ts): subirlo no crea
-- versión ni toca la etapa. Tabla nueva, sin datos que migrar.
CREATE TABLE "growth_artes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"growth_id" uuid NOT NULL,
	"creativo" integer NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text NOT NULL,
	"ruta" text,
	"mime" text,
	"nombre_original" text,
	"bytes" integer,
	"url" text,
	"autor_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "growth_artes_growth_id_creativo_orden" UNIQUE("growth_id","creativo","orden"),
	CONSTRAINT "growth_artes_tipo" CHECK (tipo IN ('archivo', 'enlace')),
	CONSTRAINT "growth_artes_forma" CHECK ((tipo = 'archivo' AND ruta IS NOT NULL AND mime IS NOT NULL AND url IS NULL) OR (tipo = 'enlace' AND url IS NOT NULL AND ruta IS NULL)),
	CONSTRAINT "growth_artes_posicion" CHECK (creativo >= 0 AND orden >= 0)
);
--> statement-breakpoint
ALTER TABLE "growth_artes" ADD CONSTRAINT "growth_artes_growth_id_growth_results_id_fk" FOREIGN KEY ("growth_id") REFERENCES "public"."growth_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "growth_artes" ADD CONSTRAINT "growth_artes_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;