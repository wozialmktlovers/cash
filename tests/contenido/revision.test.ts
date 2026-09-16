import { describe, it, expect } from 'vitest';
import {
  aceptaDecision, anclaDePieza, razonPlazoVencido, textoComentarioCambios, validarDecision,
  LARGO_MAXIMO_NOTA,
} from '@/contenido/revision';
import { limiteRevision } from '@/contenido/reglas';

/**
 * Las reglas puras de la revisión del cliente (C2). `registrarRevision` toca la
 * base y los avisos, y se prueba desde su ruta en
 * `tests/api/contenido-revision.test.ts`; aquí está lo que se puede decidir sin
 * base de datos.
 */
describe('validarDecision', () => {
  it('acepta aprobar sin nota', () => {
    expect(validarDecision({ decision: 'aprobar' })).toEqual({ ok: true, decision: 'aprobar', nota: '' });
  });

  it('aprobar ignora la nota que venga', () => {
    const r = validarDecision({ decision: 'aprobar', nota: 'cambien el color' });
    expect(r).toEqual({ ok: true, decision: 'aprobar', nota: '' });
  });

  it('cambios exige nota', () => {
    for (const cuerpo of [{ decision: 'cambios' }, { decision: 'cambios', nota: '   ' }, { decision: 'cambios', nota: 7 }]) {
      const r = validarDecision(cuerpo);
      expect(r.ok, JSON.stringify(cuerpo)).toBe(false);
      if (!r.ok) expect(r.errores[0]).toContain('cambiemos');
    }
  });

  it('cambios recorta la nota y la acepta', () => {
    expect(validarDecision({ decision: 'cambios', nota: '  La foto no  ' })).toEqual({
      ok: true, decision: 'cambios', nota: 'La foto no',
    });
  });

  it('la nota tiene tope', () => {
    const r = validarDecision({ decision: 'cambios', nota: 'a'.repeat(LARGO_MAXIMO_NOTA + 1) });
    expect(r.ok).toBe(false);
  });

  it('una decisión desconocida no se adivina', () => {
    for (const cuerpo of [{}, null, { decision: 'rechazar' }, { decision: 'aprobada' }, 'aprobar']) {
      expect(validarDecision(cuerpo).ok, JSON.stringify(cuerpo)).toBe(false);
    }
  });
});

describe('ancla y texto del comentario', () => {
  const PIEZA = '11111111-2222-4333-8444-555555555555';

  it('el ancla va por el id de la pieza, no por su número', () => {
    expect(anclaDePieza(PIEZA)).toBe(`pieza:${PIEZA}`);
  });

  it('el ancla pasa el formato que acepta validarComentario', () => {
    expect(anclaDePieza(PIEZA)).toMatch(/^[\w:.-]+$/);
    expect(anclaDePieza(PIEZA).length).toBeLessThanOrEqual(200);
  });

  it('el comentario dice de qué pieza habla', () => {
    expect(textoComentarioCambios(7, 'La foto no es del consultorio.'))
      .toBe('Contenido 07 · La foto no es del consultorio.');
  });
});

describe('aceptaDecision', () => {
  const AHORA = new Date('2026-09-19T18:00:00.000Z');
  const compartidoEn = new Date('2026-09-16T18:00:00.000Z');

  it('un lote en revisión acepta, con plazo o sin él', () => {
    expect(aceptaDecision({ estado: 'en_revision', compartidoEn, limiteRevision: null }, AHORA)).toBe(true);
    expect(aceptaDecision({ estado: 'en_revision', compartidoEn, limiteRevision: limiteRevision(compartidoEn, 2) }, AHORA)).toBe(true);
  });

  it('un lote con cambios acepta aunque su límite ya pasó: la pelota es del operador', () => {
    const viejo = new Date('2026-08-01T18:00:00.000Z');
    expect(aceptaDecision({ estado: 'con_cambios', compartidoEn: viejo, limiteRevision: limiteRevision(viejo, 2) }, AHORA)).toBe(true);
  });

  // El riesgo que dejó abierto C3: después de la auto-aprobación, no hay
  // cambios a destiempo.
  it('un lote aprobado con el plazo vencido ya no acepta', () => {
    const viejo = new Date('2026-08-01T18:00:00.000Z');
    expect(aceptaDecision({ estado: 'aprobada', compartidoEn: viejo, limiteRevision: limiteRevision(viejo, 2) }, AHORA)).toBe(false);
  });

  // …pero el cliente que aprobó todo por su cuenta sigue a tiempo de
  // arrepentirse, que es lo que ya dice `estadoTrasComentarioCliente`.
  it('un lote aprobado DENTRO del plazo sigue aceptando', () => {
    const limite = new Date('2026-09-20T05:59:59.999Z');
    expect(aceptaDecision({ estado: 'aprobada', compartidoEn, limiteRevision: limite }, AHORA)).toBe(true);
  });

  it('un lote aprobado sin fecha límite acepta: nunca hubo plazo que vencer', () => {
    expect(aceptaDecision({ estado: 'aprobada', compartidoEn, limiteRevision: null }, AHORA)).toBe(true);
  });
});

describe('razonPlazoVencido', () => {
  it('dice cuándo terminó y a dónde acudir', () => {
    const texto = razonPlazoVencido(new Date('2026-09-19T05:59:59.999Z'));
    expect(texto).toContain('plazo de revisión');
    expect(texto).toContain('aprobado');
    expect(texto).toContain('escríbele a tu equipo');
  });

  it('sin fecha no inventa una', () => {
    expect(razonPlazoVencido(null)).not.toContain(' el undefined');
  });
});
