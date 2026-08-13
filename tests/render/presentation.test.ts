import { describe, it, expect } from 'vitest';
import { renderizarPresentacion } from '@/render/presentation';
import { investigacionSchema } from '@/research/schemas';
import completa from '../fixtures/investigacion-completa.json';
import parcial from '../fixtures/investigacion-parcial.json';

const meta = { cliente: 'Ana Villa', giro: 'Cosmetología', fecha: '2026-08-12' };

describe('fixtures', () => {
  it('la investigación completa valida contra el esquema', () => {
    const r = investigacionSchema.safeParse(completa);
    if (!r.success) console.error(r.error.issues.slice(0, 5));
    expect(r.success).toBe(true);
  });

  it('la investigación parcial valida contra el esquema', () => {
    expect(investigacionSchema.safeParse(parcial).success).toBe(true);
  });
});

describe('renderizado', () => {
  it('produce 17 paneles con datos completos', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect((html.match(/class="panel"/g) ?? []).length).toBe(17);
  });

  it('incluye el nombre del cliente y el título', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect(html).toContain('Ana Villa');
    expect(html).toContain('<title>');
  });

  it('marca los paneles vacíos con su razón, sin inventar contenido', () => {
    const html = renderizarPresentacion(parcial as any, meta);
    expect(html).toContain('Sin datos');
    expect((html.match(/class="panel"/g) ?? []).length).toBe(17);
  });

  it('escapa el HTML de los datos para evitar inyección', () => {
    const conScript = JSON.parse(JSON.stringify(completa));
    conScript.competencia.datos.hallazgos = ['<script>alert(1)</script>'];
    const html = renderizarPresentacion(conScript, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapa también las URL de las fuentes', () => {
    const conScript = JSON.parse(JSON.stringify(completa));
    conScript.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    const html = renderizarPresentacion(conScript, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
