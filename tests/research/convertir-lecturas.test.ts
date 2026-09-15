import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  necesitaLectura, esRespuestaInvalida, previosDesde, convertirLecturasPendientes, seleccionarLecturasAConvertir,
} from '@/research/convertir-lecturas';
import { MENSAJE_JSON_INVALIDO, MENSAJE_DECLINO } from '@/research/claude';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

const vacia = {
  competencia: { estado: 'vacio', razon: 'x' }, audiencia: { estado: 'vacio', razon: 'x' },
  canales: { estado: 'vacio', razon: 'x' }, mercado: { estado: 'vacio', razon: 'x' }, sintesis: { estado: 'vacio', razon: 'x' },
};

describe('necesitaLectura', () => {
  it('sí, si no tiene lectura y alguna etapa trae datos', () => {
    expect(necesitaLectura(completa)).toBe(true);
    expect(necesitaLectura(parcial)).toBe(true);
  });
  it('no, si ya tiene lectura, aunque sea vacía', () => {
    expect(necesitaLectura({ ...completa, lectura: { estado: 'ok', datos: {} } })).toBe(false);
    expect(necesitaLectura({ ...completa, lectura: { estado: 'vacio', razon: 'x' } })).toBe(false);
  });
  it('no, si ninguna etapa trajo datos o los datos no son objeto', () => {
    expect(necesitaLectura(vacia)).toBe(false);
    expect(necesitaLectura(null)).toBe(false);
    expect(necesitaLectura('x')).toBe(false);
  });
});

describe('esRespuestaInvalida', () => {
  // Se pinan contra las constantes que de verdad lanza `claude.ts`, no contra
  // una copia a mano del texto: si el mensaje cambia allá, esto se rompe aquí.
  it('distingue una respuesta que no cumplió el esquema', () => {
    expect(esRespuestaInvalida(new Error(`${MENSAJE_JSON_INVALIDO} Último error: jerga`))).toBe(true);
    expect(esRespuestaInvalida(new Error(`${MENSAJE_DECLINO} (x).`))).toBe(true);
  });
  it('trata todo lo demás como error de API que se reintenta después', () => {
    expect(esRespuestaInvalida(new Error('400 credit balance is too low'))).toBe(false);
    expect(esRespuestaInvalida(new Error('fetch failed'))).toBe(false);
    expect(esRespuestaInvalida('texto')).toBe(false);
  });
});

describe('previosDesde', () => {
  it('toma solo los datos de las etapas ok', () => {
    const p = previosDesde(parcial);
    expect(Object.keys(p)).toEqual(['competencia']);
    expect(p.competencia).toEqual((parcial as any).competencia.datos);
  });
});

// --- seleccionarLecturasAConvertir: función pura, sin base de datos --------
//
// Punto 2 de la corrección: prioridad y alcance. Se prueba sola, sin pasar
// por `convertirLecturasPendientes`, porque no depende de la base ni de
// `correr`: solo de las filas de `research_results` y de las etapas
// `investigacion` de `cliente_etapas`.
describe('seleccionarLecturasAConvertir', () => {
  const copiaParcial = () => JSON.parse(JSON.stringify(parcial));
  const fila = (id: string, clientId: string, version: number, datos = copiaParcial()) => ({ id, clientId, datos, version });

  it('usa la investigación ligada a la etapa del cliente, aunque no sea la más reciente', () => {
    const filas = [fila('vieja', 'c1', 1), fila('nueva', 'c1', 2)];
    const etapas = [{ clientId: 'c1', documentoTipo: 'research', documentoId: 'vieja' }];
    expect(seleccionarLecturasAConvertir(filas, etapas).map((f) => f.id)).toEqual(['vieja']);
  });

  it('sin enlace, usa la más reciente con datos de ese cliente', () => {
    const filas = [fila('v1', 'c1', 1), fila('v2', 'c1', 2)];
    expect(seleccionarLecturasAConvertir(filas, []).map((f) => f.id)).toEqual(['v2']);
  });

  it('las versiones viejas sin enlace nunca se convierten: solo sale la más reciente', () => {
    const filas = [fila('v1', 'c1', 1), fila('v2', 'c1', 2), fila('v3', 'c1', 3)];
    const r = seleccionarLecturasAConvertir(filas, []);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('v3');
  });

  it('un enlace a otro tipo de documento (growth, pilares) no cuenta: cae al respaldo', () => {
    const filas = [fila('v1', 'c1', 1)];
    const etapas = [{ clientId: 'c1', documentoTipo: 'growth', documentoId: 'algo-de-growth' }];
    expect(seleccionarLecturasAConvertir(filas, etapas).map((f) => f.id)).toEqual(['v1']);
  });

  it('un cliente sin ninguna fila con datos no aporta nada, ligado o no', () => {
    const sinDatos = { competencia: { estado: 'vacio', razon: 'x' } };
    expect(seleccionarLecturasAConvertir([fila('v1', 'c1', 1, sinDatos)], [])).toEqual([]);
  });

  it('un cliente cuya fila ya tiene lectura no aporta nada, aunque esté ligada', () => {
    const conLectura = { ...copiaParcial(), lectura: { estado: 'ok', datos: {} } };
    const filas = [fila('v1', 'c1', 1, conLectura)];
    const etapas = [{ clientId: 'c1', documentoTipo: 'research', documentoId: 'v1' }];
    expect(seleccionarLecturasAConvertir(filas, etapas)).toEqual([]);
  });

  it('orden estable: primero los clientes con enlace, después el resto; cada grupo por id de cliente', () => {
    const filas = [
      fila('sin-b', 'clienteB', 1),
      fila('con-a', 'clienteA', 1),
      fila('con-c', 'clienteC', 1),
      fila('sin-d', 'clienteD', 1),
    ];
    const etapas = [
      { clientId: 'clienteC', documentoTipo: 'research', documentoId: 'con-c' },
      { clientId: 'clienteA', documentoTipo: 'research', documentoId: 'con-a' },
    ];
    const r = seleccionarLecturasAConvertir(filas, etapas);
    expect(r.map((f) => f.id)).toEqual(['con-a', 'con-c', 'sin-b', 'sin-d']);
  });
});

// --- convertirLecturasPendientes: base de datos simulada -------------------
//
// `vi.hoisted` porque `vi.mock('@/db', ...)` se eleva sobre los imports del
// archivo: el estado y las tablas que usa la fábrica del mock tienen que
// existir antes de que ese `vi.mock` se ejecute. La simulación es deliberada-
// mente tosca (ignora las condiciones de `where`, solo importan sus efectos):
// alcanza con una fila por cliente y un cliente por prueba, que es como están
// armados los escenarios de abajo.
const mockDb = vi.hoisted(() => {
  const estado: {
    filasResearch: any[]; filasClients: any[]; filasLinks: any[]; filasFiles: any[];
    filasEtapas: any[]; actualizaciones: any[];
  } = { filasResearch: [], filasClients: [], filasLinks: [], filasFiles: [], filasEtapas: [], actualizaciones: [] };

  const TABLAS = {
    researchResults: { __tabla: 'researchResults' },
    clients: { __tabla: 'clients' },
    clientLinks: { __tabla: 'clientLinks' },
    clientFiles: { __tabla: 'clientFiles' },
    clienteEtapas: { __tabla: 'clienteEtapas' },
  };

  function filasDe(tabla: any): any[] {
    if (tabla === TABLAS.researchResults) return estado.filasResearch;
    if (tabla === TABLAS.clients) return estado.filasClients;
    if (tabla === TABLAS.clientLinks) return estado.filasLinks;
    if (tabla === TABLAS.clientFiles) return estado.filasFiles;
    if (tabla === TABLAS.clienteEtapas) return estado.filasEtapas;
    return [];
  }

  // Objeto encadenable y a la vez «thenable»: `await` funciona sin importar
  // en qué punto de la cadena (`.from()`, `.where()` o `.limit()`) se corte,
  // igual que con el query builder real de drizzle.
  function chain(resultado: any[]): any {
    const obj: any = {
      where: () => obj,
      limit: (n: number) => chain(resultado.slice(0, n)),
      then: (resuelve: any, rechaza: any) => Promise.resolve(resultado).then(resuelve, rechaza),
    };
    return obj;
  }

  const db = {
    select: (..._cols: any[]) => ({ from: (tabla: any) => chain(filasDe(tabla)) }),
    update: (tabla: any) => ({
      set: (valores: any) => ({
        where: (..._cond: any[]) => {
          estado.actualizaciones.push({ tabla, valores });
          return Promise.resolve();
        },
      }),
    }),
  };

  return { estado, TABLAS, db };
});

vi.mock('@/db', () => ({
  researchResults: mockDb.TABLAS.researchResults,
  clients: mockDb.TABLAS.clients,
  clientLinks: mockDb.TABLAS.clientLinks,
  clientFiles: mockDb.TABLAS.clientFiles,
  clienteEtapas: mockDb.TABLAS.clienteEtapas,
  db: mockDb.db,
}));

describe('convertirLecturasPendientes', () => {
  const CLIENTE = { id: 'c1', nombre: 'Ana', giro: 'Belleza', producto: 'Diplomado', ciudad: null, ticket: null, contacto: null, notas: null };
  const copiaParcial = () => JSON.parse(JSON.stringify(parcial));
  const LECTURA_OK = { portada: { titular: 't', resumen: 'r' } };

  beforeEach(() => {
    mockDb.estado.filasResearch = [];
    mockDb.estado.filasClients = [CLIENTE];
    mockDb.estado.filasLinks = [];
    mockDb.estado.filasFiles = [];
    mockDb.estado.filasEtapas = [];
    mockDb.estado.actualizaciones = [];
  });

  it('el tope se revisa antes de cada fila: la que no alcanzó a arrancar queda intacta', async () => {
    // Dos clientes distintos (punto 2: solo se elige una fila por cliente,
    // así que dos filas pendientes de un mismo cliente ya no sirven para
    // probar el tope).
    mockDb.estado.filasResearch = [
      { id: 'r1', clientId: 'c1', datos: copiaParcial(), version: 1 },
      { id: 'r2', clientId: 'c2', datos: copiaParcial(), version: 1 },
    ];
    // claude-opus-5: $5/M entrada, $25/M salida → 100k entrada + 20k salida = $1.00 exacto.
    const correr = vi.fn(async (_ctx: string, _previos: any, onUso?: (e: number, s: number) => boolean) => {
      onUso?.(100_000, 20_000);
      return { datos: LECTURA_OK, tokensEntrada: 100_000, tokensSalida: 20_000 };
    });

    const r = await convertirLecturasPendientes({ correr, tope: 1, modelo: 'claude-opus-5', log: () => {} });

    expect(correr).toHaveBeenCalledTimes(1);
    expect(mockDb.estado.actualizaciones).toHaveLength(1);
    expect(mockDb.estado.actualizaciones[0].valores.datos.lectura).toEqual({ estado: 'ok', datos: LECTURA_OK });
    expect(r).toEqual({ convertidas: 1, invalidas: 0, pendientes: 1, gasto: 1 });
  });

  it('un error de API detiene la conversión: la fila en curso no se toca y no se reintenta en la misma corrida', async () => {
    mockDb.estado.filasResearch = [
      { id: 'r1', clientId: 'c1', datos: copiaParcial(), version: 1 },
      { id: 'r2', clientId: 'c2', datos: copiaParcial(), version: 1 },
    ];
    const correr = vi.fn(async () => { throw new Error('400 credit balance is too low'); });
    const mensajes: string[] = [];

    const r = await convertirLecturasPendientes({ correr, tope: 10, modelo: 'claude-opus-5', log: (m) => mensajes.push(m) });

    expect(correr).toHaveBeenCalledTimes(1);
    expect(mockDb.estado.actualizaciones).toHaveLength(0);
    expect(r).toEqual({ convertidas: 0, invalidas: 0, pendientes: 2, gasto: 0 });
    expect(mensajes.some((m) => m.includes('se detiene'))).toBe(true);
  });

  it('una respuesta inválida no detiene la corrida: se guarda vacío y sigue con la siguiente fila', async () => {
    mockDb.estado.filasResearch = [
      { id: 'r1', clientId: 'c1', datos: copiaParcial(), version: 1 },
      { id: 'r2', clientId: 'c2', datos: copiaParcial(), version: 1 },
    ];
    const correr = vi.fn()
      .mockRejectedValueOnce(new Error(`${MENSAJE_JSON_INVALIDO} Último error: jerga`))
      .mockImplementationOnce(async (_ctx: string, _previos: any, onUso?: (e: number, s: number) => boolean) => {
        onUso?.(10_000, 2_000);
        return { datos: LECTURA_OK, tokensEntrada: 10_000, tokensSalida: 2_000 };
      });

    const r = await convertirLecturasPendientes({ correr, tope: 10, modelo: 'claude-opus-5', log: () => {} });

    expect(correr).toHaveBeenCalledTimes(2);
    expect(mockDb.estado.actualizaciones).toHaveLength(2);
    expect(mockDb.estado.actualizaciones[0].valores.datos.lectura).toEqual({
      estado: 'vacio', razon: 'No se pudo redactar la lectura para el cliente.',
    });
    expect(mockDb.estado.actualizaciones[1].valores.datos.lectura).toEqual({ estado: 'ok', datos: LECTURA_OK });
    expect(r.convertidas).toBe(1);
    expect(r.invalidas).toBe(1);
    expect(r.pendientes).toBe(0);
  });

  it('cuenta convertidas, inválidas, pendientes y gasto; ignora las filas que ya tienen lectura', async () => {
    mockDb.estado.filasResearch = [
      { id: 'ya-tiene', clientId: 'c1', datos: { ...copiaParcial(), lectura: { estado: 'vacio', razon: 'x' } }, version: 1 },
      { id: 'r1', clientId: 'c2', datos: copiaParcial(), version: 1 },
      { id: 'r2', clientId: 'c3', datos: copiaParcial(), version: 1 },
    ];
    const correr = vi.fn()
      .mockImplementationOnce(async (_ctx: string, _previos: any, onUso?: (e: number, s: number) => boolean) => {
        onUso?.(10_000, 2_000);
        return { datos: LECTURA_OK, tokensEntrada: 10_000, tokensSalida: 2_000 };
      })
      .mockRejectedValueOnce(new Error(`${MENSAJE_DECLINO} (contenido).`));

    const r = await convertirLecturasPendientes({ correr, tope: 10, modelo: 'claude-opus-5', log: () => {} });

    // La fila "ya-tiene" nunca se toca: ni correr ni update.
    expect(correr).toHaveBeenCalledTimes(2);
    expect(mockDb.estado.actualizaciones).toHaveLength(2);
    expect(mockDb.estado.actualizaciones.some((a) => a.tabla === mockDb.TABLAS.researchResults)).toBe(true);
    // claude-opus-5: (10,000/1M × $5) + (2,000/1M × $25) = $0.05 + $0.05 = $0.10.
    expect(r).toEqual({ convertidas: 1, invalidas: 1, pendientes: 0, gasto: 0.1 });
  });

  it('respeta la investigación ligada a la etapa del cliente, no la versión más reciente sin enlace', async () => {
    // v2 es la más nueva, pero la etapa del cliente sigue enlazada a v1
    // (documentoId): es v1 la que hay que convertir.
    mockDb.estado.filasResearch = [
      { id: 'v1', clientId: 'c1', datos: copiaParcial(), version: 1 },
      { id: 'v2', clientId: 'c1', datos: copiaParcial(), version: 2 },
    ];
    mockDb.estado.filasEtapas = [{ clientId: 'c1', documentoTipo: 'research', documentoId: 'v1' }];
    const correr = vi.fn(async () => ({ datos: LECTURA_OK, tokensEntrada: 0, tokensSalida: 0 }));

    const r = await convertirLecturasPendientes({ correr, tope: 10, modelo: 'claude-opus-5', log: () => {} });

    expect(correr).toHaveBeenCalledTimes(1);
    // Una sola actualización: v2 (la más nueva, sin enlace) nunca entra a
    // `pendientes` porque `seleccionarLecturasAConvertir` eligió v1 (la
    // ligada) como la única fila de este cliente a convertir.
    expect(mockDb.estado.actualizaciones).toHaveLength(1);
    expect(mockDb.estado.actualizaciones[0].valores.datos.lectura).toEqual({ estado: 'ok', datos: LECTURA_OK });
    expect(r.convertidas).toBe(1);
  });
});
