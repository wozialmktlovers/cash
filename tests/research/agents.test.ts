import { describe, it, expect } from 'vitest';
import { armarContexto } from '@/research/contexto';
import { SISTEMA_COMUN } from '@/research/agents/competencia';

describe('contexto', () => {
  it('incluye los datos del cliente y sus enlaces', () => {
    const ctx = armarContexto(
      { nombre: 'Ana', giro: 'Cosmetología', producto: 'Diplomado', ciudad: 'Guadalajara', ticket: '$36,792', notas: null, contacto: null },
      [{ tipo: 'sitio', url: 'https://x.com' }],
      [{ nombreOriginal: 'temario.pdf', textoExtraido: 'Contenido del temario' }]
    );
    expect(ctx).toContain('Ana');
    expect(ctx).toContain('https://x.com');
    expect(ctx).toContain('Contenido del temario');
  });

  it('avisa cuando no hay archivos ni enlaces', () => {
    const ctx = armarContexto(
      { nombre: 'X', giro: 'Y', producto: 'Z', ciudad: null, ticket: null, notas: null, contacto: null }, [], []
    );
    expect(ctx).toContain('Sin enlaces');
    expect(ctx).toContain('Sin archivos');
  });
});

describe('reglas del sistema', () => {
  it('prohíbe inventar datos y exige fuente', () => {
    expect(SISTEMA_COMUN).toContain('fuente');
    expect(SISTEMA_COMUN.toLowerCase()).toContain('no inventes');
  });
});
