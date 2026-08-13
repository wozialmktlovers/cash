import { describe, it, expect } from 'vitest';
import { growthSchema, RATIO_POR_FORMATO } from '@/growth/schemas';
import completo from '../fixtures/growth-completo.json';

const clonar = () => JSON.parse(JSON.stringify(completo));

describe('growthSchema', () => {
  it('acepta el fixture completo', () => {
    const r = growthSchema.safeParse(completo);
    if (!r.success) console.error(r.error.issues.slice(0, 5));
    expect(r.success).toBe(true);
  });

  it('rechaza ocho creativos: la estructura de la casa son nueve', () => {
    const malo = clonar();
    malo.creativos = malo.creativos.slice(0, 8);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza diez creativos', () => {
    const malo = clonar();
    malo.creativos.push(malo.creativos[0]);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza cuatro campañas de Meta', () => {
    const malo = clonar();
    malo.campanasMeta.push(malo.campanasMeta[0]);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza un titular RSA de 31 caracteres, que Google no admite', () => {
    const malo = clonar();
    malo.rsa.titulares[0] = 'x'.repeat(31);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('acepta un titular de exactamente 30', () => {
    const bueno = clonar();
    bueno.rsa.titulares[0] = 'x'.repeat(30);
    expect(growthSchema.safeParse(bueno).success).toBe(true);
  });

  it('rechaza una descripción RSA de 91 caracteres', () => {
    const malo = clonar();
    malo.rsa.descripciones[0] = 'x'.repeat(91);
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza una campaña de Google con una clave fuera del estándar', () => {
    const malo = clonar();
    malo.campanasGoogle[0].clave = 'remarketing';
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza semanas fuera del rango razonable', () => {
    const malo = clonar();
    malo.semanas = 52;
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza un texto en blanco disfrazado de contenido', () => {
    const malo = clonar();
    malo.creativos[0].copyA = '   ';
    expect(growthSchema.safeParse(malo).success).toBe(false);
  });

  it('el fixture respeta el ratio que dicta cada formato', () => {
    for (const c of completo.creativos) {
      expect(c.ratio, `${c.formato} debería ser ${RATIO_POR_FORMATO[c.formato as keyof typeof RATIO_POR_FORMATO]}`)
        .toBe(RATIO_POR_FORMATO[c.formato as keyof typeof RATIO_POR_FORMATO]);
    }
  });

  it('los nueve creativos cubren cada combinación de grupo y formato', () => {
    const combos = completo.creativos.map((c: any) => `${c.grupo}-${c.formato}`);
    expect(new Set(combos).size).toBe(9);
  });
});

describe('segmentación de Meta', () => {
  it('el fixture de Yessica valida contra el esquema completo', async () => {
    const { segmentacionSchema } = await import('@/growth/schemas');
    const r = segmentacionSchema.safeParse((completo as any).segmentacion);
    if (!r.success) console.error(r.error.issues.slice(0, 5));
    expect(r.success).toBe(true);
  });

  it('exige dos perfiles: uno solo no permite contrastar la segmentación', async () => {
    const { segmentacionSchema } = await import('@/growth/schemas');
    const malo = clonar().segmentacion;
    malo.perfiles = malo.perfiles.slice(0, 1);
    expect(segmentacionSchema.safeParse(malo).success).toBe(false);
  });

  it('exige las tres capas de intereses', async () => {
    const { segmentacionSchema } = await import('@/growth/schemas');
    const malo = clonar().segmentacion;
    malo.capas = malo.capas.slice(0, 2);
    expect(segmentacionSchema.safeParse(malo).success).toBe(false);
  });

  it('rechaza una tabla de configuración raquítica: es la hoja de captura', async () => {
    const { segmentacionSchema } = await import('@/growth/schemas');
    const malo = clonar().segmentacion;
    malo.configuracion = malo.configuracion.slice(0, 3);
    expect(segmentacionSchema.safeParse(malo).success).toBe(false);
  });

  it('no deja apilar veinte intereses en una capa, que es el error que documenta', async () => {
    const { segmentacionSchema } = await import('@/growth/schemas');
    const malo = clonar().segmentacion;
    malo.capas[0].intereses = Array.from({ length: 20 }, (_, i) => `interes ${i}`);
    expect(segmentacionSchema.safeParse(malo).success).toBe(false);
  });
});
