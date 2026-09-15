// La campana de avisos (src/components/Campana.tsx) es una isla React
// `client:load` sin infraestructura de DOM en este repo (no hay jsdom ni
// testing-library entre las devDependencies, y no se puede `npm install`).
// Igual que `cabecera.test.ts` verifica el script en línea por contenido en
// vez de ejecutarlo en un navegador, estas pruebas leen el código fuente
// para blindar los tres arreglos del punto 4 de menores contra un borrado
// accidental: foco al abrirse, un solo GET, y resalte también en hover.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import campana from '@/components/Campana.tsx?raw';

// `?raw` sobre un .css se comporta distinto al de un .ts/.tsx en este
// entorno (Vite sigue tratándolo como hoja de estilos, no como texto): se
// lee el archivo a mano, igual de directo y sin depender de esa mecánica.
const estilos = readFileSync(fileURLToPath(new URL('../../src/styles/global.css', import.meta.url)), 'utf8');

describe('Campana: foco, un solo GET y hover de no leídos (fix menores, punto 4)', () => {
  it('el panel es enfocable y recibe el foco al abrirse', () => {
    expect(campana).toContain('tabIndex={-1}');
    expect(campana).toContain('panel.current?.focus()');
  });

  it('la lista se pide en un único efecto, separado del sondeo de conteo', () => {
    // Dos efectos con `cargarConteo`/`cargarLista` cada uno con su propio
    // `useEffect`: si alguien los fusionara, abrir el panel dispararía dos
    // peticiones a /api/notificaciones en vez de una.
    const efectos = campana.match(/useEffect\(/g) ?? [];
    expect(efectos.length).toBeGreaterThanOrEqual(3);
    expect(campana).toContain('void cargarLista();');
    expect(campana.match(/void cargarLista\(\)/g) ?? []).toHaveLength(1);
  });

  it('un aviso no leído también se resalta en hover, no solo en reposo', () => {
    // Sin una regla dedicada, `[data-leida="false"]` y `:hover` empatan en
    // especificidad y gana el orden de la hoja: el aviso no leído se vería
    // igual en reposo que al pasar el mouse.
    expect(estilos).toContain('.campana-item[data-leida="false"]:hover');
  });
});
