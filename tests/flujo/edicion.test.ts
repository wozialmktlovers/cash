import { describe, it, expect } from 'vitest';
import { aplicarCambios, validarDocumento, puedeEditar } from '@/flujo/edicion';
import investigacionCompleta from '../fixtures/investigacion-completa.json';
import lecturaEjemplo from '../fixtures/lectura-ejemplo.json';
import growthCompleto from '../fixtures/growth-completo.json';
import { mapaFalso } from '../fixtures/pilares';

describe('aplicarCambios', () => {
  it('aplica un cambio en una ruta válida', () => {
    const datos = { a: { b: 'hola' } };
    const r = aplicarCambios(datos, [{ ruta: 'a.b', valor: 'adiós' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.datos as any).a.b).toBe('adiós');
  });

  it('no muta la entrada', () => {
    const datos = { a: { b: 'hola' } };
    aplicarCambios(datos, [{ ruta: 'a.b', valor: 'adiós' }]);
    expect(datos.a.b).toBe('hola');
  });

  it('navega índices de arreglo válidos', () => {
    const datos = { items: ['uno', 'dos', 'tres'] };
    const r = aplicarCambios(datos, [{ ruta: 'items.1', valor: 'dos editado' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.datos as any).items).toEqual(['uno', 'dos editado', 'tres']);
  });

  it('aplica varios cambios sobre rutas distintas en un solo lote', () => {
    const datos = { a: { b: 'x' }, items: ['uno', 'dos'] };
    const r = aplicarCambios(datos, [{ ruta: 'a.b', valor: 'y' }, { ruta: 'items.0', valor: 'cambiado' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.datos as any).a.b).toBe('y');
      expect((r.datos as any).items[0]).toBe('cambiado');
    }
  });

  it('rechaza una ruta inexistente (segmento intermedio)', () => {
    const r = aplicarCambios({ a: { b: 'x' } }, [{ ruta: 'a.c.d', valor: 'y' }]);
    expect(r.ok).toBe(false);
  });

  it('rechaza una ruta inexistente (segmento final)', () => {
    const r = aplicarCambios({ a: { b: 'x' } }, [{ ruta: 'a.z', valor: 'y' }]);
    expect(r.ok).toBe(false);
  });

  it('rechaza un índice de arreglo fuera de rango', () => {
    const r = aplicarCambios({ items: ['uno'] }, [{ ruta: 'items.5', valor: 'y' }]);
    expect(r.ok).toBe(false);
  });

  it('rechaza un índice de arreglo que no es un entero válido', () => {
    const r1 = aplicarCambios({ items: ['uno', 'dos'] }, [{ ruta: 'items.01', valor: 'y' }]);
    expect(r1.ok).toBe(false);
    const r2 = aplicarCambios({ items: ['uno', 'dos'] }, [{ ruta: 'items.-1', valor: 'y' }]);
    expect(r2.ok).toBe(false);
    const r3 = aplicarCambios({ items: ['uno', 'dos'] }, [{ ruta: 'items.1.5', valor: 'y' }]);
    expect(r3.ok).toBe(false);
  });

  it('rechaza un destino que no es un string', () => {
    const r1 = aplicarCambios({ a: { b: 42 } }, [{ ruta: 'a.b', valor: 'y' }]);
    expect(r1.ok).toBe(false);
    const r2 = aplicarCambios({ a: { b: { c: 1 } } }, [{ ruta: 'a.b', valor: 'y' }]);
    expect(r2.ok).toBe(false);
    const r3 = aplicarCambios({ a: { b: null } }, [{ ruta: 'a.b', valor: 'y' }]);
    expect(r3.ok).toBe(false);
  });

  it('rechaza un valor que no es string', () => {
    const r = aplicarCambios({ a: { b: 'x' } }, [{ ruta: 'a.b', valor: 42 as unknown as string }]);
    expect(r.ok).toBe(false);
  });

  it('rechaza __proto__, constructor y prototype, a cualquier profundidad', () => {
    const datos = { a: { b: 'x' } };
    for (const ruta of ['__proto__.polluted', 'a.__proto__.polluted', 'constructor.polluted', 'a.constructor.polluted', 'prototype.polluted', 'a.prototype']) {
      const r = aplicarCambios(datos, [{ ruta, valor: 'y' }]);
      expect(r.ok, `ruta rechazada: ${ruta}`).toBe(false);
    }
    // Nunca se contaminó el prototipo real.
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rechaza un valor que supera los 2000 caracteres', () => {
    const r = aplicarCambios({ a: { b: 'x' } }, [{ ruta: 'a.b', valor: 'y'.repeat(2001) }]);
    expect(r.ok).toBe(false);
  });

  it('acepta un valor de exactamente 2000 caracteres', () => {
    const r = aplicarCambios({ a: { b: 'x' } }, [{ ruta: 'a.b', valor: 'y'.repeat(2000) }]);
    expect(r.ok).toBe(true);
  });

  it('rechaza más de 200 cambios', () => {
    const datos = { items: Array.from({ length: 201 }, (_, i) => `v${i}`) };
    const cambios = Array.from({ length: 201 }, (_, i) => ({ ruta: `items.${i}`, valor: `n${i}` }));
    const r = aplicarCambios(datos, cambios);
    expect(r.ok).toBe(false);
  });

  it('acepta exactamente 200 cambios', () => {
    const datos = { items: Array.from({ length: 200 }, (_, i) => `v${i}`) };
    const cambios = Array.from({ length: 200 }, (_, i) => ({ ruta: `items.${i}`, valor: `n${i}` }));
    const r = aplicarCambios(datos, cambios);
    expect(r.ok).toBe(true);
  });

  it('si un solo cambio del lote falla, no se aplica ninguno', () => {
    const datos = { a: { b: 'x' }, c: { d: 'y' } };
    const r = aplicarCambios(datos, [{ ruta: 'a.b', valor: 'nuevo' }, { ruta: 'c.z', valor: 'no existe' }]);
    expect(r.ok).toBe(false);
    // La entrada tampoco se tocó.
    expect(datos.a.b).toBe('x');
  });
});

describe('validarDocumento', () => {
  it('research: acepta el fixture completo', () => {
    const r = validarDocumento('research', investigacionCompleta);
    expect(r.ok).toBe(true);
  });

  it('research: rechaza un documento que no cumple el esquema', () => {
    const roto = JSON.parse(JSON.stringify(investigacionCompleta));
    // `fuente` es obligatoria en cada competidor: quitarla rompe el esquema.
    delete roto.competencia.datos.directos[0].fuente;
    const r = validarDocumento('research', roto);
    expect(r.ok).toBe(false);
  });

  it('research: los mensajes de error llevan la ruta del campo delante', () => {
    const roto = JSON.parse(JSON.stringify(investigacionCompleta));
    delete roto.competencia.datos.directos[0].fuente;
    const r = validarDocumento('research', roto);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.length).toBeGreaterThan(0);
      // El formato es "a.b.0.c: mensaje" (igual que validarCliente en
      // src/lib/clientes.ts) — B6, ronda de arreglos 1, punto 8.
      expect(r.errores[0]).toMatch(/^competencia\.datos\.directos\.0\.fuente/);
    }
  });

  it('research: una lectura vieja (inválida) no bloquea editar el resto del documento', () => {
    // La lectura ya viene rota ANTES del cambio (le falta casi todo el
    // esquema actual, como una investigación v1 sin `cifras`): el mismo
    // `datos` como "antes" y "después" simula un cambio que no la toca.
    const conLecturaRota = { ...investigacionCompleta, lectura: { estado: 'ok', datos: { portada: { titular: 'x', resumen: 'y' } } } };
    const r = validarDocumento('research', conLecturaRota, conLecturaRota);
    expect(r.ok).toBe(true);
  });

  it('research: sin `datosAnteriores`, la lectura sí se revalida (por seguridad)', () => {
    const conLecturaRota = { ...investigacionCompleta, lectura: { estado: 'ok', datos: { portada: { titular: 'x', resumen: 'y' } } } };
    const r = validarDocumento('research', conLecturaRota);
    expect(r.ok).toBe(false);
  });

  it('research: si la lectura SÍ era válida antes, un cambio que la rompe se sigue rechazando', () => {
    const antes = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } };
    const despues = JSON.parse(JSON.stringify(antes));
    delete despues.lectura.datos.portada; // rompe lecturaSchema
    const r = validarDocumento('research', despues, antes);
    expect(r.ok).toBe(false);
  });

  it('research: si la lectura era válida y el cambio no la toca, sigue validando (y pasa)', () => {
    const antes = { ...investigacionCompleta, lectura: { estado: 'ok', datos: lecturaEjemplo } };
    const r = validarDocumento('research', antes, antes);
    expect(r.ok).toBe(true);
  });

  it('pilares: acepta el mapa de prueba (estrategia + temas)', () => {
    const mapa = mapaFalso();
    const r = validarDocumento('pilares', mapa);
    expect(r.ok).toBe(true);
  });

  it('pilares: rechaza si la estrategia no cumple estrategiaSchema', () => {
    const mapa: any = mapaFalso();
    mapa.estrategia.mix[0].porcentaje = 5; // rompe la suma de 100
    const r = validarDocumento('pilares', mapa);
    expect(r.ok).toBe(false);
  });

  it('pilares: rechaza si un tema del banco no cumple temaGeneradoSchema', () => {
    const mapa: any = mapaFalso();
    mapa.pilares[0].subcategorias[0].temas[0].funcion = 'no-existe';
    const r = validarDocumento('pilares', mapa);
    expect(r.ok).toBe(false);
  });

  it('pilares: ignora los pilares vacíos (sin subcategorías/temas que validar)', () => {
    const mapa: any = mapaFalso();
    mapa.pilares[0] = { numero: 1, estado: 'vacio', razon: 'No se generó' };
    const r = validarDocumento('pilares', mapa);
    expect(r.ok).toBe(true);
  });

  it('growth: acepta el fixture completo', () => {
    const r = validarDocumento('growth', growthCompleto);
    expect(r.ok).toBe(true);
  });

  it('growth: acepta un documento parcial (algunos campos ausentes)', () => {
    const r = validarDocumento('growth', { semanas: 4, bloqueantes: ['algo'], reglasCopy: ['algo'] });
    expect(r.ok).toBe(true);
  });

  it('growth: rechaza si un campo presente no cumple su esquema', () => {
    const roto = JSON.parse(JSON.stringify(growthCompleto));
    roto.campanasMeta[0].grupo = 'z'; // fuera del enum GRUPOS
    const r = validarDocumento('growth', roto);
    expect(r.ok).toBe(false);
  });
});

describe('puedeEditar', () => {
  it('admin siempre puede editar, sin importar el estado', () => {
    for (const estado of ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      expect(puedeEditar('admin', false, estado)).toBe(true);
      expect(puedeEditar('admin', true, estado)).toBe(true);
    }
  });

  it('operador asignado puede editar salvo en_revision', () => {
    expect(puedeEditar('operador', true, 'no_iniciada')).toBe(true);
    expect(puedeEditar('operador', true, 'en_proceso')).toBe(true);
    expect(puedeEditar('operador', true, 'con_cambios')).toBe(true);
    expect(puedeEditar('operador', true, 'aprobada')).toBe(true);
    expect(puedeEditar('operador', true, 'en_revision')).toBe(false);
  });

  it('operador no asignado nunca puede editar', () => {
    for (const estado of ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      expect(puedeEditar('operador', false, estado)).toBe(false);
    }
  });

  it('cliente nunca puede editar', () => {
    for (const estado of ['no_iniciada', 'en_proceso', 'en_revision', 'con_cambios', 'aprobada'] as const) {
      expect(puedeEditar('cliente', true, estado)).toBe(false);
      expect(puedeEditar('cliente', false, estado)).toBe(false);
    }
  });
});
