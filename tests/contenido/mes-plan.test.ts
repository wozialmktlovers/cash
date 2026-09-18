import { describe, it, expect } from 'vitest';
import {
  armarRanuras, diasDelPeriodo, diasParaPublicar, esHabil, faltantes, intercalar, numerosLibres,
  repartirFechas, repartirFunciones, separarPiezas, tandasPorSemana, totalDe, leerParametros, semanaDe,
  type PiezaExistente,
} from '@/contenido/mes/plan';
import { FORMATOS } from '@/contenido/reglas';

/**
 * El plan del mes que genera la IA (src/contenido/mes/plan.ts): lo que se
 * decide en código y no el modelo. Sin base y sin modelo.
 */

const MIX = [
  { funcion: 'autoridad' as const, porcentaje: 30 },
  { funcion: 'conexion' as const, porcentaje: 30 },
  { funcion: 'engagement' as const, porcentaje: 10 },
  { funcion: 'prueba_social' as const, porcentaje: 10 },
  { funcion: 'venta' as const, porcentaje: 20 },
];
const PAQUETE = { post: 8, carrusel: 4, reel: 4, historia: 6 };
const cero = { post: 0, carrusel: 0, reel: 0, historia: 0 };

const pieza = (id: string, extra: Partial<PiezaExistente> = {}): PiezaExistente => ({
  id, numero: Number(id.replace(/\D/g, '')) || 1, formato: 'post', estadoCliente: 'pendiente', arte: [],
  fechaPublicacion: null, temaId: null, ...extra,
});

describe('el reparto respeta el paquete exacto', () => {
  it('un lote vacío genera exactamente el paquete, formato por formato', () => {
    const porGenerar = faltantes(PAQUETE, []);
    expect(porGenerar).toEqual(PAQUETE);
    const ranuras = armarRanuras({ periodo: '2026-10', aGenerar: porGenerar, quedan: [], mix: MIX, pilares: [1, 2, 3, 4, 5] });
    expect(ranuras).toHaveLength(22);
    for (const f of FORMATOS) expect(ranuras.filter((r) => r.formato === f)).toHaveLength(PAQUETE[f]);
    // Los `ref` son los nombres de las ranuras en el pedido: únicos y seguidos.
    expect(ranuras.map((r) => r.ref)).toEqual(Array.from({ length: 22 }, (_, i) => i + 1));
  });

  it('completar cuenta lo que ya hay y nunca pide de menos ni negativo', () => {
    const quedan = [pieza('p1', { formato: 'reel' }), pieza('p2', { formato: 'reel' }), pieza('p3', { formato: 'carrusel' }),
      ...Array.from({ length: 6 }, (_, i) => pieza(`c${i}`, { formato: 'carrusel' }))];
    expect(faltantes(PAQUETE, quedan)).toEqual({ post: 8, carrusel: 0, reel: 2, historia: 6 });
    expect(totalDe(faltantes(PAQUETE, quedan))).toBe(16);
  });

  it('un formato que el paquete no trae no se genera', () => {
    expect(faltantes({ post: 3 }, [])).toEqual({ ...cero, post: 3 });
  });
});

describe('completar frente a reemplazar', () => {
  const aprobada = pieza('a1', { estadoCliente: 'aprobada' });
  const conCambios = pieza('a2', { estadoCliente: 'cambios' });
  const conArte = pieza('a3', { arte: [{ tipo: 'imagen', fileId: 'x' }] });
  const libre = pieza('a4');

  it('completar no toca ninguna pieza', () => {
    const r = separarPiezas([aprobada, conCambios, conArte, libre], 'completar', true);
    expect(r.reemplazar).toEqual([]);
    expect(r.quedan).toHaveLength(4);
  });

  it('reemplazar nunca toca aprobadas ni con cambios, y con arte solo si se confirma', () => {
    const sin = separarPiezas([aprobada, conCambios, conArte, libre], 'reemplazar', false);
    expect(sin.reemplazar.map((p) => p.id)).toEqual(['a4']);
    const con = separarPiezas([aprobada, conCambios, conArte, libre], 'reemplazar', true);
    expect(con.reemplazar.map((p) => p.id).sort()).toEqual(['a3', 'a4']);
    expect(con.quedan.map((p) => p.id).sort()).toEqual(['a1', 'a2']);
  });
});

describe('las fechas caen dentro del mes, en días hábiles y sin amontonar', () => {
  it('todas las fechas son del mes y de lunes a viernes', () => {
    for (const periodo of ['2026-02', '2026-09', '2026-10', '2027-01']) {
      const ranuras = armarRanuras({ periodo, aGenerar: faltantes(PAQUETE, []), quedan: [], mix: MIX, pilares: [1] });
      for (const r of ranuras) {
        expect(r.fecha.startsWith(periodo)).toBe(true);
        expect(esHabil(r.fecha)).toBe(true);
      }
    }
  });

  it('el feed no pone dos piezas el mismo día mientras sobren días hábiles', () => {
    const ranuras = armarRanuras({ periodo: '2026-10', aGenerar: { ...cero, post: 8, carrusel: 4, reel: 4 }, quedan: [], mix: MIX, pilares: [1] });
    const dias = ranuras.map((r) => r.fecha);
    expect(new Set(dias).size).toBe(dias.length);
    // Repartidas por el mes: al menos una en cada una de las cuatro primeras semanas.
    for (const s of [1, 2, 3, 4]) expect(dias.some((d) => semanaDe(d) === s)).toBe(true);
  });

  it('con más piezas que días hábiles, ningún día lleva más de una de diferencia con otro', () => {
    const dias = diasDelPeriodo('2026-10').filter(esHabil);
    const fechas = repartirFechas(dias, 50);
    const carga = dias.map((d) => fechas.filter((f) => f === d).length);
    expect(Math.max(...carga) - Math.min(...carga)).toBeLessThanOrEqual(1);
  });

  it('al completar, esquiva los días que ya tienen pieza', () => {
    const dias = diasDelPeriodo('2026-10').filter(esHabil);
    const ocupadas = dias.slice(0, 10);
    const fechas = repartirFechas(dias, 5, ocupadas);
    for (const f of fechas) expect(ocupadas).not.toContain(f);
  });

  it('si el mes ya empezó, publica de hoy en adelante; si no queda casi nada, usa el mes entero', () => {
    const desde = '2026-10-15';
    expect(diasParaPublicar('2026-10', 10, desde).every((d) => d >= desde)).toBe(true);
    const todos = diasDelPeriodo('2026-10').filter(esHabil);
    expect(diasParaPublicar('2026-10', 40, '2026-10-29')).toEqual(todos);
  });
});

describe('el mix editorial', () => {
  it('reparte exactamente n entre las funciones, en proporción al mix', () => {
    const r = repartirFunciones(MIX, 20);
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(20);
    expect(r).toEqual({ autoridad: 6, conexion: 6, engagement: 2, prueba_social: 2, venta: 4 });
  });

  it('al completar, carga hacia lo que le falta al mes entero', () => {
    // Ya hay 4 de venta: el mes de 20 pide 4, así que las 10 nuevas no llevan venta.
    const r = repartirFunciones(MIX, 10, { venta: 4, autoridad: 3, conexion: 3 });
    expect(r.venta).toBe(0);
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('sin mix válido, parejo', () => {
    expect(repartirFunciones(null, 5)).toEqual({ autoridad: 1, conexion: 1, engagement: 1, prueba_social: 1, venta: 1 });
  });

  it('las ranuras llevan las funciones del mix, intercaladas y no en bloque', () => {
    const ranuras = armarRanuras({ periodo: '2026-10', aGenerar: faltantes({ post: 10 }, []), quedan: [], mix: MIX, pilares: [1, 2] });
    const cuenta = (f: string) => ranuras.filter((r) => r.funcion === f).length;
    expect([cuenta('autoridad'), cuenta('conexion'), cuenta('engagement'), cuenta('prueba_social'), cuenta('venta')]).toEqual([3, 3, 1, 1, 2]);
    expect(ranuras.slice(0, 3).map((r) => r.funcion)).not.toEqual(['autoridad', 'autoridad', 'autoridad']);
    // Pilares en rueda.
    expect(ranuras.map((r) => r.pilar).slice(0, 4)).toEqual([1, 2, 1, 2]);
  });

  it('intercalar reparte cada grupo a lo largo de la lista', () => {
    expect(intercalar([['a', 2], ['b', 2]])).toEqual(['a', 'b', 'a', 'b']);
  });
});

describe('tandas y números', () => {
  it('una tanda por semana, partida si trae demasiadas piezas', () => {
    const ranuras = armarRanuras({ periodo: '2026-10', aGenerar: faltantes({ post: 30, historia: 20 }, []), quedan: [], mix: MIX, pilares: [1] });
    const tandas = tandasPorSemana(ranuras, 8);
    expect(tandas.every((t) => t.ranuras.length <= 8)).toBe(true);
    expect(tandas.flatMap((t) => t.ranuras)).toHaveLength(50);
    for (const t of tandas) expect(t.ranuras.every((r) => semanaDe(r.fecha) === t.semana)).toBe(true);
  });

  it('las piezas nuevas llenan primero los huecos y después siguen', () => {
    expect(numerosLibres([1, 2, 4, 7], 4)).toEqual([3, 5, 6, 8]);
  });

  it('los parámetros del job se leen con cuidado', () => {
    expect(leerParametros({ loteId: 'l', periodo: '2026-10', modo: 'completar' }))
      .toEqual({ loteId: 'l', periodo: '2026-10', modo: 'completar', incluirConArte: false, planeadas: [] });
    expect(leerParametros({ loteId: 'l', periodo: '2026-13', modo: 'completar' })).toBeNull();
    expect(leerParametros({ loteId: 'l', periodo: '2026-10', modo: 'borrar-todo' })).toBeNull();
    expect(leerParametros(null)).toBeNull();
  });
});
