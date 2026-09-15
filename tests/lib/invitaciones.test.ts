import { describe, it, expect } from 'vitest';
import {
  generarInvitacion,
  hashToken,
  vencimiento,
  estadoInvitacion,
  validarAceptacion,
  puedeInvitar,
} from '@/lib/invitaciones';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, rol, clientId: null, activo: true, ...extra });

describe('generarInvitacion', () => {
  it('da un token de al menos 32 caracteres y el hash coincide', () => {
    const { token, tokenHash } = generarInvitacion();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hashToken(token)).toBe(tokenHash);
  });

  it('da tokens distintos en cada llamada', () => {
    expect(generarInvitacion().token).not.toBe(generarInvitacion().token);
  });
});

describe('vencimiento', () => {
  it('suma 7 días', () => {
    const desde = new Date('2026-01-01T00:00:00.000Z');
    expect(vencimiento(desde).toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });
});

describe('estadoInvitacion', () => {
  const ahora = new Date('2026-01-10T00:00:00.000Z');

  it('inexistente si no hay invitación', () => {
    expect(estadoInvitacion(null, ahora)).toBe('inexistente');
  });

  it('usada si ya tiene usadaEn, aunque no haya vencido', () => {
    expect(estadoInvitacion({ expiraEn: new Date('2026-02-01'), usadaEn: new Date('2026-01-05') }, ahora)).toBe('usada');
  });

  it('vencida si expiraEn quedó atrás', () => {
    expect(estadoInvitacion({ expiraEn: new Date('2026-01-05'), usadaEn: null }, ahora)).toBe('vencida');
  });

  it('valida si no expiró ni se usó', () => {
    expect(estadoInvitacion({ expiraEn: new Date('2026-02-01'), usadaEn: null }, ahora)).toBe('valida');
  });
});

describe('validarAceptacion', () => {
  it('exige nombre', () => {
    const r = validarAceptacion({ nombre: '  ', password: '123456789012', confirmacion: '123456789012' });
    expect(r.ok).toBe(false);
  });

  it('exige contraseña de al menos 12 caracteres', () => {
    const r = validarAceptacion({ nombre: 'Ana', password: 'corta1234', confirmacion: 'corta1234' });
    expect(r.ok).toBe(false);
  });

  it('exige que la confirmación coincida', () => {
    const r = validarAceptacion({ nombre: 'Ana', password: '123456789012', confirmacion: 'otra12345678' });
    expect(r.ok).toBe(false);
  });

  it('acepta datos válidos', () => {
    const r = validarAceptacion({ nombre: 'Ana', password: '123456789012', confirmacion: '123456789012' });
    expect(r.ok).toBe(true);
  });
});

describe('puedeInvitar', () => {
  const cliente = { id: 'c1', operadorId: 'op1' };

  it('admin invita cualquier rol', () => {
    expect(puedeInvitar(u('admin'), 'admin', null)).toBe(true);
    expect(puedeInvitar(u('admin'), 'operador', null)).toBe(true);
    expect(puedeInvitar(u('admin'), 'cliente', cliente)).toBe(true);
    expect(puedeInvitar(u('admin'), 'cliente', null)).toBe(true);
  });

  it('operador solo invita cliente de un cliente que tenga asignado', () => {
    expect(puedeInvitar(u('operador', { id: 'op1' }), 'cliente', cliente)).toBe(true);
    expect(puedeInvitar(u('operador', { id: 'op2' }), 'cliente', cliente)).toBe(false);
    expect(puedeInvitar(u('operador', { id: 'op1' }), 'cliente', null)).toBe(false);
  });

  it('operador nunca invita admin u operador', () => {
    expect(puedeInvitar(u('operador'), 'admin', null)).toBe(false);
    expect(puedeInvitar(u('operador'), 'operador', null)).toBe(false);
  });

  it('cliente no invita a nadie', () => {
    expect(puedeInvitar(u('cliente', { clientId: 'c1' }), 'cliente', cliente)).toBe(false);
    expect(puedeInvitar(u('cliente'), 'operador', null)).toBe(false);
  });
});
