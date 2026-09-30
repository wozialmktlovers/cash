import { describe, it, expect } from 'vitest';
import { hayMapaDePilares, mapaUtil } from '@/lib/precheck';
import { leerSeleccion, proponerTemas, ranurasAutorizadas, situacionDelMes, validarSeleccion } from '@/contenido/mes/propuesta';
import { catalogoDeTemas } from '@/contenido/mes/temas';
import { armarAltas } from '@/contenido/mes/guardado';
import { FORMATOS } from '@/contenido/reglas';
import { mapaFalso } from '../fixtures/pilares';

const mapa = mapaFalso();
const catalogo = catalogoDeTemas(mapa);
const PAQUETE = { post: 8, carrusel: 4, reel: 4, historia: 6 };
const base = { periodo: '2026-10', paquete: PAQUETE, modo: 'completar' as const, incluirConArte: false, piezasLote: [], temasDelCliente: [], catalogo, mix: mapa.estrategia.mix };

describe('hay mapa de pilares', () => {
  it('solo cuenta un mapa con al menos un pilar ok con temas', () => {
    expect(hayMapaDePilares(mapa)).toBe(true);
    expect(hayMapaDePilares(null)).toBe(false);
    expect(hayMapaDePilares({})).toBe(false);
    expect(hayMapaDePilares({ pilares: [{ estado: 'fallo' }] })).toBe(false);
    expect(hayMapaDePilares({ pilares: [{ estado: 'ok', subcategorias: [{ temas: [] }] }] })).toBe(false);
  });

  it('elige la versión más reciente que sí sirve', () => {
    const r = mapaUtil([{ datos: mapa, version: 1 }, { datos: { pilares: [] }, version: 2 }]);
    expect(r?.version).toBe(1);
    expect(mapaUtil([{ datos: {}, version: 1 }])).toBeUndefined();
  });
});

describe('proponerTemas', () => {
  it('trae exactamente el paquete, un tema distinto por pieza y fechas dentro del mes', () => {
    const filas = proponerTemas(base);
    expect(filas).toHaveLength(22);
    for (const f of FORMATOS) expect(filas.filter((x) => x.formato === f)).toHaveLength(PAQUETE[f]);
    expect(new Set(filas.map((f) => f.temaId)).size).toBe(22);
    for (const f of filas) expect(f.fecha.startsWith('2026-10-')).toBe(true);
  });

  it('prefiere pendientes y no repite los temas de meses anteriores', () => {
    const usados = catalogo.filter((t) => t.funcion === 'autoridad').slice(0, 40).map((t) => t.id);
    const conAvance = catalogoDeTemas(mapa, Object.fromEntries(catalogo.slice(0, 200).map((t) => [t.id, 'publicado'])));
    const filas = proponerTemas({ ...base, catalogo: conAvance, temasDelCliente: usados.map((temaId, i) => ({ id: `p${i}`, temaId })) });
    for (const f of filas) {
      expect(usados).not.toContain(f.temaId);
      expect(conAvance.find((t) => t.id === f.temaId)?.estado).toBe('pendiente');
    }
  });

  it('al completar solo propone lo que falta y al reemplazar libera los temas de las piezas que se van', () => {
    const p = (id: string, numero: number, temaId: string, extra = {}) => ({ id, numero, formato: 'post' as const, estadoCliente: 'pendiente' as const, arte: [], fechaPublicacion: null, temaId, ...extra });
    const piezasLote = [p('a', 1, catalogo[0].id, { estadoCliente: 'aprobada' }), p('b', 2, catalogo[1].id)];
    const completar = proponerTemas({ ...base, piezasLote, temasDelCliente: piezasLote.map((x) => ({ id: x.id, temaId: x.temaId })) });
    expect(completar).toHaveLength(20);
    expect(completar.map((f) => f.temaId)).not.toContain(catalogo[0].id);
    expect(completar.map((f) => f.temaId)).not.toContain(catalogo[1].id);
    const reemplazar = proponerTemas({ ...base, modo: 'reemplazar', piezasLote, temasDelCliente: piezasLote.map((x) => ({ id: x.id, temaId: x.temaId })) });
    expect(reemplazar).toHaveLength(21);
    expect(reemplazar.map((f) => f.temaId)).not.toContain(catalogo[0].id); // la aprobada se queda con el suyo
  });
});

describe('validarSeleccion', () => {
  const filas = proponerTemas(base);
  const esperadas = situacionDelMes({ paquete: PAQUETE, modo: 'completar', incluirConArte: false, piezasLote: [] }).esperadas;
  const val = (f = filas, extra = {}) => validarSeleccion({ filas: f, periodo: '2026-10', catalogo, bloqueados: new Map(), esperadas, exigirTemas: true, ...extra });

  it('una propuesta del sistema es válida y cuadra', () => {
    expect(val()).toEqual({ errores: [], avisos: [], desajuste: null });
  });
  it('rechaza repetidos, fuera del mes, inexistentes y sin tema', () => {
    const cambiar = (i: number, c: object) => filas.map((f, j) => (j === i ? { ...f, ...c } : f));
    expect(val(cambiar(1, { temaId: filas[0].temaId })).errores[0]).toMatch(/no se puede repetir/);
    expect(val(cambiar(0, { fecha: '2026-11-01' })).errores[0]).toMatch(/fuera del mes/);
    expect(val(cambiar(0, { temaId: 'P9-S9-99' })).errores[0]).toMatch(/no está en el mapa/);
    expect(val(cambiar(0, { temaId: null })).errores[0]).toMatch(/Elige un tema/);
    expect(val(cambiar(0, { temaId: null }), { exigirTemas: false }).errores).toEqual([]);
  });
  it('un formato cambiado avisa del desajuste con el paquete', () => {
    const r = val(filas.map((f, i) => (i === 0 ? { ...f, formato: 'historia' as const } : f)));
    expect(r.errores).toEqual([]);
    expect(r.desajuste).not.toBeNull();
    expect(r.avisos[0]).toMatch(/no cuadra/);
  });
});

describe('de la selección autorizada al agente', () => {
  it('cada ranura sale con su tema, su fecha fija y la función y pilar del tema', () => {
    const filas = proponerTemas(base).map((f) => ({ ...f, temaId: f.temaId! }));
    const r = ranurasAutorizadas(filas, catalogo);
    if ('error' in r) throw new Error(r.error);
    for (const [i, ra] of r.ranuras.entries()) {
      const t = catalogo.find((x) => x.id === filas[i].temaId)!;
      expect(ra).toMatchObject({ temaId: t.id, funcion: t.funcion, pilar: t.pilar, fija: true, fecha: filas[i].fecha });
    }
  });
  it('un tema que ya no está en el mapa detiene el trabajo con un mensaje claro', () => {
    const r = ranurasAutorizadas([{ ref: 1, formato: 'post', fecha: '2026-10-05', temaId: 'P9-S9-99' }], catalogo);
    expect('error' in r && r.error).toMatch(/ya no está en el mapa/);
  });
  it('al guardar, la fecha autorizada no la mueve el modelo', () => {
    const r = ranurasAutorizadas([{ ref: 1, formato: 'post', fecha: '2026-10-05', temaId: catalogo[0].id }], catalogo);
    if ('error' in r) throw new Error(r.error);
    const pieza = { ref: 1, temaId: null, plataforma: 'ambas' as const, fecha: '2026-10-06', copy: 'c', cta: '', hashtags: '', briefVisual: '', promptImagen: '', guion: [], tarjetas: [] };
    expect(armarAltas([{ ranura: r.ranuras[0], pieza, temaId: catalogo[0].id }], [])[0].fechaPublicacion).toBe('2026-10-05');
  });
});

describe('leerSeleccion', () => {
  it('lee lo guardado, y lo que no cuadra se descarta', () => {
    const s = { modo: 'completar', incluirConArte: false, filas: [{ ref: 1, formato: 'post', fecha: '2026-10-05', temaId: 'P1-S1-01' }], propuestaEn: 'x', propuestaPor: 'u', autorizada: { usuarioId: 'u', nombre: 'Ana', en: '2026-09-30T00:00:00Z' } };
    expect(leerSeleccion(s)).toEqual(s);
    expect(leerSeleccion({ ...s, filas: [{ ref: 'x' }] })).toBeNull();
    expect(leerSeleccion({ ...s, modo: 'otro' })).toBeNull();
    expect(leerSeleccion(null)).toBeNull();
  });
});
