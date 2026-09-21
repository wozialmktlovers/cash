/**
 * Regresión del incidente «Mar de miel» (no educativo): 15.70 USD con tope de
 * 15 y una sola etapa entregada. Los registros de producción fueron:
 *
 *   [etapa canales]     horarios: Invalid input: expected string, received array
 *   [etapa audiencia]   jerga.0: Invalid input: expected string, received object (x5)
 *   [etapa competencia] directos.0.producto: expected string, received undefined;
 *                       directos.0.precio …; .duracion …; .modalidad …; .aval …
 *
 * Aquí se simulan respuestas del modelo con esas mismas formas. Nada sale a la
 * red: el SDK está simulado y ninguna prueba gasta saldo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const crear = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: vi.fn(), stream: (cuerpo: any) => ({ finalMessage: () => crear(cuerpo) }) }; },
}));

function respuesta(texto: string, extra: Record<string, unknown> = {}) {
  return {
    content: [{ type: 'text', text: texto }],
    usage: { input_tokens: 1000, output_tokens: 500 },
    stop_reason: 'end_turn',
    ...extra,
  };
}

const FUENTE = { url: 'https://mardemiel.example/tienda', consultado: '2026-09-10' };
const CTX = '## Cliente\nNombre: Mar de miel\nGiro: Miel artesanal y productos de colmena';

beforeEach(() => {
  crear.mockReset();
  process.env.ANTHROPIC_API_KEY = 'test';
});

describe('Mar de miel: las tres formas que tiraban la etapa ahora se normalizan', () => {
  it('canales: horarios como arreglo se une en un texto, sin reintento', async () => {
    const { correrCanales } = await import('@/research/agents/canales');
    const { canalesSchema } = await import('@/research/schemas');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({
      plataformas: [{ nombre: 'Instagram', alcance: 'alto', notas: 'recetas y maridajes', fuente: FUENTE }],
      formatos: ['reels'],
      horarios: ['Instagram: 19 a 22 h entre semana', 'Facebook: domingos por la mañana'],
      tendencias: ['miel cruda'],
      advertenciaRegulatoria: 'NOM-051: etiquetado de alimentos',
    })));

    const r = await correrCanales(CTX);

    expect(r.datos.horarios).toBe('Instagram: 19 a 22 h entre semana; Facebook: domingos por la mañana');
    expect(crear).toHaveBeenCalledTimes(1);
    expect(r.parcial).toBeUndefined();
    // Y el dato guardado sigue cumpliendo el esquema del documento.
    expect(canalesSchema.safeParse(r.datos).success).toBe(true);
  });

  it('audiencia: cada término de jerga como objeto se vuelve «término: significado»', async () => {
    const { correrAudiencia } = await import('@/research/agents/audiencia');
    const jerga = [
      { termino: 'miel cruda', significado: 'sin pasteurizar' },
      { termino: 'cristalizada', significado: 'se hizo sólida, no está echada a perder' },
      { termino: 'de flor de azahar', significado: 'monofloral' },
      { termino: 'panal', significado: 'la miel en su cera' },
      { termino: 'adulterada', significado: 'rebajada con jarabe' },
    ];
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({
      escalera: [{ termino: 'consumidor de miel', connotacion: 'neutra' }],
      jerga,
      jergaNegocio: ['precio por kilo'],
      tono: ['cercano'],
      dolores: [{ texto: 'No sé si la miel del súper es real', contexto: 'compradora en un foro', anonimizada: true, fuente: FUENTE }],
      aspiraciones: [],
      miedoPrincipal: { nombre: 'Comprar miel adulterada', evidencia: 'foros y reseñas', fuente: FUENTE },
      unidadDeCompra: 'Confianza en que es miel de verdad',
      personas: [
        { nombre: 'Laura', edad: '35', ciudad: 'Mérida', situacion: 'mamá', demografia: ['clase media'], comportamiento: [], dolor: [], objeciones: [], comoSeGana: 'origen', riesgo: 'precio' },
        { nombre: 'Jorge', edad: '50', ciudad: 'CDMX', situacion: 'chef', demografia: [], comportamiento: [], dolor: [], objeciones: [], comoSeGana: 'volumen', riesgo: 'abasto' },
      ],
    })));

    const r = await correrAudiencia(CTX);

    expect(r.datos.jerga).toHaveLength(5);
    expect(r.datos.jerga[0]).toBe('miel cruda: sin pasteurizar');
    expect(r.datos.jerga.every((j) => typeof j === 'string')).toBe(true);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('competencia: un competidor sin producto, precio, duración, modalidad ni aval se conserva', async () => {
    const { correrCompetencia } = await import('@/research/agents/competencia');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({
      directos: [{ nombre: 'Miel del Valle', presentaciones: ['500 g', '1 kg'], fuente: FUENTE }],
      indirectos: [],
      referentes: [{ cuenta: '@mielartesanal', seguidores: '12.4K', pais: 'México', fuente: FUENTE }],
      hallazgos: 'Nadie vende miel monofloral certificada por debajo de 200 pesos',
    })));

    const r = await correrCompetencia(CTX);

    expect(r.datos.directos).toHaveLength(1);
    expect(r.datos.directos[0]).toMatchObject({ nombre: 'Miel del Valle', producto: '', precio: '', detalles: [] });
    expect(r.datos.directos[0].duracion).toBeUndefined();
    expect(r.datos.referentes[0].seguidores).toBe(12_400);
    expect(r.datos.hallazgos).toEqual(['Nadie vende miel monofloral certificada por debajo de 200 pesos']);
    expect(crear).toHaveBeenCalledTimes(1);
  });

  it('el prompt de competencia ya no presupone un negocio educativo y lleva la forma del JSON', async () => {
    const { correrCompetencia, FORMA_COMPETENCIA } = await import('@/research/agents/competencia');
    crear.mockResolvedValueOnce(respuesta('{"directos":[],"indirectos":[],"referentes":[],"hallazgos":[]}'));
    await correrCompetencia(CTX);
    const cuerpo = crear.mock.calls[0][0];
    const texto = (c: unknown) => (typeof c === 'string' ? c : (c as { text: string }[]).map((b) => b.text).join(''));
    expect(texto(cuerpo.messages[0].content)).toContain(FORMA_COMPETENCIA);
    expect(FORMA_COMPETENCIA).not.toMatch(/duracion|modalidad|aval/);
    expect(texto(cuerpo.system)).toMatch(/no supongas que vende cursos/i);
  });

  it('el render muestra al competidor sin chips vacíos ni «undefined»', async () => {
    const { correrCompetencia } = await import('@/research/agents/competencia');
    const { seccionDetalle } = await import('@/render/investigacion/detalle');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify({
      directos: [
        { nombre: 'Miel del Valle', fuente: FUENTE },
        { nombre: 'Colmena Viva', producto: 'Miel de azahar', precio: '$180 el frasco', detalles: ['500 g', 'envío nacional'], fuente: FUENTE },
      ],
      indirectos: [], referentes: [], hallazgos: [],
    })));
    const r = await correrCompetencia(CTX);
    const html = seccionDetalle({
      competencia: { estado: 'ok', datos: r.datos },
      audiencia: { estado: 'vacio', razon: 'x' },
      canales: { estado: 'vacio', razon: 'x' },
      mercado: { estado: 'vacio', razon: 'x' },
      sintesis: { estado: 'vacio', razon: 'x' },
    } as any, 'Mar de miel', '03');
    expect(html).toContain('Precio no publicado');
    expect(html).toContain('<li>envío nacional</li>');
    expect(html).not.toContain('<li></li>');
    expect(html).not.toContain('undefined');
  });
});

describe('Mar de miel: el reintento ya no repite la búsqueda', () => {
  it('corrige el formato con un pedido sin herramientas ni contexto del cliente', async () => {
    const { correrCanales } = await import('@/research/agents/canales');
    const { SISTEMA_CORRECCION } = await import('@/research/claude');
    // Primera respuesta: el JSON viene con prosa y sin cerrar (no se puede leer).
    const rota = 'Aquí está: {"plataformas": [], "formatos": ["reels"], "horarios": "noches"';
    crear
      .mockResolvedValueOnce(respuesta(rota))
      .mockResolvedValueOnce(respuesta('{"plataformas":[],"formatos":["reels"],"horarios":"noches","tendencias":[],"advertenciaRegulatoria":null}'));

    const r = await correrCanales(CTX);

    expect(r.datos.horarios).toBe('noches');
    expect(crear).toHaveBeenCalledTimes(2);
    const correccion = crear.mock.calls[1][0];
    expect(correccion.tools).toBeUndefined();          // sin búsqueda web
    expect(correccion.system).toBe(SISTEMA_CORRECCION);
    expect(correccion.messages).toHaveLength(1);
    expect(correccion.messages[0].content).toContain(rota);   // parte de lo ya obtenido
    expect(correccion.messages[0].content).not.toContain('Mar de miel'); // no reenvía el contexto
    expect(correccion.max_tokens).toBeLessThanOrEqual(12_000);
  });

  it('si ni la corrección valida, guarda lo que sí valida en vez de perder la etapa', async () => {
    const { correrCompetencia } = await import('@/research/agents/competencia');
    const conBasura = JSON.stringify({
      directos: [
        { nombre: 'Miel del Valle', precio: '$150', fuente: FUENTE },
        { nombre: 'Sin fuente verificable', precio: '$90', fuente: { url: 'no es una url' } },
      ],
      indirectos: [], referentes: [], hallazgos: ['algo'],
    });
    crear.mockResolvedValueOnce(respuesta(conBasura)).mockResolvedValueOnce(respuesta(conBasura));

    const r = await correrCompetencia(CTX);

    expect(r.parcial).toBe(true);
    expect(r.datos.directos.map((d) => d.nombre)).toEqual(['Miel del Valle']);
    expect(r.descartes?.[0]).toMatch(/^directos\.1/);
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('sin nada rescatable, falla con el mensaje de siempre', async () => {
    const { correrMercado } = await import('@/research/agents/mercado');
    const { MENSAJE_JSON_INVALIDO } = await import('@/research/claude');
    crear.mockResolvedValue(respuesta('No encontré datos.'));
    await expect(correrMercado(CTX)).rejects.toThrow(MENSAJE_JSON_INVALIDO);
    expect(crear).toHaveBeenCalledTimes(2);
  });
});

describe('Mar de miel, mapa de pilares: un texto largo ya no tumba la estrategia', () => {
  it('pilares.N.funcion > 120 se recorta con elipsis, sin reintento', async () => {
    const { correrEstrategia } = await import('@/pilares/agentes');
    const { estrategiaSchema } = await import('@/pilares/schemas');
    const { estrategiaFalsa } = await import('../fixtures/pilares');
    const e = estrategiaFalsa();
    // El error de producción: pilares.2, .3 y .4 con `funcion` de más de 120.
    const larga = 'Conectar la miel con los rituales cotidianos de la familia mexicana, desde el desayuno hasta el remedio de la abuela, sin caer en la nostalgia fácil';
    expect(larga.length).toBeGreaterThan(120);
    for (const i of [2, 3, 4]) e.pilares[i].funcion = larga;
    expect(estrategiaSchema.safeParse(e).success).toBe(false); // así fallaba
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(e)));

    const r = await correrEstrategia(CTX, {});

    expect(crear).toHaveBeenCalledTimes(1);
    for (const i of [2, 3, 4]) {
      const f = r.datos.pilares[i].funcion;
      expect(f.length).toBeLessThanOrEqual(120);
      expect(f.endsWith('…')).toBe(true);
      expect(larga.startsWith(f.slice(0, -1))).toBe(true);
    }
    expect(r.datos.pilares[0].funcion).toBe('Función 1'); // lo que cumplía no se toca
  });

  it('las reglas de negocio (el mix suma 100) siguen pidiendo reintento', async () => {
    const { correrEstrategia } = await import('@/pilares/agentes');
    const { estrategiaFalsa } = await import('../fixtures/pilares');
    const mala = estrategiaFalsa();
    mala.mix[0].porcentaje = 90;
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(mala)))
         .mockResolvedValueOnce(respuesta(JSON.stringify(estrategiaFalsa())));
    const r = await correrEstrategia(CTX, {});
    expect(crear).toHaveBeenCalledTimes(2);
    expect(r.datos.mix[0].porcentaje).toBe(30);
  });
});

describe('ajustarAlEsquema: el normalizador compartido de pedirJson', () => {
  it('recorta, convierte y corrige enums en cualquier esquema de agente', async () => {
    const { ajustarAlEsquema, recortar } = await import('@/research/normalizar');
    const { z } = await import('zod');
    const esquema = z.object({
      titulo: z.string().min(1).max(30),
      lista: z.array(z.string()).max(2),
      funcion: z.enum(['prueba_social', 'venta']),
      edad: z.number().int(),
      notas: z.string(),
      etiquetas: z.array(z.string()),
    });
    const { valor, ajustes } = ajustarAlEsquema(esquema, {
      titulo: 'Miel cruda de la península de Yucatán',
      lista: ['a', 'b', 'c'],
      funcion: 'Prueba social',
      edad: '35',
      notas: ['una', 'dos'],
      etiquetas: 'sola',
    });
    const r = esquema.parse(valor);
    expect(r.titulo.length).toBeLessThanOrEqual(30);
    expect(r.titulo).toBe(recortar('Miel cruda de la península de Yucatán', 30));
    expect(r.lista).toEqual(['a', 'b']);
    expect(r.funcion).toBe('prueba_social');
    expect(r.edad).toBe(35);
    expect(r.notas).toBe('una; dos');
    expect(r.etiquetas).toEqual(['sola']);
    expect(ajustes.length).toBeGreaterThanOrEqual(6);
  });

  it('no inventa lo que falta: una respuesta vacía sigue sin validar', async () => {
    const { ajustarAlEsquema } = await import('@/research/normalizar');
    const { z } = await import('zod');
    const esquema = z.object({ valor: z.string() });
    expect(esquema.safeParse(ajustarAlEsquema(esquema, { otra: 'cosa' }).valor).success).toBe(false);
  });

  it('titulares de Google de más de 30 y un gancho de copy largo caben tras ajustar', async () => {
    const { ajustarAlEsquema } = await import('@/research/normalizar');
    const { googleSchema } = await import('@/growth/schemas');
    const titular = 'Miel artesanal de Yucatán a domicilio';
    const datos = {
      googleKeywords: ['marca', 'categoria', 'precio', 'geo', 'contenido'].map((clave) => ({ clave, keywords: ['miel'], negativas: [] })),
      rsa: { titulares: Array.from({ length: 15 }, (_, i) => (i === 0 ? titular : `Titular ${i}`)), descripciones: ['a', 'b', 'c', 'd'] },
    };
    expect(googleSchema.safeParse(datos).success).toBe(false);
    const r = googleSchema.parse(ajustarAlEsquema(googleSchema, datos).valor);
    expect(r.rsa.titulares[0].length).toBeLessThanOrEqual(30);
  });
});
