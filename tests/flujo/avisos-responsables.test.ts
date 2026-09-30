import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Los avisos que antes iban «al operador del cliente» ahora llegan a TODOS los
 * responsables de la etapa (en el desarrollo mensual son dos: contenido y
 * diseño). Base simulada: `responsablesDeEtapa` devuelve lo que la prueba
 * decida y el `insert` de notificaciones anota a quién se le escribió.
 */
const espia = vi.hoisted(() => ({
  responsables: [] as Record<string, unknown>[],
  admins: [] as Record<string, unknown>[],
  notificados: [] as { usuarioId: string; tipo: string }[],
  etapasConsultadas: [] as string[],
}));

vi.mock('@/lib/correo', () => ({ enviarCorreo: vi.fn(async () => ({ enviado: true })) }));
vi.mock('@/flujo/responsables', () => ({
  responsablesDeEtapa: vi.fn(async (etapaId: string) => { espia.etapasConsultadas.push(etapaId); return espia.responsables; }),
}));
vi.mock('@/db', async (importarReal) => {
  const real = await importarReal<typeof import('@/db')>();
  return {
    ...real,
    db: {
      // Solo la consulta de admins (`adminsActivos`) y la de un usuario por id pasan por aquí.
      select: () => ({ from: () => ({ where: () => Object.assign(Promise.resolve(espia.admins), { limit: () => Promise.resolve(espia.admins.slice(0, 1)) }) }) }),
      insert: () => ({ values: (filas: { usuarioId: string; tipo: string }[]) => { espia.notificados.push(...filas); return Promise.resolve(); } }),
    },
  };
});

const { avisarTransicion, avisarComentarioCliente, avisarRespuestaDelCliente, avisarLoteAutoAprobado, avisarAsignacionResponsable, textoAviso } = await import('@/flujo/avisos');

const resp = (id: string, activo = true) => ({ id, puesto: 'contenido', nombre: id, apellido: null, email: `${id}@x.mx`, activo });
const admin = (id: string) => ({ id, email: `${id}@x.mx`, nombre: id, apellido: null, rol: 'admin', activo: true });
const para = () => espia.notificados.map((n) => n.usuarioId).sort();

beforeEach(() => { espia.responsables = []; espia.admins = []; espia.notificados = []; espia.etapasConsultadas = []; });

describe('avisos a todos los responsables de la etapa', () => {
  it('cambios pedidos: llega a contenido y a diseño, no a uno solo; el actor nunca se avisa a sí mismo', async () => {
    espia.responsables = [resp('contenido1'), resp('diseno1')];
    await avisarTransicion({ evento: 'cambios_pedidos', actorId: 'admin-1', clientId: 'c', etapaId: 'mes', etapaVisibleCliente: true, cliente: 'Ana', etapa: 'Desarrollo mensual', autor: 'Luis', enlace: '/x' });
    expect(para()).toEqual(['contenido1', 'diseno1']);
    expect(espia.etapasConsultadas).toEqual(['mes']);
  });

  it('se consulta la etapa concreta, no el cliente', async () => {
    espia.responsables = [resp('u1')];
    await avisarTransicion({ evento: 'reabierta', actorId: 'a', clientId: 'cliente-1', etapaId: 'etapa-9', etapaVisibleCliente: false, cliente: 'Ana', etapa: 'Mapa', autor: 'L', enlace: '/x' });
    expect(espia.etapasConsultadas).toEqual(['etapa-9']);
  });

  it('comentario del cliente: a los responsables y a los admins', async () => {
    espia.responsables = [resp('contenido1'), resp('diseno1')];
    espia.admins = [admin('admin-1')];
    await avisarComentarioCliente({ actorId: 'cliente-1', clientId: 'c', etapaId: 'mes', cliente: 'Ana', etapa: 'Desarrollo mensual', enlace: '/x' });
    expect(para()).toEqual(['admin-1', 'contenido1', 'diseno1']);
  });

  it('el cliente responde en su hilo: a los responsables activos; sin ninguno activo, a los admins', async () => {
    espia.responsables = [resp('contenido1'), resp('diseno1')];
    await avisarRespuestaDelCliente({ actorId: 'cliente-1', etapaId: 'mes', cliente: 'Ana', etapa: 'Desarrollo mensual', enlace: '/x' });
    expect(para()).toEqual(['contenido1', 'diseno1']);

    espia.notificados = [];
    espia.responsables = [resp('contenido1', false)];
    espia.admins = [admin('admin-1')];
    await avisarRespuestaDelCliente({ actorId: 'cliente-1', etapaId: 'mes', cliente: 'Ana', etapa: 'Desarrollo mensual', enlace: '/x' });
    expect(para()).toEqual(['admin-1']);
  });

  it('lote auto-aprobado: a los dos responsables del mes', async () => {
    espia.responsables = [resp('contenido1'), resp('diseno1')];
    await avisarLoteAutoAprobado({ etapaId: 'mes', cliente: 'Ana', periodo: '2026-09', enlace: '/x' });
    expect(para()).toEqual(['contenido1', 'diseno1']);
  });

  it('etapa sin responsables: la solicitud sigue yendo a los admins y lo demás a nadie', async () => {
    espia.admins = [admin('admin-1')];
    await avisarTransicion({ evento: 'solicitud', actorId: 'op', clientId: 'c', etapaId: 'e', etapaVisibleCliente: false, cliente: 'Ana', etapa: 'Investigación', autor: 'Op', enlace: '/x' });
    expect(para()).toEqual(['admin-1']);
    espia.notificados = [];
    await avisarTransicion({ evento: 'cambios_pedidos', actorId: 'admin-1', clientId: 'c', etapaId: 'e', etapaVisibleCliente: false, cliente: 'Ana', etapa: 'Investigación', autor: 'L', enlace: '/x' });
    expect(para()).toEqual([]);
  });

  it('asignación: solo a la persona asignada, con texto de la etapa', async () => {
    espia.admins = [admin('u-nuevo')];
    await avisarAsignacionResponsable({ actorId: 'admin-1', nuevoResponsableId: 'u-nuevo', cliente: 'Ana', etapa: 'Mapa de pilares', enlace: '/clientes/c' });
    expect(para()).toEqual(['u-nuevo']);
    expect(textoAviso('responsable_asignado', { cliente: 'Ana', etapa: 'Mapa de pilares' }).texto)
      .toBe('Te asignaron como responsable de Mapa de pilares de Ana.');
  });
});
