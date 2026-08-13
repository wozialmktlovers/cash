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
    const r = puedeGenerarGrowth({ etapasConDatos: 0 });
    expect(r.ok).toBe(false);
    expect(r.razon).toMatch(/investigación/i);
  });

  it('lo permite en cuanto una etapa produjo datos', async () => {
    const { puedeGenerarGrowth } = await import('@/lib/precheck');
    expect(puedeGenerarGrowth({ etapasConDatos: 1 }).ok).toBe(true);
  });

  it('la razón nunca va vacía cuando bloquea: el operador tiene que saber por qué', async () => {
    const { puedeGenerarGrowth } = await import('@/lib/precheck');
    expect(puedeGenerarGrowth({ etapasConDatos: 0 }).razon.length).toBeGreaterThan(20);
  });

  it('una investigación que falló entera no cuenta como base', async () => {
    // El pipeline inserta una fila de resultado aunque fallen las cinco
    // etapas, para dejar constancia del intento. Si el precheck solo mirara
    // que la fila existe, dejaría generar una campaña sobre nada. Pasó en
    // producción con el cliente de prueba.
    const { contarEtapasConDatos, puedeGenerarGrowth } = await import('@/lib/precheck');
    const fallida = {
      competencia: { estado: 'vacio', razon: 'x' }, audiencia: { estado: 'vacio', razon: 'x' },
      canales: { estado: 'vacio', razon: 'x' }, mercado: { estado: 'vacio', razon: 'x' },
      sintesis: { estado: 'vacio', razon: 'x' },
    };
    expect(contarEtapasConDatos(fallida)).toBe(0);
    expect(puedeGenerarGrowth({ etapasConDatos: contarEtapasConDatos(fallida) }).ok).toBe(false);
  });

  it('una investigación parcial sí sirve de base', async () => {
    const { contarEtapasConDatos, puedeGenerarGrowth } = await import('@/lib/precheck');
    const parcial = {
      competencia: { estado: 'ok', datos: {} }, audiencia: { estado: 'vacio', razon: 'x' },
    };
    expect(contarEtapasConDatos(parcial)).toBe(1);
    expect(puedeGenerarGrowth({ etapasConDatos: 1 }).ok).toBe(true);
  });

  it('no revienta con datos corruptos o ausentes', async () => {
    const { contarEtapasConDatos } = await import('@/lib/precheck');
    for (const malo of [null, undefined, 'texto', 42, []]) {
      expect(contarEtapasConDatos(malo)).toBe(0);
    }
  });
});
