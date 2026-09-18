import { describe, it, expect } from 'vitest';
import { validarCambioPieza, validarNuevaPieza, piezaVisibleJson, type FilaPieza } from '@/contenido/piezas';
import { destinatarios, textoAviso } from '@/flujo/avisos';

/**
 * Los campos que agregó la generación del mes con IA —prompt de imagen, guion
 * por escenas y tarjetas del carrusel— se editan a mano con los mismos topes.
 */

describe('prompt de imagen, guion y tarjetas en la API de piezas', () => {
  it('el alta los deja vacíos por omisión', () => {
    const r = validarNuevaPieza({ formato: 'reel', plataforma: 'ambas' });
    expect(r.ok && r.datos).toMatchObject({ promptImagen: '', guion: [], tarjetas: [] });
  });

  it('la edición los acepta y quita renglones vacíos', () => {
    const r = validarCambioPieza({
      promptImagen: '  Foto cenital  ',
      guion: [{ visual: 'Plano', texto: 'Voz' }, { visual: '', texto: '' }],
      tarjetas: ['Uno', '', 'Dos'],
    });
    expect(r.ok && r.datos).toEqual({ promptImagen: 'Foto cenital', guion: [{ visual: 'Plano', texto: 'Voz' }], tarjetas: ['Uno', 'Dos'] });
  });

  it('respeta los topes', () => {
    expect(validarCambioPieza({ promptImagen: 'x'.repeat(1001) }).ok).toBe(false);
    expect(validarCambioPieza({ tarjetas: Array.from({ length: 11 }, () => 't') }).ok).toBe(false);
    expect(validarCambioPieza({ tarjetas: ['x'.repeat(301)] }).ok).toBe(false);
    expect(validarCambioPieza({ guion: Array.from({ length: 13 }, () => ({ visual: 'v', texto: 't' })) }).ok).toBe(false);
    expect(validarCambioPieza({ guion: [{ visual: 'v' }] }).ok).toBe(false);
    // Los de siempre siguen iguales.
    expect(validarCambioPieza({ copy: 'x'.repeat(2201) }).ok).toBe(false);
    expect(validarCambioPieza({ briefVisual: 'x'.repeat(401) }).ok).toBe(false);
  });

  it('la respuesta los lee con cuidado aunque la columna traiga basura', () => {
    const fila = {
      id: 'p', loteId: 'l', numero: 1, formato: 'reel', plataforma: 'ambas', fechaPublicacion: null, temaId: null,
      copy: '', cta: '', hashtags: '', briefVisual: '', promptImagen: 'P', guion: [{ visual: 'v' }, 'basura'], tarjetas: ['a', 3],
      arte: [], estadoCliente: 'pendiente', notaCliente: null, revisadoEn: null, actualizadoEn: new Date(),
    } as unknown as FilaPieza;
    const v = piezaVisibleJson(fila);
    expect(v.guion).toEqual([{ visual: 'v', texto: '' }]);
    expect(v.tarjetas).toEqual(['a']);
  });
});

describe('el aviso en la campana al terminar', () => {
  const autor = { id: 'u1', email: 'o@x.mx', nombre: null, apellido: null, rol: 'operador' as const, activo: true };
  it('le llega solo a quien lo lanzó y dice de qué mes y cuántas piezas', () => {
    expect(destinatarios('mes_generado', { admins: [], operador: null, autor, usuariosCliente: [], etapaVisibleCliente: false }))
      .toEqual([autor]);
    const t = textoAviso('mes_generado', { cliente: 'Negocio', etapa: 'Desarrollo mensual', periodo: '2026-10', detalle: '22 piezas' });
    expect(t.titulo).toBe('El contenido de Octubre 2026 de Negocio está listo');
    expect(t.texto).toContain('22 piezas');
  });
});
