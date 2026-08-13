import { describe, it, expect } from 'vitest';
import { mismoOrigen, requiereVerificacion } from '@/lib/csrf';

const pedir = (cabeceras: Record<string, string>) =>
  new Request('http://interno.local/api/login', { method: 'POST', headers: cabeceras });

describe('verificación de origen', () => {
  it('acepta un Origin https detrás de un proxy que entrega http', () => {
    // El caso que rompía en Railway: el navegador manda https, el proceso ve http.
    expect(mismoOrigen(pedir({
      origin: 'https://wozial.up.railway.app',
      'x-forwarded-host': 'wozial.up.railway.app',
      host: 'interno.local',
    }))).toBe(true);
  });

  it('acepta el mismo host sin proxy', () => {
    expect(mismoOrigen(pedir({
      origin: 'http://localhost:4321',
      host: 'localhost:4321',
    }))).toBe(true);
  });

  it('rechaza un origen ajeno', () => {
    expect(mismoOrigen(pedir({
      origin: 'https://sitio-atacante.com',
      'x-forwarded-host': 'wozial.up.railway.app',
    }))).toBe(false);
  });

  it('rechaza una petición sin Origin', () => {
    expect(mismoOrigen(pedir({ host: 'wozial.up.railway.app' }))).toBe(false);
  });

  it('rechaza un Origin que no es URL', () => {
    expect(mismoOrigen(pedir({ origin: 'null', host: 'wozial.up.railway.app' }))).toBe(false);
  });

  it('toma el primer host cuando el proxy encadena varios', () => {
    expect(mismoOrigen(pedir({
      origin: 'https://wozial.up.railway.app',
      'x-forwarded-host': 'wozial.up.railway.app, interno.railway.internal',
    }))).toBe(true);
  });

  it('solo verifica los métodos que cambian estado', () => {
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect(requiereVerificacion(m)).toBe(true);
    for (const m of ['GET', 'HEAD', 'OPTIONS']) expect(requiereVerificacion(m)).toBe(false);
  });
});
