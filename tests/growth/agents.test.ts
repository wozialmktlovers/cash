import { describe, it, expect, vi, beforeEach } from 'vitest';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';
import completo from '../fixtures/growth-completo.json';

const pedir = vi.fn();
vi.mock('@/research/claude', () => ({ pedirJson: (o: any) => pedir(o) }));

const cliente = {
  nombre: 'Yessica Villa', giro: 'Cosmiatría', producto: 'Diplomado',
  ciudad: 'Guadalajara', ticket: '$36,000', notas: null,
};

beforeEach(() => pedir.mockReset());

describe('armarContextoGrowth', () => {
  it('lleva la investigación, no solo la ficha del cliente', async () => {
    const { armarContextoGrowth } = await import('@/growth/contexto');
    const ctx = armarContextoGrowth(completa as any, cliente);
    expect(ctx).toContain('Yessica Villa');
    expect(ctx).toContain('### Competencia');
    expect(ctx).toContain('### Audiencia');
    expect(ctx).toContain('### Síntesis estratégica');
  });

  it('declara las etapas vacías con su razón en vez de callarlas', async () => {
    const { armarContextoGrowth } = await import('@/growth/contexto');
    const ctx = armarContextoGrowth(parcial as any, cliente);
    expect(ctx).toContain('Etapas sin datos');
    expect(ctx).toMatch(/No inventes su contenido/i);
  });

  it('cuando no hay ninguna etapa con datos lo dice, no devuelve un hueco mudo', async () => {
    const { armarContextoGrowth } = await import('@/growth/contexto');
    const vacia = Object.fromEntries(
      ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis']
        .map((k) => [k, { estado: 'vacio', razon: 'La etapa no se ejecutó.' }]),
    );
    const ctx = armarContextoGrowth(vacia as any, cliente);
    expect(ctx).toContain('no produjo ninguna etapa con datos');
  });
});

describe('agentes de campaña', () => {
  it('ninguno sale a buscar a la web: razonan sobre lo ya investigado', async () => {
    const mods = await Promise.all([
      import('@/growth/agents/estructura'),
      import('@/growth/agents/creativos'),
      import('@/growth/agents/google'),
      import('@/growth/agents/prompts'),
    ]);
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await mods[0].correrEstructura('ctx');
    await mods[1].correrCreativos('ctx', null);
    await mods[2].correrGoogle('ctx', null);
    await mods[3].correrPrompts('ctx', null);
    expect(pedir).toHaveBeenCalledTimes(4);
    for (const [opts] of pedir.mock.calls) expect(opts.buscarWeb).toBe(false);
  });

  it('creativos recibe los ángulos que decidió estructura', async () => {
    const { correrCreativos } = await import('@/growth/agents/creativos');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await correrCreativos('ctx', completo as any);
    expect(pedir.mock.calls[0][0].usuario).toContain('salario invisible');
    expect(pedir.mock.calls[0][0].usuario).toContain('imagen=1x1');
  });

  it('creativos se apaña si estructura falló, sin inventarse que sí llegó', async () => {
    const { correrCreativos } = await import('@/growth/agents/creativos');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await correrCreativos('ctx', null);
    expect(pedir.mock.calls[0][0].usuario).toMatch(/no produjo datos/i);
  });

  it('prompts recibe los nueve creativos en orden', async () => {
    const { correrPrompts } = await import('@/growth/agents/prompts');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await correrPrompts('ctx', completo as any);
    const u = pedir.mock.calls[0][0].usuario;
    expect(u).toContain('1. Grupo a');
    expect(u).toContain('9. Grupo c');
  });

  it('el sistema de prompts prohíbe generar rostros', async () => {
    const { correrPrompts } = await import('@/growth/agents/prompts');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await correrPrompts('ctx', null);
    expect(pedir.mock.calls[0][0].sistema).toMatch(/rostros identificables/i);
  });

  it('el sistema de Google escribe los límites reales de caracteres', async () => {
    const { correrGoogle } = await import('@/growth/agents/google');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    await correrGoogle('ctx', null);
    const s = pedir.mock.calls[0][0].sistema;
    expect(s).toContain('30 caracteres');
    expect(s).toContain('90 caracteres');
  });

  it('todos propagan onUso para que el tope pueda frenarlos', async () => {
    const { correrEstructura } = await import('@/growth/agents/estructura');
    pedir.mockResolvedValue({ datos: {}, tokensEntrada: 1, tokensSalida: 1 });
    const guardia = () => true;
    await correrEstructura('ctx', guardia);
    expect(pedir.mock.calls[0][0].onUso).toBe(guardia);
  });
});
