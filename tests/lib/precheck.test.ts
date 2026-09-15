import { describe, it, expect } from 'vitest';
import { revisarAntesDeInvestigar, investigacionUtil, contarEtapasConDatos } from '@/lib/precheck';

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

describe('precheck del mapa de pilares', () => {
  // `puedeGenerarGrowth` (equivalente para el manual de campaña) se quitó en
  // la limpieza de M3 por no tener ya ningún llamador; este describe pasó a
  // probar `puedeGenerarPilares`, la única función de este par que sigue en
  // uso (la pantalla de confirmación de pilares), sin perder la cobertura
  // de `contarEtapasConDatos` que ya traían estos casos.
  it('no deja generarlo sin investigación previa', async () => {
    const { puedeGenerarPilares } = await import('@/lib/precheck');
    const r = puedeGenerarPilares({ etapasConDatos: 0 });
    expect(r.ok).toBe(false);
    expect(r.razon).toMatch(/investigación/i);
  });

  it('lo permite en cuanto una etapa produjo datos', async () => {
    const { puedeGenerarPilares } = await import('@/lib/precheck');
    expect(puedeGenerarPilares({ etapasConDatos: 1 }).ok).toBe(true);
  });

  it('la razón nunca va vacía cuando bloquea: el operador tiene que saber por qué', async () => {
    const { puedeGenerarPilares } = await import('@/lib/precheck');
    expect(puedeGenerarPilares({ etapasConDatos: 0 }).razon.length).toBeGreaterThan(20);
  });

  it('una investigación que falló entera no cuenta como base', async () => {
    // El pipeline inserta una fila de resultado aunque fallen las cinco
    // etapas, para dejar constancia del intento. Si el precheck solo mirara
    // que la fila existe, dejaría generar un mapa de pilares sobre nada.
    // Pasó en producción con el cliente de prueba.
    const { contarEtapasConDatos, puedeGenerarPilares } = await import('@/lib/precheck');
    const fallida = {
      competencia: { estado: 'vacio', razon: 'x' }, audiencia: { estado: 'vacio', razon: 'x' },
      canales: { estado: 'vacio', razon: 'x' }, mercado: { estado: 'vacio', razon: 'x' },
      sintesis: { estado: 'vacio', razon: 'x' },
    };
    expect(contarEtapasConDatos(fallida)).toBe(0);
    expect(puedeGenerarPilares({ etapasConDatos: contarEtapasConDatos(fallida) }).ok).toBe(false);
  });

  it('una investigación parcial sí sirve de base', async () => {
    const { contarEtapasConDatos, puedeGenerarPilares } = await import('@/lib/precheck');
    const parcial = {
      competencia: { estado: 'ok', datos: {} }, audiencia: { estado: 'vacio', razon: 'x' },
    };
    expect(contarEtapasConDatos(parcial)).toBe(1);
    expect(puedeGenerarPilares({ etapasConDatos: 1 }).ok).toBe(true);
  });

  it('no revienta con datos corruptos o ausentes', async () => {
    const { contarEtapasConDatos } = await import('@/lib/precheck');
    for (const malo of [null, undefined, 'texto', 42, []]) {
      expect(contarEtapasConDatos(malo)).toBe(0);
    }
  });
});

describe('investigacionUtil', () => {
  const ok = (n: number) => ({ estado: 'ok', datos: {} });
  const vacia = { estado: 'vacio', razon: 'x' };

  it('elige la más reciente entre las que sí tienen datos, no la más reciente a secas', () => {
    // Caso del reporte: v1 con 4 etapas con datos, v2 falló entera pero el
    // pipeline igual insertó su fila. Generar sobre v2 haría fallar el job
    // aunque la API ya haya dicho que el cliente estaba listo.
    const v1 = { version: 1, datos: { a: ok(1), b: ok(1), c: ok(1), d: ok(1) } };
    const v2 = { version: 2, datos: { a: vacia, b: vacia, c: vacia, d: vacia, e: vacia } };
    expect(investigacionUtil([v1, v2])).toBe(v1);
  });

  it('entre dos versiones con datos, gana la más reciente', () => {
    const v1 = { version: 1, datos: { a: ok(1), b: ok(1) } };
    const v2 = { version: 2, datos: { a: ok(1) } };
    expect(investigacionUtil([v1, v2])).toBe(v2);
  });

  it('sin ninguna con datos, no devuelve nada', () => {
    const v1 = { version: 1, datos: { a: vacia } };
    const v2 = { version: 2, datos: {} };
    expect(investigacionUtil([v1, v2])).toBeUndefined();
  });

  it('lista vacía no revienta', () => {
    expect(investigacionUtil([])).toBeUndefined();
  });

  it('el conteo de la elegida coincide con lo que usaría el precheck de la API', () => {
    const v1 = { version: 1, datos: { a: ok(1), b: ok(1), c: ok(1), d: ok(1) } };
    const v2 = { version: 2, datos: {} };
    const elegida = investigacionUtil([v1, v2]);
    expect(contarEtapasConDatos(elegida?.datos)).toBe(4);
  });
});
