import { describe, it, expect } from 'vitest';
import {
  situacionEtapa, situacionPendiente, avisoCliente, fraseComentario, ordenBotones, cuando, diaCorto, cita, columnaEntrega,
  type EntradaSituacion, type EventoEntrada, type Mirada,
} from '@/flujo/situacion';

// 17 sep 2026, 12:00 en Ciudad de México (UTC-6).
const AHORA = new Date('2026-09-17T18:00:00Z');
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000);

const ADMIN: Mirada = { rol: 'admin', usuarioId: 'admin-1' };
const OPERADOR: Mirada = { rol: 'operador', usuarioId: 'op-1' };

const evento = (o: Partial<EventoEntrada> = {}): EventoEntrada => ({
  accion: 'solicitar', usuarioId: 'op-1', autor: 'Ana Paw', creadoEn: haceHoras(3), comentario: null, ...o,
});

const entrada = (o: Partial<EntradaSituacion> = {}): EntradaSituacion => ({
  etapa: 'investigacion', estado: 'en_revision', actualizadoEn: haceHoras(3),
  evento: null, operador: 'Ana Paw', comentariosAbiertos: 0, ...o,
});

describe('cuando', () => {
  it('dice minutos y horas mientras no pase un día', () => {
    expect(cuando(new Date(AHORA.getTime() - 20_000), AHORA)).toBe('hace un momento');
    expect(cuando(new Date(AHORA.getTime() - 60_000), AHORA)).toBe('hace 1 minuto');
    expect(cuando(new Date(AHORA.getTime() - 25 * 60_000), AHORA)).toBe('hace 25 minutos');
    expect(cuando(haceHoras(1), AHORA)).toBe('hace 1 hora');
    expect(cuando(haceHoras(5), AHORA)).toBe('hace 5 horas');
  });

  it('pasado un día da la fecha, en hora de México', () => {
    expect(cuando(haceHoras(30), AHORA)).toBe('el 16 sep');
    // 02:00 UTC del 17 son las 20:00 del 16 en México.
    expect(diaCorto(new Date('2026-09-17T02:00:00Z'), AHORA)).toBe('16 sep');
  });

  it('añade el año si no es el de hoy', () => {
    expect(diaCorto(new Date('2025-12-10T18:00:00Z'), AHORA)).toBe('10 dic 2025');
  });

  it('una fecha en el futuro cuenta como «hace un momento»', () => {
    expect(cuando(new Date(AHORA.getTime() + 60_000), AHORA)).toBe('hace un momento');
  });
});

describe('en_revision: la etiqueta depende de quién mira', () => {
  it('el admin ve «Espera tu autorización», destacada en rosa', () => {
    const s = situacionEtapa(entrada({ evento: evento() }), ADMIN, AHORA);
    expect(s.chip).toBe('Espera tu autorización');
    expect(s.color).toBe('rosa');
    expect(s.destacada).toBe(true);
  });

  it('el operador ve «Enviada a autorización», sin destacar', () => {
    const s = situacionEtapa(entrada({ evento: evento() }), OPERADOR, AHORA);
    expect(s.chip).toBe('Enviada a autorización');
    expect(s.color).toBe('amarillo');
    expect(s.destacada).toBe(false);
  });
});

describe('en_revision: el recuadro del admin', () => {
  it('con evento `solicitar`: nombre, cuándo y qué hacer', () => {
    const s = situacionEtapa(entrada({ evento: evento() }), ADMIN, AHORA);
    expect(s.recuadro).toBe('Ana Paw te pidió autorización hace 3 horas. Revisa el documento y autorízalo o pide cambios.');
    expect(s.resumen).toBe('Ana Paw te pidió autorización hace 3 horas');
  });

  it('con evento de hace más de un día, da la fecha', () => {
    const s = situacionEtapa(entrada({ evento: evento({ creadoEn: haceHoras(48) }) }), ADMIN, AHORA);
    expect(s.recuadro).toBe('Ana Paw te pidió autorización el 15 sep. Revisa el documento y autorízalo o pide cambios.');
  });

  it('sin evento `solicitar`: el mismo texto, sin nombre y sin inventar a nadie', () => {
    const s = situacionEtapa(entrada({ evento: null }), ADMIN, AHORA);
    expect(s.chip).toBe('Espera tu autorización');
    expect(s.recuadro).toBe('Esta etapa espera tu autorización. Revisa el documento y autorízalo o pide cambios.');
    expect(s.recuadro).not.toContain('Ana');
  });

  it('un evento que no es `solicitar` no se atribuye como solicitud', () => {
    const s = situacionEtapa(entrada({ evento: evento({ accion: 'generado' }) }), ADMIN, AHORA);
    expect(s.recuadro).toBe('Esta etapa espera tu autorización. Revisa el documento y autorízalo o pide cambios.');
  });

  it('si la cuenta de quien pidió ya no existe, se dice sin nombre pero con fecha', () => {
    const s = situacionEtapa(entrada({ evento: evento({ usuarioId: null, autor: null }) }), ADMIN, AHORA);
    expect(s.recuadro).toBe('Te pidieron autorización hace 3 horas. Revisa el documento y autorízalo o pide cambios.');
  });

  it('el operador lee que la envió él y que espera a un admin', () => {
    const s = situacionEtapa(entrada({ evento: evento() }), OPERADOR, AHORA);
    expect(s.recuadro).toBe('Pediste autorización hace 3 horas. Esperando a que un admin la revise.');
    const sinEvento = situacionEtapa(entrada(), OPERADOR, AHORA);
    expect(sinEvento.recuadro).toBe('Esperando a que un admin la revise.');
  });
});

describe('con_cambios', () => {
  const pedido = evento({ accion: 'pedir_cambios', usuarioId: 'admin-2', autor: 'Carlos Ruiz', comentario: 'Falta la  competencia\n local.' });

  it('el operador tiene cambios por hacer: quién, cuándo, el comentario y lo que queda', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: pedido, comentariosAbiertos: 2 }), OPERADOR, AHORA);
    expect(s.chip).toBe('Tienes cambios por hacer');
    expect(s.destacada).toBe(true);
    expect(s.recuadro).toBe('Carlos Ruiz pidió cambios hace 3 horas: «Falta la competencia local.» 2 comentarios por atender.');
    expect(s.resumen).toBe('Tienes cambios por hacer · Carlos Ruiz pidió cambios hace 3 horas');
  });

  it('sin comentarios abiertos le dice que vuelva a pedir autorización', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: { ...pedido, comentario: null } }), OPERADOR, AHORA);
    expect(s.recuadro).toBe('Carlos Ruiz pidió cambios hace 3 horas. Cuando esté listo, vuelve a pedir autorización.');
  });

  it('el admin ve a quién espera, y «Pediste» si fue él', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: { ...pedido, usuarioId: 'admin-1' } }), ADMIN, AHORA);
    expect(s.chip).toBe('Cambios pedidos · esperando a Ana Paw');
    expect(s.destacada).toBe(false);
    expect(s.recuadro).toBe('Pediste cambios hace 3 horas: «Falta la competencia local.»');
    expect(s.resumen).toBe('Esperando a Ana Paw · pediste cambios hace 3 horas');
  });

  it('en el resumen del admin, el nombre de quien pidió conserva su mayúscula', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: pedido }), ADMIN, AHORA);
    expect(s.resumen).toBe('Esperando a Ana Paw · Carlos Ruiz pidió cambios hace 3 horas');
  });

  it('sin operador asignado, el chip no nombra a nadie', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: pedido, operador: null }), ADMIN, AHORA);
    expect(s.chip).toBe('Cambios pedidos');
  });

  it('sin evento, el operador sabe qué hacer aunque no sepa quién', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', comentariosAbiertos: 1 }), OPERADOR, AHORA);
    expect(s.recuadro).toBe('1 comentario por atender.');
  });
});

describe('reabierta', () => {
  const reabrir = evento({ accion: 'reabrir', usuarioId: 'admin-2', autor: 'Carlos Ruiz', comentario: 'El cliente cambió de giro' });

  it('el operador ve quién la reabrió y el motivo, destacada', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: reabrir }), OPERADOR, AHORA);
    expect(s.chip).toBe('Carlos Ruiz reabrió la etapa');
    expect(s.destacada).toBe(true);
    expect(s.reabierta).toBe(true);
    expect(s.recuadro).toContain('«El cliente cambió de giro»');
  });

  it('el admin que la reabrió lee «Reabriste la etapa»', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: { ...reabrir, usuarioId: 'admin-1' } }), ADMIN, AHORA);
    expect(s.chip).toBe('Reabriste la etapa');
    expect(s.recuadro).toBe('Reabriste la etapa hace 3 horas: «El cliente cambió de giro». Ahora está esperando a Ana Paw.');
  });

  it('otro admin la ve con el nombre de quien la reabrió', () => {
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: reabrir }), ADMIN, AHORA);
    expect(s.chip).toBe('Carlos Ruiz reabrió la etapa');
  });
});

describe('en_proceso y aprobada', () => {
  it('en proceso: el admin ve quién la lleva; el operador, que está en su mesa', () => {
    expect(situacionEtapa(entrada({ estado: 'en_proceso' }), ADMIN, AHORA).chip).toBe('En proceso · lo lleva Ana Paw');
    expect(situacionEtapa(entrada({ estado: 'en_proceso', operador: null }), ADMIN, AHORA).chip).toBe('En proceso');
    const op = situacionEtapa(entrada({ estado: 'en_proceso' }), OPERADOR, AHORA);
    expect(op.chip).toBe('En tu mesa');
    expect(op.recuadro).toBe('Cuando esté listo, pide autorización.');
  });

  it('autorizada: por ti o por quien fue, con la fecha', () => {
    const aprobar = evento({ accion: 'aprobar', usuarioId: 'admin-1', autor: 'Michel G', creadoEn: haceHoras(30) });
    expect(situacionEtapa(entrada({ estado: 'aprobada', evento: aprobar }), ADMIN, AHORA).chip).toBe('Autorizada por ti el 16 sep');
    expect(situacionEtapa(entrada({ estado: 'aprobada', evento: aprobar }), OPERADOR, AHORA).chip).toBe('Autorizada por Michel G el 16 sep');
    expect(situacionEtapa(entrada({ estado: 'aprobada' }), OPERADOR, AHORA).chip).toBe('Autorizada');
  });
});

describe('desarrollo_mensual no pasa por la autorización', () => {
  it('en_revision sigue diciendo «En revisión» a los dos, sin recuadro', () => {
    for (const mirada of [ADMIN, OPERADOR]) {
      const s = situacionEtapa(entrada({ etapa: 'desarrollo_mensual', evento: evento() }), mirada, AHORA);
      expect(s.chip).toBe('En revisión');
      expect(s.destacada).toBe(false);
      expect(s.recuadro).toBeNull();
    }
  });
});

describe('situacionPendiente', () => {
  it('da la misma frase que la tarjeta para un pendiente del admin', () => {
    const p = { motivo: 'en_revision' as const, etapa: 'pilares' as const, actualizadoEn: haceHoras(3), evento: evento(), operador: 'Ana Paw', comentariosAbiertos: 0 };
    expect(situacionPendiente(p, ADMIN, AHORA).resumen).toBe('Ana Paw te pidió autorización hace 3 horas');
  });
});

describe('avisoCliente', () => {
  it('manual con observaciones del cliente', () => {
    expect(avisoCliente({ etapa: 'manual_campana', cliente: 'Kvalita', observaciones: 3, piezasConCambios: 0 })).toBe('Kvalita dejó 3 observaciones.');
    expect(avisoCliente({ etapa: 'manual_campana', cliente: 'Kvalita', observaciones: 1, piezasConCambios: 0 })).toBe('Kvalita dejó 1 observación.');
  });
  it('el mes con piezas devueltas', () => {
    expect(avisoCliente({ etapa: 'desarrollo_mensual', cliente: 'Kvalita', observaciones: 0, piezasConCambios: 2 })).toBe('Kvalita pidió cambios en 2 piezas.');
  });
  it('nada que decir: sin recuadro, y nunca en las etapas donde el cliente no opina', () => {
    expect(avisoCliente({ etapa: 'manual_campana', cliente: 'K', observaciones: 0, piezasConCambios: 0 })).toBeNull();
    expect(avisoCliente({ etapa: 'pilares', cliente: 'K', observaciones: 4, piezasConCambios: 4 })).toBeNull();
  });
});

describe('fraseComentario', () => {
  it('dice quién comentó y cuándo, y marca al cliente', () => {
    expect(fraseComentario({ autorId: 'c-1', autor: 'Laura', autorRol: 'cliente', creadoEn: haceHoras(2) }, OPERADOR, AHORA)).toBe('Laura (cliente) comentó hace 2 horas');
    expect(fraseComentario({ autorId: 'op-1', autor: 'Yo', autorRol: 'operador', creadoEn: haceHoras(2) }, OPERADOR, AHORA)).toBe('Comentaste hace 2 horas');
    expect(fraseComentario({ autorId: null, autor: null, autorRol: 'admin', creadoEn: haceHoras(2) }, OPERADOR, AHORA)).toBe('Comentario sin atender · hace 2 horas');
    expect(fraseComentario({ autorId: null, autor: null, autorRol: 'cliente', creadoEn: haceHoras(2) }, OPERADOR, AHORA)).toBe('El cliente comentó hace 2 horas');
  });
});

describe('ordenBotones', () => {
  const botones = [{ id: 'generar' }, { id: 'ver' }, { id: 'aprobar' }, { id: 'pedir_cambios' }];

  it('al admin en revisión: revisar, autorizar, pedir cambios y luego lo demás, sin «Generar»', () => {
    expect(ordenBotones([...botones, { id: 'reabrir' }], 'en_revision', 'admin').map((b) => b.id)).toEqual(['ver', 'aprobar', 'pedir_cambios', 'reabrir']);
  });

  it('en cualquier otro caso respeta el orden de `botonesEtapa`', () => {
    expect(ordenBotones(botones, 'en_revision', 'operador')).toEqual(botones);
    expect(ordenBotones(botones, 'en_proceso', 'admin')).toEqual(botones);
  });
});

describe('cita', () => {
  it('recorta los comentarios largos', () => {
    const c = cita('x'.repeat(400))!;
    expect(c.length).toBeLessThanOrEqual(162);
    expect(c.endsWith('…»')).toBe(true);
    expect(cita('   ')).toBeNull();
  });
});

describe('puntuación de la cita', () => {
  it('no duplica el punto cuando el comentario ya termina en uno', () => {
    const ev = evento({ accion: 'pedir_cambios', usuarioId: 'admin-2', autor: 'Carlos Ruiz', comentario: 'Separa los pilares.' });
    const s = situacionEtapa(entrada({ estado: 'con_cambios', evento: ev }), OPERADOR, AHORA);
    expect(s.recuadro).toBe('Carlos Ruiz pidió cambios hace 3 horas: «Separa los pilares.» Cuando esté listo, vuelve a pedir autorización.');
    expect(s.resumen).toBe('Tienes cambios por hacer · Carlos Ruiz pidió cambios hace 3 horas');
  });
});

describe('columnaEntrega (Inicio · Estado de las entregas)', () => {
  it('el mes compartido con el cliente va en «En proceso», no en «Esperan autorización», y conserva su frase', () => {
    expect(columnaEntrega({ etapa: 'desarrollo_mensual', estado: 'en_revision' })).toBe('proceso');
    expect(situacionEtapa(entrada({ etapa: 'desarrollo_mensual', estado: 'en_revision' }), ADMIN, AHORA).resumen)
      .toBe('Compartido: espera la respuesta del cliente');
  });

  it('las demás etapas en revisión sí esperan autorización', () => {
    for (const etapa of ['investigacion', 'pilares', 'manual_campana'] as const) {
      expect(columnaEntrega({ etapa, estado: 'en_revision' })).toBe('autorizacion');
    }
  });

  it('con cambios, en proceso y el resto', () => {
    expect(columnaEntrega({ etapa: 'pilares', estado: 'con_cambios' })).toBe('cambios');
    expect(columnaEntrega({ etapa: 'desarrollo_mensual', estado: 'con_cambios' })).toBe('cambios');
    expect(columnaEntrega({ etapa: 'manual_campana', estado: 'en_proceso' })).toBe('proceso');
    expect(columnaEntrega({ etapa: 'desarrollo_mensual', estado: 'en_proceso' })).toBe('proceso');
    expect(columnaEntrega({ etapa: 'investigacion', estado: 'aprobada' })).toBeNull();
    expect(columnaEntrega({ etapa: 'investigacion', estado: 'no_iniciada' })).toBeNull();
  });
});
