/**
 * Regresión del manual de campaña de «Mar de miel» (no educativo): terminó
 * `completado` con 1.29 USD y etapas
 *   { google: 'fallo', prompts: 'ok', creativos: 'ok', estructura: 'fallo' }
 * sin ningún registro del error. Aquí se simulan las respuestas plausibles
 * que tumbaban esas dos etapas: forma adivinada (llaves con acento, objeto
 * por clave, rsa por campaña, respuesta envuelta), titulares largos, menos
 * anuncios de los ideales y corte por `max_tokens` con el razonamiento
 * activo. Nada sale a la red: el SDK está simulado y ninguna prueba gasta saldo.
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

const CTX = '## Cliente\nNombre: Mar de miel\nGiro: Miel artesanal y productos de colmena';

beforeEach(() => {
  crear.mockReset();
  process.env.ANTHROPIC_API_KEY = 'test';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** Estructura como la escribe un modelo que no vio la forma: en español, con acentos y envuelta. */
const estructuraAdivinada = {
  estructura: {
    semanas: '8 semanas',
    'campañasMeta': [
      { grupo: 'Grupo A', nombre: 'Miel cruda de origen', objetivo: 'Ventas', audiencia: 'Compradores de alimentos orgánicos en CDMX', 'ángulo': 'La miel del súper viene mezclada' },
      { grupo: 'Grupo B', nombre: 'Regalo con historia', objetivo: 'Ventas', audiencia: 'Quien regala en fechas', 'ángulo': 'Un regalo que se explica solo' },
      { grupo: 'Grupo C', nombre: 'Cocina con miel', objetivo: 'Tráfico', audiencia: 'Cocineros caseros', 'ángulo': 'Recetas que cambian con buena miel' },
    ],
    'campañasGoogle': {
      marca: { nombre: 'Marca', 'intención': 'Ya conoce Mar de miel' },
      'Categoría': { nombre: 'Miel artesanal', 'intención': 'Compara mieles' },
      precios: { nombre: 'Precio', 'intención': 'Busca cuánto cuesta' },
      'ubicación': { nombre: 'Envío CDMX', 'intención': 'Quiere recibirla pronto' },
      contenido: { nombre: 'Beneficios', 'intención': 'Investiga propiedades' },
    },
    bloqueantes: ['Falta el monto de inversión mensual.', 'Confirmar el etiquetado NOM-051 de los frascos.'],
    reglasCopy: 'No atribuir propiedades curativas a la miel (COFEPRIS).',
  },
};

describe('estructura: la forma adivinada ahora se convierte en vez de tirar la etapa', () => {
  it('llaves con acento, grupos «Grupo A», claves «Categoría»/«ubicación», semanas en texto: una sola llamada', async () => {
    const { correrEstructura } = await import('@/growth/agents/estructura');
    const { growthSchema } = await import('@/growth/schemas');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(estructuraAdivinada)));

    const r = await correrEstructura(CTX);

    expect(crear).toHaveBeenCalledTimes(1);
    expect(r.datos.semanas).toBe(8);
    expect(r.datos.campanasMeta.map((c) => c.grupo)).toEqual(['a', 'b', 'c']);
    expect(r.datos.campanasMeta[0].angulo).toBe('La miel del súper viene mezclada');
    expect(r.datos.campanasGoogle?.map((c) => c.clave)).toEqual(['marca', 'categoria', 'precio', 'geo', 'contenido']);
    expect(r.datos.campanasGoogle?.[1].intencion).toBe('Compara mieles');
    expect(r.datos.reglasCopy).toEqual(['No atribuir propiedades curativas a la miel (COFEPRIS).']);
    // Lo guardado sigue siendo editable: cumple el esquema del documento.
    expect(growthSchema.partial().safeParse(r.datos).success).toBe(true);
  });

  it('el pedido lleva la forma exacta y un tope de salida con holgura para el razonamiento', async () => {
    const { correrEstructura, FORMA_ESTRUCTURA } = await import('@/growth/agents/estructura');
    const { estructuraSchema } = await import('@/growth/schemas');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(estructuraAdivinada)));
    await correrEstructura(CTX);
    const cuerpo = crear.mock.calls[0][0];
    for (const llave of Object.keys(estructuraSchema.shape)) expect(FORMA_ESTRUCTURA).toContain(`"${llave}"`);
    for (const llave of ['grupo', 'objetivo', 'audiencia', 'angulo', 'clave', 'intencion']) expect(FORMA_ESTRUCTURA).toContain(`"${llave}"`);
    expect(cuerpo.messages[0].content).toContain(FORMA_ESTRUCTURA);
    expect(cuerpo.max_tokens).toBeGreaterThanOrEqual(32_000);
  });

  it('cortada por max_tokens: la corrige un pedido barato, sin volver a mandar la investigación', async () => {
    const { correrEstructura } = await import('@/growth/agents/estructura');
    const { SISTEMA_CORRECCION } = await import('@/research/claude');
    const completo = JSON.stringify(estructuraAdivinada.estructura);
    crear
      .mockResolvedValueOnce(respuesta(completo.slice(0, 600), { stop_reason: 'max_tokens' }))
      .mockResolvedValueOnce(respuesta(completo));

    const r = await correrEstructura(CTX);

    expect(crear).toHaveBeenCalledTimes(2);
    const correccion = crear.mock.calls[1][0];
    expect(correccion.system).toBe(SISTEMA_CORRECCION);
    expect(correccion.messages[0].content).not.toContain('Giro: Miel artesanal');
    expect(correccion.messages[0].content).toContain('"campanasMeta"');
    expect(r.datos.campanasMeta).toHaveLength(3);
  });

  it('una campaña sin ángulo no tira las otras: se guarda lo que valida', async () => {
    const { correrEstructura } = await import('@/growth/agents/estructura');
    const malo = structuredClone(estructuraAdivinada.estructura) as any;
    delete malo['campañasMeta'][2]['ángulo'];
    crear.mockResolvedValue(respuesta(JSON.stringify(malo)));

    const r = await correrEstructura(CTX);

    expect(r.parcial).toBe(true);
    expect(r.datos.campanasMeta.map((c) => c.grupo)).toEqual(['a', 'b']);
    expect(r.datos.bloqueantes).toHaveLength(2);
  });

  it('semanas fuera de rango se acota en vez de rechazar la etapa', async () => {
    const { prepararEstructura } = await import('@/growth/normalizar');
    expect((prepararEstructura({ semanas: 16, campanasMeta: [] }) as any).semanas).toBe(12);
    expect((prepararEstructura({ semanas: 'unas cuantas', campanasMeta: [] }) as any).semanas).toBeUndefined();
  });
});

const largo = 'Miel cruda de la península de Yucatán a domicilio';

/** Google como lo escribe un modelo que no vio la forma: objeto por clave y un rsa por campaña. */
const googleAdivinado = {
  googleKeywords: {
    marca: { keywords: ['mar de miel', 'mar de miel tienda'] },
    'categoría': { keywords: ['miel artesanal', 'miel cruda'], negativas: ['receta', 'empleo'] },
    precio: { keywords: ['precio miel artesanal', 'miel cruda costo'], negativas: ['mayoreo'] },
    geo: { keywords: ['miel artesanal cdmx'], negativas: [] },
    contenido: { keywords: ['beneficios de la miel cruda'], negativas: ['receta'] },
  },
  rsa: [
    { campana: 'marca', 'títulos': [largo, 'Mar de miel oficial', 'Miel de colmena real', 'Envío a todo México'], descripciones: ['Miel cruda sin mezclas, de apicultores de Yucatán. Pide hoy y recíbela en casa en 48 horas hábiles.'] },
    { campana: 'categoria', 'títulos': ['Miel artesanal pura', 'Sin jarabes ni mezclas', 'Mar de miel oficial'], descripciones: ['Cada frasco dice de qué floración viene.', 'Sin jarabe de maíz: miel como sale del panal.'] },
  ],
};

describe('google: la forma adivinada ahora se convierte en vez de tirar la etapa', () => {
  it('objeto por clave, rsa por campaña, titulares largos y negativas que faltan: una sola llamada', async () => {
    const { correrGoogle } = await import('@/growth/agents/google');
    const { growthSchema } = await import('@/growth/schemas');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(googleAdivinado)));

    const r = await correrGoogle(CTX, null);

    expect(crear).toHaveBeenCalledTimes(1);
    expect(r.datos.googleKeywords.map((k) => k.clave)).toEqual(['marca', 'categoria', 'precio', 'geo', 'contenido']);
    expect(r.datos.googleKeywords[0].negativas).toEqual([]);
    const { titulares, descripciones } = r.datos.rsa!;
    // Recortado por palabra y sin elipsis: se puede cargar tal cual en Google Ads.
    for (const t of titulares) expect(t.length).toBeLessThanOrEqual(30);
    for (const d of descripciones) expect(d.length).toBeLessThanOrEqual(90);
    expect(titulares[0]).toBe('Miel cruda de la península');
    expect(titulares.join('')).not.toContain('…');
    // «Mar de miel oficial» venía en dos campañas: se cuenta una vez.
    expect(titulares.filter((t) => t === 'Mar de miel oficial')).toHaveLength(1);
    expect(titulares).toHaveLength(6);
    expect(descripciones).toHaveLength(3);
    // El documento guardado sigue siendo editable.
    expect(growthSchema.partial().safeParse(r.datos).success).toBe(true);
  });

  it('si los anuncios no alcanzan el mínimo de Google, salva las keywords en vez de tirar la etapa', async () => {
    const { correrGoogle } = await import('@/growth/agents/google');
    const pobre = { ...googleAdivinado, rsa: { titulares: ['Miel artesanal'], descripciones: ['Sin mezclas.'] } };
    crear.mockResolvedValue(respuesta(JSON.stringify(pobre)));

    const r = await correrGoogle(CTX, null);

    expect(r.parcial).toBe(true);
    expect(r.datos.googleKeywords).toHaveLength(5);
    expect(r.datos.rsa).toBeUndefined();
    // Primer intento y una corrección barata; nunca el pedido completo otra vez.
    expect(crear).toHaveBeenCalledTimes(2);
  });

  it('cortada por max_tokens (razonamiento sin JSON): reintenta y sale', async () => {
    const { correrGoogle } = await import('@/growth/agents/google');
    crear
      .mockResolvedValueOnce({ content: [{ type: 'thinking', thinking: '' }], usage: { input_tokens: 9000, output_tokens: 32000 }, stop_reason: 'max_tokens' })
      .mockResolvedValueOnce(respuesta(JSON.stringify(googleAdivinado)));

    const r = await correrGoogle(CTX, null);

    expect(r.datos.googleKeywords).toHaveLength(5);
    expect(crear.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(32_000);
  });

  it('el pedido lleva la forma exacta y ya no presupone que se vende formación', async () => {
    const { correrGoogle, FORMA_GOOGLE } = await import('@/growth/agents/google');
    const { googleSchema } = await import('@/growth/schemas');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(googleAdivinado)));
    await correrGoogle(CTX, null);
    const cuerpo = crear.mock.calls[0][0];
    for (const llave of Object.keys(googleSchema.shape)) expect(FORMA_GOOGLE).toContain(`"${llave}"`);
    for (const llave of ['clave', 'keywords', 'negativas', 'titulares', 'descripciones']) expect(FORMA_GOOGLE).toContain(`"${llave}"`);
    expect(cuerpo.messages[0].content).toContain(FORMA_GOOGLE);
    expect(cuerpo.system).not.toMatch(/formaci[oó]n|diplomado|curso/i);
    // Contar letra por letra era lo que se comía el presupuesto de razonamiento.
    expect(cuerpo.system).not.toMatch(/Cuenta los caracteres/i);
  });

  it('Google usa las campañas que decidió estructura cuando las hay', async () => {
    const { correrGoogle } = await import('@/growth/agents/google');
    crear.mockResolvedValueOnce(respuesta(JSON.stringify(googleAdivinado)));
    await correrGoogle(CTX, {
      campanasMeta: [{ grupo: 'a', nombre: 'x', objetivo: 'x', audiencia: 'x', angulo: 'x' }],
      campanasGoogle: [{ clave: 'geo', nombre: 'Envío CDMX', intencion: 'Quiere recibirla pronto' }],
    });
    expect(crear.mock.calls[0][0].messages[0].content).toContain('- geo: Envío CDMX');
  });
});

describe('recortarAnuncio', () => {
  it('corta por palabra, sin elipsis ni puntuación colgando', async () => {
    const { recortarAnuncio } = await import('@/growth/schemas');
    expect(recortarAnuncio('Miel cruda, sin mezclas y con envío', 30)).toBe('Miel cruda, sin mezclas');
    expect(recortarAnuncio('Corto', 30)).toBe('Corto');
    expect(recortarAnuncio('Supercalifragilisticoespialidoso', 30)).toHaveLength(30);
  });
});

describe('el manual se rinde con los datos normalizados', () => {
  it('estructura parcial y Google sin anuncios: rinde las secciones y el documento es editable', async () => {
    const { correrEstructura } = await import('@/growth/agents/estructura');
    const { correrGoogle } = await import('@/growth/agents/google');
    const { renderizarManual } = await import('@/render/growth/manual');
    const { validarDocumento } = await import('@/flujo/edicion');

    crear.mockResolvedValueOnce(respuesta(JSON.stringify(estructuraAdivinada)));
    const e = await correrEstructura(CTX);
    const pobre = { ...googleAdivinado, rsa: { titulares: ['Miel'], descripciones: [] } };
    crear.mockResolvedValue(respuesta(JSON.stringify(pobre)));
    const g = await correrGoogle(CTX, e.datos);

    const datos = { _huecos: { creativos: 'x', prompts: 'x' }, ...e.datos, ...g.datos };
    const html = renderizarManual(datos as any, {
      cliente: 'Mar de miel', producto: 'Miel artesanal', fecha: '2026-09-18',
      destino: 'https://mardemiel.example', ciudad: 'CDMX',
    });
    expect((html.match(/class="sec"/g) ?? []).length).toBe(8);
    expect(html).toContain('Miel cruda de origen');
    expect(html).toContain('miel artesanal cdmx');
    expect(html).toContain('Falta el monto de inversión mensual.');

    const { _huecos, ...documento } = datos;
    expect(validarDocumento('growth', { ...documento, _huecos })).toEqual({ ok: true });
  });
});
