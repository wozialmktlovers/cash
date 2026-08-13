import { describe, it, expect } from 'vitest';
import { investigacionSchema } from '@/research/schemas';
import { renderizarPresentacion } from '@/render/presentation';
import { CLIENTE_EJEMPLO, INVESTIGACION_EJEMPLO } from '../../scripts/datos-ejemplo.mjs';

describe('investigación de ejemplo (Yessica Villa)', () => {
  it('valida contra el esquema del pipeline', () => {
    const r = investigacionSchema.safeParse(INVESTIGACION_EJEMPLO);
    if (!r.success) console.error(r.error.issues.slice(0, 10));
    expect(r.success).toBe(true);
  });

  it('las cinco etapas traen datos, ninguna vacía', () => {
    for (const etapa of ['competencia', 'audiencia', 'canales', 'mercado', 'sintesis'] as const) {
      expect((INVESTIGACION_EJEMPLO as any)[etapa].estado).toBe('ok');
    }
  });

  it('renderiza los 17 paneles', () => {
    const html = renderizarPresentacion(INVESTIGACION_EJEMPLO as any, {
      cliente: CLIENTE_EJEMPLO.nombre,
      giro: CLIENTE_EJEMPLO.giro,
      fecha: '2026-08-12',
    });
    expect((html.match(/class="panel"/g) ?? []).length).toBe(17);
  });

  it('conserva las cifras que sostienen el argumento', () => {
    const html = renderizarPresentacion(INVESTIGACION_EJEMPLO as any, {
      cliente: CLIENTE_EJEMPLO.nombre,
      giro: CLIENTE_EJEMPLO.giro,
      fecha: '2026-08-12',
    });
    // El hallazgo central: el aval equivalente cuesta una décima parte.
    expect(html).toContain('$3,450');
    expect(html).toContain('$36,792');
    // La prueba que sí sostiene el ticket.
    expect(html).toContain('$6,480');
    expect(html).toContain('Universidad de Barcelona');
  });

  it('toda cifra de mercado y salario lleva fuente con URL', () => {
    const m = (INVESTIGACION_EJEMPLO as any).mercado.datos;
    for (const grupo of [m.datos, m.salarios, m.regulacion]) {
      for (const item of grupo) {
        expect(item.fuente?.url).toMatch(/^https?:\/\//);
        expect(item.fuente?.consultado).toBeTruthy();
      }
    }
  });
});
