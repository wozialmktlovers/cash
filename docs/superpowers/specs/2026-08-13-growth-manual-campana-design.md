# Growth Wozial · Manual de campaña — diseño

Fecha: 2026-08-13
Estado: aprobado por el operador (secciones 1–4 y las cuatro autorizaciones)

## Qué se construye

Un segundo generador dentro de Wozial Studio. A partir de una investigación
Social Research ya completada, produce el «Growth Wozial · Manual de campaña»:
el documento que se le presenta al cliente con la campaña lista para montar.

Referencias, ambas fuera del repo:

- Machote con marcadores: `~/Desktop/Claude/Wozial/estrategias/machote-growth-wozial.html`
- Ejemplo real (Yessica Villa): `~/Desktop/Claude/Wozial/estrategias/growth-wozial-yessica-villa.html`

El machote manda sobre la línea de diseño. Donde este documento y el machote
discrepen, gana el machote.

## Decisiones tomadas

1. **Encadenado al Social Research, sin captura extra.** El Growth solo existe
   para clientes con investigación completada y razona sobre esos datos, que ya
   vienen con fuente. No vuelve a buscar en la web.

   Se verificó que no falta ningún dato de entrada: lo que podría parecer una
   entrada obligatoria —el monto de inversión mensual— en el machote es una
   *salida*, listada bajo «Bloqueantes · sin esto no se arranca», junto con la
   fecha de cierre y el contenedor de GTM publicado. El manual le dice al
   cliente qué falta, igual que el Social Research declara paneles vacíos.

2. **El modelo escribe solo lo que cambia por cliente.** La fontanería
   —nomenclatura UTM, implementación GTM/GA4/píxel, tabla de medición,
   contadores de portada— se genera con código determinista.

3. **La estructura es fija, estándar de la casa.** 3 campañas Meta, 5 de
   Google, 9 creativos, 14 URLs etiquetadas. Solo el número de semanas varía
   (en el machote es el único marcador de esos: `[N] Semanas`).

   Los números no son independientes: 3 campañas Meta (grupos a, b, c) × 3
   formatos (imagen, video, carrusel) = 9 creativos; + 5 campañas de Google
   = 14 URLs. Es la misma estructura contada de tres maneras, y eso permite
   derivar los contadores de portada sin modelo.

4. **Base de render compartida** entre el deck y el Growth (enfoque A de tres
   evaluados). Razón concreta, no estética: el Growth también se presenta
   compartiendo pantalla en videollamada, así que debe heredar la escala
   tipográfica `--esc`, el piso de 12px y los grises subidos que se
   implementaron el 2026-08-13. Un renderizador aparte obligaría a reescribir
   ese trabajo y los dos documentos derivarían.

## 1 · Arquitectura de render

`src/render/` pasa de plano a tres capas.

```
src/render/
  base/
    tokens.ts       --esc, colores, radios, tipografía, grises
    comunes.ts      las 41 clases compartidas: card, tbl, lst, badge,
                    blob, wrap, guia, grad, chips de color, alert…
  deck/
    estilos.ts      envase de 17 paneles: deck, panel, dots, prog, mas
    navegacion.ts   (se mueve tal cual, sin reescribir)
    presentation.ts
    panels/
  growth/
    estilos.ts      envase de 9 secciones + las 49 clases propias
    navegacion.ts   nav de anclas con scroll-spy y barra de progreso
    manual.ts       ensambla el documento
    secciones/
```

Clases propias del Growth (medidas contra el machote, 49 en total):
`sec`, `shead`, `shead-n`, `shead-x`, `skicker`, `nav`, `nav-links`,
`slot`, `slots`, `slots-car`, `slot-n`, `slot-p`, `slot-r`, `slot-t`,
`ar-1x1`, `ar-4x5`, `ar-9x16`, `copy`, `kv`, `kv-k`, `chips`, `chip`,
`chip-k`, `chip-x`, `pre`, `tbl-bare`, `utm`, `utm-c`, `utm-l`, `hr`,
`g5`, `gcols`, `grp`, `grp-a`, `grp-b`, `grp-c`, `grp-hd`, `grp-bd`,
`fmt`, `fmt-hd`, `fmt-bd`, `fmt-ic`, `fmt-side`, `fmt-split`,
`ilu`, `ilu-card`, `ilu-grp`, `ilu-hero`, `ilu-sec`.

**Restricción heredada:** las pruebas de videollamada que ya existen
(«ningún font-size en px sueltos», «nada por debajo de 0.75rem») se amplían
para cubrir las tres capas. El Growth nace cumpliendo el estándar.

**Riesgo y mitigación:** partir `estilos.ts` toca código que hoy funciona en
producción. Los 78 tests actuales son la red; el reparto es mecánico (mover
reglas, no reescribirlas) y el render del deck debe seguir produciendo
exactamente los mismos 17 paneles.

## 2 · Datos

### Tablas

- **`growth_results`** — nueva. Espejo de `research_results`: `id`, `jobId`,
  `clientId`, `datos` (jsonb), `version`, `createdAt`.
- **`research_jobs.tipo`** — columna nueva, enum `documento_tipo`
  (`research` | `growth`), por omisión `research`. El mismo worker, los
  mismos estados y la misma contabilidad de costo sirven a los dos pipelines.
  No se crea un segundo sistema de colas.
- **`share_links`** — pasa de apuntar solo a `research_results` a apuntar a un
  documento con su tipo: `documentoId` + `documentoTipo`. Migración de relleno
  que marca las filas existentes como `research`, para que los links ya
  repartidos sigan resolviendo.

### Esquemas Zod

La forma fija se impone en el esquema, no en el prompt. Si el modelo devuelve
ocho o diez creativos, la validación falla y reintenta, igual que hoy.

```
growthSchema = {
  semanas: number (2..12)          // el único número variable
  campanasMeta: tuple de 3 { grupo: 'a'|'b'|'c', nombre, objetivo,
                             audiencia, angulo }
  campanasGoogle: tuple de 5 { clave: 'marca'|'categoria'|'precio'|
                               'geo'|'contenido', nombre, intencion }
  creativos: tuple de 9 { grupo, formato: 'imagen'|'video'|'carrusel',
                          ratio: '1x1'|'4x5'|'9x16', medidas,
                          angulo, copyA, copyB }
  promptsImagen: { base: string, porCreativo: tuple de 9 }
  googleKeywords: por campaña, con concordancia y negativas
  rsa: { titulares: 15 máx 30 car., descripciones: 4 máx 90 car. }
  bloqueantes: lista
  reglasCopy: lista
}
```

Los límites de caracteres de RSA se validan en el esquema: son límites reales
de Google Ads y un titular de 34 caracteres no se puede cargar.

## 3 · Pipeline

Cuatro etapas. Las tres primeras en paralelo; `prompts` espera a `creativos`.

| Etapa | Produce | Depende de |
|---|---|---|
| `estructura` | 3 campañas Meta + 5 Google, audiencias, objetivos, semanas | — |
| `creativos` | 9 creativos con formato, ratio, ángulo y dos copys | — |
| `google` | keywords por campaña, titulares y descripciones RSA | — |
| `prompts` | prompt base + uno por creativo, en inglés | `creativos` |

El contexto de entrada es el resultado del Social Research serializado
(audiencia, personas, competencia, precios, ciclo de compra, regulación), no
la ficha cruda del cliente.

### Generado por código, sin tokens

- **Constructor de UTM.** La convención del machote está completamente
  especificada y por tanto es determinista:

  | Parámetro | Meta | Google |
  |---|---|---|
  | `utm_source` | `meta` | `google` |
  | `utm_medium` | `paid_social` | `cpc` |
  | `utm_campaign` | `[cliente]_[periodo]` | igual |
  | `utm_content` | `ga_imagen`…`gc_carrusel` | `g1_marca`…`g5_contenido` |
  | `utm_term` | el ángulo | `{keyword}` (inserción dinámica) |

  `g4_geo_[ciudad]` toma `clients.ciudad`. Reglas de escritura: minúsculas,
  guion bajo, sin acentos ni eñes. Las 14 URLs salen de slug del cliente,
  periodo, los 3 ángulos y la ciudad.

  **`[periodo]` es la fecha de generación del manual en formato `YYYYMM`.**
  No puede ser la fecha de arranque de campaña: esa es justamente uno de los
  bloqueantes que el cliente todavía no ha dado. Se toma del `createdAt` del
  resultado, no de un reloj en tiempo de render, para que regenerar el HTML de
  un manual viejo no cambie sus URLs — si cambiaran, dejarían de casar con lo
  que ya está cargado en las plataformas.

- **Implementación técnica**, **tabla de medición** y **contadores de
  portada**: plantilla con los nombres del cliente sustituidos.

**Corrección sobre bloqueantes y reglas de copy.** Una primera versión de este
diseño los ponía aquí, entre lo determinista. Es falso: en el documento real
dicen cosas como «Precios corregidos y publicados — pagar en 12 meses sale más
barato que en 8; está invertido», o «El aval no es titular: IMNAS lo tiene por
$3,450, va en el cuerpo como objeción resuelta». Eso es prosa que exige juicio
sobre los hallazgos, no una sustitución de plantilla. Los escribe el agente de
`estructura`, apoyado en la síntesis y en `mercado.regulacion`, y viajan en el
esquema como listas validadas.

### Tope de costo

Se corrige para **los dos pipelines**. Hoy las etapas paralelas consultan el
tope antes de arrancar, todas con el acumulado en cero, así que ninguna se
corta a media corrida y el tope solo puede impedir la última etapa. El cambio:

1. Cada etapa vuelve a mirar el acumulado al terminar, bajo un candado, y las
   pendientes que queden se marcan `omitido_por_costo`.
2. Se comprueba también entre reanudaciones de `pause_turn`, que es donde la
   búsqueda web más dispara el gasto.

## 4 · Flujo, errores y pruebas

**Flujo.** Botón «Generar manual de campaña» en la ficha del cliente,
habilitado solo si hay una investigación completada: el encadenado se impone
en la interfaz, no solo en el código. Precheck → job → la misma página de
progreso → `/growth/[id]` con barra de operador → link público revocable sin
ella.

**Errores.** Una etapa que falla declara el hueco, no lo rellena. Si cae
`creativos`, los 9 slots siguen apareciendo con su ratio y sus medidas —esa
parte es determinista— y los copys dicen por qué faltan. Si la investigación
de origen venía parcial, el manual lo dice en vez de inventar sobre datos que
nunca existieron.

**Pruebas.**

- Constructor de UTM: función pura, tabla de casos con acentos, eñes,
  espacios, mayúsculas y ciudad ausente.
- Esquemas por rechazo: 8 o 10 creativos deben fallar; un titular RSA de 31
  caracteres debe fallar.
- Render: 9 secciones, escapado de HTML e inyección, herencia de las tres
  pruebas de videollamada, y `new Function` sobre el script de navegación del
  Growth.
- Tope de costo: una etapa que se pasa del tope deja las siguientes en
  `omitido_por_costo`.
- El deck sigue produciendo 17 paneles idénticos tras partir la hoja de
  estilos.

## Fuera de alcance

- Subir creativos: los `slot` del machote son especificaciones para el
  diseñador (ratio y píxeles), no contenedores de imagen. Se comprobó en el
  documento real: 30 slots y ningún archivo.
- Captura de presupuesto, fechas o cuentas: son bloqueantes que el manual
  reporta, no entradas que pida.
- Generar el Growth automáticamente al terminar la investigación: se lanza a
  mano, después de revisar el Social Research.
