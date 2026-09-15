import { describe, it, expect } from 'vitest';
import { detectarJerga, JERGA_PROHIBIDA } from '@/research/jerga';
import { lecturaSchema, investigacionSchema } from '@/research/schemas';
import lectura from '../fixtures/lectura-ejemplo.json';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

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
  it('los términos de varias palabras aceptan cualquier espacio en blanco entre palabras', () => {
    // El modelo no siempre normaliza espacios: un salto de línea, un tab o
    // varios espacios seguidos entre las palabras del término también cuentan.
    expect(detectarJerga('Tu buyer\npersona ideal')).toEqual(['buyer persona']);
    expect(detectarJerga('Tu buyer   persona ideal')).toEqual(['buyer persona']);
    expect(detectarJerga('Un call\tto   action claro')).toEqual(['call to action']);
  });
  it('no repite términos', () => {
    expect(detectarJerga(['target', 'TARGET'])).toEqual(['target']);
  });
  it('«CTA» no coincide con la abreviatura «Cta.» (cuenta)', () => {
    expect(detectarJerga('Revisa el estado de cuenta, Cta. 12345')).toEqual([]);
    expect(detectarJerga('Cta. de ahorro')).toEqual([]);
    // Pero sigue detectando CTA de verdad, con o sin mayúsculas (detectarJerga
    // devuelve el término tal como está en JERGA_PROHIBIDA, no el texto que lo
    // disparó).
    expect(detectarJerga('Pon un CTA claro')).toEqual(['CTA']);
    expect(detectarJerga('pon un cta claro')).toEqual(['CTA']);
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

  it('el error de jerga trae un path (no queda como mensaje "colgado" con ": " al inicio)', () => {
    // src/research/claude.ts formatea los issues como `${path.join('.')}: ${message}`;
    // sin path, un issue de raíz (path []) producía "«: Hay jerga...»".
    const l = copia();
    l.recomendamos.pasos[0].queHacer = 'Mejora tu funnel de ventas';
    const r = lecturaSchema.safeParse(l);
    const issue = r.error?.issues.find((i) => i.message.includes('jerga'));
    expect(issue?.path.length).toBeGreaterThan(0);
    const formateado = `${issue?.path.join('.')}: ${issue?.message}`;
    expect(formateado.startsWith(': ')).toBe(false);
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
    l.portada.titular = 'a'.repeat(91);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
  });

  it('acepta precio null y faltaConfirmar vacío', () => {
    const l = copia();
    l.recomendamos.precio = null;
    l.faltaConfirmar = [];
    expect(lecturaSchema.safeParse(l).success).toBe(true);
  });

  it('exige de 3 a 4 cifras con tono válido', () => {
    const l = copia();
    l.cifras = l.cifras.slice(0, 2);
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    m.cifras[0].tono = 'rojo';
    expect(lecturaSchema.safeParse(m).success).toBe(false);
  });

  it('cada hallazgo trae resumen y detalle, y cada perfil su frase', () => {
    const l = copia();
    delete l.descubrimos[0].resumen;
    expect(lecturaSchema.safeParse(l).success).toBe(false);
    const m = copia();
    delete m.clienteIdeal.perfiles[0].frase;
    expect(lecturaSchema.safeParse(m).success).toBe(false);
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

  it('valida también el fixture parcial', () => {
    expect(investigacionSchema.safeParse(parcial).success).toBe(true);
  });
});
