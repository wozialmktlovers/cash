import { describe, it, expect } from 'vitest';
import { ETAPAS_PILARES, armarPilares } from '@/pilares/pipeline';
import { puedeGenerarPilares } from '@/lib/precheck';
import { estrategiaFalsa, pilarFalso } from '../fixtures/pilares';

describe('pipeline de pilares', () => {
  it('etapas en orden', () => {
    expect([...ETAPAS_PILARES]).toEqual(['estrategia', 'pilar1', 'pilar2', 'pilar3', 'pilar4', 'pilar5', 'revision']);
  });
  it('arma los cinco pilares con ids y declara los vacíos con su razón', () => {
    const est = estrategiaFalsa();
    const p = armarPilares(est, { 1: pilarFalso(1, est), 3: pilarFalso(3, est) }, { pilar2: 'fallo', pilar4: 'omitido_por_costo' });
    expect(p.map((x) => x.estado)).toEqual(['ok', 'vacio', 'ok', 'vacio', 'vacio']);
    expect((p[0] as any).subcategorias[0].temas[0].id).toBe('P1-S1-01');
    expect((p[1] as any).razon).toContain('dos intentos');
    expect((p[3] as any).razon).toContain('tope de costo');
    expect((p[4] as any).razon).toContain('no se ejecutó');
  });
  it('precheck como Growth', () => {
    expect(puedeGenerarPilares({ etapasConDatos: 0 }).ok).toBe(false);
    expect(puedeGenerarPilares({ etapasConDatos: 0 }).razon).toContain('investigación');
    expect(puedeGenerarPilares({ etapasConDatos: 2 })).toEqual({ ok: true, razon: '' });
  });
});
