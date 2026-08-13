import { describe, it, expect } from 'vitest';
import { renderizarPresentacion } from '@/render/presentation';
import { ESTILOS } from '@/render/estilos';
import { NAVEGACION } from '@/render/navegacion';
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
    expect((html.match(/class="panel[ "]/g) ?? []).length).toBe(17);
  });

  it('incluye el nombre del cliente y el título', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect(html).toContain('Ana Villa');
    expect(html).toContain('<title>');
  });

  it('marca los paneles vacíos con su razón, sin inventar contenido', () => {
    const html = renderizarPresentacion(parcial as any, meta);
    expect(html).toContain('Sin datos');
    expect((html.match(/class="panel[ "]/g) ?? []).length).toBe(17);
  });

  it('escapa el HTML de los datos para evitar inyección', () => {
    const conScript = JSON.parse(JSON.stringify(completa));
    conScript.competencia.datos.hallazgos = ['<script>alert(1)</script>'];
    const html = renderizarPresentacion(conScript, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('incluye los elementos que el script de navegación necesita', () => {
    // El script del machote hace tot.textContent al arrancar: si falta
    // cualquiera de estos ids, revienta en la primera línea y la presentación
    // se queda sin flechas, sin puntos, sin progreso y sin teclado.
    const html = renderizarPresentacion(completa as any, meta);
    for (const id of ['deck', 'dots', 'cur', 'tot', 'prev', 'next', 'progFill']) {
      expect(html, `falta id="${id}"`).toContain(`id="${id}"`);
    }
    expect(html).toContain('class="nav-bar"');
    expect(html).toContain('class="prog"');
  });

  it('no deja tipografía por debajo de 12px, ilegible al recomprimirse el video', () => {
    // Una videollamada reescala y recomprime la pantalla compartida: lo que
    // aquí mide 10px le llega al otro lado como 5 o 6. El piso se fija en
    // 0.75rem para que nada baje de ahí con la escala en 1.
    // Se excluyen las reglas de `html`: ahí el px es la raíz de la que cuelgan
    // los rem, no el tamaño de un texto.
    const sinRaiz = ESTILOS.replace(/html\s*\{[^}]*\}/g, '');
    const sueltos = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(sueltos, `hay tamaños en px sin escalar: ${sueltos.join(', ')}`).toEqual([]);

    // Los paneles también llevan tamaños en línea; si alguno queda en px, ese
    // texto se queda quieto mientras el resto crece.
    const pxEnPaneles = [...renderizarPresentacion(completa as any, meta)
      .matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(pxEnPaneles.filter((n) => n !== 16)).toEqual([]);

    const enRem = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(enRem.length).toBeGreaterThan(15);
    expect(Math.min(...enRem)).toBeGreaterThanOrEqual(0.75);
  });

  it('el script de navegación es JavaScript sintácticamente válido', () => {
    // Vive dentro de un literal de plantilla, así que TypeScript no lo revisa:
    // un backtick suelto en un comentario corta la cadena y la presentación
    // sale sin flechas, sin puntos y sin teclado, sin que falle ningún test.
    // new Function lo compila sin ejecutarlo.
    expect(() => new Function(NAVEGACION)).not.toThrow();
  });

  it('trae el control de escala para compartir pantalla', () => {
    const html = renderizarPresentacion(completa as any, meta);
    expect(html).toContain('id="escala"');
    expect(html).toContain('id="pantalla"');
    expect(html).toContain('--esc');
  });

  it('escapa también las URL de las fuentes', () => {
    const conScript = JSON.parse(JSON.stringify(completa));
    conScript.competencia.datos.directos[0].fuente.url = 'https://x.com/"><script>alert(1)</script>';
    const html = renderizarPresentacion(conScript, meta);
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
