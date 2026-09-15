import { describe, it, expect } from 'vitest';
import {
  ETAPAS,
  ESTADOS,
  PESOS,
  NOMBRE_ETAPA,
  ESTADO_CLIENTE,
  ETIQUETA_ESTADO_ETAPA,
  tipoDocumentoDe,
  etapaDeTipo,
  avanceCliente,
  etapasVisiblesCliente,
  dependenciasCumplidas,
  aplicarAccion,
  estadoTrasGenerar,
  estadoTrasComentarioCliente,
  puedeComentar,
  type EtapaCliente,
  type Estado,
} from '@/flujo/reglas';

// Fábrica de EtapaCliente con valores por omisión razonables.
const et = (etapa: EtapaCliente['etapa'], overrides: Partial<EtapaCliente> = {}): EtapaCliente => ({
  id: `${etapa}-1`,
  etapa,
  contratada: true,
  interna: false,
  estado: 'no_iniciada',
  documentoId: null,
  ...overrides,
});

describe('constantes', () => {
  it('ETAPAS y ESTADOS traen los valores esperados en orden', () => {
    expect(ETAPAS).toEqual(['investigacion', 'pilares', 'desarrollo_mensual', 'manual_campana']);
    expect(ESTADOS).toEqual(['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada']);
  });

  it('PESOS asigna el peso correcto a cada estado', () => {
    expect(PESOS).toEqual({ no_iniciada: 0, en_proceso: 25, en_revision: 50, con_cambios: 60, aprobada: 100 });
  });

  it('NOMBRE_ETAPA trae el nombre de cada etapa', () => {
    expect(NOMBRE_ETAPA.investigacion).toBe('Investigación');
    expect(NOMBRE_ETAPA.pilares).toBe('Mapa de pilares');
    expect(NOMBRE_ETAPA.desarrollo_mensual).toBe('Desarrollo mensual');
    expect(NOMBRE_ETAPA.manual_campana).toBe('Manual de campaña');
  });

  it('ESTADO_CLIENTE traduce el estado interno a la etiqueta del cliente', () => {
    expect(ESTADO_CLIENTE.no_iniciada).toBe('Por iniciar');
    expect(ESTADO_CLIENTE.en_proceso).toBe('En preparación');
    expect(ESTADO_CLIENTE.con_cambios).toBe('En preparación');
    expect(ESTADO_CLIENTE.en_revision).toBe('En revisión');
    expect(ESTADO_CLIENTE.aprobada).toBe('Listo');
  });

  it('ETIQUETA_ESTADO_ETAPA trae la etiqueta interna de cada estado', () => {
    expect(ETIQUETA_ESTADO_ETAPA).toEqual({
      no_iniciada: 'No iniciada',
      en_proceso: 'En proceso',
      en_revision: 'En revisión',
      con_cambios: 'Con cambios',
      aprobada: 'Aprobada',
    });
  });
});

describe('tipoDocumentoDe / etapaDeTipo', () => {
  it('mapea cada etapa a su tipo de documento', () => {
    expect(tipoDocumentoDe('investigacion')).toBe('research');
    expect(tipoDocumentoDe('pilares')).toBe('pilares');
    expect(tipoDocumentoDe('manual_campana')).toBe('growth');
    expect(tipoDocumentoDe('desarrollo_mensual')).toBeNull();
  });

  it('mapea cada tipo de documento a su etapa (inverso)', () => {
    expect(etapaDeTipo('research')).toBe('investigacion');
    expect(etapaDeTipo('pilares')).toBe('pilares');
    expect(etapaDeTipo('growth')).toBe('manual_campana');
  });
});

describe('avanceCliente', () => {
  it('promedia los pesos de las etapas contratadas visibles', () => {
    const etapas = [et('investigacion', { estado: 'aprobada' }), et('pilares', { estado: 'en_revision' }), et('manual_campana', { estado: 'no_iniciada' })];
    expect(avanceCliente(etapas)).toBe(50); // (100+50+0)/3
  });

  it('no cuenta una etapa interna', () => {
    const etapas = [et('investigacion', { estado: 'aprobada', interna: true, contratada: false }), et('pilares', { estado: 'no_iniciada' })];
    expect(avanceCliente(etapas)).toBe(0);
  });

  it('no cuenta una etapa no contratada', () => {
    const etapas = [et('investigacion', { estado: 'aprobada', contratada: false }), et('pilares', { estado: 'no_iniciada' })];
    expect(avanceCliente(etapas)).toBe(0);
  });

  it('da 0 con una lista vacía', () => {
    expect(avanceCliente([])).toBe(0);
  });

  it('redondea el promedio', () => {
    const etapas = [et('investigacion', { estado: 'en_proceso' }), et('pilares', { estado: 'en_revision' })];
    // (25+50)/2 = 37.5 -> 38
    expect(avanceCliente(etapas)).toBe(38);
  });
});

describe('etapasVisiblesCliente', () => {
  it('respeta el orden de ETAPAS y excluye internas y no contratadas', () => {
    const etapas = [
      et('manual_campana'),
      et('investigacion', { interna: true }),
      et('desarrollo_mensual', { contratada: false }),
      et('pilares'),
    ];
    expect(etapasVisiblesCliente(etapas).map((e) => e.etapa)).toEqual(['pilares', 'manual_campana']);
  });

  it('da una lista vacía si no hay ninguna visible', () => {
    expect(etapasVisiblesCliente([et('investigacion', { interna: true })])).toEqual([]);
  });
});

describe('dependenciasCumplidas', () => {
  it('investigacion siempre está ok', () => {
    expect(dependenciasCumplidas('investigacion', [], false).ok).toBe(true);
  });

  it('pilares sin investigación con datos da no-ok mencionando "investigación"', () => {
    const r = dependenciasCumplidas('pilares', [et('investigacion')], false);
    expect(r.ok).toBe(false);
    expect(r.razon.toLowerCase()).toContain('investigación');
  });

  it('pilares con investigación contratada no aprobada da no-ok', () => {
    const etapas = [et('investigacion', { contratada: true, interna: false, estado: 'en_proceso' })];
    const r = dependenciasCumplidas('pilares', etapas, true);
    expect(r.ok).toBe(false);
  });

  it('pilares con investigación interna y datos da ok', () => {
    const etapas = [et('investigacion', { contratada: false, interna: true, estado: 'en_proceso' })];
    const r = dependenciasCumplidas('pilares', etapas, true);
    expect(r.ok).toBe(true);
  });

  it('pilares con investigación contratada y aprobada da ok', () => {
    const etapas = [et('investigacion', { contratada: true, interna: false, estado: 'aprobada' })];
    const r = dependenciasCumplidas('pilares', etapas, true);
    expect(r.ok).toBe(true);
  });

  it('manual_campana con pilares contratada no aprobada da no-ok', () => {
    const etapas = [
      et('investigacion', { contratada: false, interna: true, estado: 'en_proceso' }),
      et('pilares', { contratada: true, interna: false, estado: 'en_proceso' }),
    ];
    const r = dependenciasCumplidas('manual_campana', etapas, true);
    expect(r.ok).toBe(false);
  });

  it('manual_campana con pilares interna no exige que esté aprobada', () => {
    const etapas = [
      et('investigacion', { contratada: false, interna: true, estado: 'en_proceso' }),
      et('pilares', { contratada: false, interna: true, estado: 'en_proceso' }),
    ];
    const r = dependenciasCumplidas('manual_campana', etapas, true);
    expect(r.ok).toBe(true);
  });

  it('desarrollo_mensual siempre no-ok con "Próximamente"', () => {
    const r = dependenciasCumplidas('desarrollo_mensual', [], true);
    expect(r.ok).toBe(false);
    expect(r.razon).toContain('Próximamente');
  });
});

describe('aplicarAccion', () => {
  const depsOk = { ok: true, razon: '' };
  const depsNoOk = { ok: false, razon: 'Falta completar la investigación antes de continuar.' };

  it('iniciar: admin desde no_iniciada con dependencias ok pasa a en_proceso', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'no_iniciada' }),
      accion: 'iniciar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'en_proceso' });
  });

  it('iniciar: operador asignado desde no_iniciada con dependencias ok pasa a en_proceso', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'no_iniciada' }),
      accion: 'iniciar',
      rol: 'operador',
      esOperadorAsignado: true,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'en_proceso' });
  });

  it('iniciar: falla si no está en no_iniciada', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso' }),
      accion: 'iniciar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.razon).toContain('En proceso');
  });

  it('iniciar: falla si las dependencias no están cumplidas, con la razón dada', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'no_iniciada' }),
      accion: 'iniciar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsNoOk,
    });
    expect(r).toEqual({ ok: false, razon: depsNoOk.razon });
  });

  it('solicitar: desde en_proceso con documento y sin comentarios abiertos pasa a en_revision', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso', documentoId: 'doc1' }),
      accion: 'solicitar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'en_revision' });
  });

  it('solicitar: desde con_cambios también funciona', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'con_cambios', documentoId: 'doc1' }),
      accion: 'solicitar',
      rol: 'operador',
      esOperadorAsignado: true,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'en_revision' });
  });

  it('solicitar: falla sin documento', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso', documentoId: null }),
      accion: 'solicitar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Esta etapa aún no tiene documento' });
  });

  it('solicitar: falla con comentarios abiertos, y la razón los menciona', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso', documentoId: 'doc1' }),
      accion: 'solicitar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 2,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.razon).toContain('comentarios pendientes');
  });

  it('aprobar: admin desde en_revision pasa a aprobada', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'aprobar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'aprobada' });
  });

  it('aprobar: un operador asignado no puede', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'aprobar',
      rol: 'operador',
      esOperadorAsignado: true,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Solo un administrador puede aprobar' });
  });

  it('aprobar: falla si no está en en_revision', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso' }),
      accion: 'aprobar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r.ok).toBe(false);
  });

  it('pedir_cambios: admin desde en_revision con comentarios abiertos pasa a con_cambios', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'pedir_cambios',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 1,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'con_cambios' });
  });

  it('pedir_cambios: admin desde en_revision con comentario general no vacío pasa a con_cambios', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'pedir_cambios',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '  hay que ajustar el tono  ',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'con_cambios' });
  });

  it('pedir_cambios: falla sin comentarios ni comentario general', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'pedir_cambios',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '   ',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Deja al menos un comentario con los cambios' });
  });

  it('pedir_cambios: un operador no puede, aunque esté asignado', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision' }),
      accion: 'pedir_cambios',
      rol: 'operador',
      esOperadorAsignado: true,
      comentariosAbiertos: 1,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r.ok).toBe(false);
  });

  it('reabrir: admin desde aprobada con comentario pasa a con_cambios', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'aprobada' }),
      accion: 'reabrir',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: 'faltó actualizar un dato',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'con_cambios' });
  });

  it('reabrir: falla sin comentario general', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'aprobada' }),
      accion: 'reabrir',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Deja al menos un comentario con los cambios' });
  });

  it('reabrir: falla si no está en aprobada', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso' }),
      accion: 'reabrir',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: 'algo',
      dependencias: depsOk,
    });
    expect(r.ok).toBe(false);
  });

  it('un operador no asignado siempre recibe no-ok, para cualquier acción', () => {
    for (const accion of ['iniciar', 'solicitar', 'aprobar', 'pedir_cambios', 'reabrir'] as const) {
      const r = aplicarAccion({
        etapa: et('pilares', { estado: 'en_revision', documentoId: 'doc1' }),
        accion,
        rol: 'operador',
        esOperadorAsignado: false,
        comentariosAbiertos: 0,
        comentarioGeneral: 'algo',
        dependencias: depsOk,
      });
      expect(r.ok, accion).toBe(false);
      if (!r.ok) expect(r.razon).toBe('No tienes este cliente asignado');
    }
  });

  it('un cliente siempre recibe no-ok, para cualquier acción', () => {
    for (const accion of ['iniciar', 'solicitar', 'aprobar', 'pedir_cambios', 'reabrir'] as const) {
      const r = aplicarAccion({
        etapa: et('pilares', { estado: 'en_revision', documentoId: 'doc1' }),
        accion,
        rol: 'cliente',
        esOperadorAsignado: false,
        comentariosAbiertos: 0,
        comentarioGeneral: 'algo',
        dependencias: depsOk,
      });
      expect(r.ok, accion).toBe(false);
    }
  });
});

describe('estadoTrasGenerar', () => {
  it('no_iniciada pasa a en_proceso', () => {
    expect(estadoTrasGenerar('no_iniciada')).toBe('en_proceso');
  });
  it('aprobada pasa a con_cambios', () => {
    expect(estadoTrasGenerar('aprobada')).toBe('con_cambios');
  });
  it('el resto se conserva igual', () => {
    for (const estado of ['en_proceso', 'en_revision', 'con_cambios'] as Estado[]) {
      expect(estadoTrasGenerar(estado)).toBe(estado);
    }
  });
});

describe('estadoTrasComentarioCliente', () => {
  it('manual_campana aprobada pasa a con_cambios', () => {
    expect(estadoTrasComentarioCliente('manual_campana', 'aprobada')).toBe('con_cambios');
  });
  it('desarrollo_mensual aprobada pasa a con_cambios', () => {
    expect(estadoTrasComentarioCliente('desarrollo_mensual', 'aprobada')).toBe('con_cambios');
  });
  it('investigacion aprobada se conserva igual', () => {
    expect(estadoTrasComentarioCliente('investigacion', 'aprobada')).toBe('aprobada');
  });
  it('pilares aprobada se conserva igual', () => {
    expect(estadoTrasComentarioCliente('pilares', 'aprobada')).toBe('aprobada');
  });
  it('un estado que no es aprobada se conserva igual', () => {
    expect(estadoTrasComentarioCliente('manual_campana', 'en_proceso')).toBe('en_proceso');
  });
});

describe('puedeComentar', () => {
  it('admin siempre puede', () => {
    expect(puedeComentar('admin', false, 'investigacion')).toBe(true);
    expect(puedeComentar('admin', false, 'manual_campana')).toBe(true);
  });
  it('operador asignado siempre puede', () => {
    expect(puedeComentar('operador', true, 'investigacion')).toBe(true);
  });
  it('operador no asignado no puede', () => {
    expect(puedeComentar('operador', false, 'investigacion')).toBe(false);
  });
  it('cliente solo en manual_campana y desarrollo_mensual', () => {
    expect(puedeComentar('cliente', false, 'manual_campana')).toBe(true);
    expect(puedeComentar('cliente', false, 'desarrollo_mensual')).toBe(true);
    expect(puedeComentar('cliente', false, 'investigacion')).toBe(false);
    expect(puedeComentar('cliente', false, 'pilares')).toBe(false);
  });
});
