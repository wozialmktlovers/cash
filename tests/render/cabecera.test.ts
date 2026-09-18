import { describe, it, expect } from 'vitest';
import { cabeceraDocumento, SCRIPT_CABECERA } from '@/render/investigacion/cabecera';
import { bandaVistaPrevia, cabeceraDocumento as cabeceraEditorial } from '@/render/editorial/cabecera';
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

  it('operador sin permiso de compartir (M2 punto 1): la razón en lugar de «Crear link público»', () => {
    const h = cabeceraDocumento(meta, { ...operador, tokenActivo: null, razonNoCompartir: 'Solo aprobados <b>' });
    expect(h).not.toContain('Crear link público');
    expect(h).toMatch(/id="panel-razon"(?![^>]*hidden)/);
    expect(h).toContain('Solo aprobados &lt;b&gt;');
  });

  it('con un link ya creado y sin permiso de crear otro: el link sigue visible y la razón oculta', () => {
    const h = cabeceraDocumento(meta, { ...operador, razonNoCompartir: 'Solo aprobados' });
    expect(h).toContain('https://x.test/p/ana-villa/tok123');
    expect(h).toMatch(/id="panel-razon"[^>]*hidden/);
    expect(h).not.toContain('Crear link público');
  });

  it('el script muestra la razón del servidor al fallar y no truena sin botón de crear', () => {
    expect(SCRIPT_CABECERA).toContain('b.errores');
    expect(SCRIPT_CABECERA).toContain("getElementById('panel-razon')");
    expect(SCRIPT_CABECERA).toContain('if (crear) crear.hidden = false');
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

// El logo lleva al inicio de quien mira: `/` en la vista interna, `/portal`
// en el portal. En el enlace público no hay `inicio` y el logo queda como
// imagen: quien lo abre no tiene cuenta y `/` lo mandaría al acceso.
describe('logo de la cabecera', () => {
  const base = { etiqueta: 'Investigación', cliente: 'Ana' };

  it('vista interna: enlace a / con nombre accesible, envolviendo el mismo logo', () => {
    const h = cabeceraEditorial({ ...base, inicio: '/' });
    expect(h).toMatch(/<a class="cabecera-inicio" href="\/" aria-label="Wozial Studio · inicio"><img class="logo" /);
  });

  it('portal: enlace a /portal, con su ?cliente= en vista previa', () => {
    expect(cabeceraEditorial({ ...base, inicio: '/portal' })).toContain('<a class="cabecera-inicio" href="/portal"');
    expect(cabeceraEditorial({ ...base, inicio: '/portal?cliente=c1' })).toContain('href="/portal?cliente=c1"');
  });

  it('enlace público (sin inicio): el logo es una imagen suelta, sin enlace', () => {
    const h = cabeceraEditorial(base);
    expect(h).toContain('<img class="logo"');
    expect(h).not.toContain('cabecera-inicio');
    expect(h).not.toContain('Wozial Studio · inicio');
  });
});

// Fix menores, punto 3: banda «Vista previa del portal» cuando admin/operador
// abren el documento aprobado del cliente en modo previsualización.
describe('bandaVistaPrevia', () => {
  it('trae el aviso y el enlace de vuelta escapado', () => {
    const h = bandaVistaPrevia('/clientes/c1');
    expect(h).toContain('class="banda-vista-previa"');
    expect(h).toContain('Vista previa del portal');
    expect(h).toContain('Volver a la ficha');
    expect(h).toContain('href="/clientes/c1"');
  });

  it('escapa el href', () => {
    const h = bandaVistaPrevia('/clientes/"><script>alert(1)</script>');
    expect(h).not.toContain('<script>alert(1)</script>');
  });
});
