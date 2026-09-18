import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SCRIPT_EDITORIAL } from '@/render/editorial/interaccion';
import { SCRIPT_PILARES } from '@/render/pilares/script';
import { SCRIPT_CONTENIDO, SCRIPT_REVISION } from '@/render/contenido/script';
import { SCRIPT_CABECERA } from '@/render/editorial/cabecera';
import { SCRIPT_FLUJO } from '@/render/editorial/flujo-cliente';
import { SCRIPT_BARRA_ETAPA } from '@/render/editorial/barra-etapa';
import { NAVEGACION_GROWTH } from '@/render/growth/navegacion';
import { SCRIPT_ARTES } from '@/render/growth/artes-script';

// Estos scripts se mandan tal cual dentro de un <script> en línea del
// documento HTML (sin paso de build): un navegador viejo tiene que poder
// correrlos directo. `npm run build` no los revisa —son texto dentro de un
// template string, no código TypeScript que el compilador vea— así que la
// única red es esta prueba.
const SCRIPTS: Record<string, string> = {
  SCRIPT_EDITORIAL,
  SCRIPT_PILARES,
  SCRIPT_CONTENIDO,
  SCRIPT_REVISION,
  SCRIPT_CABECERA,
  SCRIPT_FLUJO,
  SCRIPT_BARRA_ETAPA,
  NAVEGACION_GROWTH,
  SCRIPT_ARTES,
};

const ESBUILD_DISPONIBLE = existsSync(join(process.cwd(), 'node_modules/esbuild'));

describe('ES5 real en los scripts en línea', () => {
  for (const [nombre, codigo] of Object.entries(SCRIPTS)) {
    it(`${nombre} no usa arrow functions, template literals, const ni let`, async () => {
      // Arrow functions y template literals: esbuild SÍ sabe bajarlos a ES5
      // sin quejarse (una arrow se vuelve `function`, un template literal se
      // vuelve concatenación), así que revisar la SALIDA de esbuild nunca los
      // encontraría aunque el ORIGEN los tuviera — se revisa el texto tal
      // cual, antes de cualquier transformación.
      expect(codigo, `${nombre} usa arrow function (=>)`).not.toMatch(/=>/);
      expect(codigo, `${nombre} usa template literals (comillas invertidas)`).not.toMatch(/`/);

      if (ESBUILD_DISPONIBLE) {
        // const/let, en cambio, esbuild no sabe bajarlos a `var` con
        // target:'es5' y truena (probado a mano: "Transforming const to the
        // configured target environment (\"es5\") is not supported yet").
        // Que transformSync no lance ya certifica su ausencia, y de paso
        // valida que el resto de la sintaxis sea compatible con ES5.
        const { transformSync } = await import('esbuild');
        expect(() => transformSync(codigo, { loader: 'js', target: 'es5' })).not.toThrow();
      } else {
        // Sin esbuild en node_modules (símlink a node_modules.nosync/ roto o
        // paquete no instalado): revisión de respaldo por regex simple. Menos
        // fiable que dejar que esbuild parsee de verdad, pero evita que la
        // prueba entera se quede sin cubrir nada si falta el paquete.
        expect(codigo, `${nombre} usa const`).not.toMatch(/\bconst\b/);
        expect(codigo, `${nombre} usa let`).not.toMatch(/\blet\b/);
      }
    });
  }
});
