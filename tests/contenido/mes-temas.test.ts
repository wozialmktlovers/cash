import { describe, it, expect } from 'vitest';
import { asignarTemas, catalogoDeTemas, candidatosPara, pilaresPorUso, temasUsados } from '@/contenido/mes/temas';
import { armarRanuras, faltantes } from '@/contenido/mes/plan';
import { mapaFalso } from '../fixtures/pilares';

/** De dónde salen los temas del mes (src/contenido/mes/temas.ts). */

const mapa = mapaFalso();

describe('el catálogo de temas', () => {
  it('trae los 300 temas del mapa, pendientes salvo lo que diga el banco', () => {
    const cat = catalogoDeTemas(mapa, { 'P1-S1-01': 'publicado' });
    expect(cat).toHaveLength(300);
    expect(cat.find((t) => t.id === 'P1-S1-01')?.estado).toBe('publicado');
    expect(cat.find((t) => t.id === 'P1-S1-02')?.estado).toBe('pendiente');
    expect(cat.find((t) => t.id === 'P3-S2-05')?.pilar).toBe(3);
    expect(cat.find((t) => t.id === 'P3-S2-05')?.subcategoria).toBe('Subcategoría 3.2');
  });

  it('un mapa sin pilares no revienta', () => {
    expect(catalogoDeTemas(null)).toEqual([]);
    expect(catalogoDeTemas({ estrategia: {} } as never)).toEqual([]);
  });
});

describe('no repite temas usados', () => {
  const ranurasDe = (paquete: Record<string, number>) => armarRanuras({ periodo: '2026-10', aGenerar: faltantes(paquete as never, []), quedan: [], mix: mapa.estrategia.mix, pilares: [1, 2, 3, 4, 5] });

  it('ninguna ranura recibe un tema de otro mes', () => {
    const cat = catalogoDeTemas(mapa);
    const usados = temasUsados(cat.slice(0, 200).map((t) => ({ temaId: t.id })));
    const asignados = asignarTemas(ranurasDe({ post: 8, carrusel: 4, reel: 4, historia: 6 }), cat, usados);
    for (const t of asignados.values()) expect(usados.has(t!.id)).toBe(false);
  });

  it('dos ranuras no comparten tema, y no se toca el conjunto de usados', () => {
    const cat = catalogoDeTemas(mapa);
    const usados = new Set<string>();
    const asignados = asignarTemas(ranurasDe({ post: 8 }), cat, usados);
    const ids = [...asignados.values()].map((t) => t!.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(usados.size).toBe(0);
  });

  it('sin temas libres, la ranura queda sin tema en vez de repetir', () => {
    const cat = catalogoDeTemas(mapa);
    const asignados = asignarTemas(ranurasDe({ post: 2 }), cat, new Set(cat.map((t) => t.id)));
    expect([...asignados.values()]).toEqual([null, null]);
  });
});

describe('prefiere pendientes y respeta la función y el pilar', () => {
  it('los pendientes van antes que los ya elegidos, aunque cuadren igual', () => {
    const cat = catalogoDeTemas(mapa);
    const avance = Object.fromEntries(cat.filter((t) => t.pilar === 2).map((t) => [t.id, 'en_desarrollo']));
    const conAvance = catalogoDeTemas(mapa, avance);
    const [primero] = candidatosPara({ formato: 'post', funcion: 'autoridad', pilar: 2 }, conAvance, new Set(), 1);
    expect(primero.estado).toBe('pendiente');
    expect(primero.funcion).toBe('autoridad');
  });

  it('entre pendientes, gana la función de la ranura y luego su pilar', () => {
    const cat = catalogoDeTemas(mapa);
    const lista = candidatosPara({ formato: 'reel', funcion: 'venta', pilar: 4 }, cat, new Set(), 4);
    expect(lista.every((t) => t.funcion === 'venta')).toBe(true);
    expect(lista[0].pilar).toBe(4);
  });

  it('los pilares se reparten empezando por el menos usado', () => {
    const cat = catalogoDeTemas(mapa, Object.fromEntries(catalogoDeTemas(mapa).filter((t) => t.pilar === 1).slice(0, 5).map((t) => [t.id, 'publicado'])));
    const usados = new Set(cat.filter((t) => t.pilar === 3).slice(0, 2).map((t) => t.id));
    expect(pilaresPorUso(cat, usados)).toEqual([2, 4, 5, 3, 1]);
  });
});
