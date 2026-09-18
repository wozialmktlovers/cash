import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESTILOS_GROWTH } from '@/render/growth/estilos';
import { NAVEGACION_GROWTH } from '@/render/growth/navegacion';

// `ESTILOS_EDITORIAL` incrusta src/styles/tokens.css con `?raw`, y en vitest
// ese import devuelve cadena vacía (vite no procesa CSS en el entorno de
// pruebas). Para lo que mira la integridad de las variables hay que leer el
// archivo del disco, igual que hace tests/lib/ui/contraste.test.ts.
const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const HOJA = `${TOKENS_CSS}\n${ESTILOS_GROWTH}`;

describe('estilos del manual de campaña', () => {
  it('se apoya en la base editorial, no en una línea propia', () => {
    // La cápsula flotante, el índice lateral y el marco al 85% son los mismos
    // que la investigación y el mapa de pilares.
    expect(ESTILOS_GROWTH).toContain('.cabecera{');
    expect(ESTILOS_GROWTH).toContain('.indice-lateral');
    expect(ESTILOS_GROWTH).toContain('.pagina{');
    // Y la escala de videollamada, que sigue siendo suya.
    expect(ESTILOS_GROWTH).toContain('--esc');
    expect(ESTILOS_GROWTH).toContain('.card{');
  });

  it('ni un color fijo: de ahí sale el modo noche', () => {
    // El diagnóstico de la migración: 438 líneas con #0a0a0e, #5ee0ad y
    // rgba(255,255,255,…) escritos a mano, que sobre fondo claro quedaban
    // ilegibles. Todo el color vive ahora en los tokens.
    expect(ESTILOS_GROWTH).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(ESTILOS_GROWTH).not.toMatch(/\brgba?\(/);
  });

  it('no deja ni un tamaño de letra en px, y ninguno por debajo de 0.75rem', () => {
    const sinRaiz = ESTILOS_GROWTH.replace(/html\s*\{[^}]*\}/g, '');
    const px = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
    expect(px, `quedan px sueltos: ${px.join(', ')}`).toEqual([]);
    const rem = [...sinRaiz.matchAll(/font-size:\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(Math.min(...rem)).toBeGreaterThanOrEqual(0.75);
    // El grueso del tipo ya no se declara aquí: viene de la escala del Studio
    // (--t-body, --t-small, --t-micro), que --esc multiplica.
    expect(ESTILOS_GROWTH).toContain('font:var(--t-body)');
    expect(ESTILOS_GROWTH).toContain('font:var(--t-micro)');
  });

  it('trae las clases propias del manual', () => {
    // `.utm` salió de la lista con la migración: la URL etiquetada de cada
    // pieza se rinde desde hace tiempo como `.pre` dentro de un `.kv`
    // (secciones/creativos.ts), y esas reglas ya no las usaba nadie.
    for (const c of ['.sec', '.slot', '.slots-car', '.ar-1x1', '.ar-4x5', '.ar-9x16',
                     '.copy', '.kv', '.chips', '.chip-k', '.shead', '.pre', '.fmt', '.grp']) {
      expect(ESTILOS_GROWTH, `falta ${c}`).toContain(c);
    }
  });

  it('trae los controles de videollamada, que no están en la base', () => {
    expect(ESTILOS_GROWTH).toContain('.cabecera-escala');
    expect(ESTILOS_GROWTH).toContain('.cabecera-pantalla');
  });

  it('no arrastra el envase del deck', () => {
    expect(ESTILOS_GROWTH).not.toContain('.deck{');
    expect(ESTILOS_GROWTH).not.toContain('.panel{');
    expect(ESTILOS_GROWTH).not.toContain('.dots{');
  });
});

describe('controles de videollamada del manual', () => {
  it('es JavaScript sintácticamente válido', () => {
    expect(() => new Function(NAVEGACION_GROWTH)).not.toThrow();
  });

  it('trae la escala de texto y la pantalla completa', () => {
    expect(NAVEGACION_GROWTH).toContain('escala');
    expect(NAVEGACION_GROWTH).toContain('pantalla');
    expect(NAVEGACION_GROWTH).toContain('requestFullscreen');
    expect(NAVEGACION_GROWTH).toContain('--esc');
  });

  it('no escribe la escala mientras se teclea en un campo', () => {
    expect(NAVEGACION_GROWTH).toContain('INPUT|TEXTAREA');
  });
});

describe('integridad de los tokens', () => {
  it('ninguna variable CSS se usa sin estar definida', () => {
    // Una var() sin definir no falla: la declaración se descarta en silencio
    // y el documento sale con la caja rota sin que nada avise.
    const definidas = new Set([...HOJA.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const usadas = new Set([...HOJA.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
    const huerfanas = [...usadas].filter((v) => !definidas.has(v));
    expect(huerfanas, `variables sin definir: ${huerfanas.join(', ')}`).toEqual([]);
  });

  it('el tema oscuro redefine la paleta que el manual usa', () => {
    // El manual era el único entregable sin modo noche. Lo tiene porque sus
    // reglas nombran los mismos tokens que tokens.css redefine en oscuro.
    const oscuro = TOKENS_CSS.slice(TOKENS_CSS.indexOf(':root[data-tema="oscuro"]'));
    for (const t of ['--tinta', '--texto', '--suave', '--fondo', '--gris', '--tarjeta', '--linea', '--rosa']) {
      expect(oscuro, `el tema oscuro no redefine ${t}`).toContain(`${t}:`);
      expect(ESTILOS_GROWTH, `el manual no usa ${t}`).toContain(`var(${t})`);
    }
  });
});

describe('atributo [hidden]', () => {
  it('gana por encima de cualquier display propio de la clase', () => {
    // '.recuadro-comentario' y '.respuesta-area' declaran 'display:grid' con
    // la misma especificidad que '[hidden]{display:none}' del navegador;
    // como vienen después en la hoja, ganaban y el elemento no se ocultaba
    // pese al atributo. La regla global con '!important' debe estar
    // presente y no dentro de un '@media print' (debe regir siempre).
    const sinPrint = ESTILOS_GROWTH.replace(/@media print\{[^}]*\}/g, '');
    expect(sinPrint).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
  });
});
