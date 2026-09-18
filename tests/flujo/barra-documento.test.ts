import { describe, it, expect } from 'vitest';
import { barraEtapaDocumento } from '@/flujo/barra-documento';
import type { EtapaCliente, Estado, Etapa } from '@/flujo/reglas';
import type { EventoEntrada } from '@/flujo/situacion';

// 17 sep 2026, 12:00 en Ciudad de México.
const AHORA = new Date('2026-09-17T18:00:00Z');
const hace = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);

function etapaDe(estado: Estado, o: Partial<EtapaCliente> & { etapa?: Etapa } = {}) {
  return {
    id: 'e-manual', etapa: 'manual_campana' as Etapa, contratada: true, interna: false,
    estado, documentoId: 'doc-1', actualizadoEn: hace(3), ...o,
  };
}

function barra(o: {
  estado: Estado; rol: 'admin' | 'operador' | 'cliente'; comentarios?: number; evento?: EventoEntrada | null;
  etapa?: Etapa; vigente?: boolean; asignado?: boolean; documentoId?: string | null;
}) {
  const etapa = etapaDe(o.estado, { etapa: o.etapa ?? 'manual_campana', documentoId: o.documentoId === undefined ? 'doc-1' : o.documentoId });
  const etapasCliente: EtapaCliente[] = [
    { id: 'e-inv', etapa: 'investigacion', contratada: true, interna: false, estado: 'aprobada', documentoId: 'r-1' },
    { id: 'e-pil', etapa: 'pilares', contratada: true, interna: false, estado: 'aprobada', documentoId: 'p-1' },
    etapa,
  ];
  return barraEtapaDocumento({
    etapa, rol: o.rol, usuarioId: o.rol === 'admin' ? 'admin-1' : 'op-1',
    esOperadorAsignado: o.asignado ?? o.rol === 'operador',
    esDocumentoVigente: o.vigente ?? true,
    comentariosAbiertos: o.comentarios ?? 0,
    etapasCliente,
    evento: o.evento ?? null,
    operador: 'Ana Paw',
    ahora: AHORA,
  });
}

const ids = (b: ReturnType<typeof barra>) => b?.botones.map((x) => x.id) ?? [];

describe('barra de la etapa en el documento · admin', () => {
  it('en_revision: «Espera tu autorización», quién la pidió, y Autorizar (principal) + Pedir cambios', () => {
    const b = barra({
      estado: 'en_revision', rol: 'admin',
      evento: { accion: 'solicitar', usuarioId: 'op-1', autor: 'Ana Paw', creadoEn: hace(2), comentario: null },
    });
    expect(b?.titulo).toBe('Espera tu autorización');
    expect(b?.detalle).toContain('Ana Paw te pidió autorización hace 2 horas');
    expect(b?.tono).toBe('le-toca');
    expect(ids(b)).toEqual(['aprobar', 'pedir_cambios']);
    expect(b?.botones[0]).toMatchObject({ id: 'aprobar', disabled: false });
    expect(b?.botones[1]).toMatchObject({ id: 'pedir_cambios', requiereComentario: true });
  });

  it('en_revision con comentarios abiertos: el motivo de «Pedir cambios» es opcional', () => {
    const b = barra({ estado: 'en_revision', rol: 'admin', comentarios: 2 });
    expect(b?.botones.find((x) => x.id === 'pedir_cambios')).toMatchObject({ requiereComentario: false });
    expect(b?.botones.find((x) => x.id === 'aprobar')).toMatchObject({ disabled: false });
  });

  it('en_proceso con documento y sin comentarios: Autorizar directo (el caso reportado del manual de campaña)', () => {
    const b = barra({ estado: 'en_proceso', rol: 'admin' });
    expect(ids(b)).toEqual(['aprobar']);
    expect(b?.botones[0]).toMatchObject({ disabled: false });
    expect(b?.titulo).toBe('En proceso · lo lleva Ana Paw');
    expect(b?.tono).toBe('le-toca');
  });

  it('con_cambios sin comentarios: también Autorizar', () => {
    expect(ids(barra({ estado: 'con_cambios', rol: 'admin' }))).toEqual(['aprobar']);
  });

  it('en_proceso con comentarios abiertos: Autorizar deshabilitado con la razón, e «Ir al primero»', () => {
    const b = barra({ estado: 'en_proceso', rol: 'admin', comentarios: 3 });
    expect(b?.botones[0]).toMatchObject({ id: 'aprobar', disabled: true, razon: 'Primero hay que resolver los comentarios pendientes' });
    expect(b?.comentariosPorAtender).toBe(3);
  });

  it('aprobada: una línea discreta «Autorizada por X el …», sin botones', () => {
    const b = barra({
      estado: 'aprobada', rol: 'admin',
      evento: { accion: 'aprobar', usuarioId: 'admin-2', autor: 'Luis Soto', creadoEn: new Date('2026-09-10T18:00:00Z'), comentario: null },
    });
    expect(b?.tono).toBe('discreta');
    expect(b?.titulo).toMatch(/^Autorizada por Luis Soto el 10 sept?\.?$/);
    expect(b?.botones).toEqual([]);
  });
});

describe('barra de la etapa en el documento · operador', () => {
  it('en_proceso sin comentarios: Solicitar autorización', () => {
    const b = barra({ estado: 'en_proceso', rol: 'operador' });
    expect(ids(b)).toEqual(['solicitar']);
    expect(b?.botones[0]).toMatchObject({ disabled: false });
    expect(b?.titulo).toBe('En tu mesa');
  });

  it('en_proceso con comentarios: «Tienes N comentarios por atender», Ir al primero y Solicitar deshabilitado con explicación', () => {
    const b = barra({ estado: 'en_proceso', rol: 'operador', comentarios: 2 });
    expect(b?.titulo).toBe('Tienes 2 comentarios por atender');
    expect(b?.comentariosPorAtender).toBe(2);
    expect(b?.botones).toEqual([{ id: 'solicitar', disabled: true, razon: 'Primero hay que resolver los comentarios pendientes' }]);
    expect(b?.detalle).toBeNull();
  });

  it('con_cambios con comentarios: cuenta qué pasó (quién pidió cambios) sin repetir el conteo', () => {
    const b = barra({
      estado: 'con_cambios', rol: 'operador', comentarios: 1,
      evento: { accion: 'pedir_cambios', usuarioId: 'admin-1', autor: 'Luis Soto', creadoEn: hace(1), comentario: 'Cambia el tono' },
    });
    expect(b?.titulo).toBe('Tienes 1 comentario por atender');
    expect(b?.detalle).toBe('Luis Soto pidió cambios hace 1 hora: «Cambia el tono».');
  });

  it('con_cambios sin comentarios: Solicitar autorización', () => {
    expect(ids(barra({ estado: 'con_cambios', rol: 'operador' }))).toEqual(['solicitar']);
  });

  it('en_revision: «Enviada a autorización · esperando al admin», sin botón', () => {
    const b = barra({ estado: 'en_revision', rol: 'operador' });
    expect(b?.titulo).toBe('Enviada a autorización · esperando al admin');
    expect(b?.botones).toEqual([]);
    expect(b?.tono).toBe('informa');
  });

  it('nunca ve Autorizar ni Pedir cambios', () => {
    for (const estado of ['en_proceso', 'en_revision', 'con_cambios'] as const) {
      expect(ids(barra({ estado, rol: 'operador' }))).not.toContain('aprobar');
      expect(ids(barra({ estado, rol: 'operador' }))).not.toContain('pedir_cambios');
    }
  });

  it('sin el cliente asignado no tiene botones (lo mismo que decide `aplicarAccion`)', () => {
    expect(barra({ estado: 'en_proceso', rol: 'operador', asignado: false })?.botones).toEqual([]);
  });
});

describe('cuándo no hay barra', () => {
  it('el cliente (portal) nunca', () => {
    for (const estado of ['en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      expect(barra({ estado, rol: 'cliente' })).toBeNull();
    }
  });

  it('el desarrollo mensual tiene su pantalla del mes', () => {
    expect(barra({ estado: 'en_revision', rol: 'admin', etapa: 'desarrollo_mensual' })).toBeNull();
  });

  it('un documento que ya no es el vigente de su etapa', () => {
    expect(barra({ estado: 'en_revision', rol: 'admin', vigente: false })).toBeNull();
  });

  it('una etapa no iniciada', () => {
    expect(barra({ estado: 'no_iniciada', rol: 'admin' })).toBeNull();
  });

  it('funciona igual en investigación y mapa de pilares', () => {
    expect(ids(barra({ estado: 'en_revision', rol: 'admin', etapa: 'investigacion' }))).toEqual(['aprobar', 'pedir_cambios']);
    expect(ids(barra({ estado: 'en_proceso', rol: 'operador', etapa: 'pilares' }))).toEqual(['solicitar']);
  });
});
