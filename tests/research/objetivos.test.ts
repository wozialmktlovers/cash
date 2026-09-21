import { describe, it, expect, vi } from 'vitest';

/**
 * «Objetivos y líneas de investigación»: el texto que el equipo escribe en la
 * ficha llega, como sección prioritaria, a TODOS los agentes que reciben
 * contexto del cliente. Sin base y sin modelo: solo se arman los textos.
 */
vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  return { ...real, db: {} };
});

import { armarContexto, seccionObjetivos } from '@/research/contexto';
import { armarContextoGrowth } from '@/growth/contexto';
import { armarEntradaEstrategia, armarEntradaPilar } from '@/pilares/agentes';
import { contextoDelMes } from '@/contenido/mes/pipeline';
import { armarEntradaTanda } from '@/contenido/mes/agente';
import { armarEntradaLectura } from '@/research/agents/lectura';
import completa from '../fixtures/investigacion-completa.json';
import { estrategiaFalsa, mapaFalso } from '../fixtures/pilares';

const OBJETIVOS = 'Quiere abrir sucursal en Monterrey.\nInvestigar la competencia en Querétaro.\nNo considerar a Pan Ejemplo como competidor.';
const TITULO = '## Objetivos y líneas de investigación (prioridad del cliente)';

const base = {
  nombre: 'Panadería de Ejemplo', giro: 'Panadería', producto: 'Pan de masa madre',
  ciudad: 'Guadalajara', ticket: '$120', contacto: null, notas: null,
};
const conObjetivos = { ...base, objetivos: OBJETIVOS };
const links = [{ tipo: 'sitio', url: 'https://ejemplo.test' }];
const archivos = [{ nombreOriginal: 'catalogo.pdf', textoExtraido: 'Texto del catálogo' }];

describe('armarContexto con objetivos', () => {
  it('lleva la sección destacada, con el texto tal cual, ANTES de enlaces y documentos', () => {
    const ctx = armarContexto(conObjetivos, links, archivos);
    const iObj = ctx.indexOf(TITULO);
    expect(iObj).toBeGreaterThan(ctx.indexOf('## Cliente'));
    expect(iObj).toBeLessThan(ctx.indexOf('## Enlaces'));
    expect(iObj).toBeLessThan(ctx.indexOf('## Documentos del cliente'));
    expect(ctx).toContain(OBJETIVOS);
  });

  it('dice que mandan sobre lo supuesto y pide declarar en pendientes lo que no se respondió', () => {
    const s = seccionObjetivos(OBJETIVOS);
    expect(s).toMatch(/mandan sobre tus suposiciones por defecto/i);
    expect(s).toMatch(/cubre cada punto/i);
    expect(s).toMatch(/pendientes/);
  });

  it('sin objetivos (null, ausente o solo espacios) no aparece la sección', () => {
    for (const objetivos of [null, undefined, '   \n ']) {
      const ctx = armarContexto({ ...base, objetivos }, links, archivos);
      expect(ctx).not.toContain('Objetivos y líneas de investigación');
      expect(ctx).toContain('## Enlaces');
    }
    expect(armarContexto(base, [], [])).not.toContain('Objetivos');
  });
});

describe('todos los agentes con contexto del cliente los reciben', () => {
  const ctx = armarContexto(conObjetivos, links, archivos);

  it('manual de campaña (growth), antes de la investigación previa', () => {
    const g = armarContextoGrowth(completa as any, conObjetivos);
    expect(g).toContain(TITULO);
    expect(g).toContain(OBJETIVOS);
    expect(g.indexOf(TITULO)).toBeLessThan(g.indexOf('## Investigación previa'));
    expect(armarContextoGrowth(completa as any, base)).not.toContain(TITULO);
  });

  it('mapa de pilares: estrategia y cada pilar', () => {
    expect(armarEntradaEstrategia(ctx, completa as any)).toContain(OBJETIVOS);
    expect(armarEntradaPilar(ctx, estrategiaFalsa(), 1)).toContain(OBJETIVOS);
  });

  it('lectura de la investigación', () => {
    expect(armarEntradaLectura(ctx, {} as any)).toContain(OBJETIVOS);
  });

  it('contenido del mes: el contexto de la tanda y lo que llega al redactor', () => {
    const mes = contextoDelMes(conObjetivos, links, archivos, mapaFalso(), completa);
    expect(mes).toContain(TITULO);
    expect(mes.indexOf(TITULO)).toBeLessThan(mes.indexOf('## Estrategia editorial'));
    const entrada = armarEntradaTanda({
      contexto: mes, nombreMes: 'octubre', ranuras: [], candidatos: new Map(), nombresPilares: [], yaEscritas: [],
    } as any);
    expect(entrada).toContain(OBJETIVOS);
  });
});
