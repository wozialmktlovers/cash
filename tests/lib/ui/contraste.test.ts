import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contraste } from '@/lib/ui/contraste';

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

function bloque(selector: string): Record<string, string> {
  const inicio = css.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No existe el bloque ${selector}`);
  const cuerpo = css.slice(inicio, css.indexOf('}', inicio));
  const tokens: Record<string, string> = {};
  for (const m of cuerpo.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];
  return tokens;
}

const claro = bloque(':root');
const oscuro = { ...claro, ...bloque(':root[data-tema="oscuro"]') };

// Cada par es texto sobre fondo tal como aparece en pantalla.
const PARES: Array<[string, string]> = [
  ['tinta', 'fondo'], ['texto', 'fondo'], ['texto', 'gris'],
  ['suave', 'fondo'], ['suave', 'gris'], ['suave', 'tarjeta'],
  ['rosa', 'fondo'], ['rosa', 'rosa-s'], ['sobre-acento', 'rosa'],
  ['azul', 'fondo'], ['azul', 'azul-s'],
  ['amarillo', 'fondo'], ['amarillo', 'amarillo-s'],
  ['verde', 'fondo'], ['verde', 'verde-s'],
  ['rojo', 'fondo'], ['rojo', 'rojo-s'],
  // Cabecera de pilar en el banco de temas (banco.ts): el eyebrow «Pilar N»
  // del quinto pilar usa --tinta sobre --gris (su --color-pilar-s, ya que
  // tinta no tiene tinte -s propio).
  ['tinta', 'gris'],
];

describe('contraste', () => {
  it('calcula los extremos conocidos', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contraste('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  for (const [nombre, tokens] of [['claro', claro], ['oscuro', oscuro]] as const) {
    it(`todos los pares de texto cumplen AA en tema ${nombre}`, () => {
      for (const [fg, bg] of PARES) {
        expect(tokens[fg], `falta --${fg}`).toBeDefined();
        expect(tokens[bg], `falta --${bg}`).toBeDefined();
        const r = contraste(tokens[fg], tokens[bg]);
        expect(r, `--${fg} sobre --${bg} da ${r.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
