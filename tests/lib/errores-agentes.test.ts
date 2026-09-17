import { describe, it, expect } from 'vitest';
import { APIError } from '@anthropic-ai/sdk';
import {
  motivoDeCorte, esCorte, cortar, nuevaCaja, CorteDeTrabajo,
  MENSAJE_SALDO, MENSAJE_CREDENCIALES,
} from '@/lib/errores-agentes';

/**
 * Los errores se fabrican con `APIError.generate`, que es exactamente la
 * función que el SDK usa en producción (`client.makeStatusError`), para que la
 * prueba vea la misma forma que llegó aquella noche: `status`, `type` sacado
 * del cuerpo y un `message` con el cuerpo entero en JSON. Nada de esto sale a
 * la red: `generate` solo construye el objeto.
 */
const delSdk = (status: number, tipo: string, mensaje: string) =>
  APIError.generate(status, { type: 'error', error: { type: tipo, message: mensaje } }, undefined, new Headers());

/** El error literal de los registros de Railway del incidente. */
const SIN_SALDO = () => delSdk(
  400, 'invalid_request_error',
  'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.',
);

describe('errores que cortan el trabajo', () => {
  it('el 400 de saldo agotado (el del incidente) se reconoce como falta de saldo', () => {
    const e = SIN_SALDO();
    // Comprobación de que la fixture es fiel a lo que hace el SDK.
    expect(e.constructor.name).toBe('BadRequestError');
    expect(e.status).toBe(400);
    expect(e.type).toBe('invalid_request_error');
    expect(e.message).toContain('400 ');

    expect(motivoDeCorte(e)).toBe('saldo');
  });

  it('el tipo billing_error también es falta de saldo, venga con el status que venga', () => {
    expect(motivoDeCorte(delSdk(400, 'billing_error', 'Billing issue.'))).toBe('saldo');
    expect(motivoDeCorte(delSdk(403, 'billing_error', 'Billing issue.'))).toBe('saldo');
  });

  it('el 401 de llave inválida es un problema de credenciales', () => {
    const e = delSdk(401, 'authentication_error', 'invalid x-api-key');
    expect(e.constructor.name).toBe('AuthenticationError');
    expect(motivoDeCorte(e)).toBe('credenciales');
  });

  it('el 403 sin permiso también es de credenciales', () => {
    expect(motivoDeCorte(delSdk(403, 'permission_error', 'not allowed'))).toBe('credenciales');
  });

  it('sin ANTHROPIC_API_KEY (error local de claude.ts) es de credenciales', () => {
    expect(motivoDeCorte(new Error('Falta ANTHROPIC_API_KEY'))).toBe('credenciales');
  });
});

describe('errores que NO cortan el trabajo', () => {
  it('el 429 de límite de peticiones es temporal: no aborta nada', () => {
    const e = delSdk(429, 'rate_limit_error', 'Number of requests has exceeded your rate limit.');
    expect(e.constructor.name).toBe('RateLimitError');
    expect(motivoDeCorte(e)).toBeNull();
    expect(esCorte(e)).toBe(false);
  });

  it('un 429 que encima mencionara el saldo seguiría sin abortar: lo temporal manda', () => {
    expect(motivoDeCorte(delSdk(429, 'rate_limit_error', 'credit balance is too low'))).toBeNull();
  });

  it('el 529 de sobrecarga y los 5xx son temporales', () => {
    expect(motivoDeCorte(delSdk(529, 'overloaded_error', 'Overloaded'))).toBeNull();
    expect(motivoDeCorte(delSdk(500, 'api_error', 'Internal server error'))).toBeNull();
  });

  it('un 400 corriente (parámetro mal puesto) es fallo de esa etapa, no del trabajo', () => {
    expect(motivoDeCorte(delSdk(400, 'invalid_request_error', 'max_tokens: must be >= 1'))).toBeNull();
  });

  it('la red caída, el JSON inválido y cualquier Error suelto se dejan pasar', () => {
    expect(motivoDeCorte(new Error('fetch failed'))).toBeNull();
    expect(motivoDeCorte(new Error('El modelo no devolvió JSON válido tras dos intentos.'))).toBeNull();
    expect(motivoDeCorte(undefined)).toBeNull();
    expect(motivoDeCorte('sin saldo')).toBeNull();
  });
});

describe('mensaje para la persona', () => {
  it('el de saldo dice qué pasó y qué hacer, sin volcado del SDK', () => {
    const corte = new CorteDeTrabajo('saldo', SIN_SALDO());
    expect(corte.message).toBe('Se agotó el saldo de la cuenta de Anthropic. Recarga en console.anthropic.com y vuelve a lanzarlo.');
    expect(corte.message).toBe(MENSAJE_SALDO);
    expect(corte.message).not.toContain('400');
    expect(corte.message).not.toContain('invalid_request_error');
    expect(corte.message).not.toContain('{');
  });

  it('el de credenciales apunta a la variable de entorno', () => {
    expect(new CorteDeTrabajo('credenciales').message).toBe(MENSAJE_CREDENCIALES);
    expect(MENSAJE_CREDENCIALES).toContain('ANTHROPIC_API_KEY');
  });

  it('el error original se conserva para los registros, fuera del mensaje', () => {
    const original = SIN_SALDO();
    expect(new CorteDeTrabajo('saldo', original).causa).toBe(original);
  });
});

describe('cortar: anota en la caja y lanza', () => {
  it('con un error de saldo lanza el corte y lo deja en la caja', () => {
    const caja = nuevaCaja();
    expect(() => cortar(caja, SIN_SALDO())).toThrow(MENSAJE_SALDO);
    expect(caja.valor?.motivo).toBe('saldo');
  });

  it('con un 429 no lanza ni ensucia la caja', () => {
    const caja = nuevaCaja();
    expect(() => cortar(caja, delSdk(429, 'rate_limit_error', 'slow down'))).not.toThrow();
    expect(caja.valor).toBeNull();
  });

  it('el primer corte gana: un segundo error no pisa el motivo original', () => {
    const caja = nuevaCaja();
    expect(() => cortar(caja, SIN_SALDO())).toThrow();
    expect(() => cortar(caja, new Error('Falta ANTHROPIC_API_KEY'))).toThrow();
    expect(caja.valor?.motivo).toBe('saldo');
  });

  it('un corte ya lanzado se vuelve a reconocer como corte (no se degrada a fallo de etapa)', () => {
    expect(motivoDeCorte(new CorteDeTrabajo('saldo'))).toBe('saldo');
  });
});
