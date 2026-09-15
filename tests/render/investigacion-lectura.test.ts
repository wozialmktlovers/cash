import { describe, it, expect } from 'vitest';
import {
  seccionPortada, seccionDescubrimos, seccionClienteIdeal, seccionRecomendamos,
} from '@/render/investigacion/lectura';
import lectura from '../fixtures/lectura-ejemplo.json';

const l = () => JSON.parse(JSON.stringify(lectura));

describe('portada', () => {
  it('muestra titular, resumen, cifras con tono e índice', () => {
    const h = seccionPortada({ eyebrow: 'Investigación · 2026', titular: 'T', resumen: 'R', cifras: (lectura as any).cifras, conIndice: true });
    expect(h).toContain('class="portada');
    expect((h.match(/class="cifra-tarjeta/g) ?? []).length).toBe(3);
    expect(h).toContain('cifra-tarjeta a_favor');
    expect(h).toContain('$36,792');
    expect(h).toContain('href="#detalle"');
  });
  it('sin cifras ni índice no deja contenedores vacíos', () => {
    const h = seccionPortada({ eyebrow: 'e', titular: 'T', resumen: 'R', cifras: [], conIndice: false });
    expect(h).not.toContain('cifras');
    expect(h).not.toContain('class="accesos"');
  });
});

describe('secciones de la lectura', () => {
  it('01 descubrimos: tarjetas con resumen visible y detalle desplegable', () => {
    const h = seccionDescubrimos(l());
    expect(h).toContain('id="descubrimos"');
    expect(h).toContain('class="seccion-num">01<');
    expect((h.match(/<details class="mas"/g) ?? []).length).toBe(4);
    expect(h).toContain('Ver más');
    expect(h).toContain('Hay que cuidar');
  });

  it('02 cliente ideal: tres columnas, perfiles con frase y cómo hablarle', () => {
    const h = seccionClienteIdeal(l());
    expect(h).toContain('id="cliente-ideal"');
    expect(h).toContain('rejilla tres');
    expect(h).toContain('Ya sé hacer el trabajo');
    expect(h).toContain('Cómo hablarle');
  });

  it('03 recomendamos: pasos numerados, canales, precio y pendientes', () => {
    const h = seccionRecomendamos(l());
    expect(h).toContain('id="recomendamos"');
    expect((h.match(/class="paso /g) ?? []).length).toBe(4);
    expect(h).toContain('Dónde anunciarte');
    expect(h).toContain('Sobre tu precio');
    expect(h).toContain('Lo que falta confirmar');
  });

  it('omite precio y pendientes cuando no hay', () => {
    const x = l();
    x.recomendamos.precio = null;
    x.faltaConfirmar = [];
    const h = seccionRecomendamos(x);
    expect(h).not.toContain('Sobre tu precio');
    expect(h).not.toContain('Lo que falta confirmar');
  });

  it('escapa el texto del modelo', () => {
    const x = l();
    x.descubrimos[0].titulo = '<script>alert(1)</script>';
    expect(seccionDescubrimos(x)).not.toContain('<script>alert(1)</script>');
  });
});
