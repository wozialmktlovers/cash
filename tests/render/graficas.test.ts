import { describe, it, expect } from 'vitest';
import { parsearMontos, formatearMonto } from '@/render/investigacion/montos';
import { filasGrafica, graficaBarras, graficaRangos } from '@/render/investigacion/graficas';

describe('parsearMontos', () => {
  it('lee dinero con separador de miles y moneda', () => {
    expect(parsearMontos('$28,500 MXN')).toEqual([28500]);
  });
  it('lee rangos', () => {
    expect(parsearMontos('de $10,000 a $18,000 al mes')).toEqual([10000, 18000]);
  });
  it('con signo de pesos ignora los números que no son dinero', () => {
    expect(parsearMontos('12 mensualidades de $3,066')).toEqual([3066]);
  });
  it('lee K y M sin confundir MXN', () => {
    expect(parsearMontos('16.4K seguidores')).toEqual([16400]);
    expect(parsearMontos('$1.2M')).toEqual([1200000]);
  });
  it('sin número devuelve vacío', () => {
    expect(parsearMontos('Gratis')).toEqual([]);
  });
  it('formatea en pesos mexicanos', () => {
    expect(formatearMonto(36792)).toBe('$36,792');
  });
});

describe('gráficas', () => {
  const items = [
    { n: 'IMNAS', p: '$3,450' },
    { n: 'Tu diplomado (el cliente)', p: '$36,792' },
    { n: 'Sin precio', p: 'Consultar' },
  ];
  const filas = filasGrafica(items, (i) => i.n, (i) => i.p, (i) => i.n.includes('(el cliente)'));

  it('solo toma filas con monto legible', () => {
    expect(filas.map((f) => f.nombre)).toEqual(['IMNAS', 'Tu diplomado (el cliente)']);
    expect(filas[1]).toEqual({ nombre: 'Tu diplomado (el cliente)', min: 36792, max: 36792, destacada: true });
  });

  it('barras proporcionales al máximo, con la destacada marcada y el texto escapado', () => {
    const html = graficaBarras([...filas, { nombre: '<b>', min: 18396, max: 18396, destacada: false }], 'Precio');
    expect((html.match(/class="barra-fila/g) ?? []).length).toBe(3);
    expect(html).toContain('width:100%');
    expect(html).toContain('width:50%');
    expect(html).toContain('barra-fila destacada');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('$36,792');
  });

  it('no dibuja con menos de dos filas', () => {
    expect(graficaBarras(filas.slice(0, 1), 'x')).toBe('');
    expect(graficaRangos([], 'x')).toBe('');
  });

  it('con un tope en cero no truena ni da porcentajes negativos', () => {
    const filasCero = [
      { nombre: 'A', min: 0, max: 0, destacada: false },
      { nombre: 'B', min: 0, max: 0, destacada: false },
    ];
    expect(() => graficaBarras(filasCero, 'x')).not.toThrow();
    expect(graficaBarras(filasCero, 'x')).toContain('width:0%');
    expect(graficaBarras(filasCero, 'x')).not.toContain('width:-');
    expect(() => graficaRangos(filasCero, 'x')).not.toThrow();
  });

  it('rangos dibujan de mínimo a máximo y un valor único como punto', () => {
    const html = graficaRangos([
      { nombre: 'Promedio', min: 6480, max: 6480, destacada: false },
      { nombre: 'Formal', min: 10000, max: 18000, destacada: false },
    ], 'Ingreso');
    expect(html).toContain('rango-punto');
    expect(html).toContain('left:56%;width:44%');
    expect(html).toContain('$10,000 – $18,000');
  });
});
