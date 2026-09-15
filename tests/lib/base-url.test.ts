import { describe, it, expect } from 'vitest';
import { baseUrlPublica, hostValido, baseUrlCorreo, esProduccion, enlaceCorreo } from '@/lib/base-url';

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

  it('un x-forwarded-proto que no sea http ni https cae al origen de la petición (fix round 1)', () => {
    const r = peticion('http://10.0.0.5:8080/x', { host: 'studio.wozial.mx', 'x-forwarded-proto': 'javascript' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('http://10.0.0.5:8080');
  });

  it('un host reenviado con ruta, credenciales, espacios o caracteres raros cae al origen de la petición', () => {
    for (const malo of ['evil.tld/phish', 'evil.tld?x=1', 'user@evil.tld', 'evil tld', 'evil.tld#a', 'evil.tld:puerto', '<script>']) {
      const r = peticion('http://10.0.0.5:8080/x', { 'x-forwarded-host': malo, 'x-forwarded-proto': 'https' });
      expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('http://10.0.0.5:8080');
    }
  });

  it('el host reenviado se normaliza a minúsculas', () => {
    const r = peticion('http://10.0.0.5:8080/x', { 'x-forwarded-host': 'Studio.Wozial.MX:443', 'x-forwarded-proto': 'https' });
    expect(baseUrlPublica(r, { publicBaseUrl: undefined, produccion: true })).toBe('https://studio.wozial.mx:443');
  });
});

describe('hostValido', () => {
  it('acepta nombre o IP con puerto opcional, en minúsculas', () => {
    for (const h of ['studio.wozial.mx', 'localhost:4321', '10.0.0.5:8080', 'a-b.c']) expect(hostValido(h)).toBe(true);
  });
  it('rechaza mayúsculas, rutas, consultas, credenciales, puertos no numéricos y vacío', () => {
    for (const h of ['Studio.mx', 'evil.tld/x', 'evil.tld?x', 'u@evil.tld', 'evil.tld:abc', 'evil.tld:', '', ' evil.tld', '[::1]']) expect(hostValido(h)).toBe(false);
  });
});

describe('baseUrlCorreo (fix round 1: lo que va en un correo solo sale de PUBLIC_BASE_URL)', () => {
  it('con PUBLIC_BASE_URL la devuelve sin diagonal final', () => {
    expect(baseUrlCorreo({ publicBaseUrl: 'https://studio.wozial.mx/' })).toBe('https://studio.wozial.mx');
  });
  it('sin ella (o vacía) devuelve null: nunca deriva de cabeceras', () => {
    expect(baseUrlCorreo({ publicBaseUrl: undefined })).toBeNull();
    expect(baseUrlCorreo({ publicBaseUrl: '  ' })).toBeNull();
  });
  it('una PUBLIC_BASE_URL que no es http(s) se ignora', () => {
    expect(baseUrlCorreo({ publicBaseUrl: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('esProduccion', () => {
  it('solo con NODE_ENV=production', () => {
    expect(esProduccion({ NODE_ENV: 'production' })).toBe(true);
    expect(esProduccion({ NODE_ENV: 'development' })).toBe(false);
    expect(esProduccion({})).toBe(false);
  });
});

describe('enlaceCorreo', () => {
  it('con PUBLIC_BASE_URL: con enlace absoluto', () => {
    expect(enlaceCorreo('/portal', { publicBaseUrl: 'https://studio.wozial.mx', produccion: true })).toEqual({ modo: 'con-enlace', url: 'https://studio.wozial.mx/portal' });
  });
  it('sin PUBLIC_BASE_URL en producción: no se envía', () => {
    expect(enlaceCorreo('/portal', { publicBaseUrl: undefined, produccion: true })).toEqual({ modo: 'no-enviar' });
  });
  it('sin PUBLIC_BASE_URL fuera de producción: sin enlace', () => {
    expect(enlaceCorreo('/portal', { publicBaseUrl: undefined, produccion: false })).toEqual({ modo: 'sin-enlace' });
  });
});
