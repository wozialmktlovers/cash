-- El plazo de revisión solo vale sobre el contenido que se compartió
-- (`loteAutoAprobado`, src/contenido/reglas.ts). Para poder compararlo hace
-- falta saber cuándo se tocó por última vez el contenido del mes.
ALTER TABLE "contenido_lotes" ADD COLUMN "contenido_actualizado_en" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
-- Las filas que ya existen se rellenan con `creado_en` y no con el `now()` por
-- omisión de la columna, y la diferencia importa:
--
-- `creado_en` es siempre anterior o igual a `compartido_en` —no se puede
-- compartir un lote antes de crearlo—, así que los meses que hoy tienen un
-- plazo corriendo lo conservan y siguen venciendo igual que ayer. Con `now()`
-- pasaría lo contrario: todo lote compartido antes de esta migración quedaría
-- marcado como «tocado después de compartirse» y su auto-aprobación —que es una
-- promesa escrita en el propio entregable, con cuenta regresiva— no volvería a
-- cumplirse nunca.
--
-- Es además lo único que se puede afirmar sin inventar: de las ediciones
-- anteriores a esta columna no hay registro, así que se toma la única fecha que
-- consta y que no cambia la conducta de nadie. A partir de aquí la fecha la
-- escribe `marcarContenidoTocado` (src/contenido/servicio.ts).
UPDATE "contenido_lotes" SET "contenido_actualizado_en" = "creado_en";
