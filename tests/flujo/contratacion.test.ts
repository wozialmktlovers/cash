import { describe, it, expect } from 'vitest';
import { planContratacion } from '@/flujo/servicio';
import { ETAPAS } from '@/flujo/reglas';

describe('planContratacion', () => {
  it('devuelve las 4 etapas siempre, en el orden de ETAPAS', () => {
    const p = planContratacion(['investigacion']);
    expect(p.map((e) => e.etapa)).toEqual([...ETAPAS]);
  });

  it('marca contratadas las etapas seleccionadas y no interna a ninguna cuando investigación va incluida', () => {
    const p = planContratacion(['investigacion', 'pilares', 'manual_campana']);
    expect(p).toEqual([
      { etapa: 'investigacion', contratada: true, interna: false },
      { etapa: 'pilares', contratada: true, interna: false },
      { etapa: 'desarrollo_mensual', contratada: false, interna: false },
      { etapa: 'manual_campana', contratada: true, interna: false },
    ]);
  });

  it('si se contrata pilares sin investigación, la investigación queda interna y no contratada', () => {
    const p = planContratacion(['pilares']);
    const investigacion = p.find((e) => e.etapa === 'investigacion')!;
    expect(investigacion).toEqual({ etapa: 'investigacion', contratada: false, interna: true });
  });

  it('si se contrata manual_campana sin investigación, la investigación también queda interna', () => {
    const p = planContratacion(['manual_campana']);
    const investigacion = p.find((e) => e.etapa === 'investigacion')!;
    expect(investigacion).toEqual({ etapa: 'investigacion', contratada: false, interna: true });
  });

  it('desarrollo_mensual se puede seleccionar: queda contratada como cualquier otra (sigue "Próximamente" en las reglas)', () => {
    const p = planContratacion(['investigacion', 'desarrollo_mensual']);
    const desarrollo = p.find((e) => e.etapa === 'desarrollo_mensual')!;
    expect(desarrollo).toEqual({ etapa: 'desarrollo_mensual', contratada: true, interna: false });
  });

  it('sin investigación ni pilares ni manual_campana, la investigación no contratada no es interna (nadie la necesita)', () => {
    const p = planContratacion(['desarrollo_mensual']);
    const investigacion = p.find((e) => e.etapa === 'investigacion')!;
    expect(investigacion).toEqual({ etapa: 'investigacion', contratada: false, interna: false });
  });

  it('selección vacía: ninguna contratada, investigación no queda interna (nadie la necesita)', () => {
    const p = planContratacion([]);
    expect(p.every((e) => !e.contratada)).toBe(true);
    expect(p.find((e) => e.etapa === 'investigacion')).toEqual({ etapa: 'investigacion', contratada: false, interna: false });
  });
});
