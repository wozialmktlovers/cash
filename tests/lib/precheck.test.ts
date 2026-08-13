import { describe, it, expect } from 'vitest';
import { revisarAntesDeInvestigar } from '@/lib/precheck';

describe('revisión previa', () => {
  it('avisa cuando no hay enlaces ni archivos', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 0, archivosConTexto: 0, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('enlaces');
    expect(r.listo).toBe(true);
  });

  it('avisa cuando falta el ticket', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 2, archivosConTexto: 1, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('ticket');
  });

  it('sin advertencias cuando está todo', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 3, archivosConTexto: 2, ticket: '$30,000', ciudad: 'GDL' });
    expect(r.advertencias).toHaveLength(0);
  });
});

describe('precheck del manual de campaña', () => {
  it('no deja generarlo sin investigación previa', async () => {
    const { puedeGenerarGrowth } = await import('@/lib/precheck');
    const r = puedeGenerarGrowth({ tieneResultado: false });
    expect(r.ok).toBe(false);
    expect(r.razon).toMatch(/investigación/i);
  });

  it('lo permite en cuanto hay una', async () => {
    const { puedeGenerarGrowth } = await import('@/lib/precheck');
    expect(puedeGenerarGrowth({ tieneResultado: true }).ok).toBe(true);
  });

  it('la razón nunca va vacía cuando bloquea: el operador tiene que saber por qué', async () => {
    const { puedeGenerarGrowth } = await import('@/lib/precheck');
    expect(puedeGenerarGrowth({ tieneResultado: false }).razon.length).toBeGreaterThan(20);
  });
});
