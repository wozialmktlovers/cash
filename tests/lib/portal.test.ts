import { describe, it, expect, vi } from 'vitest';
import { resumenPortal, fraseEtapaLista, clientePortal, actividadPortal, lotesPortal, type EtapaClientePortal } from '@/lib/portal';

// Base simulada del estilo existente (tests/research/convertir-lecturas.test.ts):
// un objeto `db` que solo imita las cadenas que este módulo de verdad usa
// (select/from/innerJoin/where/orderBy/limit, todas encadenables y "thenable"
// como el query builder real de drizzle) e ignora las condiciones de `where`
// — solo importan sus efectos, con los datos ya filtrados a mano en cada
// prueba. `vi.hoisted` porque `vi.mock('@/db', ...)` se eleva sobre los
// imports del archivo.
const mockDb = vi.hoisted(() => {
  const estado: { filasClients: any[]; filasEventos: any[]; filasComentarios: any[]; filasLotes: any[] } = {
    filasClients: [], filasEventos: [], filasComentarios: [], filasLotes: [],
  };

  const TABLAS = {
    clients: { __tabla: 'clients' },
    etapaEventos: { __tabla: 'etapaEventos' },
    comentarios: { __tabla: 'comentarios' },
    contenidoLotes: { __tabla: 'contenidoLotes' },
  };

  function filasDe(tabla: any): any[] {
    if (tabla === TABLAS.clients) return estado.filasClients;
    if (tabla === TABLAS.etapaEventos) return estado.filasEventos;
    if (tabla === TABLAS.comentarios) return estado.filasComentarios;
    if (tabla === TABLAS.contenidoLotes) return estado.filasLotes;
    return [];
  }

  // `actividadPortal` reordena y recorta el resultado combinado al final
  // (`eventos.sort(...).slice(0, 8)`), así que el orden que devuelva cada
  // consulta suelta no importa para el resultado — orderBy() no hace nada.
  function chain(resultado: any[]): any {
    const obj: any = {
      innerJoin: () => obj,
      where: () => obj,
      orderBy: () => obj,
      limit: (n: number) => chain(resultado.slice(0, n)),
      then: (resuelve: any, rechaza: any) => Promise.resolve(resultado).then(resuelve, rechaza),
    };
    return obj;
  }

  const db = {
    select: (..._cols: any[]) => ({ from: (tabla: any) => chain(filasDe(tabla)) }),
  };

  return { estado, TABLAS, db };
});

vi.mock('@/db', () => ({
  clients: mockDb.TABLAS.clients,
  etapaEventos: mockDb.TABLAS.etapaEventos,
  comentarios: mockDb.TABLAS.comentarios,
  contenidoLotes: mockDb.TABLAS.contenidoLotes,
  db: mockDb.db,
}));

// Fábrica de EtapaClientePortal con valores por omisión razonables, siguiendo
// el patrón de tests/flujo/reglas.test.ts.
const et = (etapa: EtapaClientePortal['etapa'], overrides: Partial<EtapaClientePortal> = {}): EtapaClientePortal => ({
  id: `${etapa}-1`,
  etapa,
  contratada: true,
  interna: false,
  estado: 'no_iniciada',
  documentoId: null,
  versionAprobadaId: null,
  actualizadoEn: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

describe('resumenPortal', () => {
  it('calcula el avance con avanceCliente sobre las etapas contratadas y no internas', () => {
    const r = resumenPortal([
      et('investigacion', { estado: 'aprobada', versionAprobadaId: 'v1' }),
      et('pilares', { estado: 'en_proceso' }),
      et('desarrollo_mensual', { contratada: false }),
      et('manual_campana', { estado: 'no_iniciada' }),
    ]);
    // (100 + 25 + 0) / 3 = 41.67 → 42
    expect(r.avance).toBe(42);
  });

  it('ordena las tarjetas según ETAPAS, sin importar el orden de entrada', () => {
    const r = resumenPortal([et('manual_campana'), et('investigacion'), et('pilares')]);
    expect(r.tarjetas.map((t) => t.etapa)).toEqual(['investigacion', 'pilares', 'manual_campana']);
  });

  it('oculta las etapas internas y las no contratadas', () => {
    const r = resumenPortal([
      et('investigacion', { interna: true }),
      et('pilares', { contratada: false }),
      et('manual_campana'),
    ]);
    expect(r.tarjetas.map((t) => t.etapa)).toEqual(['manual_campana']);
  });

  it('listo es true solo si hay versión aprobada', () => {
    const r = resumenPortal([
      et('investigacion', { estado: 'aprobada', versionAprobadaId: 'v1' }),
      et('pilares', { estado: 'aprobada', versionAprobadaId: null }),
    ]);
    expect(r.tarjetas.find((t) => t.etapa === 'investigacion')!.listo).toBe(true);
    expect(r.tarjetas.find((t) => t.etapa === 'pilares')!.listo).toBe(false);
  });

  it('puedeComentar solo en las etapas 3 y 4 (desarrollo_mensual y manual_campana)', () => {
    const r = resumenPortal([et('investigacion'), et('pilares'), et('desarrollo_mensual'), et('manual_campana')]);
    const por = new Map(r.tarjetas.map((t) => [t.etapa, t.puedeComentar]));
    expect(por.get('investigacion')).toBe(false);
    expect(por.get('pilares')).toBe(false);
    expect(por.get('desarrollo_mensual')).toBe(true);
    expect(por.get('manual_campana')).toBe(true);
  });

  it('proximamente solo en desarrollo_mensual, y solo mientras no haya mes compartido', () => {
    const r = resumenPortal([et('desarrollo_mensual'), et('manual_campana')]);
    const por = new Map(r.tarjetas.map((t) => [t.etapa, t.proximamente]));
    expect(por.get('desarrollo_mensual')).toBe(true);
    expect(por.get('manual_campana')).toBe(false);
  });

  // C2: desde que el cliente revisa su mes en el portal, «Próximamente» deja de
  // ser verdad en cuanto hay un lote compartido — y seguir diciéndolo sería
  // mentirle mientras le corre el plazo.
  describe('el mes de desarrollo_mensual', () => {
    const LOTE = { id: 'lote-1', periodo: '2026-09' };
    const SEPTIEMBRE = { id: 'lote-sep', periodo: '2026-09', compartido: true, activo: false };
    const OCTUBRE = { id: 'lote-oct', periodo: '2026-10', compartido: false, activo: true };

    it('con un mes compartido, la etapa queda lista y con su lote', () => {
      const r = resumenPortal([et('desarrollo_mensual')], [{ ...LOTE, compartido: true, activo: true }]);
      const t = r.tarjetas.find((x) => x.etapa === 'desarrollo_mensual')!;
      expect(t.proximamente).toBe(false);
      expect(t.listo).toBe(true);
      expect(t.lote).toEqual(LOTE);
      expect(t.mesesAnteriores).toBeUndefined();
    });

    it('un lote que todavía se arma no es del cliente: sigue en próximamente', () => {
      const r = resumenPortal([et('desarrollo_mensual')], [{ ...LOTE, compartido: false, activo: true }]);
      const t = r.tarjetas.find((x) => x.etapa === 'desarrollo_mensual')!;
      expect(t.proximamente).toBe(true);
      expect(t.listo).toBe(false);
      expect(t.lote).toBeUndefined();
    });

    it('sin lote se comporta como antes', () => {
      const t = resumenPortal([et('desarrollo_mensual')]).tarjetas[0];
      expect(t.proximamente).toBe(true);
      expect(t.listo).toBe(false);
      expect(t.lote).toBeUndefined();
      expect(t.mesesAnteriores).toBeUndefined();
    });

    it('el lote no se le pega a ninguna otra etapa', () => {
      const r = resumenPortal([et('investigacion'), et('manual_campana')], [{ ...LOTE, compartido: true, activo: true }]);
      for (const t of r.tarjetas) expect(t.lote, t.etapa).toBeUndefined();
      for (const t of r.tarjetas) expect(t.mesesAnteriores, t.etapa).toBeUndefined();
    });

    // El fallo que motivó la lista: abrir el lote de octubre —`en_proceso`, sin
    // compartir— devolvía la tarjeta a «Próximamente» y hacía desaparecer
    // septiembre, que el cliente tenía aprobado. El diseño §2 promete lo
    // contrario con todas sus letras.
    describe('los meses anteriores (diseño §2)', () => {
      it('abrir un mes nuevo sin compartir no borra el anterior: destaca el último compartido', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [OCTUBRE, SEPTIEMBRE]);
        const t = r.tarjetas[0];
        expect(t.proximamente).toBe(false);
        expect(t.listo).toBe(true);
        expect(t.lote).toEqual({ id: 'lote-sep', periodo: '2026-09' });
        // Y octubre no se nombra por ningún lado: se está armando.
        expect(t.mesesAnteriores).toBeUndefined();
      });

      it('en cuanto octubre se comparte, pasa al frente y septiembre baja a la lista', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [{ ...OCTUBRE, compartido: true }, SEPTIEMBRE]);
        const t = r.tarjetas[0];
        expect(t.lote).toEqual({ id: 'lote-oct', periodo: '2026-10' });
        expect(t.mesesAnteriores).toEqual([{ id: 'lote-sep', periodo: '2026-09' }]);
      });

      it('los anteriores van del más reciente al más viejo, venga como venga la lista', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [
          { id: 'jul', periodo: '2026-07', compartido: true, activo: false },
          { id: 'nov', periodo: '2026-11', compartido: true, activo: true },
          { id: 'ago', periodo: '2026-08', compartido: true, activo: false },
          { id: 'sep', periodo: '2026-09', compartido: true, activo: false },
        ]);
        const t = r.tarjetas[0];
        expect(t.lote!.id).toBe('nov');
        expect(t.mesesAnteriores!.map((m) => m.id)).toEqual(['sep', 'ago', 'jul']);
      });

      // El permiso que sostiene esta función: lo que no se compartió no existe
      // para el cliente, ni destacado ni en la lista, ni aunque esté en medio
      // de dos meses que sí se compartieron.
      it('un mes sin compartir nunca aparece, aunque haya otros compartidos', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [
          { id: 'oct', periodo: '2026-10', compartido: true, activo: true },
          { id: 'sep-borrador', periodo: '2026-09', compartido: false, activo: false },
          { id: 'ago', periodo: '2026-08', compartido: true, activo: false },
        ]);
        const t = r.tarjetas[0];
        const nombrados = [t.lote!.id, ...(t.mesesAnteriores ?? []).map((m) => m.id)];
        expect(nombrados).toEqual(['oct', 'ago']);
      });

      it('ningún mes compartido: próximamente, aunque el cliente tenga dos lotes abiertos', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [
          { id: 'oct', periodo: '2026-10', compartido: false, activo: true },
          { id: 'sep', periodo: '2026-09', compartido: false, activo: false },
        ]);
        const t = r.tarjetas[0];
        expect(t.proximamente).toBe(true);
        expect(t.listo).toBe(false);
        expect(t.lote).toBeUndefined();
        expect(t.mesesAnteriores).toBeUndefined();
      });

      // `elegirLoteActivo` toma «el más reciente sin aprobar» al pie de la
      // letra, así que el activo puede no ser el último. Si está compartido, es
      // el que el cliente tiene que atender y va al frente.
      it('el activo compartido manda, aunque exista un mes posterior ya aprobado', () => {
        const r = resumenPortal([et('desarrollo_mensual')], [
          { id: 'oct', periodo: '2026-10', compartido: true, activo: false },
          { id: 'sep', periodo: '2026-09', compartido: true, activo: true },
        ]);
        const t = r.tarjetas[0];
        expect(t.lote!.id).toBe('sep');
        expect(t.mesesAnteriores!.map((m) => m.id)).toEqual(['oct']);
      });
    });
  });

  it('numero sigue la posición fija de la etapa (1–4), no el índice entre las visibles', () => {
    const r = resumenPortal([et('pilares'), et('manual_campana')]);
    expect(r.tarjetas.find((t) => t.etapa === 'pilares')!.numero).toBe(2);
    expect(r.tarjetas.find((t) => t.etapa === 'manual_campana')!.numero).toBe(4);
  });

  it('estadoCliente usa la etiqueta ESTADO_CLIENTE, no la interna', () => {
    const r = resumenPortal([et('investigacion', { estado: 'en_revision' })]);
    expect(r.tarjetas[0].estadoCliente).toBe('En revisión');
  });

  it('sin etapas visibles: avance 0 y sin tarjetas', () => {
    const r = resumenPortal([et('investigacion', { contratada: false })]);
    expect(r.avance).toBe(0);
    expect(r.tarjetas).toEqual([]);
  });
});

describe('fraseEtapaLista', () => {
  // Fix wave: «{Etapa} está listo para ti» no concordaba en género
  // («Investigación está listo»). El mapa de artículo/concordancia cubre las
  // cuatro etapas, no solo el caso que se notó en revisión.
  it('investigacion usa artículo y concordancia femeninos', () => {
    expect(fraseEtapaLista('investigacion')).toBe('la Investigación ya está lista para ti');
  });

  it('pilares, desarrollo_mensual y manual_campana usan artículo y concordancia masculinos', () => {
    expect(fraseEtapaLista('pilares')).toBe('el Mapa de pilares ya está listo para ti');
    expect(fraseEtapaLista('desarrollo_mensual')).toBe('el Desarrollo mensual ya está listo para ti');
    expect(fraseEtapaLista('manual_campana')).toBe('el Manual de campaña ya está listo para ti');
  });
});

// Fábrica de UsuarioSesion, siguiendo el mismo patrón que `et` arriba.
const CLIENTE_A = '11111111-1111-1111-1111-111111111111';
const CLIENTE_B = '22222222-2222-2222-2222-222222222222';
const OPERADOR_1 = '33333333-3333-3333-3333-333333333333';

const usr = (rol: 'admin' | 'operador' | 'cliente', overrides: Record<string, any> = {}) => ({
  id: OPERADOR_1, email: 'u@w.mx', nombre: 'U', apellido: null, rol, clientId: null, activo: true, ...overrides,
});

describe('clientePortal', () => {
  it('cliente sin clientId propio: null (dato inconsistente, pero no truena)', async () => {
    mockDb.estado.filasClients = [];
    expect(await clientePortal(usr('cliente', { clientId: null }), new URLSearchParams())).toBeNull();
  });

  it('cliente ve el suyo, sin vista previa', async () => {
    mockDb.estado.filasClients = [{ id: CLIENTE_A, operadorId: null, nombre: 'Ana' }];
    const r = await clientePortal(usr('cliente', { clientId: CLIENTE_A }), new URLSearchParams());
    expect(r).toEqual({ cliente: { id: CLIENTE_A, operadorId: null, nombre: 'Ana' }, vistaPrevia: false });
  });

  it('cliente no puede ver el cliente de otra cuenta: null', async () => {
    mockDb.estado.filasClients = [{ id: CLIENTE_B, operadorId: null, nombre: 'Beto' }];
    expect(await clientePortal(usr('cliente', { clientId: CLIENTE_A }), new URLSearchParams())).toBeNull();
  });

  it('admin ve cualquier cliente con ?cliente=, en vista previa', async () => {
    mockDb.estado.filasClients = [{ id: CLIENTE_A, operadorId: null, nombre: 'Ana' }];
    const r = await clientePortal(usr('admin'), new URLSearchParams({ cliente: CLIENTE_A }));
    expect(r).toEqual({ cliente: { id: CLIENTE_A, operadorId: null, nombre: 'Ana' }, vistaPrevia: true });
  });

  it('operador ve su propio cliente asignado, en vista previa', async () => {
    mockDb.estado.filasClients = [{ id: CLIENTE_A, operadorId: OPERADOR_1, nombre: 'Ana' }];
    const r = await clientePortal(usr('operador'), new URLSearchParams({ cliente: CLIENTE_A }));
    expect(r?.vistaPrevia).toBe(true);
  });

  it('operador no ve el cliente de otro operador: null', async () => {
    mockDb.estado.filasClients = [{ id: CLIENTE_A, operadorId: 'otro-operador', nombre: 'Ana' }];
    expect(await clientePortal(usr('operador'), new URLSearchParams({ cliente: CLIENTE_A }))).toBeNull();
  });

  it('un ?cliente= que no tiene forma de UUID da null, no un 500', async () => {
    mockDb.estado.filasClients = [];
    expect(await clientePortal(usr('admin'), new URLSearchParams({ cliente: 'no-es-uuid' }))).toBeNull();
  });

  it('sin ?cliente= para un rol interno: null', async () => {
    mockDb.estado.filasClients = [];
    expect(await clientePortal(usr('admin'), new URLSearchParams())).toBeNull();
  });
});

describe('actividadPortal', () => {
  const T0 = new Date('2026-01-01T00:00:00Z');
  const dia = (n: number) => new Date(T0.getTime() + n * 86_400_000);
  const ETAPAS_VISIBLES = [{ id: 'e1', etapa: 'investigacion' as const }, { id: 'e2', etapa: 'pilares' as const }];

  it('sin etapas visibles: no consulta nada y devuelve vacío', async () => {
    mockDb.estado.filasEventos = [{ etapaId: 'e1', creadoEn: dia(1) }];
    expect(await actividadPortal([], 'u1', false)).toEqual([]);
  });

  it('una aprobación se traduce con fraseEtapaLista', async () => {
    mockDb.estado.filasEventos = [{ etapaId: 'e1', creadoEn: dia(1) }];
    mockDb.estado.filasComentarios = [];
    const r = await actividadPortal(ETAPAS_VISIBLES, 'u1', false);
    expect(r).toHaveLength(1);
    expect(r[0].etiqueta).toBe(fraseEtapaLista('investigacion'));
  });

  it('una respuesta del equipo nombra la etapa', async () => {
    mockDb.estado.filasEventos = [];
    mockDb.estado.filasComentarios = [{ id: 'c1', etapaId: 'e2', creadoEn: dia(1) }];
    const r = await actividadPortal(ETAPAS_VISIBLES, 'u1', false);
    expect(r).toHaveLength(1);
    expect(r[0].etiqueta).toBe('El equipo respondió tu observación en Mapa de pilares');
  });

  it('mezcla aprobaciones y respuestas, más recientes primero, tope de 8', async () => {
    mockDb.estado.filasEventos = [
      { etapaId: 'e1', creadoEn: dia(1) },
      { etapaId: 'e1', creadoEn: dia(5) },
    ];
    mockDb.estado.filasComentarios = [
      { id: 'c1', etapaId: 'e2', creadoEn: dia(3) },
      { id: 'c2', etapaId: 'e2', creadoEn: dia(7) },
    ];
    const r = await actividadPortal(ETAPAS_VISIBLES, 'u1', false);
    expect(r.map((e) => e.creadoEn.getTime())).toEqual([dia(7), dia(5), dia(3), dia(1)].map((d) => d.getTime()));
  });

  it('recorta a las últimas 8, aunque haya más actividad', async () => {
    // El mock (a diferencia de Postgres) no ordena por sí solo: se cargan ya
    // en orden descendente, como las devolvería `orderBy(desc(creadoEn))`
    // antes de su propio `.limit(8)` real (chain().limit sí recorta).
    mockDb.estado.filasEventos = Array.from({ length: 10 }, (_, i) => ({ etapaId: 'e1', creadoEn: dia(9 - i) }));
    mockDb.estado.filasComentarios = [];
    const r = await actividadPortal(ETAPAS_VISIBLES, 'u1', false);
    // El límite de 8 de la consulta ya deja fuera los días 1 y 0; el propio
    // actividadPortal no tiene que recortar nada más porque no hay otra fuente.
    expect(r).toHaveLength(8);
    expect(r[0].creadoEn.getTime()).toBe(dia(9).getTime());
    expect(r.at(-1)!.creadoEn.getTime()).toBe(dia(2).getTime());
  });

  it('etapa sin nombre conocido: etiqueta genérica en vez de romper', async () => {
    mockDb.estado.filasEventos = [{ etapaId: 'etapa-fantasma', creadoEn: dia(1) }];
    mockDb.estado.filasComentarios = [];
    const r = await actividadPortal(ETAPAS_VISIBLES, 'u1', false);
    expect(r[0].etiqueta).toBe('Tu etapa ya está lista para ti');
  });
});

/**
 * `lotesPortal`: los meses del cliente tal como los necesita la portada, con el
 * activo marcado. Lo que se comprueba aquí es lo que no se puede comprobar en
 * `resumenPortal` porque es puro — que el activo se decida con
 * `elegirLoteActivo` (diseño §2) y que `compartido` salga de `compartido_en`.
 */
describe('lotesPortal', () => {
  const lote = (periodo: string, estado: string, compartidoEn: Date | null) =>
    ({ id: `lote-${periodo}`, periodo, estado, compartidoEn });

  it('marca activo el más reciente sin aprobar y traduce compartido_en', async () => {
    mockDb.estado.filasLotes = [
      lote('2026-10', 'en_proceso', null),
      lote('2026-09', 'aprobada', new Date('2026-09-20T00:00:00Z')),
    ];
    const r = await lotesPortal('cliente-1');
    expect(r).toEqual([
      { id: 'lote-2026-10', periodo: '2026-10', compartido: false, activo: true },
      { id: 'lote-2026-09', periodo: '2026-09', compartido: true, activo: false },
    ]);
  });

  it('con todos aprobados, el activo es el último', async () => {
    mockDb.estado.filasLotes = [
      lote('2026-10', 'aprobada', new Date('2026-10-20T00:00:00Z')),
      lote('2026-09', 'aprobada', new Date('2026-09-20T00:00:00Z')),
    ];
    const r = await lotesPortal('cliente-1');
    expect(r.filter((l) => l.activo).map((l) => l.periodo)).toEqual(['2026-10']);
  });

  it('devuelve también los meses sin compartir, para que el activo se decida sobre la lista completa', async () => {
    mockDb.estado.filasLotes = [lote('2026-10', 'en_proceso', null)];
    const r = await lotesPortal('cliente-1');
    expect(r).toEqual([{ id: 'lote-2026-10', periodo: '2026-10', compartido: false, activo: true }]);
  });

  it('un cliente sin lotes devuelve la lista vacía, no revienta', async () => {
    mockDb.estado.filasLotes = [];
    expect(await lotesPortal('cliente-1')).toEqual([]);
  });
});
