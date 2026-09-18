import { describe, it, expect } from 'vitest';
import { botonesEtapa, marcaEtapa, COLOR_ESTADO, type BotonEtapa } from '@/flujo/ui';
import type { EtapaCliente } from '@/flujo/reglas';

// Fábrica de EtapaCliente con valores por omisión razonables (igual que en tests/flujo/reglas.test.ts).
const et = (etapa: EtapaCliente['etapa'], overrides: Partial<EtapaCliente> = {}): EtapaCliente => ({
  id: `${etapa}-1`,
  etapa,
  contratada: true,
  interna: false,
  estado: 'no_iniciada',
  documentoId: null,
  ...overrides,
});

const idsDe = (botones: BotonEtapa[]) => botones.map((b) => b.id);

describe('COLOR_ESTADO', () => {
  it('trae un color por estado, en el orden gris/azul/amarillo/rosa/verde', () => {
    expect(COLOR_ESTADO).toEqual({
      no_iniciada: 'gris', en_proceso: 'azul', en_revision: 'amarillo', con_cambios: 'rosa', aprobada: 'verde',
    });
  });
});

describe('marcaEtapa', () => {
  it('marca "interna" cuando la etapa es interna', () => {
    expect(marcaEtapa({ contratada: false, interna: true })).toBe('interna');
  });
  it('marca "no_contratada" cuando no está contratada ni es interna', () => {
    expect(marcaEtapa({ contratada: false, interna: false })).toBe('no_contratada');
  });
  it('no trae marca cuando está contratada y no es interna', () => {
    expect(marcaEtapa({ contratada: true, interna: false })).toBeNull();
  });
});

describe('botonesEtapa', () => {
  it('desarrollo_mensual nunca trae botones (tarjeta «Próximamente»)', () => {
    const botones = botonesEtapa({
      etapa: et('desarrollo_mensual'), rol: 'admin', esOperadorAsignado: false,
      comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente: [],
    });
    expect(botones).toEqual([]);
  });

  it('investigacion no_iniciada: admin ve Generar e Iniciar, no Ver ni el resto', () => {
    const etapasCliente = [et('investigacion')];
    const botones = botonesEtapa({
      etapa: et('investigacion'), rol: 'admin', esOperadorAsignado: false,
      comentariosAbiertos: 0, hayInvestigacionConDatos: false, etapasCliente,
    });
    expect(idsDe(botones)).toEqual(['generar', 'iniciar']);
  });

  it('pilares sin investigación con datos: ni Generar ni Iniciar (dependencias no cumplidas)', () => {
    const etapasCliente = [et('investigacion'), et('pilares')];
    const botones = botonesEtapa({
      etapa: et('pilares'), rol: 'admin', esOperadorAsignado: false,
      comentariosAbiertos: 0, hayInvestigacionConDatos: false, etapasCliente,
    });
    expect(idsDe(botones)).toEqual([]);
  });

  it('pilares y manual con la investigación con datos pero sin aprobar: se pueden trabajar ya (diseño 2026-09-16 §1)', () => {
    const etapasCliente = [
      et('investigacion', { estado: 'en_proceso' }),
      et('pilares'),
      et('manual_campana'),
    ];
    for (const etapa of [et('pilares'), et('manual_campana')]) {
      const botones = botonesEtapa({
        etapa, rol: 'admin', esOperadorAsignado: false,
        comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente,
      });
      expect(idsDe(botones)).toEqual(['generar', 'iniciar']);
    }
  });

  it('en_revision: el admin ve Aprobar y Pedir cambios; el operador (asignado) no ve ninguno de los dos', () => {
    const etapa = et('investigacion', { estado: 'en_revision', documentoId: 'doc-1' });
    const etapasCliente = [etapa];

    const botonesAdmin = botonesEtapa({
      etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 1, hayInvestigacionConDatos: true, etapasCliente,
    });
    expect(idsDe(botonesAdmin)).toEqual(expect.arrayContaining(['ver', 'aprobar', 'pedir_cambios']));

    const botonesOperador = botonesEtapa({
      etapa, rol: 'operador', esOperadorAsignado: true, comentariosAbiertos: 1, hayInvestigacionConDatos: true, etapasCliente,
    });
    expect(idsDe(botonesOperador)).not.toContain('aprobar');
    expect(idsDe(botonesOperador)).not.toContain('pedir_cambios');
    expect(idsDe(botonesOperador)).toContain('ver');
  });

  it('operador no asignado: no ve ningún botón de acción (solo lo que no depende del rol)', () => {
    const etapa = et('investigacion', { estado: 'no_iniciada' });
    const botones = botonesEtapa({
      etapa, rol: 'operador', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: false, etapasCliente: [etapa],
    });
    // «Generar» no pasa por aplicarAccion (no depende del rol); «Iniciar» sí y se bloquea.
    expect(idsDe(botones)).toEqual(['generar']);
  });

  // Desde la autorización en un paso, «Solicitar» es solo del operador: el admin ve «Autorizar».
  it('solicitar (operador): habilitado cuando no hay comentarios abiertos y hay documento', () => {
    const etapa = et('investigacion', { estado: 'en_proceso', documentoId: 'doc-1' });
    const botones = botonesEtapa({
      etapa, rol: 'operador', esOperadorAsignado: true, comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente: [etapa],
    });
    const solicitar = botones.find((b) => b.id === 'solicitar');
    expect(solicitar).toEqual({ id: 'solicitar', disabled: false, razon: '' });
  });

  it('solicitar (operador): bloqueado solo por comentarios abiertos → se muestra deshabilitado con la razón, no se oculta', () => {
    const etapa = et('investigacion', { estado: 'en_proceso', documentoId: 'doc-1' });
    const botones = botonesEtapa({
      etapa, rol: 'operador', esOperadorAsignado: true, comentariosAbiertos: 2, hayInvestigacionConDatos: true, etapasCliente: [etapa],
    });
    const solicitar = botones.find((b) => b.id === 'solicitar');
    expect(solicitar).toMatchObject({ id: 'solicitar', disabled: true });
    expect((solicitar as { razon: string }).razon).toBe('Primero hay que resolver los comentarios pendientes');
  });

  it('solicitar: bloqueado por estado (no en_proceso/con_cambios) → no aparece ni habilitado ni deshabilitado', () => {
    const etapa = et('investigacion', { estado: 'no_iniciada' });
    const botones = botonesEtapa({
      etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente: [etapa],
    });
    expect(botones.find((b) => b.id === 'solicitar')).toBeUndefined();
  });

  it('aprobada: el admin ve Reabrir; en manual_campana/desarrollo_mensual el estado seguiría siendo aprobada, pero aquí solo se prueba manual_campana', () => {
    const investigacion = et('investigacion', { estado: 'aprobada', documentoId: 'doc-inv' });
    const pilares = et('pilares', { estado: 'aprobada', documentoId: 'doc-pil' });
    const manual = et('manual_campana', { estado: 'aprobada', documentoId: 'doc-man' });
    const etapasCliente = [investigacion, pilares, manual];

    const botones = botonesEtapa({
      etapa: manual, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente,
    });
    expect(idsDe(botones)).toEqual(expect.arrayContaining(['ver', 'reabrir', 'generar']));
    expect(idsDe(botones)).not.toContain('iniciar');
    expect(idsDe(botones)).not.toContain('aprobar');
  });

  it('pedir_cambios: requiereComentario es true cuando no hay comentarios abiertos, false cuando sí los hay', () => {
    const etapa = et('investigacion', { estado: 'en_revision', documentoId: 'doc-1' });

    const sinAbiertos = botonesEtapa({
      etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente: [etapa],
    }).find((b) => b.id === 'pedir_cambios');
    expect(sinAbiertos).toEqual({ id: 'pedir_cambios', requiereComentario: true });

    const conAbiertos = botonesEtapa({
      etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 3, hayInvestigacionConDatos: true, etapasCliente: [etapa],
    }).find((b) => b.id === 'pedir_cambios');
    expect(conAbiertos).toEqual({ id: 'pedir_cambios', requiereComentario: false });
  });

  describe('autorización en un paso', () => {
    const base = { esOperadorAsignado: true, hayInvestigacionConDatos: true };

    it('admin en en_proceso o con_cambios con documento: ve «Autorizar» habilitado y NO «Solicitar autorización»', () => {
      for (const estado of ['en_proceso', 'con_cambios'] as const) {
        const etapa = et('pilares', { estado, documentoId: 'doc-1' });
        const botones = botonesEtapa({ ...base, etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, etapasCliente: [etapa] });
        expect(botones.find((b) => b.id === 'aprobar'), estado).toEqual({ id: 'aprobar', disabled: false, razon: '' });
        expect(idsDe(botones), estado).not.toContain('solicitar');
      }
    });

    it('operador asignado en en_proceso/con_cambios: sigue viendo «Solicitar autorización» y no «Autorizar»', () => {
      for (const estado of ['en_proceso', 'con_cambios'] as const) {
        const etapa = et('pilares', { estado, documentoId: 'doc-1' });
        const botones = botonesEtapa({ ...base, etapa, rol: 'operador', comentariosAbiertos: 0, etapasCliente: [etapa] });
        expect(botones.find((b) => b.id === 'solicitar'), estado).toEqual({ id: 'solicitar', disabled: false, razon: '' });
        expect(idsDe(botones), estado).not.toContain('aprobar');
      }
    });

    it('operador con comentarios abiertos: igual que antes, «Solicitar» deshabilitado con la razón', () => {
      const etapa = et('pilares', { estado: 'en_proceso', documentoId: 'doc-1' });
      const botones = botonesEtapa({ ...base, etapa, rol: 'operador', comentariosAbiertos: 2, etapasCliente: [etapa] });
      expect(botones.find((b) => b.id === 'solicitar')).toMatchObject({ id: 'solicitar', disabled: true });
      expect(idsDe(botones)).not.toContain('aprobar');
    });

    it('admin sin documento: no ve «Autorizar» (ni «Solicitar»)', () => {
      const etapa = et('pilares', { estado: 'en_proceso', documentoId: null });
      const botones = botonesEtapa({ ...base, etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, etapasCliente: [etapa] });
      expect(idsDe(botones)).not.toContain('aprobar');
      expect(idsDe(botones)).not.toContain('solicitar');
    });

    it('admin con comentarios abiertos: «Autorizar» aparece deshabilitado con la razón (no autoriza, pero no parece que falte)', () => {
      const etapa = et('pilares', { estado: 'con_cambios', documentoId: 'doc-1' });
      const botones = botonesEtapa({ ...base, etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 1, etapasCliente: [etapa] });
      expect(botones.find((b) => b.id === 'aprobar')).toEqual({
        id: 'aprobar', disabled: true, razon: 'Primero hay que resolver los comentarios pendientes',
      });
      expect(idsDe(botones)).not.toContain('solicitar');
    });

    it('admin en en_revision: «Autorizar» habilitado aunque haya comentarios abiertos (como hasta ahora)', () => {
      const etapa = et('pilares', { estado: 'en_revision', documentoId: 'doc-1' });
      const botones = botonesEtapa({ ...base, etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 2, etapasCliente: [etapa] });
      expect(botones.find((b) => b.id === 'aprobar')).toEqual({ id: 'aprobar', disabled: false, razon: '' });
    });

    it('desarrollo_mensual sigue sin botones en cualquier estado, también para el admin', () => {
      for (const estado of ['en_proceso', 'con_cambios', 'en_revision'] as const) {
        const etapa = et('desarrollo_mensual', { estado, documentoId: 'doc-1' });
        expect(botonesEtapa({ ...base, etapa, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, etapasCliente: [etapa] }), estado).toEqual([]);
      }
    });
  });

  it('ver: aparece si y solo si hay documentoId, sin importar el estado', () => {
    const conDoc = et('investigacion', { estado: 'no_iniciada', documentoId: 'doc-1' });
    const sinDoc = et('investigacion', { estado: 'no_iniciada', documentoId: null });
    expect(idsDe(botonesEtapa({ etapa: conDoc, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: false, etapasCliente: [conDoc] }))).toContain('ver');
    expect(idsDe(botonesEtapa({ etapa: sinDoc, rol: 'admin', esOperadorAsignado: false, comentariosAbiertos: 0, hayInvestigacionConDatos: false, etapasCliente: [sinDoc] }))).not.toContain('ver');
  });
});
