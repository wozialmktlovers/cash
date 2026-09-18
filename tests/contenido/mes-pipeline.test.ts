import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * La generación del mes con IA de punta a punta, **sin llamar al modelo**: el
 * agente se sustituye por uno falso que contesta lo que cada prueba necesita.
 * La base tampoco se toca: las decisiones (`generarTandas`, `decidirGuardado`)
 * son funciones sin base, y la escritura del banco de pilares se comprueba
 * sobre un doble que anota lo que se le pide.
 */

const escrito = vi.hoisted(() => ({ inserts: [] as { values: unknown; conflicto: any }[] }));
vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  return {
    ...real,
    db: {
      insert: () => {
        const registro: { values: unknown; conflicto: any } = { values: null, conflicto: null };
        const q = {
          values(v: unknown) { registro.values = v; return q; },
          onConflictDoUpdate(c: unknown) { registro.conflicto = c; escrito.inserts.push(registro); return Promise.resolve(); },
        };
        return q;
      },
    },
  };
});

import { generarTandas } from '@/contenido/mes/pipeline';
import { armarRanuras, faltantes, totalDe, type PiezaExistente, type Ranura } from '@/contenido/mes/plan';
import { catalogoDeTemas, temasUsados } from '@/contenido/mes/temas';
import { decidirGuardado, promptConProporcion, type PiezaGenerada } from '@/contenido/mes/guardado';
import { marcarTemasEnDesarrollo } from '@/pilares/avance-servicio';
import type { EntradaTanda } from '@/contenido/mes/agente';
import { FORMATOS } from '@/contenido/reglas';
import { mapaFalso } from '../fixtures/pilares';
import { pilaresTemas } from '@/db/schema';

const mapa = mapaFalso();
const PAQUETE = { post: 8, carrusel: 4, reel: 4, historia: 6 };
const PERIODO = '2026-10';

/** Un agente falso: por cada ranura, una pieza con el tema que diga `elegir`. */
function agenteFalso(elegir: (t: EntradaTanda, r: Ranura) => string | null = (t, r) => t.candidatos.get(r.ref)?.[0]?.id ?? null) {
  return vi.fn(async (t: EntradaTanda) => ({
    datos: { piezas: t.ranuras.map((r) => ({
      ref: r.ref, temaId: elegir(t, r), plataforma: 'ambas' as const, fecha: null,
      copy: `Copy ${r.ref}`, cta: 'Escríbenos', hashtags: '#a #b #c #d #e', briefVisual: 'Brief', promptImagen: 'Foto de algo',
      guion: [{ visual: 'Plano', texto: 'Voz' }], tarjetas: ['T1', 'T2'],
    })) },
    tokensEntrada: 1000, tokensSalida: 500,
  }));
}

function preparar(usadosPrevios: string[] = []) {
  const catalogo = catalogoDeTemas(mapa);
  const usados = temasUsados(usadosPrevios.map((temaId) => ({ temaId })));
  const ranuras = armarRanuras({ periodo: PERIODO, aGenerar: faltantes(PAQUETE, []), quedan: [], mix: mapa.estrategia.mix, pilares: [1, 2, 3, 4, 5] });
  return { catalogo, usados, ranuras, estado: {} as Record<string, string> };
}

const base = (p: ReturnType<typeof preparar>, correr: any, hayPresupuesto = () => true) => generarTandas({
  ranuras: p.ranuras, catalogo: p.catalogo, usados: p.usados, contexto: 'ctx', periodo: PERIODO,
  nombresPilares: mapa.estrategia.pilares.map((x) => x.nombre), estado: p.estado, correr, hayPresupuesto,
});

beforeEach(() => { escrito.inserts = []; });

describe('generarTandas', () => {
  it('genera exactamente el paquete, con fechas dentro del mes', async () => {
    const p = preparar();
    const r = await base(p, agenteFalso());
    expect(r.generadas).toHaveLength(totalDe(PAQUETE as any));
    for (const f of FORMATOS) expect(r.generadas.filter((g) => g.ranura.formato === f)).toHaveLength(PAQUETE[f]);
    for (const g of r.generadas) expect(g.ranura.fecha.startsWith(`${PERIODO}-`)).toBe(true);
    expect(p.estado).toMatchObject({ semana1: 'ok', semana2: 'ok', semana3: 'ok', semana4: 'ok', semana5: 'ok' });
  });

  it('no repite temas: ni de meses anteriores ni entre ranuras, aunque el modelo insista', async () => {
    const previos = catalogoDeTemas(mapa).filter((t) => t.funcion === 'autoridad').slice(0, 40).map((t) => t.id);
    const p = preparar(previos);
    // El modelo intenta usar siempre un tema de un mes anterior y, si no, el mismo para todo.
    const r = await base(p, agenteFalso(() => previos[0]));
    const temas = r.generadas.map((g) => g.temaId);
    expect(temas.every(Boolean)).toBe(true);
    expect(new Set(temas).size).toBe(temas.length);
    for (const t of temas) expect(previos).not.toContain(t);
  });

  it('una tanda que falla no tumba el mes: se guarda lo demás (rescate parcial)', async () => {
    const p = preparar();
    const bueno = agenteFalso();
    const correr = vi.fn(async (t: EntradaTanda, onUso?: any) => {
      if (t.ranuras.some((r) => r.fecha >= '2026-10-08' && r.fecha <= '2026-10-14')) throw new Error('JSON inválido');
      const res = await bueno(t);
      // Y en la semana 3 el modelo se come una pieza.
      if (t.ranuras.some((r) => r.fecha >= '2026-10-15' && r.fecha <= '2026-10-21')) res.datos.piezas.pop();
      return res;
    });
    const r = await base(p, correr);
    const semana2 = p.ranuras.filter((x) => x.fecha >= '2026-10-08' && x.fecha <= '2026-10-14').length;
    expect(semana2).toBeGreaterThan(0);
    expect(r.generadas).toHaveLength(22 - semana2 - 1);
    expect(p.estado.semana2).toBe('fallo');
    expect(p.estado.semana3).toBe('ok');
    expect(r.corte).toBeNull();
  });

  it('sin saldo corta el trabajo y no pide más tandas', async () => {
    const p = preparar();
    const correr = vi.fn(async () => { throw Object.assign(new Error('Your credit balance is too low'), { status: 400 }); });
    const r = await base(p, correr);
    expect(r.corte?.motivo).toBe('saldo');
    expect(correr).toHaveBeenCalledTimes(1);
    expect(p.estado.semana1).toBe('abortado');
  });

  it('el tope de gasto deja de pedir y marca las semanas que faltaban', async () => {
    const p = preparar();
    let llamadas = 0;
    const falso = agenteFalso();
    const correr = vi.fn(async (t: EntradaTanda) => { llamadas++; return falso(t); });
    const r = await base(p, correr, () => llamadas < 1);
    expect(correr).toHaveBeenCalledTimes(1);
    expect(r.generadas.length).toBeGreaterThan(0);
    expect(p.estado.semana2).toBe('omitido_por_costo');
  });
});

describe('decidirGuardado: completar frente a reemplazar', () => {
  const pieza = (id: string, numero: number, extra: Partial<PiezaExistente> = {}): PiezaExistente => ({
    id, numero, formato: 'post', estadoCliente: 'pendiente', arte: [], fechaPublicacion: '2026-10-05', temaId: null, ...extra,
  });
  const actuales = [
    pieza('aprobada', 1, { estadoCliente: 'aprobada' }),
    pieza('cambios', 2, { estadoCliente: 'cambios' }),
    pieza('conArte', 3, { arte: [{ tipo: 'imagen', fileId: 'f' }] }),
    pieza('libre', 4),
  ];
  const generadas: PiezaGenerada[] = (['post', 'reel', 'carrusel'] as const).map((formato, i) => ({
    ranura: { ref: i + 1, formato, fecha: `2026-10-${String(10 + i).padStart(2, '0')}`, funcion: 'venta', pilar: 1 },
    pieza: { ref: i + 1, temaId: null, plataforma: 'ambas', fecha: null, copy: 'c', cta: '', hashtags: '', briefVisual: '', promptImagen: 'Una foto', guion: [{ visual: 'v', texto: 't' }], tarjetas: ['a'] },
    temaId: `P1-S1-0${i + 1}`,
  }));

  it('completar no borra nada y numera después de lo que hay', () => {
    const d = decidirGuardado({ modo: 'completar', incluirConArte: true, actuales, planeadas: ['libre', 'conArte'], generadas });
    expect(d.borrar).toEqual([]);
    expect(d.altas.map((a) => a.numero)).toEqual([5, 6, 7]);
  });

  it('reemplazar nunca borra una aprobada ni una con cambios, ni con arte sin confirmar', () => {
    const d = decidirGuardado({ modo: 'reemplazar', incluirConArte: false, actuales, planeadas: ['aprobada', 'cambios', 'conArte', 'libre'], generadas });
    expect(d.borrar).toEqual(['libre']);
    // El hueco que deja la reemplazada se llena primero.
    expect(d.altas.map((a) => a.numero)).toEqual([4, 5, 6]);
  });

  it('con arte solo si se confirmó, y solo si sigue sin revisar al guardar', () => {
    const con = decidirGuardado({ modo: 'reemplazar', incluirConArte: true, actuales, planeadas: ['conArte', 'libre'], generadas });
    expect(con.borrar.sort()).toEqual(['conArte', 'libre']);
    // El cliente aprobó «libre» mientras la IA escribía: ya no se toca.
    const ahora = actuales.map((p) => (p.id === 'libre' ? { ...p, estadoCliente: 'aprobada' as const } : p));
    expect(decidirGuardado({ modo: 'reemplazar', incluirConArte: true, actuales: ahora, planeadas: ['conArte', 'libre'], generadas }).borrar).toEqual(['conArte']);
    // Una pieza que no estaba planeada no se borra aunque sea reemplazable.
    expect(decidirGuardado({ modo: 'reemplazar', incluirConArte: true, actuales, planeadas: [], generadas }).borrar).toEqual([]);
  });

  it('cada formato lleva lo suyo, y el prompt dice su proporción', () => {
    const d = decidirGuardado({ modo: 'completar', incluirConArte: false, actuales: [], planeadas: [], generadas });
    const [post, reel, carrusel] = d.altas;
    expect(post.guion).toEqual([]); expect(post.tarjetas).toEqual([]);
    expect(reel.guion).toHaveLength(1); expect(reel.tarjetas).toEqual([]);
    expect(carrusel.tarjetas).toEqual(['a']); expect(carrusel.guion).toEqual([]);
    expect(reel.promptImagen).toContain('9:16');
    expect(post.promptImagen).toContain('4:5');
    expect(promptConProporcion('Foto 1:1 de algo', 'reel')).toBe('Foto 1:1 de algo');
    expect(d.temas).toEqual(['P1-S1-01', 'P1-S1-02', 'P1-S1-03']);
  });
});

describe('marca los temas «En desarrollo» en el banco de pilares', () => {
  it('un upsert por mapa y tema que solo pisa los pendientes', async () => {
    await marcarTemasEnDesarrollo('mapa-1', ['P1-S1-01', 'P1-S1-01', 'P2-S3-04'], 'u1', new Date('2026-10-01T00:00:00Z'));
    expect(escrito.inserts).toHaveLength(1);
    const { values, conflicto } = escrito.inserts[0];
    expect(values).toEqual([
      expect.objectContaining({ resultId: 'mapa-1', temaId: 'P1-S1-01', estado: 'en_desarrollo', actualizadoPor: 'u1' }),
      expect.objectContaining({ resultId: 'mapa-1', temaId: 'P2-S3-04', estado: 'en_desarrollo' }),
    ]);
    expect(conflicto.target).toEqual([pilaresTemas.resultId, pilaresTemas.temaId]);
    expect(conflicto.set.estado).toBe('en_desarrollo');
    // `setWhere` es `estado = 'pendiente'`: un tema publicado no baja a en desarrollo.
    const chunks = JSON.stringify(conflicto.setWhere.queryChunks.map((c: any) => c.value ?? c.name ?? null));
    expect(chunks).toContain('pendiente');
  });

  it('sin temas no escribe nada', async () => {
    await marcarTemasEnDesarrollo('mapa-1', [], null);
    expect(escrito.inserts).toHaveLength(0);
  });
});
