import { describe, it, expect } from 'vitest';
import { revisarAntesDeInvestigar } from '@/lib/precheck';

describe('revisión previa', () => {
  it('avisa cuando no hay enlaces ni archivos', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 0, archivosConTexto: 0, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('enlaces');
    expect(r.listo).toBe(true);
  });

  it('avisa cuando falta el ticket', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 2, archivosConTexto: 1, ticket: null, ciudad: 'GDL' });
    expect(r.advertencias.join(' ')).toContain('ticket');
  });

  it('sin advertencias cuando está todo', () => {
    const r = revisarAntesDeInvestigar({ enlaces: 3, archivosConTexto: 2, ticket: '$30,000', ciudad: 'GDL' });
    expect(r.advertencias).toHaveLength(0);
  });
});
