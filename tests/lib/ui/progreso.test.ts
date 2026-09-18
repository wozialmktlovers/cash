import { describe, it, expect } from 'vitest';
import { etapasDe, porcentaje, transcurrido, ETIQUETA_ESTADO, resumenAvance, type EtapaResumen } from '@/lib/ui/progreso';
import { ETAPAS as ETAPAS_FLUJO, avanceCliente } from '@/flujo/reglas';
import { ETAPAS } from '@/research/pipeline';
import { ETAPAS_GROWTH } from '@/growth/pipeline';
import { ETAPAS_PILARES } from '@/pilares/pipeline';
import { ETAPAS_CONTENIDO } from '@/contenido/mes/pipeline';
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
  it('las etapas del mes con IA coinciden con su pipeline', () => {
    expect(etapasDe('contenido').map((e) => e.clave)).toEqual([...ETAPAS_CONTENIDO]);
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

// Fábrica de etapas para `resumenAvance`: contratada y visible por omisión.
const et = (etapa: EtapaResumen['etapa'], overrides: Partial<EtapaResumen> = {}): EtapaResumen => ({
  etapa,
  contratada: true,
  interna: false,
  estado: 'no_iniciada',
  ...overrides,
});

describe('resumenAvance', () => {
  it('resume las cuatro etapas contratadas con su porcentaje y el paso en curso', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
      et('desarrollo_mensual', { estado: 'en_revision' }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ];
    const r = resumenAvance(etapas);

    // Media de las cuatro: (100+100+50+0)/4 = 62.5 -> 63. Es el número que
    // esperaba el plan original y que la exclusión de `desarrollo_mensual`
    // convertía en 67 ((100+100+0)/3) mientras esa etapa no tenía generador.
    expect(r.porcentaje).toBe(63);
    expect(r.porcentaje).toBe(avanceCliente(etapas));
    expect(r.pasos.map((p) => p.etapa)).toEqual([...ETAPAS_FLUJO]);
    expect(r.pasos.map((p) => p.estado)).toEqual(['aprobada', 'aprobada', 'en_revision', 'no_iniciada']);
    expect(r.pasos.every((p) => p.contratada)).toBe(true);
    // El paso en curso es el tercero: la primera etapa visible que no está
    // aprobada. Ahora además cuenta para el porcentaje, que es justo lo que
    // arregla la incoherencia que este archivo documentaba.
    expect(r.pasoActual?.etapa).toBe('desarrollo_mensual');
  });

  // La incoherencia que había entre las dos mitades del resumen: `pasoActual`
  // miraba las cuatro etapas y el porcentaje solo tres, así que un cliente
  // podía ver «100%» con el paso 3 todavía en curso. Al entrar la etapa 3 al
  // avance, las dos mitades usan el mismo conjunto.
  it('el 100% y «sin paso en curso» ya no se contradicen en desarrollo_mensual', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
      et('desarrollo_mensual', { estado: 'en_proceso' }),
      et('manual_campana', { estado: 'aprobada' }),
    ];
    const r = resumenAvance(etapas);
    // Antes: 100 con pasoActual = desarrollo_mensual. Ahora (100+100+25+100)/4 = 81.
    expect(r.porcentaje).toBe(81);
    expect(r.pasoActual?.etapa).toBe('desarrollo_mensual');

    const listo = resumenAvance(etapas.map((e) => ({ ...e, estado: 'aprobada' as const })));
    expect(listo.porcentaje).toBe(100);
    expect(listo.pasoActual).toBeNull();
  });

  it('redondea el promedio', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'con_cambios' }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ];
    // (100+60+0)/3 = 53.33 -> 53
    expect(resumenAvance(etapas).porcentaje).toBe(53);
  });

  it('deja fuera del porcentaje las etapas no contratadas, pero las pinta como pasos', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { contratada: false, estado: 'no_iniciada' }),
      et('desarrollo_mensual', { contratada: false }),
      et('manual_campana', { contratada: false }),
    ];
    const r = resumenAvance(etapas);

    expect(r.porcentaje).toBe(100);
    expect(r.pasos).toHaveLength(4);
    expect(r.pasos.map((p) => p.contratada)).toEqual([true, false, false, false]);
    expect(r.pasoActual).toBeNull();
  });

  it('trata una etapa interna como no contratada', () => {
    const r = resumenAvance([et('investigacion', { interna: true, estado: 'en_proceso' })]);
    expect(r.porcentaje).toBe(0);
    expect(r.pasos[0]?.contratada).toBe(false);
    expect(r.pasoActual).toBeNull();
  });

  it('sin etapas contratadas da 0 y ningún paso en curso', () => {
    const r = resumenAvance([]);
    expect(r.porcentaje).toBe(0);
    expect(r.pasoActual).toBeNull();
    expect(r.pasos.map((p) => p.etapa)).toEqual([...ETAPAS_FLUJO]);
    expect(r.pasos.every((p) => !p.contratada && p.estado === 'no_iniciada')).toBe(true);
  });

  it('con todo aprobado da 100 y ningún paso en curso', () => {
    const r = resumenAvance(ETAPAS_FLUJO.map((e) => et(e, { estado: 'aprobada' })));
    expect(r.porcentaje).toBe(100);
    expect(r.pasoActual).toBeNull();
  });
});
