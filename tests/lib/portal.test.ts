import { describe, it, expect } from 'vitest';
import { resumenPortal, type EtapaClientePortal } from '@/lib/portal';

// Fábrica de EtapaClientePortal con valores por omisión razonables, siguiendo
// el patrón de tests/flujo/reglas.test.ts.
const et = (etapa: EtapaClientePortal['etapa'], overrides: Partial<EtapaClientePortal> = {}): EtapaClientePortal => ({
  id: `${etapa}-1`,
  etapa,
  contratada: true,
  interna: false,
  estado: 'no_iniciada',
  documentoId: null,
  versionAprobadaId: null,
  actualizadoEn: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('resumenPortal', () => {
  it('calcula el avance con avanceCliente sobre las etapas contratadas y no internas', () => {
    const r = resumenPortal([
      et('investigacion', { estado: 'aprobada', versionAprobadaId: 'v1' }),
      et('pilares', { estado: 'en_proceso' }),
      et('desarrollo_mensual', { contratada: false }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ]);
    // (100 + 25 + 0) / 3 = 41.67 → 42
    expect(r.avance).toBe(42);
  });

  it('ordena las tarjetas según ETAPAS, sin importar el orden de entrada', () => {
    const r = resumenPortal([et('manual_campana'), et('investigacion'), et('pilares')]);
    expect(r.tarjetas.map((t) => t.etapa)).toEqual(['investigacion', 'pilares', 'manual_campana']);
  });

  it('oculta las etapas internas y las no contratadas', () => {
    const r = resumenPortal([
      et('investigacion', { interna: true }),
      et('pilares', { contratada: false }),
      et('manual_campana'),
    ]);
    expect(r.tarjetas.map((t) => t.etapa)).toEqual(['manual_campana']);
  });

  it('listo es true solo si hay versión aprobada', () => {
    const r = resumenPortal([
      et('investigacion', { estado: 'aprobada', versionAprobadaId: 'v1' }),
      et('pilares', { estado: 'aprobada', versionAprobadaId: null }),
    ]);
    expect(r.tarjetas.find((t) => t.etapa === 'investigacion')!.listo).toBe(true);
    expect(r.tarjetas.find((t) => t.etapa === 'pilares')!.listo).toBe(false);
  });

  it('puedeComentar solo en las etapas 3 y 4 (desarrollo_mensual y manual_campana)', () => {
    const r = resumenPortal([et('investigacion'), et('pilares'), et('desarrollo_mensual'), et('manual_campana')]);
    const por = new Map(r.tarjetas.map((t) => [t.etapa, t.puedeComentar]));
    expect(por.get('investigacion')).toBe(false);
    expect(por.get('pilares')).toBe(false);
    expect(por.get('desarrollo_mensual')).toBe(true);
    expect(por.get('manual_campana')).toBe(true);
  });

  it('proximamente solo en desarrollo_mensual', () => {
    const r = resumenPortal([et('desarrollo_mensual'), et('manual_campana')]);
    const por = new Map(r.tarjetas.map((t) => [t.etapa, t.proximamente]));
    expect(por.get('desarrollo_mensual')).toBe(true);
    expect(por.get('manual_campana')).toBe(false);
  });

  it('numero sigue la posición fija de la etapa (1–4), no el índice entre las visibles', () => {
    const r = resumenPortal([et('pilares'), et('manual_campana')]);
    expect(r.tarjetas.find((t) => t.etapa === 'pilares')!.numero).toBe(2);
    expect(r.tarjetas.find((t) => t.etapa === 'manual_campana')!.numero).toBe(4);
  });

  it('estadoCliente usa la etiqueta ESTADO_CLIENTE, no la interna', () => {
    const r = resumenPortal([et('investigacion', { estado: 'en_revision' })]);
    expect(r.tarjetas[0].estadoCliente).toBe('En revisión');
  });

  it('sin etapas visibles: avance 0 y sin tarjetas', () => {
    const r = resumenPortal([et('investigacion', { contratada: false })]);
    expect(r.avance).toBe(0);
    expect(r.tarjetas).toEqual([]);
  });
});
