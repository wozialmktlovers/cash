# Autorización del admin antes de compartir el mes · Diseño

**Fecha:** 2026-09-17
**Estado:** pendiente de tu revisión
**Motivo:** hoy cualquier operador puede mandarle el mes a un cliente real y arrancarle el reloj de auto‑aprobación sin que un admin lo mire. Los otros tres entregables sí pasan por autorización.

---

## 1. El problema de fondo

Un mes tiene **cinco momentos**, pero el sistema solo tiene cuatro estados para él, y
dos de esos momentos comparten uno:

| Momento | Quién tiene la pelota | Estado hoy |
|---|---|---|
| Se está armando | Operador | `en_proceso` |
| Espera autorización del admin | **Admin** | *no existe* |
| Espera respuesta del cliente | **Cliente** | `en_revision` |
| Pidieron cambios | Operador | `con_cambios` |
| Terminado | Nadie | `aprobada` |

De ahí salió que la bandeja del admin se llenara de meses que no le tocaban: el
sistema no sabía distinguir «te espera a ti» de «espera al cliente». Se parcheó
filtrando por tipo de etapa; esto lo arregla de raíz.

## 2. La solución: el lote tiene su propio vocabulario

Hoy `contenido_lotes.estado` reusa el enum de las etapas. Se le da **uno propio** de
cinco valores, y `sincronizarEtapa` traduce:

| Estado del lote | Significa | Etapa que refleja |
|---|---|---|
| `en_proceso` | El operador lo arma | `en_proceso` |
| `en_revision` | **Espera al admin** | `en_revision` |
| `con_cambios` | El admin o el cliente pidieron cambios | `con_cambios` |
| `con_cliente` | Autorizado y compartido, espera al cliente | `en_revision` |
| `aprobada` | El cliente lo aprobó, o venció el plazo | `aprobada` |

`con_cliente` es el valor que faltaba. Con él, «espera al admin» y «espera al cliente»
dejan de confundirse, y el filtro de pendientes se vuelve exacto en vez de heurístico.

Se pierde la simplicidad de «copiar sin traducir» que tenía el diseño original, y se
gana la verdad: un mes tiene una fase más que una etapa. La traducción vive en un solo
sitio, `sincronizarEtapa`.

## 3. El recorrido

1. El operador arma el mes → `en_proceso`.
2. Pulsa **«Pedir autorización»** → `en_revision`. Le aparece al admin en Pendientes,
   igual que cualquier otro entregable.
3. El admin lo revisa y:
   - **Autoriza** → puede compartirse. Solo entonces aparece el botón de compartir.
   - **Pide cambios** → `con_cambios`, vuelve al operador con sus observaciones.
4. Se comparte con el cliente → `con_cliente`, y **ahí arranca el plazo**, no antes.
5. El cliente aprueba todo, o vence el plazo → `aprobada`.
6. El cliente pide cambios → `con_cambios`, vuelve al operador. Al corregir, vuelve al
   paso 2: **una ronda nueva se autoriza otra vez**. El admin no firma en blanco.

## 4. Lo que esto arregla de paso

- **Pendientes deja de adivinar.** El bloque «Esperando al cliente» pasa a leer
  `con_cliente`, y el filtro por tipo de etapa que se añadió como parche sobra.
- **El plazo arranca al compartir**, que ya es después de autorizar. Un mes sin
  autorizar no tiene reloj corriendo.
- **Compartir sin querer deja de ser posible:** el botón no existe hasta que el mes
  está autorizado.

## 5. Lo que hay que cuidar

- **Migración del valor nuevo.** Añadir un valor a un enum y usarlo en la misma
  transacción es el error 55P04 que ya mordió a este proyecto. El migrador aplica una
  transacción por migración, así que la migración debe **añadir el valor y no usarlo**;
  quien lo escribe es el código, después.
- **Los lotes que ya existan** (ninguno en producción hoy) se quedan como están: el
  valor nuevo solo lo escribe el flujo nuevo.
- **Hoy los dos usuarios son admin**, así que en la práctica te estarías autorizando a
  ti mismo. La puerta es para cuando haya operadores; no estorba mientras tanto, pero
  conviene saberlo.

## 6. Qué no cambia

- Las reglas del plazo, los días hábiles y la auto‑aprobación.
- La revisión del cliente pieza por pieza.
- El entregable y su enlace público.
