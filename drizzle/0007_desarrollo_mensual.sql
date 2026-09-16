CREATE TYPE "public"."estado_revision_pieza" AS ENUM('pendiente', 'aprobada', 'cambios');--> statement-breakpoint
CREATE TYPE "public"."formato_pieza" AS ENUM('post', 'carrusel', 'reel', 'historia');--> statement-breakpoint
CREATE TYPE "public"."plataforma_pieza" AS ENUM('facebook', 'instagram', 'ambas');--> statement-breakpoint
CREATE TABLE "contenido_lotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"periodo" text NOT NULL,
	"estado" "estado_etapa" DEFAULT 'en_proceso' NOT NULL,
	"compartido_en" timestamp with time zone,
	"limite_revision" timestamp with time zone,
	"creado_por" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contenido_lotes_client_id_periodo" UNIQUE("client_id","periodo"),
	CONSTRAINT "contenido_lotes_periodo_formato" CHECK (periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "contenido_piezas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lote_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"formato" "formato_pieza" NOT NULL,
	"plataforma" "plataforma_pieza" NOT NULL,
	"fecha_publicacion" date,
	"tema_id" text,
	"copy" text DEFAULT '' NOT NULL,
	"cta" text DEFAULT '' NOT NULL,
	"hashtags" text DEFAULT '' NOT NULL,
	"arte" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado_cliente" "estado_revision_pieza" DEFAULT 'pendiente' NOT NULL,
	"nota_cliente" text,
	"revisado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contenido_piezas_lote_id_numero" UNIQUE("lote_id","numero")
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "paquete" jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "dias_revision" integer;--> statement-breakpoint
ALTER TABLE "contenido_lotes" ADD CONSTRAINT "contenido_lotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_lotes" ADD CONSTRAINT "contenido_lotes_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contenido_piezas" ADD CONSTRAINT "contenido_piezas_lote_id_contenido_lotes_id_fk" FOREIGN KEY ("lote_id") REFERENCES "public"."contenido_lotes"("id") ON DELETE cascade ON UPDATE no action;