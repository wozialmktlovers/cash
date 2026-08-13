import { describe, it, expect } from 'vitest';
import { extraerTexto, recortarTexto } from '@/lib/extract';

describe('extract', () => {
  it('lee texto plano', async () => {
    const r = await extraerTexto(Buffer.from('Hola mundo'), 'text/plain');
    expect(r.estado).toBe('ok');
    expect(r.texto).toBe('Hola mundo');
  });

  it('marca las imágenes como no aplica', async () => {
    const r = await extraerTexto(Buffer.from([0x89, 0x50]), 'image/png');
    expect(r.estado).toBe('no_aplica');
    expect(r.texto).toBeNull();
  });

  it('conserva inicio y final al recortar', () => {
    const largo = 'A'.repeat(50_000) + 'FINAL';
    const r = recortarTexto(largo, 40_000);
    expect(r.length).toBeLessThanOrEqual(40_100);
    expect(r).toContain('FINAL');
    expect(r).toContain('[recorte]');
  });

  it('no toca un texto corto', () => {
    expect(recortarTexto('corto', 40_000)).toBe('corto');
  });
});
