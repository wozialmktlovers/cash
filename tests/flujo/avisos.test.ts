import { describe, it, expect } from 'vitest';
import { destinatarios, textoAviso, type ContextoDestinatarios, type Usuario } from '@/flujo/avisos';

const u = (id: string, overrides: Partial<Usuario> = {}): Usuario => ({
  id, email: `${id}@wozial.mx`, nombre: id, rol: 'operador', activo: true, ...overrides,
});

const CTX_VACIO: ContextoDestinatarios = {
  admins: [], operador: null, autor: null, usuariosCliente: [], etapaVisibleCliente: false,
};

describe('destinatarios', () => {
  it('solicitud: va a todos los admins activos', () => {
    const admin1 = u('a1', { rol: 'admin' });
    const admin2 = u('a2', { rol: 'admin' });
    const r = destinatarios('solicitud', { ...CTX_VACIO, admins: [admin1, admin2] });
    expect(r).toEqual([admin1, admin2]);
  });

  it('solicitud: nunca incluye a actorId, aunque sea uno de los admins', () => {
    const admin1 = u('a1', { rol: 'admin' });
    const admin2 = u('a2', { rol: 'admin' });
    const r = destinatarios('solicitud', { ...CTX_VACIO, admins: [admin1, admin2], actorId: 'a1' });
    expect(r).toEqual([admin2]);
  });

  it('solicitud: descarta admins inactivos', () => {
    const activo = u('a1', { rol: 'admin' });
    const inactivo = u('a2', { rol: 'admin', activo: false });
    const r = destinatarios('solicitud', { ...CTX_VACIO, admins: [activo, inactivo] });
    expect(r).toEqual([activo]);
  });

  it('cambios_pedidos: va solo al operador asignado', () => {
    const operador = u('op1');
    const r = destinatarios('cambios_pedidos', { ...CTX_VACIO, operador, admins: [u('a1', { rol: 'admin' })] });
    expect(r).toEqual([operador]);
  });

  it('cambios_pedidos: sin operador asignado no avisa a nadie', () => {
    const r = destinatarios('cambios_pedidos', { ...CTX_VACIO, operador: null });
    expect(r).toEqual([]);
  });

  it('reabierta: va solo al operador asignado', () => {
    const operador = u('op1');
    const r = destinatarios('reabierta', { ...CTX_VACIO, operador });
    expect(r).toEqual([operador]);
  });

  it('reabierta: no incluye al actor, aunque el actor sea el propio operador', () => {
    const operador = u('op1');
    const r = destinatarios('reabierta', { ...CTX_VACIO, operador, actorId: 'op1' });
    expect(r).toEqual([]);
  });

  it('aprobada: si la etapa es visible al cliente, va al operador y a los usuarios del cliente', () => {
    const operador = u('op1');
    const c1 = u('c1', { rol: 'cliente' });
    const c2 = u('c2', { rol: 'cliente' });
    const r = destinatarios('aprobada', { ...CTX_VACIO, operador, usuariosCliente: [c1, c2], etapaVisibleCliente: true });
    expect(r).toEqual([operador, c1, c2]);
  });

  it('aprobada: si la etapa NO es visible al cliente, no avisa a los usuarios del cliente', () => {
    const operador = u('op1');
    const c1 = u('c1', { rol: 'cliente' });
    const r = destinatarios('aprobada', { ...CTX_VACIO, operador, usuariosCliente: [c1], etapaVisibleCliente: false });
    expect(r).toEqual([operador]);
  });

  it('comentario_cliente: va al operador asignado y a los admins', () => {
    const operador = u('op1');
    const admin = u('a1', { rol: 'admin' });
    const r = destinatarios('comentario_cliente', { ...CTX_VACIO, operador, admins: [admin] });
    expect(r).toEqual([operador, admin]);
  });

  it('cliente_reasignado: va solo al operador nuevo', () => {
    const nuevo = u('op2');
    const r = destinatarios('cliente_reasignado', { ...CTX_VACIO, operador: nuevo, admins: [u('a1', { rol: 'admin' })] });
    expect(r).toEqual([nuevo]);
  });

  it('entregable_generado: va solo al autor (quien lanzó el job)', () => {
    const autor = u('op1');
    const r = destinatarios('entregable_generado', { ...CTX_VACIO, autor, operador: u('op2') });
    expect(r).toEqual([autor]);
  });

  it('job_fallido: va solo al autor', () => {
    const autor = u('op1');
    const r = destinatarios('job_fallido', { ...CTX_VACIO, autor });
    expect(r).toEqual([autor]);
  });

  it('job_fallido: sin autor (job sin creado_por) no avisa a nadie', () => {
    const r = destinatarios('job_fallido', { ...CTX_VACIO, autor: null });
    expect(r).toEqual([]);
  });

  it('nunca duplica destinatarios: el mismo usuario en dos roles del contexto sale una sola vez', () => {
    const mismo = u('m1', { rol: 'admin' });
    const r = destinatarios('comentario_cliente', { ...CTX_VACIO, operador: mismo, admins: [mismo, u('a2', { rol: 'admin' })] });
    expect(r.map((x) => x.id)).toEqual(['m1', 'a2']);
  });
});

describe('textoAviso', () => {
  const datos = { cliente: 'Ana Villa', etapa: 'Mapa de pilares', autor: 'María' };

  it('solicitud: menciona el cliente y la etapa en el título', () => {
    const { titulo } = textoAviso('solicitud', datos);
    expect(titulo).toBe('Ana Villa · Mapa de pilares espera tu autorización');
  });

  it('solicitud: sin autor da un texto genérico en vez de "undefined"', () => {
    const { texto } = textoAviso('solicitud', { cliente: 'Ana Villa', etapa: 'Mapa de pilares' });
    expect(texto).not.toMatch(/undefined/);
    expect(texto).toContain('Se solicitó');
  });

  it('cambios_pedidos: título distinto al de solicitud, con cliente y etapa', () => {
    const { titulo } = textoAviso('cambios_pedidos', datos);
    expect(titulo).toContain('Ana Villa');
    expect(titulo).toContain('Mapa de pilares');
    expect(titulo).not.toBe(textoAviso('solicitud', datos).titulo);
  });

  it('aprobada: incluye al autor cuando se da', () => {
    const { texto } = textoAviso('aprobada', datos);
    expect(texto).toContain('María');
  });

  it('entregable_generado: no depende de autor (el evento no lo usa)', () => {
    const { titulo, texto } = textoAviso('entregable_generado', { cliente: 'Ana Villa', etapa: 'Investigación' });
    expect(titulo).toContain('Investigación');
    expect(texto).not.toMatch(/undefined/);
  });

  it('cada evento produce título y texto no vacíos', () => {
    const eventos = ['solicitud', 'cambios_pedidos', 'reabierta', 'aprobada', 'comentario_cliente', 'cliente_reasignado', 'entregable_generado', 'job_fallido'] as const;
    for (const evento of eventos) {
      const { titulo, texto } = textoAviso(evento, datos);
      expect(titulo.length).toBeGreaterThan(0);
      expect(texto.length).toBeGreaterThan(0);
    }
  });
});
