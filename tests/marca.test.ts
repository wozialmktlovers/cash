import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LOGO_WOZIAL, LOGO_WOZIAL_SRC } from '@/render/marca';

const PUBLIC = join(process.cwd(), 'public');

/**
 * Existe porque ya pasó: se tomó un archivo llamado «logo-mono-white.svg» de la
 * carpeta de marca y resultó ser el logotipo de Shopify. El nombre del archivo
 * no acredita de quién es el logo; el contenido sí.
 */
const MARCAS_AJENAS = [
  'shopify', 'meta platforms', 'facebook inc', 'google llc',
  'canva', 'hubspot', 'mailchimp', 'wordpress',
];

describe('activos de marca', () => {
  it('ningún archivo de public/ contiene marcas ajenas', () => {
    for (const nombre of readdirSync(PUBLIC)) {
      const ruta = join(PUBLIC, nombre);
      if (!statSync(ruta).isFile()) continue;
      // Solo tiene sentido en formatos de texto; un PNG es binario.
      if (!/\.(svg|css|js|json|txt)$/i.test(nombre)) continue;

      const contenido = readFileSync(ruta, 'utf8').toLowerCase();
      for (const marca of MARCAS_AJENAS) {
        expect(contenido, `${nombre} menciona «${marca}»`).not.toContain(marca);
      }

      // Los trazos del SVG de Shopify se llamaban s_, h_, o_, p_, i_, f_, y_.
      const iniciales = [...contenido.matchAll(/id="([a-z])_[0-9_]*"/g)].map((m) => m[1]).join('');
      expect(iniciales, `${nombre} deletrea una marca ajena en sus ids`).not.toContain('shopify');
    }
  });

  it('el logotipo incrustado es una imagen real y no un marcador vacío', () => {
    expect(LOGO_WOZIAL_SRC.startsWith('data:image/')).toBe(true);
    // El logotipo de Wozial pesa decenas de KB; un placeholder pesaría cientos de bytes.
    expect(LOGO_WOZIAL_SRC.length).toBeGreaterThan(20_000);
    expect(LOGO_WOZIAL).toContain('alt="Wozial"');
  });

  it('el logotipo va incrustado, nunca por URL: la presentación se descarga suelta', () => {
    expect(LOGO_WOZIAL).not.toMatch(/src="\/(logo|assets)/);
  });

  it('el favicon existe y usa el rosa de Wozial', () => {
    const favicon = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8');
    expect(favicon).toContain('#d4688a');
    expect(favicon).toContain('<path');
  });
});
