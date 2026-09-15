import { describe, it, expect } from 'vitest';
import { estrategiaSchema, pilarSchemaPara, reemplazosSchema } from '@/pilares/schemas';
import { estrategiaFalsa, pilarFalso } from '../fixtures/pilares';

const e = () => JSON.parse(JSON.stringify(estrategiaFalsa()));

describe('estrategiaSchema', () => {
  it('acepta la estrategia de prueba', () => {
    const r = estrategiaSchema.safeParse(estrategiaFalsa());
    if (!r.success) console.error(r.error.issues);
    expect(r.success).toBe(true);
  });
  it('exige 3 ideas, 12 principios, 5 pilares y 3 subcategorías por pilar', () => {
    const a = e(); a.ideas.pop(); expect(estrategiaSchema.safeParse(a).success).toBe(false);
    const b = e(); b.principios.pop(); expect(estrategiaSchema.safeParse(b).success).toBe(false);
    const c = e(); c.pilares.pop(); expect(estrategiaSchema.safeParse(c).success).toBe(false);
    const d = e(); d.pilares[0].subcategorias.pop(); expect(estrategiaSchema.safeParse(d).success).toBe(false);
  });
  it('el mix suma 100 y tiene una entrada por función', () => {
    const a = e(); a.mix[0].porcentaje = 31;
    const ra = estrategiaSchema.safeParse(a);
    expect(ra.success).toBe(false);
    expect(JSON.stringify(ra.error?.issues)).toContain('100');
    const b = e(); b.mix[1].funcion = 'autoridad'; b.mix[0].porcentaje = 30;
    expect(estrategiaSchema.safeParse(b).success).toBe(false);
  });
  it('conversión con exactamente 3 pasos', () => {
    const a = e(); a.conversion.pasos.pop();
    expect(estrategiaSchema.safeParse(a).success).toBe(false);
  });
});

describe('pilarSchemaPara', () => {
  const est = estrategiaFalsa();
  const nombres = est.pilares[1].subcategorias.map((s) => s.nombre);
  const p = () => JSON.parse(JSON.stringify(pilarFalso(2, est)));

  it('acepta un pilar válido', () => {
    expect(pilarSchemaPara(nombres).safeParse(pilarFalso(2, est)).success).toBe(true);
  });
  it('exige 20 temas por subcategoría con función y formato válidos', () => {
    const a = p(); a.subcategorias[0].temas.pop(); expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
    const b = p(); b.subcategorias[0].temas[0].formato = 'post'; expect(pilarSchemaPara(nombres).safeParse(b).success).toBe(false);
  });
  it('los nombres de subcategoría coinciden con la estrategia, sin importar mayúsculas ni acentos', () => {
    const a = p(); a.subcategorias[0].nombre = 'Otra';
    expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
    const b = p(); b.subcategorias[0].nombre = nombres[0].toUpperCase();
    expect(pilarSchemaPara(nombres).safeParse(b).success).toBe(true);
  });
  it('rechaza temas con el mismo texto normalizado dentro del pilar', () => {
    const a = p(); a.subcategorias[2].temas[5].texto = a.subcategorias[0].temas[0].texto.toUpperCase() + '!';
    expect(pilarSchemaPara(nombres).safeParse(a).success).toBe(false);
  });
});

describe('reemplazosSchema', () => {
  it('acepta temas con id', () => {
    expect(reemplazosSchema.safeParse({ temas: [{ id: 'P1-S1-01', texto: 'Nuevo', funcion: 'venta', formato: 'reel' }] }).success).toBe(true);
  });
});
