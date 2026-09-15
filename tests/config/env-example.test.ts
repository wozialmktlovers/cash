import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * M2 punto 7: `.env.example` documenta las variables de correo, enlaces y
 * conversión de lecturas, cada una con un comentario encima y sin valores
 * reales en las llaves secretas.
 */
const texto = fs.readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8');
const lineas = texto.split('\n');

function definicion(nombre: string) {
  const i = lineas.findIndex((l) => l.startsWith(`${nombre}=`));
  return { i, valor: i >= 0 ? lineas[i].slice(nombre.length + 1) : undefined, comentario: i > 0 && lineas[i - 1].startsWith('#') };
}

describe('.env.example', () => {
  for (const nombre of ['CORREO_SMTP_HOST', 'CORREO_SMTP_PUERTO', 'CORREO_SMTP_USUARIO', 'CORREO_SMTP_PASSWORD', 'CORREO_REMITENTE', 'PUBLIC_BASE_URL', 'CONVERTIR_LECTURAS', 'COST_LIMIT_CONVERSION_USD']) {
    it(`documenta ${nombre} con un comentario encima`, () => {
      const d = definicion(nombre);
      expect(d.i).toBeGreaterThanOrEqual(0);
      expect(d.comentario).toBe(true);
    });
  }

  it('las llaves secretas quedan vacías', () => {
    for (const nombre of ['CORREO_SMTP_PASSWORD', 'ANTHROPIC_API_KEY', 'SESSION_SECRET']) {
      expect(definicion(nombre).valor).toBe('');
    }
  });
});
