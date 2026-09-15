import { describe, it, expect } from 'vitest';
import { baseUrlPublica } from '@/lib/base-url';

const peticion = (url: string, cabeceras: Record<string, string> = {}) => new Request(url, { headers: cabeceras });

describe('baseUrlPublica (M2 punto 4: enlaces de invitación y links públicos)', () => {
  it('usa PUBLIC_BASE_URL cuando existe, sin la diagonal final', () => {
    const r = peticion('http://10.0.0.5:8080/api/invitaciones', { 'x-forwarded-host': 'otro.mx', 'x-forwarded-proto': 'https' });
    expect(baseUrlPublica(r, { publicBaseUrl: 'https://studio.wozial.mx/', produccion: true })).toBe('https://studio.wozial.mx');
  });

  it('un PUBLIC_BASE_URL vacío o con espacios cuenta como ausente', () => {
    const r = peticion('http://localhost:4321/api/invitaciones');
    expect(baseUrlPublica(r, { publicBaseUrl: '  ', produccion: false })).toBe('http://localhost:4321');
  });

  it('sin PUBLIC_BASE_URL, deriva de x-forwarded-proto y x-forwarded-host (primer valor de la lista)', () => {
    const r = peticion('http://10.0.0.5:8080/api/invitaciones', {
      'x-forwarded-host': 'studio.wozial.mx, proxy.interno', 'x-forwarded-proto': 'https, http', host: '10.0.0.5:8080',
    });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('https://studio.wozial.mx');
  });

  it('en producción, sin x-forwarded-proto, usa https aunque el proceso reciba http (proxy que termina TLS)', () => {
    const r = peticion('http://10.0.0.5:8080/api/invitaciones', { 'x-forwarded-host': 'studio.wozial.mx' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('https://studio.wozial.mx');
  });

  it('fuera de producción, sin cabeceras reenviadas, conserva el origen de la petición', () => {
    const r = peticion('http://localhost:4321/api/invitaciones', { host: 'localhost:4321' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: false })).toBe('http://localhost:4321');
  });

  it('sin x-forwarded-host usa la cabecera Host', () => {
    const r = peticion('http://10.0.0.5:8080/x', { host: 'studio.wozial.mx' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('https://studio.wozial.mx');
  });

  it('ignora un x-forwarded-proto que no sea http ni https', () => {
    const r = peticion('http://10.0.0.5:8080/x', { host: 'studio.wozial.mx', 'x-forwarded-proto': 'javascript' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('https://studio.wozial.mx');
  });
});
