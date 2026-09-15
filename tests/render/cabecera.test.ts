import { describe, it, expect } from 'vitest';
import { cabeceraDocumento, SCRIPT_CABECERA } from '@/render/investigacion/cabecera';
import type { OpcionesBarra } from '@/render/barra-operador';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };

const operador: OpcionesBarra = {
  clienteId: 'c1', clienteNombre: 'Ana Villa', clienteSlug: 'ana-villa', documentoId: 'd1',
  version: 1, tipo: 'research', tokenActivo: 'tok123', base: 'https://x.test',
};

describe('cabecera del documento', () => {
  it('vista pública: cápsula con logo, cliente, switch y progreso, sin Compartir', () => {
    const h = cabeceraDocumento(meta);
    expect(h).toContain('class="cabecera"');
    expect(h).toContain('class="logo"');
    expect(h).toContain('Ana Villa');
    expect(h).toContain('role="radiogroup"');
    expect(h).toContain('role="progressbar"');
    expect(h).not.toContain('Compartir');
    expect(h).not.toContain('/api/share');
  });

  it('vista interna con token: botón Compartir, panel con link, copiar, revocar y accesos', () => {
    const h = cabeceraDocumento(meta, operador);
    expect(h).toContain('Compartir');
    expect(h).toContain('Vista interna · v1');
    expect(h).toContain('https://x.test/p/ana-villa/tok123');
    expect(h).toContain('Copiar');
    expect(h).toContain('Revocar');
    expect(h).toContain('/clientes/c1');
    expect(h).toContain('/clientes/c1/investigar');
  });

  it('vista interna sin token: botón crear link y revocar oculto', () => {
    const h = cabeceraDocumento(meta, { ...operador, tokenActivo: null });
    expect(h).toContain('Crear link público');
    expect(h).toMatch(/id="panel-revocar"[^>]*hidden/);
  });

  it('escapa el nombre del cliente', () => {
    const h = cabeceraDocumento({ ...meta, cliente: '<script>alert(1)</script>' }, operador);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('el script de la cabecera es JavaScript válido y trae lo esencial', () => {
    expect(() => new Function(SCRIPT_CABECERA)).not.toThrow();
    for (const s of ['Escape', 'requestAnimationFrame', '/api/share', 'aria-expanded']) {
      expect(SCRIPT_CABECERA).toContain(s);
    }
  });

  it('el panel de compartir se alinea con el borde derecho de la cápsula, no con el del viewport', () => {
    expect(SCRIPT_CABECERA).toContain('window.innerWidth - r.right');
    expect(SCRIPT_CABECERA).toContain("panel.style.right = Math.max(16, margenDerecho) + 'px'");
  });
});
