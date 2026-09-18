import type { MetaContenido, PiezaEntregable } from '@/render/contenido/documento';

/**
 * Un lote de septiembre de 2026 con los cuatro formatos, los tres estados de
 * revisión, artes subidos y un reel enlazado fuera. Es el mínimo con el que
 * todas las secciones del entregable tienen algo que pintar.
 *
 * Septiembre de 2026 empieza en martes y tiene 30 días: sirve para comprobar
 * que el calendario deja un hueco antes del día 1 (la semana empieza en lunes).
 */
export function piezasFalsas(): PiezaEntregable[] {
  return [
    {
      id: 'p1', numero: 1, formato: 'post', plataforma: 'ambas',
      fechaPublicacion: '2026-09-01', copy: 'Primera línea\nSegunda línea', cta: 'Agenda tu cita',
      hashtags: '#uno #dos', arte: [{ tipo: 'imagen', fileId: '11111111-1111-4111-8111-111111111111' }],
      estadoCliente: 'aprobada', notaCliente: null,
    },
    {
      id: 'p2', numero: 2, formato: 'carrusel', plataforma: 'instagram',
      fechaPublicacion: '2026-09-04', copy: 'Copy del carrusel', cta: '', hashtags: '#tres',
      arte: [
        { tipo: 'portada', fileId: '22222222-2222-4222-8222-222222222222' },
        { tipo: 'imagen', fileId: '33333333-3333-4333-8333-333333333333' },
        { tipo: 'imagen', fileId: '44444444-4444-4444-8444-444444444444' },
      ],
      estadoCliente: 'cambios', notaCliente: 'Cambiar el color del segundo slide.',
    },
    {
      id: 'p3', numero: 3, formato: 'reel', plataforma: 'facebook',
      fechaPublicacion: '2026-09-10', copy: 'Copy del reel', cta: 'Ve el video', hashtags: '',
      arte: [
        { tipo: 'portada', fileId: '55555555-5555-4555-8555-555555555555' },
        { tipo: 'video', url: 'https://videos.ejemplo.mx/reel-3.mp4' },
      ],
      estadoCliente: 'pendiente', notaCliente: null,
    },
    {
      id: 'p4', numero: 4, formato: 'post', plataforma: 'ambas',
      fechaPublicacion: null, copy: '', cta: '', hashtags: '',
      arte: [], estadoCliente: 'pendiente', notaCliente: null,
    },
    {
      id: 'p5', numero: 5, formato: 'historia', plataforma: 'instagram',
      fechaPublicacion: '2026-09-02', copy: 'Historia del martes', cta: '', hashtags: '',
      arte: [{ tipo: 'imagen', fileId: '66666666-6666-4666-8666-666666666666' }],
      estadoCliente: 'aprobada', notaCliente: null,
    },
    {
      id: 'p6', numero: 6, formato: 'historia', plataforma: 'instagram',
      fechaPublicacion: '2026-09-30', copy: '', cta: '', hashtags: '',
      arte: [{ tipo: 'video', fileId: '77777777-7777-4777-8777-777777777777' }],
      estadoCliente: 'pendiente', notaCliente: null,
    },
  ];
}

export function metaFalsa(extra: Partial<MetaContenido> = {}): MetaContenido {
  return {
    cliente: 'Olam Dental',
    periodo: '2026-09',
    fecha: '2026-09-16',
    compartidoEn: new Date('2026-09-16T18:00:00.000Z'),
    limiteRevision: new Date('2026-09-19T05:59:59.999Z'),
    diasRevision: 2,
    cerrado: false,
    ...extra,
  };
}
