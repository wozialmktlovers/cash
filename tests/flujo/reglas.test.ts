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
  puedeGenerar,
  cambiosContratacionRiesgosos,
  puedeCompartir,
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

  // A3: desarrollo_mensual entra al promedio como una etapa más. La exclusión
  // del ruling del controller (menores, punto 5) existía solo mientras la
  // etapa no tuviera generador y su estado no pudiera moverse de
  // `no_iniciada`; con el lote mensual sí se mueve, así que esconderla sería
  // ocultar una cuarta parte de lo contratado.
  it('cuenta una etapa desarrollo_mensual contratada como cualquier otra', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
      et('manual_campana', { estado: 'aprobada' }),
      et('desarrollo_mensual', { estado: 'no_iniciada' }),
    ];
    // (100+100+100+0)/4 = 75. Con la exclusión de antes daba 100: el cliente
    // veía «listo» un mes de contenido que nadie había empezado.
    expect(avanceCliente(etapas)).toBe(75);
  });

  it('el lote del mes mueve el avance: el mismo cliente con el mes en revisión sube', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
      et('manual_campana', { estado: 'aprobada' }),
      et('desarrollo_mensual', { estado: 'en_revision' }),
    ];
    // (100+100+100+50)/4 = 87.5 -> 88. Antes daba 100 pasara lo que pasara.
    expect(avanceCliente(etapas)).toBe(88);
  });

  it('con solo desarrollo_mensual contratada, su estado es todo el avance', () => {
    expect(avanceCliente([et('desarrollo_mensual', { estado: 'no_iniciada' })])).toBe(0);
    expect(avanceCliente([et('desarrollo_mensual', { estado: 'en_proceso' })])).toBe(25);
    expect(avanceCliente([et('desarrollo_mensual', { estado: 'aprobada' })])).toBe(100);
  });

  // El caso que pidió el controlador al revisar A3, escrito como prueba para
  // que el cambio de número quede fijado y no se «arregle» de vuelta.
  it('cuatro etapas contratadas y dos aprobadas dan 50, no 67', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
      et('desarrollo_mensual', { estado: 'no_iniciada' }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ];
    expect(avanceCliente(etapas)).toBe(50);
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

// Diseño 2026-09-16 §1: lo único que se exige para cualquier etapa distinta
// de `investigacion` es que haya una investigación CON DATOS. Las dos reglas
// viejas —investigación contratada aprobada, y mapa de pilares aprobado antes
// del manual— se quitaron: aprobar es control de calidad, no una puerta.
describe('dependenciasCumplidas', () => {
  it('investigacion siempre está ok', () => {
    expect(dependenciasCumplidas('investigacion', [], false).ok).toBe(true);
  });

  it('sin investigación con datos no se puede ni pilares ni manual_campana', () => {
    for (const etapa of ['pilares', 'manual_campana'] as const) {
      const r = dependenciasCumplidas(etapa, [et('investigacion'), et('pilares')], false);
      expect(r.ok).toBe(false);
      expect(r.razon.toLowerCase()).toContain('investigación');
    }
  });

  it('con investigación con datos pero SIN aprobar se puede pilares Y manual_campana', () => {
    const etapas = [
      et('investigacion', { contratada: true, interna: false, estado: 'en_proceso' }),
      et('pilares', { contratada: true, interna: false, estado: 'no_iniciada' }),
      et('manual_campana', { contratada: true, interna: false, estado: 'no_iniciada' }),
    ];
    expect(dependenciasCumplidas('pilares', etapas, true)).toEqual({ ok: true, razon: '' });
    expect(dependenciasCumplidas('manual_campana', etapas, true)).toEqual({ ok: true, razon: '' });
  });

  it('el manual no espera al mapa de pilares: con pilares contratada y en proceso, sigue ok', () => {
    const etapas = [
      et('investigacion', { contratada: true, interna: false, estado: 'en_revision' }),
      et('pilares', { contratada: true, interna: false, estado: 'en_proceso' }),
    ];
    expect(dependenciasCumplidas('manual_campana', etapas, true).ok).toBe(true);
  });

  it('da igual que la investigación sea interna o contratada: solo cuentan los datos', () => {
    const interna = [et('investigacion', { contratada: false, interna: true, estado: 'en_proceso' })];
    const contratada = [et('investigacion', { contratada: true, interna: false, estado: 'aprobada' })];
    expect(dependenciasCumplidas('pilares', interna, true).ok).toBe(true);
    expect(dependenciasCumplidas('pilares', contratada, true).ok).toBe(true);
    expect(dependenciasCumplidas('pilares', interna, false).ok).toBe(false);
    expect(dependenciasCumplidas('pilares', contratada, false).ok).toBe(false);
  });

  // A3: se cae el bloqueo «Próximamente». La etapa entra por la misma puerta
  // que pilares y el manual — ni más (no espera a que nadie apruebe) ni menos
  // (sin investigación con datos no hay de dónde sacar temas ni copy).
  it('desarrollo_mensual solo pide investigación con datos, como pilares y el manual', () => {
    const etapas = [
      et('investigacion', { estado: 'aprobada' }),
      et('pilares', { estado: 'aprobada' }),
    ];
    for (const lista of [[], etapas]) {
      expect(dependenciasCumplidas('desarrollo_mensual', lista, true)).toEqual({ ok: true, razon: '' });
    }
  });

  it('desarrollo_mensual sin investigación con datos: bloqueada por la misma razón que las otras', () => {
    const r = dependenciasCumplidas('desarrollo_mensual', [], false);
    expect(r.ok).toBe(false);
    expect(r.razon).toBe(dependenciasCumplidas('pilares', [], false).razon);
    expect(r.razon).not.toContain('Próximamente');
  });
});

describe('puedeGenerar (I1 punto 1: 409 de POST /api/jobs)', () => {
  it('etapa contratada, no_iniciada, sin dependencias que exigir: ok', () => {
    const etapas = [et('investigacion', { estado: 'no_iniciada' })];
    expect(puedeGenerar('investigacion', etapas, true).ok).toBe(true);
  });

  it('etapa ni contratada ni interna: no-ok', () => {
    const etapas = [et('pilares', { contratada: false, interna: false, estado: 'no_iniciada' })];
    const r = puedeGenerar('pilares', etapas, true);
    expect(r.ok).toBe(false);
    expect(r.razon.toLowerCase()).toContain('contratada');
  });

  it('etapa interna (no contratada) igual deja generar: alimenta a otra etapa', () => {
    const etapas = [et('investigacion', { contratada: false, interna: true, estado: 'no_iniciada' })];
    expect(puedeGenerar('investigacion', etapas, true).ok).toBe(true);
  });

  it('etapa en_revision: no-ok, no se puede reemplazar el documento que el admin revisa', () => {
    const etapas = [et('investigacion', { estado: 'en_revision' })];
    const r = puedeGenerar('investigacion', etapas, true);
    expect(r.ok).toBe(false);
    expect(r.razon.toLowerCase()).toContain('revisión');
  });

  it('etapa aprobada: no-ok, hay que reabrirla primero', () => {
    const etapas = [et('investigacion', { estado: 'aprobada' })];
    const r = puedeGenerar('investigacion', etapas, true);
    expect(r.ok).toBe(false);
    expect(r.razon.toLowerCase()).toContain('reabr');
  });

  it('etapa en_proceso o con_cambios: ok (regenerar es el caso normal)', () => {
    expect(puedeGenerar('investigacion', [et('investigacion', { estado: 'en_proceso' })], true).ok).toBe(true);
    expect(puedeGenerar('investigacion', [et('investigacion', { estado: 'con_cambios' })], true).ok).toBe(true);
  });

  it('dependencias no cumplidas: no-ok con la razón de dependenciasCumplidas', () => {
    const etapas = [et('pilares', { estado: 'no_iniciada' })];
    const r = puedeGenerar('pilares', etapas, false);
    expect(r.ok).toBe(false);
    expect(r.razon.toLowerCase()).toContain('investigación');
  });

  it('la etapa no existe en la lista: no-ok, no revienta', () => {
    const r = puedeGenerar('pilares', [], true);
    expect(r.ok).toBe(false);
  });

  it('pilares y manual con la investigación con datos pero sin aprobar: ok (la aprobación ya no es puerta)', () => {
    const etapas = [
      et('investigacion', { estado: 'en_proceso' }),
      et('pilares', { estado: 'no_iniciada' }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ];
    expect(puedeGenerar('pilares', etapas, true).ok).toBe(true);
    expect(puedeGenerar('manual_campana', etapas, true).ok).toBe(true);
  });

  it('sin investigación con datos: ni pilares ni manual se pueden generar', () => {
    const etapas = [
      et('investigacion', { estado: 'en_proceso' }),
      et('pilares', { estado: 'no_iniciada' }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ];
    expect(puedeGenerar('pilares', etapas, false).ok).toBe(false);
    expect(puedeGenerar('manual_campana', etapas, false).ok).toBe(false);
  });

  it('las reglas de la etapa misma no cambian: en_revision y aprobada siguen sin poder regenerarse', () => {
    // Aflojar las dependencias no toca estos dos bloqueos, que son sobre la
    // etapa y no sobre sus dependencias.
    const investigacion = et('investigacion', { estado: 'en_proceso' });
    for (const estado of ['en_revision', 'aprobada'] as const) {
      const r = puedeGenerar('pilares', [investigacion, et('pilares', { estado })], true);
      expect(r.ok).toBe(false);
    }
  });

  // `puedeGenerar` solo lo consulta POST /api/jobs, cuyo `tipo` únicamente
  // puede ser research/growth/pilares: desarrollo_mensual no llega ahí ni
  // tiene job que encolar (`tipoDocumentoDe` da null). Se prueba igual porque
  // la función es pública y hasta A3 contestaba «Próximamente».
  it('desarrollo_mensual contratada, con investigación con datos: ok', () => {
    const etapas = [et('investigacion', { estado: 'aprobada' }), et('desarrollo_mensual')];
    expect(puedeGenerar('desarrollo_mensual', etapas, true)).toEqual({ ok: true, razon: '' });
  });

  it('desarrollo_mensual sin investigación con datos: no-ok, sin hablar de «Próximamente»', () => {
    const etapas = [et('investigacion', { estado: 'en_proceso' }), et('desarrollo_mensual')];
    const r = puedeGenerar('desarrollo_mensual', etapas, false);
    expect(r.ok).toBe(false);
    expect(r.razon).not.toContain('Próximamente');
  });
});

describe('cambiosContratacionRiesgosos (I1 punto 3: qué no puede hacer un operador)', () => {
  const plan = (over: Partial<{ etapa: EtapaCliente['etapa']; contratada: boolean; interna: boolean }>[]) =>
    over.map((o) => ({ etapa: o.etapa!, contratada: o.contratada ?? false, interna: o.interna ?? false }));

  it('sin cambios de contratación ni de interna: sin riesgos', () => {
    const actuales = [et('pilares', { contratada: true, interna: false, estado: 'en_proceso' })];
    const p = plan([{ etapa: 'pilares', contratada: true, interna: false }]);
    expect(cambiosContratacionRiesgosos(actuales, p)).toEqual([]);
  });

  it('descontratar una etapa no_iniciada: sin riesgo', () => {
    const actuales = [et('pilares', { contratada: true, interna: false, estado: 'no_iniciada' })];
    const p = plan([{ etapa: 'pilares', contratada: false, interna: false }]);
    expect(cambiosContratacionRiesgosos(actuales, p)).toEqual([]);
  });

  it('descontratar una etapa en_proceso: riesgo', () => {
    const actuales = [et('pilares', { contratada: true, interna: false, estado: 'en_proceso' })];
    const p = plan([{ etapa: 'pilares', contratada: false, interna: false }]);
    const r = cambiosContratacionRiesgosos(actuales, p);
    expect(r).toHaveLength(1);
    expect(r[0].etapa).toBe('pilares');
  });

  it('descontratar una etapa aprobada: riesgo', () => {
    const actuales = [et('manual_campana', { contratada: true, interna: false, estado: 'aprobada' })];
    const p = plan([{ etapa: 'manual_campana', contratada: false, interna: false }]);
    expect(cambiosContratacionRiesgosos(actuales, p)).toHaveLength(1);
  });

  it('volver interna una investigación aprobada y visible: riesgo (con versionAprobadaId)', () => {
    const actuales = [{ ...et('investigacion', { contratada: true, interna: false, estado: 'aprobada' }), versionAprobadaId: 'v1' }];
    const p = plan([{ etapa: 'investigacion', contratada: false, interna: true }]);
    const r = cambiosContratacionRiesgosos(actuales, p);
    expect(r).toHaveLength(1);
    expect(r[0].razon.toLowerCase()).toContain('aprobada');
  });

  it('volver interna una investigación sin versión aprobada: sin riesgo si además está no_iniciada', () => {
    const actuales = [{ ...et('investigacion', { contratada: true, interna: false, estado: 'no_iniciada' }), versionAprobadaId: null }];
    const p = plan([{ etapa: 'investigacion', contratada: false, interna: true }]);
    expect(cambiosContratacionRiesgosos(actuales, p)).toEqual([]);
  });

  it('una etapa que ya era interna y sigue interna: sin riesgo', () => {
    const actuales = [{ ...et('investigacion', { contratada: false, interna: true, estado: 'en_proceso' }), versionAprobadaId: null }];
    const p = plan([{ etapa: 'investigacion', contratada: false, interna: true }]);
    expect(cambiosContratacionRiesgosos(actuales, p)).toEqual([]);
  });

  it('una etapa que no aparece en las actuales no revienta', () => {
    const p = plan([{ etapa: 'pilares', contratada: false, interna: false }]);
    expect(cambiosContratacionRiesgosos([], p)).toEqual([]);
  });

  it('varias etapas riesgosas devuelven una entrada por cada una', () => {
    const actuales = [
      et('pilares', { contratada: true, interna: false, estado: 'con_cambios' }),
      et('manual_campana', { contratada: true, interna: false, estado: 'en_revision' }),
    ];
    const p = plan([
      { etapa: 'pilares', contratada: false, interna: false },
      { etapa: 'manual_campana', contratada: false, interna: false },
    ]);
    expect(cambiosContratacionRiesgosos(actuales, p).map((r) => r.etapa).sort()).toEqual(['manual_campana', 'pilares']);
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

  it('aprobar: falla desde no_iniciada o aprobada', () => {
    for (const estado of ['no_iniciada', 'aprobada'] as const) {
      const r = aplicarAccion({
        etapa: et('pilares', { estado, documentoId: 'doc1' }),
        accion: 'aprobar',
        rol: 'admin',
        esOperadorAsignado: false,
        comentariosAbiertos: 0,
        comentarioGeneral: '',
        dependencias: depsOk,
      });
      expect(r.ok, estado).toBe(false);
    }
  });

  it('aprobar (autorización en un paso): admin desde en_proceso o con_cambios, con documento y sin comentarios abiertos, pasa a aprobada', () => {
    for (const estado of ['en_proceso', 'con_cambios'] as const) {
      const r = aplicarAccion({
        etapa: et('pilares', { estado, documentoId: 'doc1' }),
        accion: 'aprobar',
        rol: 'admin',
        esOperadorAsignado: false,
        comentariosAbiertos: 0,
        comentarioGeneral: '',
        dependencias: depsOk,
      });
      expect(r, estado).toEqual({ ok: true, nuevo: 'aprobada' });
    }
  });

  it('aprobar (autorización en un paso): el admin no puede sin documento', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso', documentoId: null }),
      accion: 'aprobar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Esta etapa aún no tiene documento' });
  });

  it('aprobar (autorización en un paso): el admin no puede con comentarios abiertos', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'con_cambios', documentoId: 'doc1' }),
      accion: 'aprobar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 1,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Primero hay que resolver los comentarios pendientes' });
  });

  it('aprobar (autorización en un paso): un operador asignado sigue sin poder, ni desde en_proceso', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_proceso', documentoId: 'doc1' }),
      accion: 'aprobar',
      rol: 'operador',
      esOperadorAsignado: true,
      comentariosAbiertos: 0,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: false, razon: 'Solo un administrador puede aprobar' });
  });

  it('aprobar desde en_revision no cambia: no exige documento ni cero comentarios abiertos', () => {
    const r = aplicarAccion({
      etapa: et('pilares', { estado: 'en_revision', documentoId: null }),
      accion: 'aprobar',
      rol: 'admin',
      esOperadorAsignado: false,
      comentariosAbiertos: 3,
      comentarioGeneral: '',
      dependencias: depsOk,
    });
    expect(r).toEqual({ ok: true, nuevo: 'aprobada' });
  });

  it('aprobar: falla desde en_proceso sin documento (antes: por estado; ahora: por documento)', () => {
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

describe('puedeCompartir (M2 punto 1: link público solo de lo aprobado)', () => {
  const doc = { tipo: 'research' as const, documentoId: 'doc-1' };
  const etapaAprobada = { estado: 'aprobada' as Estado, documentoTipo: 'research' as const, documentoId: 'doc-1' };
  const versionDelDoc = { documentoTipo: 'research' as const, documentoId: 'doc-1' };

  it('admin siempre puede, aunque sea un borrador o no haya etapa', () => {
    expect(puedeCompartir({ rol: 'admin', ...doc, etapa: null, versionAprobada: null }).ok).toBe(true);
    expect(puedeCompartir({ rol: 'admin', ...doc, etapa: { ...etapaAprobada, estado: 'en_proceso' }, versionAprobada: null }).ok).toBe(true);
  });

  it('operador puede si la etapa está aprobada y este documento es la versión aprobada', () => {
    expect(puedeCompartir({ rol: 'operador', ...doc, etapa: etapaAprobada, versionAprobada: versionDelDoc })).toEqual({ ok: true, razon: '' });
  });

  it('operador no puede compartir un borrador: la razón nombra el estado de la etapa', () => {
    for (const estado of ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios'] as Estado[]) {
      const r = puedeCompartir({ rol: 'operador', ...doc, etapa: { ...etapaAprobada, estado }, versionAprobada: versionDelDoc });
      expect(r.ok).toBe(false);
      expect(r.razon).toContain('aprobad');
      expect(r.razon).toContain(ETIQUETA_ESTADO_ETAPA[estado]);
    }
  });

  it('operador no puede si no hay etapa para el documento', () => {
    const r = puedeCompartir({ rol: 'operador', ...doc, etapa: null, versionAprobada: null });
    expect(r.ok).toBe(false);
    expect(r.razon).not.toBe('');
  });

  it('operador no puede si la etapa aprobada apunta a otro documento (una versión vieja)', () => {
    const r = puedeCompartir({ rol: 'operador', ...doc, etapa: { ...etapaAprobada, documentoId: 'doc-2' }, versionAprobada: { ...versionDelDoc, documentoId: 'doc-2' } });
    expect(r.ok).toBe(false);
    expect(r.razon).toContain('versión aprobada');
  });

  it('operador no puede si la versión aprobada registrada es de otro documento o falta', () => {
    expect(puedeCompartir({ rol: 'operador', ...doc, etapa: etapaAprobada, versionAprobada: { ...versionDelDoc, documentoId: 'doc-2' } }).ok).toBe(false);
    expect(puedeCompartir({ rol: 'operador', ...doc, etapa: etapaAprobada, versionAprobada: null }).ok).toBe(false);
    expect(puedeCompartir({ rol: 'operador', ...doc, etapa: { ...etapaAprobada, documentoTipo: 'growth' }, versionAprobada: versionDelDoc }).ok).toBe(false);
  });

  it('el cliente nunca crea links', () => {
    expect(puedeCompartir({ rol: 'cliente', ...doc, etapa: etapaAprobada, versionAprobada: versionDelDoc }).ok).toBe(false);
  });
});
