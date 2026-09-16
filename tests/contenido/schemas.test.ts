import { describe, it, expect } from 'vitest';
import { propuestasCopySchema, opcionCopySchema, LIMITES, OPCIONES } from '@/contenido/schemas';

/**
 * El esquema de las propuestas de copy (B2).
 *
 * Es el contrato con el modelo, y lo que se prueba aquí es lo que NO se le
 * acepta: dos opciones en vez de tres, hashtags fuera de rango y textos más
 * largos de lo que la red publica. Cada rechazo de estos ahorra un copy
 * mutilado en el entregable del cliente.
 */

const hashtags = (n: number) => Array.from({ length: n }, (_, i) => `#tema${i + 1}`);

const opcion = (i = 1, extra: Record<string, unknown> = {}) => ({
  gancho: `Gancho ${i}: la sala llena a las ocho de la noche`,
  copy: `Copy ${i} con la escena completa y el cierre.`,
  cta: 'Escríbenos por WhatsApp y te decimos cómo.',
  hashtags: hashtags(6),
  briefVisual: `Brief ${i}: plano medio del taller, luz de tarde, sin texto en pantalla.`,
  ...extra,
});

const tres = (extra: Record<string, unknown> = {}) => ({ opciones: [opcion(1, extra), opcion(2, extra), opcion(3, extra)] });

describe('propuestasCopySchema', () => {
  it('acepta las tres opciones completas', () => {
    const r = propuestasCopySchema.safeParse(tres());
    expect(r.success).toBe(true);
    expect(r.data?.opciones).toHaveLength(OPCIONES);
  });

  it('rechaza 2 y rechaza 4: son tres para elegir', () => {
    expect(propuestasCopySchema.safeParse({ opciones: [opcion(1), opcion(2)] }).success).toBe(false);
    expect(propuestasCopySchema.safeParse({ opciones: [opcion(1), opcion(2), opcion(3), opcion(4)] }).success).toBe(false);
    expect(propuestasCopySchema.safeParse({ opciones: [] }).success).toBe(false);
  });

  it('rechaza tres variaciones del mismo gancho, aunque cambien acentos y signos', () => {
    const mismo = { opciones: [opcion(1), { ...opcion(2), gancho: opcion(1).gancho }, opcion(3)] };
    expect(propuestasCopySchema.safeParse(mismo).success).toBe(false);

    const disfrazado = {
      opciones: [opcion(1), { ...opcion(2), gancho: `${opcion(1).gancho.toUpperCase()}!` }, opcion(3)],
    };
    const r = propuestasCopySchema.safeParse(disfrazado);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('repite el gancho');
  });

  it('exige que `opciones` venga', () => {
    expect(propuestasCopySchema.safeParse({}).success).toBe(false);
    expect(propuestasCopySchema.safeParse({ opciones: 'tres' }).success).toBe(false);
  });
});

describe('hashtags', () => {
  it('de 5 a 10, ni 4 ni 11', () => {
    expect(opcionCopySchema.safeParse(opcion(1, { hashtags: hashtags(LIMITES.hashtagsMin) })).success).toBe(true);
    expect(opcionCopySchema.safeParse(opcion(1, { hashtags: hashtags(LIMITES.hashtagsMax) })).success).toBe(true);
    expect(opcionCopySchema.safeParse(opcion(1, { hashtags: hashtags(LIMITES.hashtagsMin - 1) })).success).toBe(false);
    expect(opcionCopySchema.safeParse(opcion(1, { hashtags: hashtags(LIMITES.hashtagsMax + 1) })).success).toBe(false);
    expect(opcionCopySchema.safeParse(opcion(1, { hashtags: [] })).success).toBe(false);
  });

  it('acepta con o sin # y lo normaliza a uno solo', () => {
    const r = opcionCopySchema.safeParse(opcion(1, { hashtags: ['salud', '  #agua ', '##doble', '#tres', '#cuatro'] }));
    expect(r.success).toBe(true);
    expect(r.data?.hashtags).toEqual(['#salud', '#agua', '#doble', '#tres', '#cuatro']);
  });

  it('rechaza lo que no se puede publicar tal cual: espacios, signos o vacío', () => {
    for (const malo of ['dos palabras', '#con espacio', '#punto.final', '#', '#a', '   ']) {
      expect(opcionCopySchema.safeParse(opcion(1, { hashtags: [malo, ...hashtags(4)] })).success).toBe(false);
    }
  });

  it('rechaza repetidos, que inflan la lista sin sumar nada', () => {
    const r = opcionCopySchema.safeParse(opcion(1, { hashtags: ['#salud', '#Salud', '#a1', '#a2', '#a3'] }));
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('repetido');
  });
});

describe('largos de cada campo', () => {
  const largo = (n: number) => 'a'.repeat(n);

  it('acepta el máximo exacto y rechaza uno más', () => {
    for (const [campo, max] of [['gancho', LIMITES.gancho], ['copy', LIMITES.copy], ['cta', LIMITES.cta], ['briefVisual', LIMITES.briefVisual]] as const) {
      expect(opcionCopySchema.safeParse(opcion(1, { [campo]: largo(max) })).success).toBe(true);
      expect(opcionCopySchema.safeParse(opcion(1, { [campo]: largo(max + 1) })).success).toBe(false);
    }
  });

  it('un copy de 2200 pasa y uno de 3000 no: es el tope de Instagram', () => {
    expect(propuestasCopySchema.safeParse(tres({ copy: largo(2200) })).success).toBe(true);
    expect(propuestasCopySchema.safeParse(tres({ copy: largo(3000) })).success).toBe(false);
  });

  it('ningún campo puede venir vacío', () => {
    for (const campo of ['gancho', 'copy', 'cta', 'briefVisual']) {
      expect(opcionCopySchema.safeParse(opcion(1, { [campo]: '' })).success).toBe(false);
    }
  });

  it('el brief visual es obligatorio: sin él nadie puede hacer el arte', () => {
    const { briefVisual, ...sinBrief } = opcion(1);
    expect(opcionCopySchema.safeParse(sinBrief).success).toBe(false);
  });
});
