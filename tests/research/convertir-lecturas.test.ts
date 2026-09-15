import { describe, it, expect, vi, beforeEach } from 'vitest';
import { necesitaLectura, esRespuestaInvalida, previosDesde, convertirLecturasPendientes } from '@/research/convertir-lecturas';
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
    filasResearch: any[]; filasClients: any[]; filasLinks: any[]; filasFiles: any[]; actualizaciones: any[];
  } = { filasResearch: [], filasClients: [], filasLinks: [], filasFiles: [], actualizaciones: [] };

  const TABLAS = {
    researchResults: { __tabla: 'researchResults' },
    clients: { __tabla: 'clients' },
    clientLinks: { __tabla: 'clientLinks' },
    clientFiles: { __tabla: 'clientFiles' },
  };

  function filasDe(tabla: any): any[] {
    if (tabla === TABLAS.researchResults) return estado.filasResearch;
    if (tabla === TABLAS.clients) return estado.filasClients;
    if (tabla === TABLAS.clientLinks) return estado.filasLinks;
    if (tabla === TABLAS.clientFiles) return estado.filasFiles;
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
    mockDb.estado.actualizaciones = [];
  });

  it('el tope se revisa antes de cada fila: la que no alcanzó a arrancar queda intacta', async () => {
    mockDb.estado.filasResearch = [
      { id: 'r1', clientId: 'c1', datos: copiaParcial() },
      { id: 'r2', clientId: 'c1', datos: copiaParcial() },
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
      { id: 'r1', clientId: 'c1', datos: copiaParcial() },
      { id: 'r2', clientId: 'c1', datos: copiaParcial() },
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
      { id: 'r1', clientId: 'c1', datos: copiaParcial() },
      { id: 'r2', clientId: 'c1', datos: copiaParcial() },
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
      { id: 'ya-tiene', clientId: 'c1', datos: { ...copiaParcial(), lectura: { estado: 'vacio', razon: 'x' } } },
      { id: 'r1', clientId: 'c1', datos: copiaParcial() },
      { id: 'r2', clientId: 'c1', datos: copiaParcial() },
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
});
