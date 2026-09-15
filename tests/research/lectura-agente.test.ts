import { describe, it, expect } from 'vitest';
import { armarEntradaLectura, SISTEMA_LECTURA } from '@/research/agents/lectura';
import { JERGA_PROHIBIDA } from '@/research/jerga';
import completa from '../fixtures/investigacion-completa.json';

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
    for (const campo of ['portada', 'descubrimos', 'clienteIdeal', 'lePreocupa', 'quiereLograr', 'perfiles', 'comoHablarle', 'recomendamos', 'dondeAnunciarte', 'faltaConfirmar']) {
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
