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
    const r = reemplazosSchema.safeParse({ temas: [{ id: 'P1-S1-01', texto: 'Nuevo', funcion: 'venta', formato: 'reel' }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.temas).toHaveLength(1);
  });

  // Parseo tolerante (spec §3): un reemplazo inválido no debe tirar el lote
  // entero, porque los demás sí sirven para corregir sus duplicados.
  it('descarta solo el reemplazo con número de tema fuera de 01-20; conserva los demás del lote', () => {
    const conIdInvalido = (id: string) => ({
      temas: [
        { id, texto: 'Malo', funcion: 'venta', formato: 'reel' },
        { id: 'P1-S1-05', texto: 'Bueno', funcion: 'venta', formato: 'reel' },
      ],
    });
    const r0 = reemplazosSchema.safeParse(conIdInvalido('P1-S1-00'));
    expect(r0.success).toBe(true);
    if (r0.success) { expect(r0.data.temas).toHaveLength(1); expect(r0.data.temas[0].id).toBe('P1-S1-05'); }

    const r21 = reemplazosSchema.safeParse(conIdInvalido('P1-S1-21'));
    expect(r21.success).toBe(true);
    if (r21.success) expect(r21.data.temas).toHaveLength(1);
  });

  it('un tema con función o formato inválidos también se descarta solo, sin tumbar el lote', () => {
    const r = reemplazosSchema.safeParse({
      temas: [
        { id: 'P1-S1-01', texto: 'Malo', funcion: 'inventada', formato: 'reel' },
        { id: 'P1-S1-02', texto: 'Bueno', funcion: 'venta', formato: 'story' },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.temas).toHaveLength(1); expect(r.data.temas[0].id).toBe('P1-S1-02'); }
  });

  it('un lote sin ningún reemplazo válido no revienta: temas queda vacío', () => {
    const r = reemplazosSchema.safeParse({ temas: [{ id: 'no-valido', texto: 'x' }] });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.temas).toEqual([]);
  });

  it('sigue exigiendo que "temas" sea un arreglo, para que pedirJson reintente si el modelo no lo manda así', () => {
    expect(reemplazosSchema.safeParse({ temas: 'no es un arreglo' }).success).toBe(false);
    expect(reemplazosSchema.safeParse({}).success).toBe(false);
  });
});
