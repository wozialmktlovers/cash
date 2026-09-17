import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIError } from '@anthropic-ai/sdk';
import { MENSAJE_SALDO } from '@/lib/errores-agentes';

/**
 * El incidente del 16 de septiembre, reproducido de punta a punta en los tres
 * pipelines: la cuenta se queda sin saldo a media generación y hay que
 * comprobar que el trabajo entero para, que el job queda con el mensaje que
 * una persona entiende y que lo que ya se había pagado no se tira.
 *
 * No se llama a la API de Anthropic: los agentes están mockeados y el error se
 * fabrica con `APIError.generate`, la misma función que el SDK usa para
 * convertir una respuesta HTTP en excepción.
 */

const SIN_SALDO = () => APIError.generate(
  400,
  {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
    },
  },
  undefined,
  new Headers(),
);

const RATE_LIMIT = () => APIError.generate(
  429,
  { type: 'error', error: { type: 'rate_limit_error', message: 'Number of requests has exceeded your rate limit.' } },
  undefined,
  new Headers(),
);

// --- base de datos simulada ------------------------------------------------
//
// Doble tosco, del mismo estilo que el de `worker.test.ts`: ignora los `where`
// (cada prueba monta un solo cliente y un solo job, así que no hay a quién
// confundir) y apunta las escrituras. Lo que estas pruebas leen de él es el
// ÚLTIMO update sobre `research_jobs` —el desenlace— y la fila de resultados
// que se llegó a insertar.
const mockDb = vi.hoisted(() => {
  const TABLAS = {
    researchJobs: { __t: 'researchJobs' },
    researchResults: { __t: 'researchResults' },
    growthResults: { __t: 'growthResults' },
    pilaresResults: { __t: 'pilaresResults' },
    clients: { __t: 'clients' },
    clientLinks: { __t: 'clientLinks' },
    clientFiles: { __t: 'clientFiles' },
  };

  const estado = {
    job: {} as any,
    investigaciones: [] as any[],
    updates: [] as { tabla: any; valores: any }[],
    inserts: [] as { tabla: any; valores: any }[],
  };

  const filasDe = (tabla: any): any[] => {
    if (tabla === TABLAS.researchJobs) return [estado.job];
    if (tabla === TABLAS.clients) return [{ id: 'c1', nombre: 'Cliente de prueba' }];
    if (tabla === TABLAS.researchResults) return estado.investigaciones;
    return [];
  };

  const cadena = (filas: any[]): any => ({
    where: () => cadena(filas),
    orderBy: () => cadena(filas),
    for: () => cadena(filas),
    limit: (n: number) => cadena(filas.slice(0, n)),
    then: (ok: any, mal: any) => Promise.resolve(filas).then(ok, mal),
  });

  const db = {
    select: (..._c: any[]) => ({ from: (tabla: any) => cadena(filasDe(tabla)) }),
    update: (tabla: any) => ({
      set: (valores: any) => ({
        where: () => { estado.updates.push({ tabla, valores }); return Promise.resolve(); },
      }),
    }),
    insert: (tabla: any) => ({
      values: (valores: any) => {
        estado.inserts.push({ tabla, valores });
        return { returning: () => Promise.resolve([{ id: 'r1' }]) };
      },
    }),
  };

  return { TABLAS, estado, db };
});

vi.mock('@/db', () => ({ db: mockDb.db, ...mockDb.TABLAS }));
vi.mock('@/flujo/servicio', () => ({ registrarEntregable: vi.fn(async () => {}) }));
vi.mock('@/research/contexto', () => ({ armarContexto: () => ({ nombre: 'Cliente de prueba' }) }));
vi.mock('@/growth/contexto', () => ({ armarContextoGrowth: () => ({ nombre: 'Cliente de prueba' }) }));

// --- agentes ---------------------------------------------------------------
const agentes = vi.hoisted(() => {
  const respuesta = (datos: any) => ({ datos, tokensEntrada: 1000, tokensSalida: 500 });
  return {
    respuesta,
    competencia: vi.fn(async () => respuesta({ competidores: [] })),
    audiencia: vi.fn(async () => respuesta({ personas: [] })),
    canales: vi.fn(async () => respuesta({ canales: [] })),
    mercado: vi.fn(async () => respuesta({ cifras: [] })),
    sintesis: vi.fn(async () => respuesta({ decisiones: [] })),
    lectura: vi.fn(async () => respuesta({ portada: {} })),
    estructura: vi.fn(async () => respuesta({ campanas: [] })),
    creativos: vi.fn(async () => respuesta({ anuncios: [] })),
    google: vi.fn(async () => respuesta({ palabras: [] })),
    prompts: vi.fn(async () => respuesta({ prompts: [] })),
    estrategia: vi.fn(async () => respuesta(null)),
    pilar: vi.fn(async () => respuesta(null)),
    correccion: vi.fn(async () => respuesta({ temas: [] })),
  };
});

vi.mock('@/research/agents/competencia', () => ({ correrCompetencia: agentes.competencia }));
vi.mock('@/research/agents/audiencia', () => ({ correrAudiencia: agentes.audiencia }));
vi.mock('@/research/agents/canales', () => ({ correrCanales: agentes.canales }));
vi.mock('@/research/agents/mercado', () => ({ correrMercado: agentes.mercado }));
vi.mock('@/research/agents/sintesis', () => ({ correrSintesis: agentes.sintesis }));
vi.mock('@/research/agents/lectura', () => ({ correrLectura: agentes.lectura }));
vi.mock('@/growth/agents/estructura', () => ({ correrEstructura: agentes.estructura }));
vi.mock('@/growth/agents/creativos', () => ({ correrCreativos: agentes.creativos }));
vi.mock('@/growth/agents/google', () => ({ correrGoogle: agentes.google }));
vi.mock('@/growth/agents/prompts', () => ({ correrPrompts: agentes.prompts }));
vi.mock('@/pilares/agentes', () => ({
  correrEstrategia: agentes.estrategia,
  correrPilar: agentes.pilar,
  correrCorreccion: agentes.correccion,
}));

import { ejecutarJob } from '@/research/pipeline';
import { ejecutarGrowth } from '@/growth/pipeline';
import { ejecutarPilares } from '@/pilares/pipeline';
import { estrategiaFalsa, pilarFalso } from '../fixtures/pilares';

/** El último update sobre `research_jobs`: el desenlace que ve la persona. */
const desenlace = () => {
  const sobreJobs = mockDb.estado.updates.filter((u) => u.tabla === mockDb.TABLAS.researchJobs);
  return sobreJobs[sobreJobs.length - 1].valores;
};
const insertadoEn = (tabla: any) => mockDb.estado.inserts.find((i) => i.tabla === tabla)?.valores;

const INVESTIGACION_PREVIA = [{
  id: 'inv1', clientId: 'c1', version: 1,
  datos: { competencia: { estado: 'ok', datos: {} }, mercado: { estado: 'ok', datos: {} } },
}];

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.estado.updates = [];
  mockDb.estado.inserts = [];
  mockDb.estado.investigaciones = INVESTIGACION_PREVIA;
  mockDb.estado.job = {
    id: 'j1', clientId: 'c1', tipo: 'research', estado: 'encolado', etapas: {},
    costoUsd: '0', tokensEntrada: 0, tokensSalida: 0, startedAt: null, creadoPor: 'u1',
  };
  process.env.ANTHROPIC_API_KEY = 'sk-no-se-usa';
  // Console limpia: los pipelines registran el error, que aquí es esperado.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('investigación sin saldo', () => {
  it('para en seco: no corre la síntesis ni la lectura, y el job queda fallido con el mensaje legible', async () => {
    agentes.audiencia.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarJob('j1');

    // Lo que viene DESPUÉS de las paralelas no se llega a intentar: es el
    // dinero que el arreglo ahorra.
    expect(agentes.sintesis).not.toHaveBeenCalled();
    expect(agentes.lectura).not.toHaveBeenCalled();

    const fin = desenlace();
    expect(fin.estado).toBe('fallido');
    expect(fin.error).toBe(MENSAJE_SALDO);
    expect(fin.error).not.toContain('BadRequestError');
    expect(fin.error).not.toContain('400');
  });

  it('no tira lo que ya se había pagado: las etapas que terminaron se guardan', async () => {
    agentes.audiencia.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarJob('j1');

    const fila = insertadoEn(mockDb.TABLAS.researchResults);
    expect(fila.datos.competencia).toEqual({ estado: 'ok', datos: { competidores: [] } });
    expect(fila.datos.mercado.estado).toBe('ok');
    expect(desenlace().etapas.competencia).toBe('ok');
  });

  it('las etapas detenidas quedan como «abortado», no como fallo del agente', async () => {
    agentes.audiencia.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarJob('j1');

    const { etapas } = desenlace();
    expect(etapas.audiencia).toBe('abortado');
    expect(etapas.sintesis).toBe('abortado');
    expect(etapas.lectura).toBe('abortado');
    expect(Object.values(etapas)).not.toContain('fallo');
  });

  it('la lectura detenida se omite del resultado, para reintentarla cuando haya saldo', async () => {
    agentes.audiencia.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarJob('j1');

    // Sin la clave `lectura`, `necesitaLectura` vuelve a tomar esta fila.
    expect(insertadoEn(mockDb.TABLAS.researchResults).datos).not.toHaveProperty('lectura');
  });

  it('con la llave inválida (401) pasa lo mismo, con su propio mensaje', async () => {
    agentes.competencia.mockRejectedValueOnce(APIError.generate(
      401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, undefined, new Headers(),
    ));

    await ejecutarJob('j1');

    expect(agentes.sintesis).not.toHaveBeenCalled();
    expect(desenlace().estado).toBe('fallido');
    expect(desenlace().error).toContain('ANTHROPIC_API_KEY');
  });
});

describe('investigación con un 429: NO aborta', () => {
  it('la etapa falla, las demás siguen y el job se completa', async () => {
    agentes.audiencia.mockRejectedValueOnce(RATE_LIMIT());

    await ejecutarJob('j1');

    expect(agentes.sintesis).toHaveBeenCalledTimes(1);
    expect(agentes.lectura).toHaveBeenCalledTimes(1);

    const fin = desenlace();
    expect(fin.estado).toBe('completado');
    expect(fin.error).toBeNull();
    expect(fin.etapas.audiencia).toBe('fallo');
    expect(fin.etapas.sintesis).toBe('ok');
  });
});

describe('manual de campaña sin saldo', () => {
  beforeEach(() => { mockDb.estado.job.tipo = 'growth'; });

  it('para antes de los prompts y deja el mensaje legible', async () => {
    agentes.google.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarGrowth('j1');

    expect(agentes.prompts).not.toHaveBeenCalled();
    const fin = desenlace();
    expect(fin.estado).toBe('fallido');
    expect(fin.error).toBe(MENSAJE_SALDO);
    expect(fin.etapas.google).toBe('abortado');
    expect(fin.etapas.prompts).toBe('abortado');
  });

  it('conserva la estructura y los creativos que sí se generaron', async () => {
    agentes.google.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarGrowth('j1');

    const fila = insertadoEn(mockDb.TABLAS.growthResults);
    expect(fila.datos.campanas).toEqual([]);
    expect(fila.datos.anuncios).toEqual([]);
    expect(fila.datos._huecos.google).toMatch(/se detuvo/i);
  });

  it('un 429 en una etapa no aborta el manual', async () => {
    agentes.google.mockRejectedValueOnce(RATE_LIMIT());

    await ejecutarGrowth('j1');

    expect(agentes.prompts).toHaveBeenCalledTimes(1);
    expect(desenlace().estado).toBe('completado');
  });
});

describe('mapa de pilares sin saldo', () => {
  beforeEach(() => {
    mockDb.estado.job.tipo = 'pilares';
    const est = estrategiaFalsa();
    agentes.estrategia.mockResolvedValue(agentes.respuesta(est));
    agentes.pilar.mockImplementation(async (_ctx: any, _e: any, n: number) => agentes.respuesta(pilarFalso(n, est)));
  });

  it('para tras los pilares, sin intentar la corrección, y deja el mensaje legible', async () => {
    agentes.pilar.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarPilares('j1');

    expect(agentes.correccion).not.toHaveBeenCalled();
    const fin = desenlace();
    expect(fin.estado).toBe('fallido');
    expect(fin.error).toBe(MENSAJE_SALDO);
  });

  it('conserva los pilares que sí se generaron', async () => {
    agentes.pilar.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarPilares('j1');

    const fila = insertadoEn(mockDb.TABLAS.pilaresResults);
    const conTemas = fila.datos.pilares.filter((p: any) => p.estado !== 'vacio');
    expect(conTemas.length).toBeGreaterThan(0);
    expect(fila.datos.pilares.find((p: any) => p.estado === 'vacio').razon).toMatch(/se detuvo/i);
  });

  it('si es la estrategia la que se queda sin saldo, el job falla con el mensaje legible', async () => {
    agentes.estrategia.mockRejectedValueOnce(SIN_SALDO());

    await ejecutarPilares('j1');

    expect(agentes.pilar).not.toHaveBeenCalled();
    const fin = desenlace();
    expect(fin.estado).toBe('fallido');
    expect(fin.error).toBe(MENSAJE_SALDO);
    expect(fin.error).not.toMatch(/No se pudo definir la estrategia/);
  });

  it('un 429 en un pilar no aborta el mapa', async () => {
    agentes.pilar.mockRejectedValueOnce(RATE_LIMIT());

    await ejecutarPilares('j1');

    expect(desenlace().estado).toBe('completado');
  });
});
