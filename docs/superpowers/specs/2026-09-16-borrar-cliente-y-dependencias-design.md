# Borrar un cliente y aflojar las dependencias entre etapas · Diseño

**Fecha:** 2026-09-16
**Estado:** aprobado en conversación

---

## 1. Dependencias entre etapas

Hoy cada etapa espera a la anterior: pilares exige la investigación **aprobada**, y
el manual exige además el mapa de pilares **aprobado**. En la práctica eso obliga a
ir en fila india aunque el equipo pueda trabajar en paralelo.

**Nueva regla, más simple:** lo único que se exige es tener la investigación **con
datos**. La investigación es la fuente de información; el resto son formas de
explotarla y pueden hacerse en el orden que convenga, incluso a la vez.

| Etapa | Requisito |
|---|---|
| Investigación | Ninguno |
| Mapa de pilares | Investigación con datos |
| Manual de campaña | Investigación con datos |
| Desarrollo mensual | Sigue bloqueada: «Próximamente» |

Se quita la exigencia de que la investigación esté **aprobada** y la de que el mapa
de pilares esté aprobado antes del manual. **La aprobación deja de ser una puerta y
pasa a ser lo que siempre debió ser: un control de calidad.**

Lo que **no** cambia: una etapa `en_revision` no se puede regenerar (se pisaría el
documento que el admin está revisando) y una `aprobada` exige reabrirla primero.
Esas dos reglas son sobre la etapa misma, no sobre sus dependencias.

## 2. Borrar un cliente

**Quién:** solo un admin. Un operador no puede, ni siquiera con sus clientes.

**Qué se lleva por delante:** todo lo del cliente. La base ya lo arrastra en cascada
—investigaciones, mapas, manuales, trabajos, etapas, enlaces públicos, comentarios,
archivos y enlaces de la ficha, invitaciones y **las cuentas de acceso de ese
cliente**—. Lo que la base no borra son los **archivos subidos, que viven en el disco
de datos**: hay que borrarlos a mano antes, y si alguno falla, el borrado continúa y
se deja constancia en el registro (un archivo huérfano es un problema menor que dejar
el cliente a medio borrar).

**Cómo se confirma:** un diálogo que enumera lo que se va a perder, con las cantidades
reales (cuántos entregables, cuántos archivos, cuántas cuentas de acceso), y que exige
**escribir el nombre exacto del cliente** para habilitar el botón. Sin papelera y sin
deshacer; el texto lo dice con todas sus letras.

**Dónde:** al final de la ficha del cliente, en una zona aparte, separada del resto y
con el color de peligro del sistema. No va en la lista de clientes: borrar no debe
estar a un clic de distancia mientras navegas.

**API:** `DELETE /api/clientes/[id]`, con el nombre tecleado en el cuerpo. El servidor
**vuelve a comprobar** que quien pide es admin y que el nombre coincide exactamente;
no se fía de que la pantalla ya lo haya hecho. Responde 403 si no es admin, 400 si el
nombre no coincide, 404 si no existe.

**Registro:** antes de borrar, se deja una línea en el log con quién borró qué y
cuánto se llevó. Es lo único que quedará.
