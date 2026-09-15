-- Fix menores M2, punto 6: CHECK de `client_id` según el rol (spec §2).
-- Antes de añadirlo se corrigen las filas que no lo cumplirían; si no, el
-- ALTER TABLE falla y el Studio no arranca.
-- 1) Un usuario interno (admin u operador) nunca pertenece a un cliente:
--    quedó así si un script lo promovió sin limpiar `client_id`.
UPDATE "users" SET "client_id" = NULL WHERE "rol" <> 'cliente' AND "client_id" IS NOT NULL;--> statement-breakpoint
-- 2) Un usuario cliente sin cliente no tiene portal que ver: se desactiva (no
--    se borra ni cambia de rol) y se le cierran las sesiones, igual que al
--    desactivar desde /admin/usuarios. El CHECK deja existir a estos usuarios
--    solo mientras estén inactivos.
DELETE FROM "sessions" WHERE "user_id" IN (SELECT "id" FROM "users" WHERE "rol" = 'cliente' AND "client_id" IS NULL AND "activo" = true);--> statement-breakpoint
UPDATE "users" SET "activo" = false WHERE "rol" = 'cliente' AND "client_id" IS NULL AND "activo" = true;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_por_rol" CHECK ((rol <> 'cliente' AND client_id IS NULL) OR (rol = 'cliente' AND (client_id IS NOT NULL OR activo = false)));
