# Etapa 3 · Desarrollo mensual · Borrador para revisar

**Fecha:** 2026-09-16
**Estado:** BORRADOR. No se construye hasta revisarlo con el usuario.
**Base:** `Wozial/Info cliente/OLAM_Contenido_Septiembre_Entregable (2) (1).html`, un entregable real hecho a mano. Este borrador conserva su contenido y lo lleva a la línea editorial del Studio y al flujo de etapas del sistema de trabajo.

---

## 1. Qué hace el entregable base (OLAM, septiembre)

- **Encabezado:** «Contenido mensual · Meta», cliente y mes, y un mensaje al cliente con el plazo de revisión: *2 días hábiles; sin respuesta, se considera aprobado y se programa*.
- **Vista del feed:** una imagen de cómo se verá el perfil con las piezas del mes, que se amplía en grande. Incluye una explicación de qué es, para qué sirve y cómo revisarla.
- **Resumen:** periodo (01–29 sep) y conteos: 22 contenidos, 7 posts, 2 carruseles, 3 reels y 10 historias.
- **Contenido de feed (12 piezas):** cada tarjeta trae:
  - número, formato (Post · Carrusel · Reel), fecha de publicación, plataforma (Meta) y estado;
  - arte: una imagen, un carrusel con miniaturas o un reel con enlace a Google Drive;
  - copy completo con botón «Copiar copy», CTA y hashtags dentro del copy;
  - **notas del cliente** y botones **Solicitar cambios** y **Aprobar**, por pieza.
- **Historias (10):** arte, fecha y los mismos controles de revisión.
- **Límite:** el estado de las piezas se guarda solo en el navegador (`localStorage`), no en un servidor.

## 2. Cómo encaja en el sistema de trabajo

- **Etapa:** es la **etapa 3 por cliente y por mes**. Cada mes es un «lote» con sus piezas y su propia autorización.
- **Flujo interno:** el operador arma el lote → pide autorización → el admin revisa (con comentarios anclados por pieza) → queda aprobado → se publica en el portal.
- **Revisión del cliente**, que es lo nuevo de esta etapa: en el portal, **cada pieza** tiene «Aprobar» o «Solicitar cambios» con nota.
  - Una solicitud de cambios crea un comentario anclado a la pieza, pasa el lote a *con cambios* y avisa al operador.
  - El lote queda **aprobado por el cliente** cuando todas sus piezas lo están, o cuando vence el plazo de revisión sin respuesta (auto-aprobación, como en OLAM).
- **Origen de los temas:** del **Mapa de pilares** (la etapa 2), eligiendo temas del banco. Al usarse, el tema pasa a «En desarrollo» y, al publicarse la pieza, a «Publicado».

## 3. Contenido de una pieza (propuesta)

- **Planeación:** número, fecha de publicación, formato (`post | carrusel | reel | historia`), plataforma (`facebook | instagram | ambas`) y tema del mapa (id, opcional).
- **Arte:**
  - post: una imagen;
  - carrusel: 2–10 imágenes;
  - reel: portada, más enlace de video o archivo;
  - historia: una imagen o video.

  Los archivos se suben al Studio (el sistema de archivos que ya existe) y se muestran optimizados.
- **Texto:** copy (listo para copiar), CTA, hashtags (5–10) y 3 palabras clave SEO.
- **Opcional, generado con IA desde el tema** (el «modo desarrollo de piezas» del prompt): 3 opciones con hooks, copy AIDA/PAS/PASTOR, CTA, brief visual y texto de portada. El operador elige una y la ajusta.
- **Estado para el cliente:** pendiente · aprobada · cambios solicitados, con su nota.

## 4. Página (misma línea editorial)

- **Estructura:** cabecera tipo píldora, índice lateral y 85% del ancho.
- **Portada:**
  - «Contenido de {mes}», el mensaje al cliente con el plazo y una cuenta regresiva.
  - Tarjetas de conteo por formato.
  - Barra de avance de revisión («14 de 22 aprobadas»).
- **01 · Vista del feed:** la cuadrícula del perfil armada automáticamente con las portadas de las piezas de feed en orden de fecha (3 columnas, como Instagram), sin necesidad de una imagen aparte. Se amplía al tocarla.
- **02 · Calendario:** vista de mes con cada pieza en su día, con icono de formato y color de estado. Clic en la pieza → lleva a su tarjeta.
- **03 · Contenido de feed:**
  - Tarjetas grandes con el arte a la izquierda (visor de carrusel con miniaturas, reproductor o enlace para reel) y a la derecha los datos, el copy con «Copiar», el CTA y los hashtags.
  - Controles de revisión según el rol.
  - Filtros por formato y estado.
- **04 · Historias:** tira horizontal de tarjetas verticales (9:16) con los mismos controles.

## 5. Preguntas para decidir juntos

1. ¿El plazo de auto-aprobación es siempre de 2 días hábiles, o se configura por cliente?
2. ¿Quién sube los artes: el operador, o un rol de diseñador que todavía no existe?
3. ¿Las piezas se generan con IA desde el mapa (copy y brief visual), se escriben a mano, o ambas?
4. ¿Se publica o programa directamente en Meta desde el Studio, o solo se entrega para programar fuera?
5. ¿Cuántas piezas por mes y en qué formatos, por cliente: un «paquete» contratado?
