import { describe, it, expect } from 'vitest';
import {
  generarInvitacion,
  hashToken,
  vencimiento,
  estadoInvitacion,
  invitacionVigente,
  validarAceptacion,
  puedeInvitar,
  esPendiente,
  correoInvitacion,
} from '@/lib/invitaciones';
import type { UsuarioSesion } from '@/lib/permisos';

const u = (rol: UsuarioSesion['rol'], extra: Partial<UsuarioSesion> = {}): UsuarioSesion =>
  ({ id: 'u1', email: 'a@b.c', nombre: null, apellido: null, rol, clientId: null, activo: true, ...extra });

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

describe('invitacionVigente', () => {
  const ahora = new Date('2026-01-10T00:00:00.000Z');
  const invValida = { expiraEn: new Date('2026-02-01'), usadaEn: null, rol: 'cliente' as const };
  const invAdmin = { expiraEn: new Date('2026-02-01'), usadaEn: null, rol: 'operador' as const };
  const admin = u('admin');
  const operador = u('operador', { id: 'op1' });
  const clienteDeOp1 = { id: 'c1', operadorId: 'op1' };
  const clienteDeOtro = { id: 'c1', operadorId: 'op2' };

  it('respeta primero vencida/usada/inexistente, sin mirar al creador', () => {
    expect(invitacionVigente(null, admin, null, ahora)).toBe('inexistente');
    expect(invitacionVigente({ ...invValida, expiraEn: new Date('2026-01-01') }, admin, clienteDeOp1, ahora)).toBe('vencida');
    expect(invitacionVigente({ ...invValida, usadaEn: new Date('2026-01-05') }, admin, clienteDeOp1, ahora)).toBe('usada');
  });

  it('revocada si no hay creador (lo borraron)', () => {
    expect(invitacionVigente(invValida, null, clienteDeOp1, ahora)).toBe('revocada');
  });

  it('revocada si al creador lo desactivaron', () => {
    expect(invitacionVigente(invValida, u('operador', { id: 'op1', activo: false }), clienteDeOp1, ahora)).toBe('revocada');
  });

  it('revocada si al operador que invitó lo reasignaron del cliente', () => {
    expect(invitacionVigente(invValida, operador, clienteDeOtro, ahora)).toBe('revocada');
  });

  it('revocada si el operador ya no puede invitar ese rol (p. ej. alguien le degradó de admin a operador)', () => {
    expect(invitacionVigente(invAdmin, operador, null, ahora)).toBe('revocada');
  });

  it('válida si el creador conserva la autoridad', () => {
    expect(invitacionVigente(invValida, admin, clienteDeOp1, ahora)).toBe('valida');
    expect(invitacionVigente(invValida, operador, clienteDeOp1, ahora)).toBe('valida');
    expect(invitacionVigente(invAdmin, admin, null, ahora)).toBe('valida');
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

describe('esPendiente (M2 punto 4: lista de invitaciones por revocar)', () => {
  const ahora = new Date('2026-01-10T00:00:00.000Z');
  it('pendiente: sin usar y sin vencer', () => {
    expect(esPendiente({ expiraEn: new Date('2026-01-11'), usadaEn: null }, ahora)).toBe(true);
  });
  it('una usada o vencida ya no está pendiente', () => {
    expect(esPendiente({ expiraEn: new Date('2026-01-11'), usadaEn: new Date('2026-01-09') }, ahora)).toBe(false);
    expect(esPendiente({ expiraEn: new Date('2026-01-09'), usadaEn: null }, ahora)).toBe(false);
  });
});

describe('correoInvitacion (fix round 1: el botón del correo solo apunta a PUBLIC_BASE_URL)', () => {
  const token = 'tok-real';

  it('con PUBLIC_BASE_URL: se manda con el botón a esa base, aunque la petición traiga otro host', () => {
    const r = correoInvitacion({ token, email: 'a@b.mx', publicBaseUrl: 'https://studio.wozial.mx', produccion: true });
    expect(r.enviar).toBe(true);
    if (r.enviar) {
      expect(r.correo.boton).toEqual({ texto: 'Crear mi acceso', url: 'https://studio.wozial.mx/invitacion/tok-real' });
      expect(r.correo.para).toBe('a@b.mx');
    }
  });

  it('sin PUBLIC_BASE_URL en producción: no se manda y trae una nota para la interfaz', () => {
    const r = correoInvitacion({ token, email: 'a@b.mx', publicBaseUrl: undefined, produccion: true });
    expect(r.enviar).toBe(false);
    if (!r.enviar) expect(r.nota).toContain('PUBLIC_BASE_URL');
  });

  it('sin PUBLIC_BASE_URL fuera de producción: se manda sin botón ni enlace ni token', () => {
    const r = correoInvitacion({ token, email: 'a@b.mx', publicBaseUrl: '', produccion: false });
    expect(r.enviar).toBe(true);
    if (r.enviar) {
      expect(r.correo.boton).toBeUndefined();
      expect(JSON.stringify(r.correo)).not.toContain('tok-real');
      expect(r.correo.texto).not.toContain('botón');
    }
  });

  it('sin opciones explícitas lee PUBLIC_BASE_URL y NODE_ENV del entorno (como la ruta real)', () => {
    const previo = { ...process.env };
    try {
      process.env.PUBLIC_BASE_URL = 'https://studio.wozial.mx';
      process.env.NODE_ENV = 'production';
      const con = correoInvitacion({ token, email: 'a@b.mx' });
      expect(con.enviar && con.correo.boton?.url).toBe('https://studio.wozial.mx/invitacion/tok-real');
      delete process.env.PUBLIC_BASE_URL;
      expect(correoInvitacion({ token, email: 'a@b.mx' }).enviar).toBe(false);
    } finally {
      process.env = previo;
    }
  });
});
