import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUESTOS, PUESTOS_POR_ETAPA, NOMBRE_PUESTO, ETAPAS, aplicarAccion, puedeComentar, type EtapaCliente } from '@/flujo/reglas';
import { botonesEtapa } from '@/flujo/ui';
import { puedeEditar } from '@/flujo/edicion';

/**
 * Responsables por etapa (rediseño de puestos). Reglas puras por un lado y
 * `asignarResponsable` con la base simulada por otro: nadie asigna un
 * strategist a `pilares`, desarrollo mensual admite dos responsables a la vez
 * (contenido y diseño) y el mismo usuario nunca queda dos veces en una etapa.
 */
const espia = vi.hoisted(() => ({
  usuario: null as Record<string, unknown> | null,
  borrados: [] as unknown[],
  insertados: [] as Record<string, unknown>[],
  transacciones: 0,
}));

vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  const ejecutor = {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(espia.usuario ? [espia.usuario] : []) }) }) }),
    delete: () => ({ where: (c: unknown) => { espia.borrados.push(c); return Promise.resolve(); } }),
    insert: () => ({ values: (v: Record<string, unknown>) => { espia.insertados.push(v); return Promise.resolve(); } }),
  };
  return { ...real, db: { ...ejecutor, transaction: async (fn: (tx: unknown) => unknown) => { espia.transacciones++; return fn(ejecutor); } } };
});

const { asignarResponsable, puestoValidoParaEtapa } = await import('@/flujo/responsables');

beforeEach(() => { espia.usuario = null; espia.borrados = []; espia.insertados = []; espia.transacciones = 0; });

describe('puestos por etapa', () => {
  it('cinco puestos con su nombre visible en español', () => {
    expect([...PUESTOS]).toEqual(['strategist', 'content_creator', 'contenido', 'diseno', 'trafficker']);
    expect(NOMBRE_PUESTO).toEqual({
      strategist: 'Strategist', content_creator: 'Content Creator', contenido: 'Contenido', diseno: 'Diseño', trafficker: 'Trafficker',
    });
  });

  it('cada etapa tiene sus puestos; desarrollo mensual tiene dos a la vez', () => {
    expect(PUESTOS_POR_ETAPA).toEqual({
      investigacion: ['strategist'], pilares: ['content_creator'],
      desarrollo_mensual: ['contenido', 'diseno'], manual_campana: ['trafficker'],
    });
    // Todos los puestos responden por alguna etapa, y ninguna etapa queda sin puesto.
    expect(new Set(Object.values(PUESTOS_POR_ETAPA).flat())).toEqual(new Set(PUESTOS));
    for (const e of ETAPAS) expect(PUESTOS_POR_ETAPA[e].length).toBeGreaterThan(0);
  });

  it('puestoValidoParaEtapa: nadie asigna un strategist a pilares', () => {
    expect(puestoValidoParaEtapa('pilares', 'strategist')).toBe(false);
    expect(puestoValidoParaEtapa('pilares', 'content_creator')).toBe(true);
    expect(puestoValidoParaEtapa('desarrollo_mensual', 'diseno')).toBe(true);
    expect(puestoValidoParaEtapa('desarrollo_mensual', 'trafficker')).toBe(false);
  });
});

describe('asignarResponsable', () => {
  const base = { etapaId: 'e1', asignadoPor: 'admin-1' };
  const operador = (puesto: string, extra: Record<string, unknown> = {}) => ({ id: 'u1', rol: 'operador', puesto, activo: true, ...extra });

  it('rechaza un puesto que no corresponde a la etapa, sin tocar la base', async () => {
    espia.usuario = operador('strategist');
    const r = await asignarResponsable({ ...base, etapa: 'pilares', puesto: 'strategist', usuarioId: 'u1' });
    expect(r.ok).toBe(false);
    expect(espia.transacciones).toBe(0);
    expect(espia.insertados).toEqual([]);
  });

  it('rechaza a alguien de otro puesto, inactivo, que no es operador o que no existe', async () => {
    for (const u of [operador('diseno'), operador('content_creator', { activo: false }), operador('content_creator', { rol: 'admin' }), null]) {
      espia.usuario = u;
      const r = await asignarResponsable({ ...base, etapa: 'pilares', puesto: 'content_creator', usuarioId: 'u1' });
      expect(r.ok).toBe(false);
    }
    expect(espia.insertados).toEqual([]);
  });

  it('asigna en una transacción: quita al anterior de ese puesto e inserta al nuevo con quién asignó', async () => {
    espia.usuario = operador('content_creator');
    const r = await asignarResponsable({ ...base, etapa: 'pilares', puesto: 'content_creator', usuarioId: 'u1' });
    expect(r).toEqual({ ok: true });
    expect(espia.transacciones).toBe(1);
    expect(espia.borrados).toHaveLength(1);
    expect(espia.insertados).toEqual([{ etapaId: 'e1', usuarioId: 'u1', puesto: 'content_creator', asignadoPor: 'admin-1' }]);
  });

  it('desarrollo mensual admite contenido y diseño a la vez (dos asignaciones independientes)', async () => {
    espia.usuario = operador('contenido', { id: 'u-contenido' });
    expect((await asignarResponsable({ ...base, etapa: 'desarrollo_mensual', puesto: 'contenido', usuarioId: 'u-contenido' })).ok).toBe(true);
    espia.usuario = operador('diseno', { id: 'u-diseno' });
    expect((await asignarResponsable({ ...base, etapa: 'desarrollo_mensual', puesto: 'diseno', usuarioId: 'u-diseno' })).ok).toBe(true);
    expect(espia.insertados.map((i) => i.puesto)).toEqual(['contenido', 'diseno']);
  });

  it('usuarioId null quita al responsable de ese puesto y nada más', async () => {
    const r = await asignarResponsable({ ...base, etapa: 'manual_campana', puesto: 'trafficker', usuarioId: null });
    expect(r).toEqual({ ok: true });
    expect(espia.borrados).toHaveLength(1);
    expect(espia.insertados).toEqual([]);
  });
});

describe('«asignado» es por etapa: aplicarAccion, botones, comentar y editar', () => {
  const etapa = (nombre: EtapaCliente['etapa'], estado: EtapaCliente['estado'] = 'en_proceso'): EtapaCliente =>
    ({ id: 'e', etapa: nombre, contratada: true, interna: false, estado, documentoId: 'd' });
  const dep = { ok: true, razon: '' };
  const solicitar = (asignado: boolean, rol: 'operador' | 'admin' = 'operador') => aplicarAccion({
    etapa: etapa('pilares'), accion: 'solicitar', rol, esOperadorAsignado: asignado, comentariosAbiertos: 0, comentarioGeneral: '', dependencias: dep,
  });

  it('un operador que no es responsable de la etapa no puede solicitar autorización', () => {
    const r = solicitar(false);
    expect(r).toEqual({ ok: false, razon: 'No eres responsable de esta etapa' });
  });

  it('el responsable sí; y el admin no depende de la asignación', () => {
    expect(solicitar(true)).toEqual({ ok: true, nuevo: 'en_revision' });
    expect(solicitar(false, 'admin')).toEqual({ ok: true, nuevo: 'en_revision' });
  });

  it('la autorización sigue siendo solo del admin, sea quien sea el responsable', () => {
    for (const accion of ['aprobar', 'pedir_cambios', 'reabrir'] as const) {
      const r = aplicarAccion({ etapa: etapa('pilares', accion === 'aprobar' ? 'en_revision' : accion === 'reabrir' ? 'aprobada' : 'en_revision'), accion, rol: 'operador', esOperadorAsignado: true, comentariosAbiertos: 1, comentarioGeneral: 'x', dependencias: dep });
      expect(r.ok).toBe(false);
    }
  });

  it('botonesEtapa: ver todo no es poder actuar; el responsable ve «Solicitar autorización»', () => {
    const args = { etapa: etapa('pilares'), rol: 'operador' as const, comentariosAbiertos: 0, hayInvestigacionConDatos: true, etapasCliente: [etapa('pilares')] };
    expect(botonesEtapa({ ...args, esOperadorAsignado: false }).some((b) => b.id === 'solicitar')).toBe(false);
    expect(botonesEtapa({ ...args, esOperadorAsignado: true }).some((b) => b.id === 'solicitar')).toBe(true);
  });

  it('comentar y editar también dependen de ser responsable de ESA etapa', () => {
    expect(puedeComentar('operador', false, 'pilares')).toBe(false);
    expect(puedeComentar('operador', true, 'pilares')).toBe(true);
    expect(puedeEditar('operador', false, 'en_proceso')).toBe(false);
    expect(puedeEditar('operador', true, 'en_proceso')).toBe(true);
    expect(puedeEditar('admin', false, 'en_proceso')).toBe(true);
  });
});
