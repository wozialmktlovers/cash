# Etapa 3 · Desarrollo mensual · Diseño

**Fecha:** 2026-09-16
**Estado:** pendiente de tu revisión
**Base:** `Wozial/Info cliente/OLAM_Contenido_Septiembre_Entregable (2) (1).html`, un entregable real hecho a mano, llevado a la línea del Studio y al flujo de etapas.
**Sustituye a:** `2026-09-16-desarrollo-mensual-borrador.md`, cuyas cinco preguntas ya están respondidas.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Copy | El agente propone 3 opciones desde un tema del mapa de pilares; el operador elige y edita |
| Publicación | El Studio **no** publica ni programa en Meta. Entrega listo para programar fuera |
| Artes | Los sube el operador. No se crea un rol de diseñador |
| Plazo de revisión | 2 días hábiles por omisión, configurable por cliente |
| Cuántas piezas | Paquete fijo por cliente; el sistema avisa si el mes no cuadra |

## 2. La decisión estructural: un lote por mes

Las otras tres etapas ocurren una vez. Esta se repite cada mes, y el sistema guarda
**un estado por etapa y cliente**, no uno por mes.

**Solución:** una tabla nueva de **lotes** (`contenido_lotes`), uno por cliente y
periodo (`2026-09`). La fila de `cliente_etapas` para `desarrollo_mensual` refleja
siempre el **lote activo**, que es el más reciente sin aprobar; si todos están
aprobados, el último.

Consecuencias, y conviene tenerlas claras:

- El avance del cliente y el tablero hablan del **mes en curso**, no del histórico.
- Aprobar el lote de septiembre y abrir el de octubre devuelve la etapa a
  «en proceso». Es correcto: hay trabajo nuevo que hacer.
- Los meses anteriores no desaparecen: quedan accesibles y el cliente puede
  volver a verlos desde su portal.

Es el único punto del diseño que obliga a torcer algo del modelo existente. La
alternativa —una etapa nueva por mes— haría crecer la lista de etapas sin fin y
rompería el «4 pasos» que le prometemos al cliente.

## 3. El paquete del cliente

Al contratar la etapa se define cuántas piezas lleva ese cliente al mes, por
formato: posts, carruseles, reels e historias. Se guarda en el cliente, no en el
lote, y cada lote nuevo lo hereda.

El sistema **avisa** cuando el lote no cuadra con el paquete («faltan 2 historias»),
pero **no impide** cerrar el mes: un mes puede legítimamente salirse de lo pactado, y
el operador sabrá por qué. Es un recordatorio, no un candado.

## 4. Una pieza

- **Planeación:** número, fecha de publicación, formato (`post | carrusel | reel |
  historia`), plataforma (`facebook | instagram | ambas`) y el tema del mapa de
  pilares del que salió (opcional).
- **Arte:** post, una imagen; carrusel, de 2 a 10; reel, portada más enlace o
  archivo de video; historia, una imagen o video. Se suben con el sistema de
  archivos que ya existe.
- **Texto:** copy listo para copiar, llamado a la acción y hashtags.
- **Estado de revisión del cliente:** pendiente · aprobada · con cambios, con su nota.

Al usar un tema del mapa, ese tema pasa a «En desarrollo», y a «Publicado» cuando
la pieza se marca como publicada. Es la unión entre la etapa 2 y la 3.

## 5. Generar el copy con el agente

Desde una pieza, el operador elige un tema del banco y pide propuestas. El agente
devuelve **3 opciones**, cada una con gancho, copy, llamado a la acción, hashtags y
un **brief visual** para quien haga el arte. El operador elige una, la edita y la
guarda.

Se genera **pieza por pieza**, no el mes entero de golpe: el costo se reparte, el
operador mantiene el control y un fallo no tumba el lote. Tope de gasto por
petición, con el mismo freno del resto del sistema.

## 6. Revisión del cliente, pieza por pieza

Es lo nuevo de esta etapa. En el portal, cada pieza tiene **Aprobar** o **Solicitar
cambios** con nota.

- Solicitar cambios crea un comentario anclado a esa pieza, pasa el lote a
  «con cambios» y avisa al operador.
- El lote queda **aprobado por el cliente** cuando todas sus piezas lo están.
- **Auto‑aprobación:** si el cliente no responde en el plazo (2 días hábiles por
  omisión, configurable por cliente), el lote se da por aprobado. El entregable lo
  dice desde arriba, con la fecha límite visible y una cuenta regresiva, para que
  nadie se sienta pasado por encima.

El plazo cuenta desde que el lote se comparte con el cliente, no desde que se crea.

## 7. La página

Misma línea editorial que la investigación y el mapa de pilares: 85% del ancho,
cabecera flotante, índice lateral, día y noche.

- **Portada:** «Contenido de septiembre», el mensaje al cliente con el plazo y la
  cuenta regresiva, las cifras por formato y una barra de «14 de 22 aprobadas».
- **01 · Vista del feed:** la cuadrícula del perfil armada **automáticamente** con
  las portadas de las piezas de feed en orden de fecha, a 3 columnas. En OLAM era una
  imagen hecha a mano; aquí sale sola y siempre está al día.
- **02 · Calendario:** el mes con cada pieza en su día, con su icono de formato y su
  color de estado. Al tocar una, lleva a su tarjeta.
- **03 · Contenido de feed:** tarjetas grandes con el arte a la izquierda (visor de
  carrusel, reproductor o enlace para reel) y a la derecha los datos, el copy con
  «Copiar», el llamado a la acción y los hashtags. Filtros por formato y estado.
- **04 · Historias:** tira horizontal de tarjetas verticales, con los mismos controles.

A diferencia de OLAM, **el estado de revisión se guarda en el servidor**, no en el
navegador: así lo ve el equipo, sobrevive a cambiar de dispositivo y queda registrado
quién aprobó qué y cuándo.

## 8. Qué no incluye

- No publica ni programa en Meta.
- No hay rol de diseñador.
- No se generan las imágenes; el agente escribe el brief, el arte lo sube el operador.
- No se factura ni se cobra desde aquí.
