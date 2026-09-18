import { describe, it, expect } from 'vitest';
import {
  huecosDe, acomodarArtes, destinoDeSubida, claseDe, TARJETAS_CARRUSEL, type ArteGrowth,
} from '@/growth/artes-reglas';

let n = 0;
const arte = (creativo: number, orden: number, extra: Partial<ArteGrowth> = {}): ArteGrowth => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  creativo, orden, tipo: 'archivo', mime: 'image/png', url: null, nombreOriginal: 'a.png', ...extra,
});

const creativos = [{ formato: 'imagen' }, { formato: 'video' }, { formato: 'carrusel' }];

describe('huecos por formato (la tabla ARCHIVOS)', () => {
  it('imagen: una pieza 1:1; carrusel: cinco tarjetas 4:5; video: video 9:16 y portada 4:5', () => {
    expect(huecosDe('imagen').map((h) => [h.clave, h.ratio, h.orden, h.cantidad])).toEqual([['pieza', '1x1', 0, 1]]);
    expect(huecosDe('carrusel').map((h) => [h.clave, h.ratio, h.orden, h.cantidad])).toEqual([['tarjeta', '4x5', null, TARJETAS_CARRUSEL]]);
    expect(huecosDe('video').map((h) => [h.clave, h.ratio, h.orden])).toEqual([['video', '9x16', 0], ['portada', '4x5', 1]]);
    expect(huecosDe('otro')).toEqual([]);
  });

  it('el video acepta archivo o enlace; lo demás solo imagen', () => {
    expect(huecosDe('video')[0].acepta).toEqual(['video', 'enlace']);
    expect(huecosDe('video')[1].acepta).toEqual(['imagen']);
    expect(huecosDe('imagen')[0].acepta).toEqual(['imagen']);
  });

  it('claseDe distingue imagen, video y enlace por lo guardado', () => {
    expect(claseDe({ tipo: 'archivo', mime: 'image/jpeg' })).toBe('imagen');
    expect(claseDe({ tipo: 'archivo', mime: 'video/mp4' })).toBe('video');
    expect(claseDe({ tipo: 'enlace', mime: null })).toBe('enlace');
    expect(claseDe({ tipo: 'archivo', mime: 'text/html' })).toBeNull();
  });
});

describe('acomodarArtes: qué se enseña', () => {
  it('cada arte va a su hueco, las tarjetas en orden', () => {
    const t2 = arte(2, 7); const t1 = arte(2, 3);
    const m = acomodarArtes(creativos, [arte(0, 0), t2, t1, arte(1, 1)]);
    expect(m.get(0)![0].artes).toHaveLength(1);
    expect(m.get(2)![0].artes.map((a) => a.orden)).toEqual([3, 7]);
    expect(m.get(1)![0].artes).toEqual([]);
    expect(m.get(1)![1].artes).toHaveLength(1);
  });

  it('los huérfanos no salen: anuncio que ya no existe, hueco que el formato no tiene, clase que no cabe', () => {
    const m = acomodarArtes(creativos, [
      arte(9, 0),                                   // el manual ya no tiene anuncio 9
      arte(0, 1),                                   // una imagen no tiene hueco 1
      arte(0, 0, { tipo: 'enlace', mime: null, url: 'https://x.mx' }), // una pieza no es enlace
      arte(1, 1, { mime: 'video/mp4' }),            // la portada no es video
    ]);
    expect([...m.keys()]).toEqual([0, 1, 2]);
    expect(m.get(0)![0].artes).toEqual([]);
    expect(m.get(1)![1].artes).toEqual([]);
  });

  it('un carrusel enseña a lo más cinco tarjetas', () => {
    const lista = Array.from({ length: 7 }, (_, k) => arte(2, k));
    expect(acomodarArtes(creativos, lista).get(2)![0].artes).toHaveLength(TARJETAS_CARRUSEL);
  });

  it('un manual sin creativos no truena', () => {
    expect(acomodarArtes([], [arte(0, 0)]).size).toBe(0);
  });
});

describe('destinoDeSubida', () => {
  const ocupados = (lista: ArteGrowth[], i: number) => acomodarArtes(creativos, lista).get(i)!;

  it('hueco fijo: exige orden y reemplaza en su sitio', () => {
    expect(destinoDeSubida('imagen', 0, 'imagen', ocupados([], 0))).toEqual({ ok: true, orden: 0 });
    expect(destinoDeSubida('imagen', null, 'imagen', ocupados([], 0)).ok).toBe(false);
    expect(destinoDeSubida('imagen', 1, 'imagen', ocupados([], 0)).ok).toBe(false);
  });

  it('el video recibe mp4 o enlace; su portada, solo imagen', () => {
    expect(destinoDeSubida('video', 0, 'video', ocupados([], 1)).ok).toBe(true);
    expect(destinoDeSubida('video', 0, 'enlace', ocupados([], 1)).ok).toBe(true);
    expect(destinoDeSubida('video', 0, 'imagen', ocupados([], 1)).ok).toBe(false);
    expect(destinoDeSubida('video', 1, 'video', ocupados([], 1)).ok).toBe(false);
    expect(destinoDeSubida('imagen', 0, 'enlace', ocupados([], 0)).ok).toBe(false);
  });

  it('carrusel: agrega al final hasta cinco y reemplaza solo tarjetas que existen', () => {
    const tres = [arte(2, 0), arte(2, 1), arte(2, 4)];
    expect(destinoDeSubida('carrusel', null, 'imagen', ocupados(tres, 2))).toEqual({ ok: true, orden: 5 });
    // Detrás de todo lo guardado, aunque no se enseñe.
    expect(destinoDeSubida('carrusel', null, 'imagen', ocupados(tres, 2), 9)).toEqual({ ok: true, orden: 10 });
    expect(destinoDeSubida('carrusel', 1, 'imagen', ocupados(tres, 2))).toEqual({ ok: true, orden: 1 });
    expect(destinoDeSubida('carrusel', 2, 'imagen', ocupados(tres, 2)).ok).toBe(false);
    expect(destinoDeSubida('carrusel', null, 'video', ocupados(tres, 2)).ok).toBe(false);
    const cinco = Array.from({ length: 5 }, (_, k) => arte(2, k));
    const lleno = destinoDeSubida('carrusel', null, 'imagen', ocupados(cinco, 2));
    expect(lleno.ok).toBe(false);
    if (!lleno.ok) expect(lleno.error).toContain('5 tarjetas');
  });
});
