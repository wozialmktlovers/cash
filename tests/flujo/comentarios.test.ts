import { describe, it, expect } from 'vitest';
import { validarComentario, puedeCambiarEstadoComentario, comentariosVisibles } from '@/flujo/comentarios';

describe('validarComentario', () => {
  it('acepta un texto y un ancla válidos', () => {
    const r = validarComentario({ texto: 'Falta aclarar el precio', ancla: 'seccion:recomendamos' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto).toBe('Falta aclarar el precio');
      expect(r.ancla).toBe('seccion:recomendamos');
    }
  });

  it('recorta el texto con trim antes de medir el largo', () => {
    const r = validarComentario({ texto: '   hola   ', ancla: 'general' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe('hola');
  });

  it('rechaza un texto vacío (o que solo trae espacios)', () => {
    expect(validarComentario({ texto: '', ancla: 'general' }).ok).toBe(false);
    expect(validarComentario({ texto: '   ', ancla: 'general' }).ok).toBe(false);
  });

  it('rechaza un texto de más de 2000 caracteres', () => {
    const r = validarComentario({ texto: 'a'.repeat(2001), ancla: 'general' });
    expect(r.ok).toBe(false);
  });

  it('acepta un texto de exactamente 2000 caracteres', () => {
    const r = validarComentario({ texto: 'a'.repeat(2000), ancla: 'general' });
    expect(r.ok).toBe(true);
  });

  it('acepta las tres formas de ancla del spec', () => {
    expect(validarComentario({ texto: 'x', ancla: 'seccion:recomendamos' }).ok).toBe(true);
    expect(validarComentario({ texto: 'x', ancla: 'lectura.datos.descubrimos.2' }).ok).toBe(true);
    expect(validarComentario({ texto: 'x', ancla: 'tema:P2-S1-07' }).ok).toBe(true);
    expect(validarComentario({ texto: 'x', ancla: 'general' }).ok).toBe(true);
  });

  it('rechaza un ancla vacía', () => {
    expect(validarComentario({ texto: 'x', ancla: '' }).ok).toBe(false);
  });

  it('rechaza un ancla de más de 200 caracteres', () => {
    expect(validarComentario({ texto: 'x', ancla: 'a'.repeat(201) }).ok).toBe(false);
  });

  it('rechaza un ancla con caracteres fuera de [\\w:.-]', () => {
    expect(validarComentario({ texto: 'x', ancla: 'seccion:<script>' }).ok).toBe(false);
    expect(validarComentario({ texto: 'x', ancla: 'con espacio' }).ok).toBe(false);
    expect(validarComentario({ texto: 'x', ancla: 'con/slash' }).ok).toBe(false);
  });

  it('junta los dos errores cuando texto y ancla son inválidos', () => {
    const r = validarComentario({ texto: '', ancla: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.length).toBe(2);
  });
});

describe('puedeCambiarEstadoComentario', () => {
  it('atendido: lo marca el operador asignado', () => {
    expect(puedeCambiarEstadoComentario('operador', true, 'atendido')).toBe(true);
  });

  it('atendido: lo marca un admin', () => {
    expect(puedeCambiarEstadoComentario('admin', false, 'atendido')).toBe(true);
  });

  it('atendido: un operador no asignado no puede', () => {
    expect(puedeCambiarEstadoComentario('operador', false, 'atendido')).toBe(false);
  });

  it('descartado: solo un admin', () => {
    expect(puedeCambiarEstadoComentario('admin', false, 'descartado')).toBe(true);
    expect(puedeCambiarEstadoComentario('operador', true, 'descartado')).toBe(false);
  });

  it('abierto (reabrir): solo un admin', () => {
    expect(puedeCambiarEstadoComentario('admin', false, 'abierto')).toBe(true);
    expect(puedeCambiarEstadoComentario('operador', true, 'abierto')).toBe(false);
  });

  it('el cliente nunca puede cambiar el estado de un comentario', () => {
    expect(puedeCambiarEstadoComentario('cliente', false, 'atendido')).toBe(false);
    expect(puedeCambiarEstadoComentario('cliente', false, 'descartado')).toBe(false);
    expect(puedeCambiarEstadoComentario('cliente', false, 'abierto')).toBe(false);
  });
});

describe('comentariosVisibles', () => {
  type C = { id: string; autorId: string | null; respuestaDe: string | null };

  const lista: C[] = [
    { id: 'c1', autorId: 'cliente-1', respuestaDe: null }, // hilo del cliente
    { id: 'c2', autorId: 'operador-1', respuestaDe: 'c1' }, // respuesta del equipo al hilo del cliente
    { id: 'c3', autorId: 'admin-1', respuestaDe: null }, // comentario interno, ajeno al cliente
    { id: 'c4', autorId: 'cliente-2', respuestaDe: null }, // hilo de OTRO cliente
    { id: 'c5', autorId: 'operador-1', respuestaDe: 'c4' }, // respuesta al hilo de otro cliente
  ];

  it('el personal ve la lista completa tal cual llega', () => {
    expect(comentariosVisibles('admin', 'admin-1', lista)).toEqual(lista);
    expect(comentariosVisibles('operador', 'operador-1', lista)).toEqual(lista);
  });

  it('el cliente solo ve sus propios hilos y las respuestas dentro de ellos', () => {
    const r = comentariosVisibles('cliente', 'cliente-1', lista);
    expect(r.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('el cliente no ve comentarios ni respuestas de hilos ajenos', () => {
    const r = comentariosVisibles('cliente', 'cliente-1', lista);
    expect(r.some((c) => c.id === 'c3' || c.id === 'c4' || c.id === 'c5')).toBe(false);
  });

  it('una lista vacía da una lista vacía para cualquier rol', () => {
    expect(comentariosVisibles('cliente', 'cliente-1', [])).toEqual([]);
    expect(comentariosVisibles('admin', 'admin-1', [])).toEqual([]);
  });
});
