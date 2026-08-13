import { describe, it, expect } from 'vitest';
import { normalizar, construirUrls } from '@/growth/utm';
import completo from '../fixtures/growth-completo.json';

describe('normalizar', () => {
  it('baja a minúsculas: Meta y meta serían dos fuentes distintas en el reporte', () => {
    expect(normalizar('Meta')).toBe('meta');
  });
  it('quita acentos', () => expect(normalizar('Cosmiatría')).toBe('cosmiatria'));
  it('convierte la eñe', () => expect(normalizar('Diseño')).toBe('diseno'));
  it('cambia espacios por guion bajo', () => expect(normalizar('San Luis Potosí')).toBe('san_luis_potosi'));
  it('colapsa separadores repetidos', () => expect(normalizar('a  -  b')).toBe('a_b'));
  it('quita signos', () => expect(normalizar('¡Oferta! 50%')).toBe('oferta_50'));
  it('recorta los bordes', () => expect(normalizar('  hola  ')).toBe('hola'));
  it('con una cadena de puro signo devuelve vacío, no un guion suelto', () => {
    expect(normalizar('¿?¡!')).toBe('');
  });
});

describe('construirUrls', () => {
  const opts = {
    growth: completo as any,
    destino: 'https://ejemplo.mx/registro',
    cliente: 'Yessica Villa',
    ciudad: 'San Luis Potosí',
    creadoEn: new Date('2026-08-13T00:00:00Z'),
  };
  const param = (url: string, k: string) => new URL(url).searchParams.get(k);

  it('produce exactamente 14: 9 de Meta y 5 de Google', () => {
    const urls = construirUrls(opts);
    expect(urls).toHaveLength(14);
    expect(urls.filter((u) => u.plataforma === 'meta')).toHaveLength(9);
    expect(urls.filter((u) => u.plataforma === 'google')).toHaveLength(5);
  });

  it('usa el periodo del resultado, no la fecha de hoy', () => {
    expect(param(construirUrls(opts)[0].url, 'utm_campaign')).toBe('yessica_villa_202608');
  });

  it('un resultado de otro mes conserva su periodo', () => {
    const otro = construirUrls({ ...opts, creadoEn: new Date('2026-01-05T00:00:00Z') });
    expect(param(otro[0].url, 'utm_campaign')).toBe('yessica_villa_202601');
  });

  it('etiqueta los creativos de Meta por grupo y formato', () => {
    const contents = construirUrls(opts)
      .filter((u) => u.plataforma === 'meta')
      .map((u) => param(u.url, 'utm_content'));
    expect(contents).toContain('ga_imagen');
    expect(contents).toContain('gc_carrusel');
    expect(new Set(contents).size).toBe(9);
  });

  it('mete la ciudad normalizada en la campaña geo de Google', () => {
    const geo = construirUrls(opts).find((u) => param(u.url, 'utm_content')?.startsWith('g4_geo'));
    expect(param(geo!.url, 'utm_content')).toBe('g4_geo_san_luis_potosi');
  });

  it('omite la ciudad cuando el cliente no la tiene, sin dejar el guion colgando', () => {
    const geo = construirUrls({ ...opts, ciudad: undefined })
      .find((u) => param(u.url, 'utm_content')?.startsWith('g4_geo'));
    expect(param(geo!.url, 'utm_content')).toBe('g4_geo');
  });

  it('Meta lleva paid_social y Google cpc', () => {
    const urls = construirUrls(opts);
    expect(param(urls.find((u) => u.plataforma === 'meta')!.url, 'utm_medium')).toBe('paid_social');
    expect(param(urls.find((u) => u.plataforma === 'google')!.url, 'utm_medium')).toBe('cpc');
  });

  it('deja la inserción dinámica de keyword sin codificar', () => {
    const url = construirUrls(opts).find((u) => u.plataforma === 'google')!.url;
    expect(url).toContain('utm_term={keyword}');
    expect(url).not.toContain('%7Bkeyword%7D');
  });

  it('el término de Meta va normalizado, no con el ángulo crudo', () => {
    const url = construirUrls(opts).find((u) => u.plataforma === 'meta')!.url;
    expect(param(url, 'utm_term')).toBe('salario_invisible');
  });

  it('conserva la query que ya trae la URL de destino', () => {
    const urls = construirUrls({ ...opts, destino: 'https://ejemplo.mx/r?plan=12' });
    expect(param(urls[0].url, 'plan')).toBe('12');
  });

  it('las 14 URLs son distintas entre sí: si se repitieran, el reporte no aislaría nada', () => {
    const urls = construirUrls(opts).map((u) => u.url);
    expect(new Set(urls).size).toBe(14);
  });

  it('ningún parámetro lleva acentos, eñes ni mayúsculas', () => {
    for (const { url } of construirUrls(opts)) {
      const qs = new URL(url).search;
      const utm = qs.match(/utm_[a-z]+=[^&]*/g) ?? [];
      for (const p of utm) {
        if (p.includes('{keyword}')) continue;
        expect(p, `parámetro sucio: ${p}`).toMatch(/^utm_[a-z]+=[a-z0-9_]*$/);
      }
    }
  });
});
