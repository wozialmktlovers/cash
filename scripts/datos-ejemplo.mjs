/**
 * Investigación real de Ana Yessica Villa (Diplomado en Cosmiatría Integral),
 * transcrita desde Wozial/estrategias/social-research-yessica-villa-cosmiatria.html
 * al formato que produce el pipeline.
 *
 * Sirve como ejemplo dentro del sistema: deja ver los 17 paneles con datos de un
 * cliente real en vez de material de prueba.
 *
 * Nota sobre las fuentes: el documento original las cita por nombre y no siempre
 * con enlace. Aquí se guarda el dominio de cada fuente citada, no una URL profunda
 * inventada. La fecha de consulta es la del documento.
 */

const f = (url, nota) => ({ url, consultado: '2026-08', ...(nota ? { nota } : {}) });

const IMNAS = f('https://www.imnas.mx', 'Sitio oficial, precio público');
const ILET = f('https://www.ilet.mx', 'Sitio oficial');
const EMAGISTER = f('https://www.emagister.com.mx', 'Catálogo de programas');
const DATAMEXICO = f('https://www.datamexico.org', 'Rama SCIAN 8121, ENOE-INEGI 1T 2026');
const OCC = f('https://www.occ.com.mx', 'Anuncios publicados, agosto 2026');
const COMPUTRABAJO = f('https://mx.computrabajo.com', 'Anuncios publicados, agosto 2026');
const DATAREPORTAL = f('https://datareportal.com', 'Digital 2026: Mexico');
const INEGI = f('https://www.inegi.org.mx', 'ENDUTIH 2025');
const TRENDS = f('https://trends.google.com', 'Serie de 5 años a agosto 2026');
const GREMIO = f('https://www.facebook.com', 'Grupos públicos del gremio; citas anonimizadas');

export const CLIENTE_EJEMPLO = {
  nombre: 'Ana Yessica Villa',
  giro: 'Formación en cosmiatría y estética',
  producto: 'Diplomado en Cosmiatría Integral · 8 módulos en línea',
  ciudad: 'Guadalajara, Jalisco',
  ticket: '$36,792 MXN',
  contacto: '@yessicaavillaa · 16.4K seguidores en Instagram',
  notas:
    'Ejemplo real. Investigación de fase 1 (fundamentos comerciales) realizada por Wozial. ' +
    'El diferenciador declarado por la clienta era el aval; la investigación demostró que no sostiene el precio.',
};

export const INVESTIGACION_EJEMPLO = {
  competencia: {
    estado: 'ok',
    datos: {
      directos: [
        { nombre: 'IMNAS México', producto: 'Cosmetología SEP + Cosmiatría UNAM', precio: '$3,450 MXN', duracion: '12 módulos', modalidad: 'Online', aval: 'UNAM FES Zaragoza + SEP + STPS + CONOCER', fuente: IMNAS },
        { nombre: 'IMNAS México', producto: 'Cosmetología y Cosmiatría SEP', precio: '$3,125 MXN', duracion: '12 módulos', modalidad: 'Online', aval: 'RVOE SEP, CONOCER, STPS', fuente: IMNAS },
        { nombre: 'AMECC / CCESMI', producto: 'Certificación en Cosmetología y Aparatología', precio: '$16,000 MXN', duracion: '6 meses · 360 horas', modalidad: 'No especificada', aval: 'Asociación Mexicana de Cosmetología', fuente: f('https://www.ccesmi.com', 'Sitio oficial') },
        { nombre: 'ILET', producto: 'Cosmiatría Avanzada', precio: '$26,210 MXN + IVA', duracion: '10 meses', modalidad: 'Presencial CDMX', aval: 'No declarado', fuente: ILET },
        { nombre: 'ILET', producto: 'Cosmiatría Alternativa', precio: '$28,179 MXN + IVA', duracion: '11 meses', modalidad: 'Presencial y en línea', aval: 'No declarado', fuente: ILET },
        { nombre: 'Yessica Villa (el cliente)', producto: 'Cosmiatría Integral V', precio: '$36,792 MXN', duracion: '8 meses', modalidad: 'Online', aval: 'Trámite SEP incluido', fuente: f('https://www.instagram.com/yessicaavillaa', 'Material público de la clienta') },
        { nombre: 'IPPC', producto: 'Cosmiatría e Imagen', precio: '≈$37,020 MXN', duracion: '6 meses', modalidad: 'Presencial CDMX', aval: 'No declarado', fuente: EMAGISTER },
        { nombre: 'CAPE / AsesoríaSPA', producto: 'Cosmetología y Cosmiatría', precio: '≈$39,000 MXN + IVA', duracion: '12 meses', modalidad: 'Videoconferencia con prácticas', aval: 'Certificado SEP + STPS', fuente: f('https://www.asesoriaspa.com', 'Sitio oficial') },
        { nombre: 'INEMEC', producto: 'Medicina Estética (solo médicos)', precio: '$50,800 MXN + $15,240 de aval', duracion: 'No especificada', modalidad: 'Semipresencial', aval: 'UNAM FES Zaragoza', fuente: f('https://www.inemec.mx', 'Sitio oficial') },
      ],
      indirectos: [
        { nombre: 'IMNAS México', producto: 'Curso suelto de aparatología (3 días)', precio: '$1,000 MXN', duracion: '3 días', modalidad: 'Online', aval: 'Diploma STPS', fuente: IMNAS },
        { nombre: 'AMECC', producto: 'Módulos prácticos sueltos', precio: '$3,000 MXN cada uno', duracion: 'Por módulo', modalidad: 'Presencial', aval: 'Diploma por módulo', fuente: f('https://www.ccesmi.com', 'Sitio oficial') },
        { nombre: 'Hotmart (varios)', producto: 'Cursos de cosmetología y aparatología en español', precio: 'Variable, bajo', duracion: 'Hasta 300 horas', modalidad: 'Online', aval: 'Declara "NO INCLUYE EL CERTIFICADO"', fuente: f('https://www.hotmart.com', 'Fichas públicas de producto') },
        { nombre: 'Certificaciones de marca (Dermalogica, VESCICA)', producto: 'Capacitación de fabricante', precio: 'Gratuitas o muy baratas', duracion: 'Corta', modalidad: 'Mixta', aval: 'De la marca', fuente: f('https://www.dermalogica.com.mx', 'Programa de formación de marca') },
        { nombre: 'CETIS / DGETI', producto: 'Formación técnica del área', precio: 'Costo mínimo', duracion: 'Ciclo escolar', modalidad: 'Presencial', aval: 'Público, SEP', fuente: f('https://www.gob.mx', 'Oferta educativa pública') },
      ],
      referentes: [
        { cuenta: '@vip.escuelacosmiatria (Argentina)', seguidores: 44300, pais: 'Argentina', fuente: f('https://www.instagram.com/vip.escuelacosmiatria', 'Perfil público') },
        { cuenta: '@estetica.diseno (Argentina)', seguidores: 29600, pais: 'Argentina', fuente: f('https://www.instagram.com/estetica.diseno', 'Perfil público') },
        { cuenta: '@carmennesterovsky (Venezuela)', seguidores: 29400, pais: 'Venezuela', fuente: f('https://www.instagram.com/carmennesterovsky', 'Perfil público') },
        { cuenta: '@eduem_instituto (México)', seguidores: 26000, pais: 'México', fuente: f('https://www.instagram.com/eduem_instituto', 'Perfil público') },
        { cuenta: '@yessicaavillaa (el cliente)', seguidores: 16400, pais: 'México', fuente: f('https://www.instagram.com/yessicaavillaa', 'Perfil público') },
        { cuenta: '@skinfluencer.sonia.chavez (México)', seguidores: 10600, pais: 'México', fuente: f('https://www.instagram.com/skinfluencer.sonia.chavez', 'Perfil público') },
        { cuenta: '@ladybossacademia (México)', seguidores: 8600, pais: 'México', fuente: f('https://www.instagram.com/ladybossacademia', 'Perfil público') },
      ],
      hallazgos: [
        'El centro del mercado está vacío. Entre $16,000 y $39,000 hay un puñado de jugadores y ninguno tiene marca fuerte ni presencia digital relevante. El precio de la clienta cae justo en esa franja desatendida.',
        'La modalidad en línea también está desatendida: de 68 programas de cosmiatría catalogados en Emagister, 60 son presenciales y solo 4 en línea. Un programa 100% online bien producido compite con muy poca oferta seria.',
        'La mayoría de las escuelas mexicanas no publica precios y vende por WhatsApp con asesor. Eso ya es un hallazgo: el mercado compra de forma consultiva y con ciclo largo.',
        'El competidor real de precio no es otro diplomado: son 10 a 30 cursos sueltos de $1,000 a $3,000, cada uno con su propio diploma STPS.',
        'Un diplomado de $36,792 compite contra un aval equivalente de $3,450. Si el mensaje es "diploma con validez oficial", el prospecto encuentra lo mismo a una décima parte del precio.',
        'No existe ninguna cuenta mexicana B2B de cosmiatría por encima de 30K seguidores: el techo de la categoría es 26K. Quien domina las búsquedas de "cosmiatría México" es argentino, con WhatsApp argentino y voseo.',
      ],
    },
  },

  audiencia: {
    estado: 'ok',
    datos: {
      escalera: [
        { termino: 'Esteticista', connotacion: 'Entrada. A veces se percibe como "básico"' },
        { termino: 'Cosmetóloga', connotacion: 'El más usado y el más buscado' },
        { termino: 'Cosmiatra', connotacion: 'El escalón profesional. El gancho aspiracional' },
        { termino: 'Facialista', connotacion: 'Nicho premium emergente' },
      ],
      jerga: ['aparatología', 'cavitación', 'radiofrecuencia', 'hidrafacial', 'dermapen', 'microneedling', 'peeling', 'presoterapia'],
      jergaNegocio: ['cabina', 'protocolo', 'ficha clínica', 'menú de servicios', 'insumos', 'clientas'],
      tono: [
        'De colega a colega, no de institución a alumna: ella ya trabaja en esto',
        'Concreto sobre aspiracional. «Cobra $1,200 por facial» convierte más que «transforma tu vida»',
        'Sin glamour. El eje emocional es control sobre su tiempo y su dinero, no belleza',
        'Femenino y directo: el sector es 71.5% mujeres',
        'Voz mexicana. Es un diferenciador real frente a los referentes argentinos y españoles',
      ],
      dolores: [
        { texto: 'Los sueldos son muy pero muy bajos. Sí me arrepiento de haber estudiado esa carrera.', contexto: 'Egresada del oficio, zona metropolitana de CDMX', anonimizada: true, fuente: GREMIO },
        { texto: 'La cosmetología es bien pagada si la manejas tú. Si trabajas como empleada, no lo sueñes.', contexto: 'Cosmetóloga en activo', anonimizada: true, fuente: GREMIO },
        { texto: 'Me lo manejaron como una carrera técnica cuando no era así: era un simple curso.', contexto: 'Egresada de una escuela sin RVOE', anonimizada: true, fuente: GREMIO },
        { texto: 'Investiguen mucho en qué escuela la estudian, para que no les den gato por liebre.', contexto: 'Egresada, advirtiendo a otras del gremio', anonimizada: true, fuente: GREMIO },
      ],
      aspiraciones: [
        { texto: 'Siéntete capaz, segura y dueña de tus propios ingresos.', contexto: 'Titular real de un competidor mexicano, ya optimizado para conversión', anonimizada: false, fuente: EMAGISTER },
        { texto: 'Atiende clientas desde el 4º mes.', contexto: 'Titular real de competidor: promesa de monetización temprana', anonimizada: false, fuente: EMAGISTER },
        { texto: 'Un cuartito en mi casa, empezar por mi cuenta, llevarlo alterno.', contexto: 'Formulación recurrente en el gremio: arranque gradual de bajo riesgo, no renuncia dramática', anonimizada: true, fuente: GREMIO },
      ],
      miedoPrincipal: {
        nombre: 'La escuela patito: pagar y que el papel no sirva',
        evidencia:
          'Está documentado, no percibido. En 2026 se presentó una iniciativa en el Congreso de la CDMX para obligar a escuelas sin RVOE a declararlo en su publicidad, y en Querétaro se clausuraron 12 de 120 escuelas revisadas. El mercado además cita avales mal: el estándar correcto de cosmetología facial es EC0046, y quien promociona «EC0526» está citando un estándar de operación de cargador frontal. Un DC-3 de la STPS solo puede emitirse a trabajadores de una empresa que contrató la capacitación, no a alumnas particulares. La objeción real no es «¿aprenderé?», es «¿me van a dar mi papel y ese papel sirve?».',
        fuente: f('https://www.congresocdmx.gob.mx', 'Iniciativa 2026 sobre publicidad de escuelas sin RVOE'),
      },
      unidadDeCompra:
        'No compran un diplomado: compran el permiso para cobrar más. Y no compran el total, compran la mensualidad: nadie compra «$36,792», compran «$3,299 al mes». A un promedio sectorial de $6,480, el ticket completo equivale a casi seis meses de ingreso.',
      personas: [
        {
          nombre: 'Mariana, la que ya está adentro y tocó su techo',
          edad: '34 años',
          ciudad: 'Zapopan, Jalisco',
          situacion: 'Cosmetóloga con 6 años de oficio, cabina rentada dentro de un salón, casada, dos hijos',
          demografia: ['34 años, zona metropolitana de Guadalajara', 'Ingreso propio variable de $9,000 a $14,000', 'Estudió cosmetología hace 6 años', 'Decide en pareja las compras grandes'],
          comportamiento: ['Sigue a la clienta desde hace más de un año', 'Ve sus lives, no siempre completos', 'Está en 3 o 4 grupos de Facebook del gremio', 'Guarda publicaciones de cursos «para después»'],
          dolor: ['Sus clientas piden tratamientos que no sabe dar', 'Improvisa protocolos y teme dañar una piel', 'Lleva dos años cobrando lo mismo', 'Ve a otras cobrando el triple por lo mismo'],
          objeciones: ['Son casi cuatro meses de lo que gano', '¿Y si no termino? Ya me pasó con otro curso', 'Tengo que hablarlo con mi esposo', 'Vi uno de la UNAM en tres mil pesos'],
          comoSeGana:
            'No necesita que la convenzan de que la cosmiatría es buena carrera: ya está en ella. Necesita creer que este programa en concreto la lleva a cobrar más, y municiones para la conversación en casa. Un PDF con temario, precios y credenciales es su herramienta de negociación. Su objeción de precio se responde con aritmética, no con descuento: a $3,299 al mes, si sube su limpieza facial de $600 a $1,200, con cinco sesiones al mes ya cubrió la mensualidad.',
          riesgo: 'Su ingreso es variable, lo que la hace peor pagadora en un plan largo. Y si no ve el cálculo explícito de retorno, se va con la opción de $3,450.',
        },
        {
          nombre: 'Daniela, la que quiere salirse de donde está',
          edad: '29 años',
          ciudad: 'León, Guanajuato',
          situacion: 'Licenciada en Nutrición, trabaja en consultorio ajeno, soltera, vive con su madre',
          demografia: ['29 años, ciudad media del Bajío', 'Sueldo fijo de $12,000 al mes', 'Licenciatura en área de salud', 'Decide sola, pero consulta con su madre'],
          comportamiento: ['Descubre el tema en TikTok, no en Instagram', 'Compara escuelas en pestañas abiertas por semanas', 'Busca «cuánto gana una cosmiatra» antes que el temario', 'Escribe por WhatsApp de noche'],
          dolor: ['Su carrera no le dio la vida que esperaba', 'Trabaja para el consultorio de alguien más', 'Quiere algo propio pero teme empezar de cero', 'No se siente «del mundo de la belleza»'],
          objeciones: ['¿Sirve si no tengo experiencia?', '¿Este diploma sí tiene validez oficial?', '¿Cuánto tardo en recuperar la inversión?', '¿Y si al final no consigo clientas?'],
          comoSeGana:
            'Cumple el requisito de nivel licenciatura y viene de área de salud: es exactamente el perfil que el programa pide. Tiene sueldo fijo, lo que la hace mejor pagadora en un plan de mensualidades que Mariana.',
          riesgo:
            'Es tráfico frío y compara durante semanas. Su ciclo es largo: se capta en un momento y se cierra bastante después. Tratarla como conversión inmediata es la forma más común de declarar fracasado un esfuerzo que en realidad funcionó.',
        },
      ],
    },
  },

  canales: {
    estado: 'ok',
    datos: {
      plataformas: [
        { nombre: 'WhatsApp', alcance: '91.4% de los internautas mexicanos; la favorita', notas: '7 de cada 10 mexicanos prefieren contactar una empresa por ahí antes que por teléfono o correo. Es donde cierra la venta.', fuente: DATAREPORTAL },
        { nombre: 'Facebook', alcance: '93.5 millones en México · 51.0% mujeres', notas: 'Los grupos son el hábitat profesional del gremio. Hay grupos estatales, señal de que la segmentación geográfica funciona.', fuente: DATAREPORTAL },
        { nombre: 'YouTube', alcance: '85.0 millones · 51.5% mujeres', notas: 'Consumo de formación larga, menor intención de compra inmediata.', fuente: DATAREPORTAL },
        { nombre: 'Instagram', alcance: '53.6 millones · +13.7% interanual · 53.7% mujeres', notas: 'La red con mayor sesgo femenino y la de mayor crecimiento. Es donde ya está su audiencia propia de 16.4K.', fuente: DATAREPORTAL },
        { nombre: 'TikTok', alcance: '1 h 43 min al día, el mayor tiempo de uso · 43.9% mujeres', notas: 'Donde descubre el tema el perfil de tráfico frío. Alto alcance, ciclo de decisión largo.', fuente: DATAREPORTAL },
      ],
      formatos: [
        'Reels: 4× las interacciones de una imagen simple',
        'Carruseles: 9× más guardados. Es el formato para temario y precios',
        'Imagen simple en caída libre: −46% de engagement interanual',
        'Pedir comentarios en el texto: +203% comentarios',
        'Publicar con pregunta: +37% comentarios',
        'Los hashtags penalizan: −32% de vistas frente al promedio',
      ],
      horarios:
        'Mejor ventana: 19:00 a 21:00 hora del centro, de martes a jueves y domingo. Es la única franja que aparece en las tres fuentes consultadas. Segunda ventana: 13:00 a 14:00.',
      tendencias: [
        'El eje del sector pasó de rellenar a regenerar: exosomas, polinucleótidos, skinboosters, bioestimuladores, K-beauty y skin quality',
        'Emprendimiento femenino: las mujeres de 25 a 44 años son el 44% del ecosistema emprendedor mexicano',
        'Podcast: el 60% de quienes lo consumen en México son mujeres, con autoayuda y negocios como géneros dominantes',
        'No vive en foros de texto: no hay conversación relevante en Reddit ni Quora en español sobre este oficio',
      ],
      advertenciaRegulatoria:
        'Exosomas, bioestimuladores y polinucleótidos son inyectables: acto médico. Una cosmiatra no médica no puede aplicarlos, y usarlos como gancho publicitario es riesgo regulatorio. Sí se puede enseñar y promocionar microneedling superficial, radiofrecuencia, hidrafacial, peelings superficiales y protocolos de skin quality no invasivos. Aparte: prometer ingresos infundados en formación profesional es riesgo ante Profeco.',
    },
  },

  mercado: {
    estado: 'ok',
    datos: {
      datos: [
        { etiqueta: 'Personas ocupadas en el sector (rama SCIAN 8121)', valor: '2.31 millones', fuente: DATAMEXICO },
        { etiqueta: 'Informalidad del gremio', valor: '82% (estimaciones de 85 a 89%), contra 49.9% de la carrera universitaria más informal del país', fuente: DATAMEXICO },
        { etiqueta: 'Crecimiento de unidades económicas 2018-2023', valor: 'Segunda actividad con mayor crecimiento de México: casi 72,000 negocios nuevos', fuente: DATAMEXICO },
        { etiqueta: 'Concentración geográfica de vacantes', valor: '65% en CDMX, Jalisco y Estado de México', fuente: OCC },
        { etiqueta: 'Vacantes marcadas como urgentes', valor: '26%, y la mitad lleva más de 30 días sin cubrirse', fuente: OCC },
        { etiqueta: 'Gasto mensual del hogar en cuidado personal', valor: '$1,236 MXN · 7.8% del gasto del hogar, más que salud', fuente: INEGI },
        { etiqueta: 'Uso de internet en el grupo de 25 a 34 años', valor: '96.5%', fuente: INEGI },
        { etiqueta: 'Tiempo diario en redes sociales', valor: '3 h 12 min, quinto lugar del mundo', fuente: DATAREPORTAL },
        { etiqueta: 'Búsquedas de «cosmetología» frente a «cosmiatría»', valor: '5.8 veces más. La búsqueda número uno del clúster es «cosmiatría qué es»', fuente: TRENDS },
      ],
      salarios: [
        { puesto: 'Promedio del sector (arrastrado por la informalidad)', rango: '$6,480 MXN mensuales', fuente: DATAMEXICO },
        { puesto: 'Vacante formal que pide cosmiatra certificada', rango: '$10,000 a $18,000 MXN mensuales · mediana $12,000', fuente: OCC },
        { puesto: 'Clínica en CDMX (caso real 2026)', rango: '$17,000 a $18,000 MXN mensuales', fuente: COMPUTRABAJO },
        { puesto: 'Clínica en Monterrey (caso real 2026)', rango: '$18,000 a $22,000 MXN mensuales', fuente: COMPUTRABAJO },
      ],
      regulacion: [
        { norma: 'Estándar de competencia EC0046 (cosmetología facial)', implicacion: 'Es el estándar correcto del oficio. Quien promociona «EC0526» está citando un estándar de operación de cargador frontal: un aval mal citado es señal de escuela poco seria y una objeción que se puede desarmar.', fuente: f('https://conocer.gob.mx', 'Registro nacional de estándares de competencia') },
        { norma: 'Constancia DC-3 de la STPS', implicacion: 'Solo puede emitirse a trabajadores de una empresa que contrató la capacitación, no a alumnas particulares. Ofrecerla a una alumna suelta es incorrecto.', fuente: f('https://www.gob.mx', 'Normatividad de capacitación de la STPS') },
        { norma: 'Iniciativa 2026 del Congreso de la CDMX sobre escuelas sin RVOE', implicacion: 'Obligaría a declarar la ausencia de RVOE en la publicidad. En Querétaro ya se clausuraron 12 de 120 escuelas revisadas. Explicar con precisión qué acredita cada documento es un diferenciador que casi nadie puede sostener.', fuente: f('https://www.congresocdmx.gob.mx', 'Iniciativa presentada en 2026') },
        { norma: 'Publicidad de resultados de ingreso (Profeco)', implicacion: 'Un competidor promete «gana entre $15,000 y $35,000 al mes» contra un promedio sectorial de $6,480. Prometer ingresos infundados es riesgo ante Profeco y causa directa de abandono.', fuente: f('https://www.profeco.gob.mx', 'Criterios de publicidad engañosa') },
      ],
      crecimiento:
        'Entre 2018 y 2023 los salones y clínicas de belleza fueron la segunda actividad con mayor crecimiento en unidades económicas de todo México, con casi 72,000 negocios nuevos. El empleo cae y los salarios suben de 6 a 12%: hay más demanda de perfil certificado que oferta.',
    },
  },

  sintesis: {
    estado: 'ok',
    datos: {
      hallazgos: [
        { tipo: 'bloqueante', titulo: 'El aval no puede ser el argumento', texto: 'IMNAS México vende un diplomado online de cosmiatría con aval de UNAM, SEP, STPS y CONOCER por $3,450. El de la clienta cuesta 10.7 veces más. Si el mensaje es «diploma con validez oficial», el prospecto encuentra lo mismo a una décima parte del precio.' },
        { tipo: 'salida', titulo: 'Pero sí existe un argumento que aguanta', texto: 'El sector paga $6,480 al mes en promedio porque el 82% es informal. Las vacantes formales que piden cosmiatra certificada pagan de $10,000 a $18,000. Ese diferencial de unos $5,500 mensuales es verificable con datos oficiales y recupera la inversión en poco más de seis meses.' },
        { tipo: 'problema', titulo: 'La estructura de precios está invertida', texto: 'Pagar en 12 mensualidades sale $1,416 más barato que pagar en 8. El plan con peor flujo de caja y mayor riesgo de impago es el más atractivo para el alumno. Y como el curso dura 8 meses, los últimos 4 pagos ocurren cuando ya tiene el diploma en la mano.' },
        { tipo: 'oportunidad', titulo: 'Hay un espacio vacío que nadie ocupa', texto: 'Todas las escuelas venden la técnica y el papel. Nadie en México le enseña a la cosmiatra a llenar su agenda y cobrar bien. Quien ocupa ese espacio en español le habla a las mexicanas con voseo argentino o acento español. Ahí no compite nadie local.' },
      ],
      posicionamiento: {
        frase: 'La cosmiatra mexicana que forma cosmiatras para que cobren como profesionales.',
        sustento:
          'No compite con IMNAS por el aval más barato ni con INEMEC por el mercado médico. Ocupa el espacio que hoy nadie ocupa: formación seria, con respaldo internacional verificable, que además enseña el negocio, dicho con voz mexicana desde Guadalajara a una audiencia que hoy recibe consejos con voseo argentino.',
      },
      focos: [
        { nombre: 'Su propia audiencia de 16.4K', tipo: 'prioritario', razon: 'Ya la conocen y consumen sus masterclasses. Es el activo más rentable y el más subutilizado, y el de ciclo de decisión más corto porque la confianza ya está construida.' },
        { nombre: 'Mujeres del gremio en México', tipo: 'expansion', razon: 'Esteticistas y cosmetólogas ya en activo, de 28 a 45 años, con ingreso propio. No estudiantes desde cero: profesionales con techo. Prioridad geográfica en Jalisco, segundo mercado laboral del país y donde ya tiene reconocimiento.' },
        { nombre: 'Público sin experiencia previa', tipo: 'descartado', razon: 'Tentador por volumen, pero su propia página exige nivel licenciatura y cursos previos. Con un ticket de $36,792, captar principiantes encarece el embudo sin convertir. Se retoma con un producto de entrada más accesible.' },
      ],
      oferta: {
        problemaReal:
          'El techo de ingresos de una esteticista que ya trabaja pero no puede cobrar más porque no tiene con qué respaldarlo. Lo que se vende hoy («8 módulos teórico-prácticos», «química cosmética y tecnología de vanguardia») es preciso y técnicamente correcto, pero describe el contenido y no el resultado, y el contenido es exactamente lo que toda la competencia también ofrece.',
        activosSinExplotar: [
          'Postgrado en Farmacia Dermocosmética Aplicada por la Universidad de Barcelona, más un máster en curso. En un mercado lleno de academias sin respaldo es lo más difícil de replicar, y hoy está enterrado en el «acerca de»',
          'Haber dirigido el spa del Camino Real Acapulco: experiencia operativa real. Traduce a «no te enseña teoría, te enseña lo que funciona con clientas que pagan»',
          'Coinstructor Químico Farmacéutico Biólogo con maestría enseñando química cosmética: rigor difícil de igualar que separa el programa de los cursos de fin de semana',
        ],
        faltaConstruir: [
          'Testimonios en video de egresadas contando cuánto cobraban antes y cuánto ahora. El activo de conversión más rentable, y hoy no existe públicamente',
          'Casos con números: «abrí mi cabina a los 4 meses de terminar»',
          'Claridad sobre el aval, tratado como objeción resuelta y no como titular',
          'Módulo de cómo cobrar y captar clientas: ataca la objeción real y ocupa el espacio vacío del mercado',
          'Plantillas de consentimiento y ficha de diagnóstico, comunidad privada de egresadas y guía de proveedores de aparatología en México',
        ],
        traduccion: [
          { antes: 'Diplomado en Cosmiatría Integral V', despues: 'De esteticista a cosmiatra en 8 meses, sin dejar tu trabajo', porQue: 'Nombra punto A, punto B, tiempo, y elimina la objeción principal' },
          { antes: 'Química cosmética y tecnología de vanguardia', despues: 'Aprende qué activo usar en cada piel, y por qué', porQue: 'Traduce a la decisión que ella toma cada día frente a una clienta' },
          { antes: 'Realizar diagnósticos cosmiátricos adecuados', despues: 'Deja de improvisar protocolos: diagnostica con criterio clínico', porQue: 'Le pone nombre a una inseguridad que siente pero no verbaliza' },
          { antes: '8 módulos teórico-prácticos', despues: '8 meses, 8 protocolos que puedes cobrar desde el primer mes', porQue: 'Convierte duración en retorno: cada módulo es un servicio facturable' },
          { antes: 'Incluye trámite de diploma', despues: 'Diploma con trámite ante SEP incluido', porQue: 'Objeción resuelta, no titular: IMNAS ofrece lo mismo por $3,450' },
        ],
        titularFinal: 'De esteticista a cosmiatra en 8 meses, sin dejar tu trabajo.',
      },
      precios: {
        diagnostico:
          'Con el dato de que el programa dura 8 meses, la estructura actual queda al descubierto: 8 mensualidades más inscripción suman $38,292, pero 12 mensualidades con inscripción incluida suman $36,876. Pagar más lento sale $1,416 más barato, y como el curso dura 8 meses los últimos 4 pagos ocurren cuando el alumno ya tiene el diploma y ningún incentivo para pagar. Una sola regla ordena todo: más plazo siempre cuesta más, porque el financiamiento tiene un costo y debe verse.',
        riesgos: [
          'La página dice «$240 USD» cuando el precio real ronda los $1,920 USD. Quien llega esperando $240 y descubre $36,800 MXN no genera una objeción de precio: genera desconfianza, que es mucho más cara de revertir',
          'La inscripción es ambigua: no queda claro si los $1,500 se suman en contado y en 8 meses. Cualquier ambigüedad de precio se paga en carritos abandonados',
          'El precio con forma de fórmula: $31,273.20 se lee como resultado de una hoja de cálculo, no como una oferta. Los centavos en un ticket alto restan percepción de valor',
        ],
        propuesta: [
          { plan: 'Contado, una exhibición', monto: '$30,999', total: '$30,999' },
          { plan: '8 pagos (recomendado)', monto: '$4,599 al mes', total: '$36,792' },
          { plan: '12 pagos', monto: '$3,299 al mes', total: '$39,588' },
        ],
      },
      ciclo: {
        tipo:
          'Largo, racional y de alta implicación. Ticket alto sobre el ingreso del sector, compromiso de 8 a 12 meses de pagos, frecuentemente consultado en pareja o familia, y con alta carga emocional porque es un cambio de identidad profesional.',
        etapas: [
          { nombre: 'Descubrimiento', quePiensa: 'Siente el techo. Todavía no busca un diplomado: busca aliviar una frustración', fraseTipo: 'Llevo años haciendo faciales y sigo cobrando lo mismo.' },
          { nombre: 'Investigación', quePiensa: 'Busca activamente, compara escuelas y pregunta en grupos. Aparece la duda del aval', fraseTipo: '¿Cuál sí tiene validez y no es escuela patito?' },
          { nombre: 'Evaluación', quePiensa: 'Ya tiene 2 o 3 opciones y compara precio, aval y quién enseña. Lo consulta en casa. Aquí se gana o se pierde', fraseTipo: '¿Y si pago los 8 meses y no consigo clientas?' },
          { nombre: 'Post-compra', quePiensa: 'Le quedan 8 a 12 mensualidades. El riesgo cambia: ya no es que no compre, es que abandone', fraseTipo: 'Ya voy en el módulo 3 y todavía no aplico nada.' },
        ],
        fricciones: [
          'El precio no está claro: tres planes que no se entienden y una página que dice «$240 USD». La primera pregunta siempre será el precio, y consume tiempo de venta',
          'La duda del aval es la objeción número uno del sector. Si no está resuelta arriba, el prospecto se va a comparar y no vuelve',
          'Miedo al después: «¿y si termino y no consigo clientas?». Nadie lo verbaliza en la llamada, pero decide la compra',
          'No decide sola: un compromiso de 8 a 12 meses se consulta en casa. Sin material que ella pueda mostrar, la conversación se pierde sin que nos enteremos',
          'La etapa 4 no es un detalle administrativo: cada alumna que abandona a mitad del programa es ingreso perdido que ya estaba contabilizado, y hoy no hay nada diseñado para sostener la retención',
        ],
        aceleradores: [
          'Tres planes en una sola tabla: total visible, mensualidad visible, inscripción incluida en los tres, sin asteriscos. Elimina la objeción antes de que se formule',
          'El aval arriba y con nombre: «Diploma con trámite ante SEP incluido» en el primer pantallazo, no en la letra chica',
          'Egresadas con cifras: «antes cobraba $350 por facial, hoy cobro $1,200». Un testimonio con números vale más que diez adjetivos',
          'Un PDF para llevarse con temario, precios y credenciales: es la herramienta con la que ella convence a quien decide con ella',
          'Respuesta rápida por WhatsApp, que es donde cierra este mercado',
          'Optimizar sobre el evento frecuente: un registro a sesión gratuita ocurre decenas de veces por semana, una compra de $36,792 no. El cierre se hace con intervención humana (10-20% de conversión contra 1-5% de la venta directa)',
        ],
      },
      pendientes: [
        'Aprobar la nueva estructura de precios: es el bloqueante número uno',
        'Confirmar si el módulo de negocio se incorpora al programa',
        'Conseguir 3 egresadas dispuestas a dar testimonio con cifras reales',
        'Corregir el «$240 USD» de la página actual',
        'Las dos personas son construcciones sintéticas derivadas de datos de mercado, salarios, patrones de búsqueda y objeciones documentadas. No son entrevistas reales: deben validarse con 5 a 8 conversaciones con alumnas actuales antes de tratarlas como definitivas',
        'Las frases de cada etapa del ciclo son formulaciones representativas, no verbatims. Sustituirlas por citas reales de entrevistas a egresadas en cuanto estén disponibles',
        'Los volúmenes de hashtag provienen de un dataset de octubre de 2024: considerarlos como piso, no como cifra vigente',
      ],
    },
  },
};
