import { describe, it, expect } from 'vitest';
import { fechaDelMes, formatoDe, plataformaDe, prepararTanda, ratioDe } from '@/contenido/mes/normalizar';
import { hashtagsEnLinea, tandaMesSchema } from '@/contenido/mes/schemas';

/**
 * El normalizador y el esquema tolerante del agente del mes: las variantes que
 * se convierten en vez de tirar la tanda (lecciones de 710ab1d, 99a13cb,
 * 6e88ba5 y 87ea948).
 */

describe('el normalizador acepta variantes', () => {
  it('formato escrito como lo diría una persona → enum interno', () => {
    expect(formatoDe('Reel')).toBe('reel');
    expect(formatoDe('Carrusel 4:5')).toBe('carrusel');
    expect(formatoDe('Imagen estática')).toBe('post');
    expect(formatoDe('Story')).toBe('historia');
    expect(formatoDe('Historias de Instagram')).toBe('historia');
    expect(formatoDe('algo raro')).toBeNull();
  });

  it('plataforma en cualquier forma; sin saber, las dos', () => {
    expect(plataformaDe('Facebook e Instagram')).toBe('ambas');
    expect(plataformaDe('FB/IG')).toBe('ambas');
    expect(plataformaDe(['facebook', 'instagram'])).toBe('ambas');
    expect(plataformaDe('IG')).toBe('instagram');
    expect(plataformaDe('Facebook')).toBe('facebook');
    expect(plataformaDe(undefined)).toBe('ambas');
  });

  it('«4:5» y sus primos → 4x5', () => {
    expect(ratioDe('4:5')).toBe('4x5');
    expect(ratioDe('vertical 9 : 16')).toBe('9x16');
    expect(ratioDe('4/5')).toBe('4x5');
    expect(ratioDe('cuadrado')).toBeNull();
  });

  it('fechas en varios formatos → ISO, solo dentro del mes', () => {
    const p = '2026-09';
    expect(fechaDelMes('2026-09-18', p)).toBe('2026-09-18');
    expect(fechaDelMes('2026-09-18T10:00:00Z', p)).toBe('2026-09-18');
    expect(fechaDelMes('18/09/2026', p)).toBe('2026-09-18');
    expect(fechaDelMes('18-09-26', p)).toBe('2026-09-18');
    expect(fechaDelMes('18/09', p)).toBe('2026-09-18');
    expect(fechaDelMes('18 de septiembre de 2026', p)).toBe('2026-09-18');
    expect(fechaDelMes('Viernes 18 de Septiembre', p)).toBe('2026-09-18');
    expect(fechaDelMes('jueves 17', p)).toBe('2026-09-17');
    expect(fechaDelMes(18, p)).toBe('2026-09-18');
    // Otro mes, día imposible o basura: nada.
    expect(fechaDelMes('2026-10-01', p)).toBeNull();
    expect(fechaDelMes('31/09/2026', p)).toBeNull();
    expect(fechaDelMes('la semana que entra', p)).toBeNull();
  });

  it('llaves con acento, respuesta envuelta y pieza sin ref', () => {
    const preparar = prepararTanda([7, 8], '2026-09');
    const crudo = {
      respuesta: {
        publicaciones: [
          { 'Guión': [{ 'lo que se ve': 'Manos', 'lo que se dice': 'Hola' }, 'Cierre'], 'Llamado a la acción': 'Escríbenos', copy: 'Uno', 'Tema': 'p1-s1-01 · un tema', formato: 'Reel', fecha: '18/09/2026', ratio: '9:16', plataforma: 'IG' },
          { numero: '8', 'prompt de imagen': 'Foto', 'láminas': [{ titulo: 'A', texto: 'B' }, 'C'], copy: 'Dos', hashtags: '#uno dos, #tres' },
        ],
      },
    };
    const v = preparar(crudo) as { piezas: Record<string, unknown>[] };
    expect(v.piezas[0]).toMatchObject({
      ref: 7, temaId: 'P1-S1-01', formato: 'reel', fecha: '2026-09-18', ratio: '9x16', plataforma: 'instagram', cta: 'Escríbenos',
      guion: [{ visual: 'Manos', texto: 'Hola' }, { visual: 'Cierre', texto: '' }],
    });
    expect(v.piezas[1]).toMatchObject({ ref: 8, promptImagen: 'Foto', tarjetas: ['A: B', 'C'] });

    const t = tandaMesSchema.parse(v);
    expect(t.piezas).toHaveLength(2);
    expect(t.piezas[1].hashtags).toBe('#uno #dos #tres');
  });

  it('una lista suelta también es una tanda', () => {
    const v = prepararTanda([1], '2026-09')([{ copy: 'x' }]);
    expect(tandaMesSchema.parse(v).piezas[0].ref).toBe(1);
  });
});

describe('esquema tolerante: recorta en vez de rechazar', () => {
  it('textos largos se recortan a su límite; hashtags inválidos se descartan', () => {
    const t = tandaMesSchema.parse({ piezas: [{
      ref: 1, copy: 'x'.repeat(3000), cta: 'y'.repeat(200), briefVisual: 'z'.repeat(900), promptImagen: 'p'.repeat(1500),
      hashtags: ['#bueno', '#dos palabras', 'sin_almohadilla', '#', '#Bueno'],
      tarjetas: Array.from({ length: 14 }, (_, i) => `T${i}`),
    }] });
    const p = t.piezas[0];
    expect(p.copy.length).toBeLessThanOrEqual(2200);
    expect(p.cta.length).toBeLessThanOrEqual(120);
    expect(p.briefVisual.length).toBeLessThanOrEqual(400);
    expect(p.promptImagen.length).toBeLessThanOrEqual(1000);
    expect(p.tarjetas).toHaveLength(10);
    expect(p.hashtags).toBe('#bueno #dos #palabras #sin_almohadilla');
  });

  it('una pieza sin copy se cae y las demás se quedan', () => {
    const t = tandaMesSchema.parse({ piezas: [{ ref: 1, copy: '' }, { ref: 2, copy: 'Bien' }, { ref: 2, copy: 'Repetida' }] });
    expect(t.piezas.map((p) => p.ref)).toEqual([2]);
    expect(t.piezas[0].copy).toBe('Bien');
  });

  it('una tanda sin ninguna pieza útil sí se rechaza, para que se corrija', () => {
    expect(tandaMesSchema.safeParse({ piezas: [{ ref: 1 }] }).success).toBe(false);
  });

  it('hashtagsEnLinea deja diez como máximo', () => {
    expect(hashtagsEnLinea(Array.from({ length: 15 }, (_, i) => `#tag${i}`)).split(' ')).toHaveLength(10);
  });
});
