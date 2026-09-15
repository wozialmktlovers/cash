import { describe, it, expect } from 'vitest';
import { armarEntradaLectura, SISTEMA_LECTURA, lecturaSchemaPara } from '@/research/agents/lectura';
import { JERGA_PROHIBIDA } from '@/research/jerga';
import completa from '../fixtures/investigacion-completa.json';
import lectura from '../fixtures/lectura-ejemplo.json';
import { INVESTIGACION_EJEMPLO } from '../../scripts/datos-ejemplo.mjs';

const c = completa as any;

describe('entrada del redactor', () => {
  it('incluye el contexto y las etapas con datos', () => {
    const e = armarEntradaLectura('## Cliente\nAna', { competencia: c.competencia.datos, sintesis: c.sintesis.datos });
    expect(e).toContain('## Cliente');
    expect(e).toContain('### Competencia');
    expect(e).toContain('### Síntesis estratégica');
    expect(e).toContain(JSON.stringify(c.competencia.datos, null, 2));
  });

  it('declara las etapas sin datos para que no las rellene', () => {
    const e = armarEntradaLectura('ctx', { competencia: c.competencia.datos });
    expect(e).toContain('## Temas sin datos');
    for (const nombre of ['Audiencia', 'Canales', 'Mercado', 'Síntesis estratégica']) expect(e).toContain(`- ${nombre}`);
    expect(e).toContain('faltaConfirmar');
  });

  it('sin huecos no agrega la sección de temas sin datos', () => {
    const e = armarEntradaLectura('ctx', {
      competencia: c.competencia.datos, audiencia: c.audiencia.datos, canales: c.canales.datos,
      mercado: c.mercado.datos, sintesis: c.sintesis.datos,
    });
    expect(e).not.toContain('## Temas sin datos');
  });

  it('describe la forma exacta del JSON', () => {
    const e = armarEntradaLectura('ctx', {});
    for (const campo of ['portada', 'cifras', 'tono', 'descubrimos', 'resumen', 'detalle', 'clienteIdeal', 'lePreocupa', 'quiereLograr', 'perfiles', 'frase', 'comoHablarle', 'recomendamos', 'dondeAnunciarte', 'faltaConfirmar']) {
      expect(e).toContain(campo);
    }
  });
});

describe('sistema del redactor', () => {
  it('fija las reglas clave', () => {
    expect(SISTEMA_LECTURA).toContain('tú');
    expect(SISTEMA_LECTURA.toLowerCase()).toContain('no inventes');
    expect(SISTEMA_LECTURA).toContain('JSON');
  });
  it('lista toda la jerga prohibida', () => {
    for (const t of JERGA_PROHIBIDA) expect(SISTEMA_LECTURA).toContain(t);
  });
});

describe('esquema con cifras verificadas', () => {
  const ej = INVESTIGACION_EJEMPLO as any;
  const previos = { competencia: ej.competencia.datos, mercado: ej.mercado.datos, sintesis: ej.sintesis.datos };

  it('acepta cifras que están en la investigación', () => {
    expect(lecturaSchemaPara(previos).safeParse(lectura).success).toBe(true);
  });

  it('rechaza una cifra inventada y la nombra', () => {
    const l = JSON.parse(JSON.stringify(lectura));
    l.cifras[0].valor = '$99,991';
    const r = lecturaSchemaPara(previos).safeParse(l);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain('$99,991');
  });
});
