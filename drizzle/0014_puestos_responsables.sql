CREATE TYPE "public"."puesto" AS ENUM('strategist', 'content_creator', 'contenido', 'diseno', 'trafficker');--> statement-breakpoint
CREATE TABLE "etapa_responsables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"etapa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"puesto" "puesto" NOT NULL,
	"asignado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"asignado_por" uuid,
	CONSTRAINT "etapa_responsables_etapa_usuario" UNIQUE("etapa_id","usuario_id"),
	CONSTRAINT "etapa_responsables_etapa_puesto" UNIQUE("etapa_id","puesto")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "puesto" "puesto";--> statement-breakpoint
-- Saneo antes del CHECK (mismo patrón que la migración 0005 con client_id):
-- todo operador YA EXISTENTE queda sin puesto tras el ADD COLUMN de arriba, y
-- el CHECK de abajo exige uno para rol = 'operador'. No hay forma de adivinar
-- el puesto real de cada quien desde los datos existentes (a diferencia de
-- `clients.operador_id`, que aquí a propósito NO se migra a
-- `etapa_responsables` — ver el comentario de la tabla), así que se les pone
-- 'trafficker' como valor de arranque explícito y temporal: el admin debe
-- revisar y corregir el puesto real de cada operador desde /admin/usuarios
-- después de desplegar esta migración. Un operador dado de alta DESPUÉS de
-- esta migración siempre trae su puesto real desde el alta o la invitación.
UPDATE "users" SET "puesto" = 'trafficker' WHERE "rol" = 'operador' AND "puesto" IS NULL;--> statement-breakpoint
ALTER TABLE "etapa_responsables" ADD CONSTRAINT "etapa_responsables_etapa_id_cliente_etapas_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."cliente_etapas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_responsables" ADD CONSTRAINT "etapa_responsables_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa_responsables" ADD CONSTRAINT "etapa_responsables_asignado_por_users_id_fk" FOREIGN KEY ("asignado_por") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_puesto_por_rol" CHECK ((rol = 'operador' AND puesto IS NOT NULL) OR (rol <> 'operador' AND puesto IS NULL));