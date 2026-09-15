import { describe, it, expect } from 'vitest';
import { detectarJerga, JERGA_PROHIBIDA } from '@/research/jerga';
import { lecturaSchema, investigacionSchema } from '@/research/schemas';
import lectura from '../fixtures/lectura-ejemplo.json';
import completa from '../fixtures/investigacion-completa.json';

const copia = () => JSON.parse(JSON.stringify(lectura));

describe('detectarJerga', () => {
  it('encuentra términos sin importar mayúsculas ni acentos, en objetos anidados', () => {
    expect(detectarJerga({ a: ['Mejora tu ENGAGEMENT'], b: { c: 'más conversion' } })).toEqual(['engagement', 'conversión']);
  });
  it('solo cuenta palabras completas', () => {
    expect(detectarJerga('Liderazgo y copyright')).toEqual([]);
    expect(detectarJerga('Buen copy')).toEqual(['copy']);
  });
  it('detecta frases de varias palabras', () => {
    expect(detectarJerga('Tu buyer persona ideal')).toEqual(['buyer persona']);
  });
  it('no repite términos', () => {
    expect(detectarJerga(['target', 'TARGET'])).toEqual(['target']);
  });
  it('la lista tiene los 29 términos del spec', () => {
    expect(JERGA_PROHIBIDA).toHaveLength(29);
  });
});

describe('lecturaSchema', () => {
  it('acepta la lectura de ejemplo', () => {
    const r = lecturaSchema.safeParse(lectura);
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });

  it('rechaza jerga y nombra el término', () => {
    const l = copia();
    l.recomendamos.pasos[0].queHacer = 'Mejora tu funnel de ventas';
    const r = lecturaSchema.safeParse(l);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('funnel');
  });

  it('exige exactamente dos perfiles y tres preocupaciones', () => {
    const l = copia();
    l.clienteIdeal.perfiles.pop();
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.clienteIdeal.lePreocupa.push('otra');
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('exige de 3 a 4 hallazgos y de 3 a 5 pasos', () => {
    const l = copia();
    l.descubrimos = l.descubrimos.slice(0, 2);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.recomendamos.pasos = m.recomendamos.pasos.slice(0, 2);
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('rechaza textos demasiado largos', () => {
    const l = copia();
    l.portada.titular = 'a'.repeat(161);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
  });

  it('acepta precio null y faltaConfirmar vacío', () => {
    const l = copia();
    l.recomendamos.precio = null;
    l.faltaConfirmar = [];
    expect(lecturaSchema.safeParse(l).success).toBe(true);
  });
});

describe('investigacionSchema con lectura', () => {
  it('sigue aceptando investigaciones sin lectura', () => {
    expect(investigacionSchema.safeParse(completa).success).toBe(true);
  });
  it('acepta la lectura como etapa ok o vacía', () => {
    expect(investigacionSchema.safeParse({ ...completa, lectura: { estado: 'ok', datos: lectura } }).success).toBe(true);
    expect(investigacionSchema.safeParse({ ...completa, lectura: { estado: 'vacio', razon: 'x' } }).success).toBe(true);
  });
});
