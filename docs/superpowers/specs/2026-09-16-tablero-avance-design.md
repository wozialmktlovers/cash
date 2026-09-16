# Tablero de avance e Inicio personalizado · Diseño

**Fecha:** 2026-09-16
**Estado:** aprobado en conversación
**Alcance:** que el equipo vea, sin entrar a cada ficha, qué le toca hacer hoy y cómo va cada cliente. No se toca el cálculo de avance, que ya existe y es el mismo que ve el cliente en su portal.

---

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Qué va primero en el Inicio | Lo que espera por ti; el avance de los clientes va debajo |
| Alcance | Un admin ve todos los clientes; un operador, los suyos |
| Cálculo del avance | El que ya existe (`avanceCliente`), sin cambios |
| Saludo | Nombre de pila; si no hay, el correo |

## 2. El Inicio

### Saludo

`Hola, Michel` en lugar de «Tu estudio hoy». Usa solo el **nombre de pila**
(`usuario.nombre`); si está vacío, `nombreVisible(usuario)`, que cae en el correo.
Debajo, la frase de siempre con la fecha.

### Bloque «Te toca a ti»

Primero en la página. Lista las etapas que esperan una acción **de quien mira**:

- **Admin:** etapas `en_revision` (alguien pidió su autorización) y comentarios de
  cliente sin atender.
- **Operador:** etapas `con_cambios` (el admin pidió correcciones) y sus comentarios
  sin atender.

Cada renglón: cliente, etapa, desde cuándo espera, y enlace al documento. Ordenado
por antigüedad, lo más viejo arriba. Máximo 8; si hay más, un enlace a `/pendientes`.
Si no hay nada, un vacío amable: «Nada espera por ti».

Esto **no duplica lógica**: la consulta que hoy vive dentro de `/pendientes` se
extrae a `src/lib/pendientes.ts` y las dos páginas la comparten.

### Bloque «Avance de los clientes»

Debajo. Una tarjeta por cliente, ordenadas por avance ascendente (el más atrasado
primero, que es el que necesita atención). Cada tarjeta lleva:

- Nombre del cliente y su responsable.
- Porcentaje grande y barra.
- Los cuatro pasos como una tira: cada uno con su estado por color y su nombre.
  Un paso no contratado se ve apagado y dice «no contratado».

Los estados y sus colores salen de los tokens que ya usa la ficha del cliente, para
que un mismo estado se vea igual en todas las pantallas.

### Cifras de arriba

Las tarjetas de indicadores que ya existen se quedan, pero cambian a las que sirven
para decidir: **clientes activos**, **esperan por ti**, **avance promedio** y
**gasto del mes**.

## 3. La lista de clientes

En `TarjetaCliente.astro`, debajo del nombre: barra de avance, el porcentaje y el
nombre del paso en curso (el primero que no esté aprobado). Un cliente sin etapas
contratadas dice «Sin etapas contratadas» y no pinta barra.

## 4. Datos

Nada de esto necesita columnas nuevas. Sí hace falta **una función por lote**,
porque hoy `etapasDelCliente` resuelve un cliente por consulta y el tablero los pinta
todos:

- `etapasDeClientes(clientIds): Promise<Map<clientId, FilaEtapa[]>>` en
  `src/flujo/servicio.ts`, con un solo `select ... where client_id in (...)`.
- `resumenAvance(etapas)` en `src/lib/ui/progreso.ts`: devuelve
  `{ porcentaje, pasos: { etapa, estado, contratada }[], pasoActual }`. Pura, con
  pruebas.

Con cero clientes, ninguna de las dos consulta nada.

## 5. Qué no incluye

- No se cambian los pesos ni la fórmula del avance.
- No se añaden gráficas nuevas; `/desempeno` sigue siendo el sitio de las métricas.
- No se toca el portal del cliente.
