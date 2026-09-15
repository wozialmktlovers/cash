import { describe, it, expect } from 'vitest';
import { etapasDe, porcentaje, transcurrido, ETIQUETA_ESTADO } from '@/lib/ui/progreso';
import { ETAPAS } from '@/research/pipeline';
import { ETAPAS_GROWTH } from '@/growth/pipeline';
import { ETAPAS_PILARES } from '@/pilares/pipeline';
import { jobEstado } from '@/db/schema';

describe('etapasDe', () => {
  it('coincide con las etapas reales de cada pipeline', () => {
    expect(etapasDe('research').map((e) => e.clave)).toEqual([...ETAPAS]);
    expect(etapasDe('growth').map((e) => e.clave)).toEqual([...ETAPAS_GROWTH]);
  });
  it('un tipo desconocido usa las de investigación', () => {
    expect(etapasDe(undefined)).toEqual(etapasDe('research'));
    expect(etapasDe('raro')).toEqual(etapasDe('research'));
  });
  it('las etapas del mapa de pilares coinciden con su pipeline', () => {
    expect(etapasDe('pilares').map((e) => e.clave)).toEqual([...ETAPAS_PILARES]);
  });
});

describe('porcentaje', () => {
  it('cuenta solo etapas ok sobre el total del tipo', () => {
    expect(porcentaje({ estructura: 'ok', creativos: 'ok', google: 'corriendo' }, 'growth')).toBe(50);
    expect(porcentaje({ competencia: 'ok', audiencia: 'fallo' }, 'research')).toBe(17);
    expect(porcentaje({}, 'research')).toBe(0);
  });
  it('ignora claves que no son del tipo', () => {
    expect(porcentaje({ competencia: 'ok' }, 'growth')).toBe(0);
  });
});

describe('transcurrido', () => {
  const t0 = new Date('2026-09-14T10:00:00Z');
  it('sin inicio devuelve null', () => {
    expect(transcurrido(null, t0)).toBeNull();
  });
  it('formatea segundos, minutos y horas', () => {
    expect(transcurrido(t0, new Date('2026-09-14T10:00:42Z'))).toBe('42 s');
    expect(transcurrido(t0.toISOString(), new Date('2026-09-14T10:04:12Z'))).toBe('4 min 12 s');
    expect(transcurrido(t0, new Date('2026-09-14T11:03:00Z'))).toBe('1 h 3 min');
  });
  it('nunca da negativo', () => {
    expect(transcurrido(t0, new Date('2026-09-14T09:59:00Z'))).toBe('0 s');
  });
});

describe('ETIQUETA_ESTADO', () => {
  it('tiene texto para cada estado de job', () => {
    for (const e of jobEstado.enumValues) expect(ETIQUETA_ESTADO[e]).toBeTruthy();
  });
});
