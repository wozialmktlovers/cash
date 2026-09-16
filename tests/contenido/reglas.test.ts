import { describe, it, expect } from 'vitest';
import {
  FORMATOS,
  ESTADOS_REVISION,
  limiteRevision,
  loteAutoAprobado,
  avanceRevision,
  cuadraConPaquete,
  estadoLoteSegunPiezas,
  periodoValido,
  type PiezaRevisable,
  type LoteRevisable,
} from '@/contenido/reglas';

/**
 * Instante UTC de una hora civil de Ciudad de México. Se escribe a mano con el
 * offset fijo (−06:00 todo el año desde 2022) en vez de reusar el módulo bajo
 * prueba: si `reglas.ts` se equivoca de huso, la prueba no hereda el error.
 */
const mx = (civil: string): Date => new Date(`${civil}-06:00`);

/**
 * Cómo se lee un instante en el reloj de Ciudad de México: «2026-09-15 23:59:59».
 * Se truncan los milisegundos antes de formatear porque `Intl` los redondea, y
 * las 23:59:59.999 se leerían como el día siguiente a las 00:00:00. El
 * milisegundo exacto se comprueba aparte, en la prueba del día UTC.
 */
const relojMX = (d: Date): string => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(Math.floor(d.getTime() / 1000) * 1000));
  const v = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}:${v('second')}`;
};

const pieza = (over: Partial<PiezaRevisable> = {}): PiezaRevisable => ({
  formato: 'post',
  estadoCliente: 'pendiente',
  ...over,
});

const lote = (over: Partial<LoteRevisable> = {}): LoteRevisable => ({
  compartidoEn: mx('2026-09-11T17:00:00'),
  limiteRevision: mx('2026-09-15T23:59:59.999'),
  estado: 'pendiente',
  ...over,
});

describe('constantes', () => {
  it('FORMATOS y ESTADOS_REVISION traen los valores del diseño en orden', () => {
    expect(FORMATOS).toEqual(['post', 'carrusel', 'reel', 'historia']);
    expect(ESTADOS_REVISION).toEqual(['pendiente', 'aprobada', 'cambios']);
  });
});

describe('limiteRevision', () => {
  // Fechas de referencia: jue 10, vie 11, sáb 12, dom 13, lun 14, mar 15,
  // mié 16 de septiembre de 2026.

  it('por omisión da 2 días hábiles', () => {
    expect(limiteRevision(mx('2026-09-11T17:00:00'))).toEqual(limiteRevision(mx('2026-09-11T17:00:00'), 2));
  });

  it('compartir un viernes por la tarde no gasta el fin de semana: vence al cerrar el martes', () => {
    // El viernes ya casi terminó, así que no cuenta: cuentan lunes y martes, y
    // el cliente conserva el martes completo.
    expect(relojMX(limiteRevision(mx('2026-09-11T17:00:00'), 2))).toBe('2026-09-15 23:59:59');
  });

  it('compartir un sábado no consume el fin de semana: 1 día hábil vence al cerrar el lunes', () => {
    expect(relojMX(limiteRevision(mx('2026-09-12T10:00:00'), 1))).toBe('2026-09-14 23:59:59');
  });

  it('compartir a medianoche en punto no regala ni quita un día', () => {
    // Lunes 00:00: el lunes es el día en que se comparte, así que no cuenta;
    // cuentan martes y miércoles.
    expect(relojMX(limiteRevision(mx('2026-09-14T00:00:00'), 2))).toBe('2026-09-16 23:59:59');
  });

  it('cuenta los días en el reloj de México, no en el del servidor', () => {
    // Jueves 19:00 en México ya es viernes en UTC, y el servidor corre en UTC.
    const compartido = mx('2026-09-10T19:00:00');
    expect(compartido.getUTCDay()).toBe(5); // viernes en UTC
    // Contando desde el jueves: viernes (1) y lunes (2).
    expect(relojMX(limiteRevision(compartido, 2))).toBe('2026-09-14 23:59:59');
  });

  it('vence al cerrar el día mexicano, no el día UTC', () => {
    // Las 23:59:59.999 de México son las 05:59:59.999 UTC del día siguiente.
    // Cerrar en el día UTC recortaría seis horas al cliente.
    expect(limiteRevision(mx('2026-09-11T17:00:00'), 2).toISOString()).toBe('2026-09-16T05:59:59.999Z');
  });

  it('cruza el fin de mes sin perderse', () => {
    // Miércoles 30 de septiembre: jueves (1) y viernes (2) de octubre.
    expect(relojMX(limiteRevision(mx('2026-09-30T09:00:00'), 2))).toBe('2026-10-02 23:59:59');
  });

  it('no contempla festivos: el 16 de septiembre cuenta como día hábil', () => {
    expect(relojMX(limiteRevision(mx('2026-09-15T09:00:00'), 1))).toBe('2026-09-16 23:59:59');
  });

  it('cero días hábiles vence al cerrar el mismo día', () => {
    expect(relojMX(limiteRevision(mx('2026-09-11T17:00:00'), 0))).toBe('2026-09-11 23:59:59');
  });

  it('rechaza plazos que no sean enteros no negativos', () => {
    expect(() => limiteRevision(mx('2026-09-11T17:00:00'), -1)).toThrow();
    expect(() => limiteRevision(mx('2026-09-11T17:00:00'), 1.5)).toThrow();
    expect(() => limiteRevision(mx('2026-09-11T17:00:00'), Number.NaN)).toThrow();
  });

  it('rechaza una fecha de compartido inválida', () => {
    expect(() => limiteRevision(new Date('no es fecha'), 2)).toThrow();
  });
});

describe('loteAutoAprobado', () => {
  it('se aprueba solo cuando el plazo ya venció y el cliente no dijo nada', () => {
    expect(loteAutoAprobado(lote(), mx('2026-09-16T09:00:00'))).toBe(true);
  });

  it('el instante exacto del límite todavía es del cliente', () => {
    expect(loteAutoAprobado(lote(), mx('2026-09-15T23:59:59.999'))).toBe(false);
    expect(loteAutoAprobado(lote(), new Date(mx('2026-09-15T23:59:59.999').getTime() + 1))).toBe(true);
  });

  it('un lote que no se ha compartido nunca se auto-aprueba', () => {
    expect(loteAutoAprobado(lote({ compartidoEn: null }), mx('2026-09-30T09:00:00'))).toBe(false);
  });

  it('sin fecha límite no se auto-aprueba', () => {
    expect(loteAutoAprobado(lote({ limiteRevision: null }), mx('2026-09-30T09:00:00'))).toBe(false);
  });

  it('un lote ya aprobado no se vuelve a aprobar', () => {
    expect(loteAutoAprobado(lote({ estado: 'aprobada' }), mx('2026-09-30T09:00:00'))).toBe(false);
  });

  it('si el cliente pidió cambios, el silencio ya se rompió: no se auto-aprueba', () => {
    expect(loteAutoAprobado(lote({ estado: 'cambios' }), mx('2026-09-30T09:00:00'))).toBe(false);
  });
});

describe('avanceRevision', () => {
  it('cuenta cuántas piezas aprobó el cliente', () => {
    const piezas = [
      pieza({ estadoCliente: 'aprobada' }),
      pieza({ estadoCliente: 'aprobada' }),
      pieza({ estadoCliente: 'aprobada' }),
      pieza({ estadoCliente: 'pendiente' }),
    ];
    expect(avanceRevision(piezas)).toEqual({ aprobadas: 3, total: 4, porcentaje: 75 });
  });

  it('las piezas con cambios no cuentan como aprobadas', () => {
    expect(avanceRevision([pieza({ estadoCliente: 'cambios' }), pieza({ estadoCliente: 'aprobada' })])).toEqual({
      aprobadas: 1,
      total: 2,
      porcentaje: 50,
    });
  });

  it('redondea el porcentaje', () => {
    const piezas = [pieza({ estadoCliente: 'aprobada' }), pieza(), pieza()];
    expect(avanceRevision(piezas).porcentaje).toBe(33);
  });

  it('un lote sin piezas está en cero, no dividido entre cero', () => {
    expect(avanceRevision([])).toEqual({ aprobadas: 0, total: 0, porcentaje: 0 });
  });
});

describe('cuadraConPaquete', () => {
  it('lista vacía cuando el mes cuadra con lo pactado', () => {
    const piezas = [pieza({ formato: 'post' }), pieza({ formato: 'post' }), pieza({ formato: 'reel' })];
    expect(cuadraConPaquete(piezas, { post: 2, reel: 1 })).toEqual([]);
  });

  it('avisa de lo que falta', () => {
    const piezas = [pieza({ formato: 'historia' })];
    expect(cuadraConPaquete(piezas, { historia: 3 })).toEqual([
      { formato: 'historia', esperadas: 3, hay: 1, faltan: 2 },
    ]);
  });

  it('también avisa cuando sobran piezas, con faltan en negativo', () => {
    const piezas = [pieza({ formato: 'post' }), pieza({ formato: 'post' }), pieza({ formato: 'post' })];
    expect(cuadraConPaquete(piezas, { post: 1 })).toEqual([{ formato: 'post', esperadas: 1, hay: 3, faltan: -2 }]);
  });

  it('un formato que el paquete no contempla sale como sobrante', () => {
    expect(cuadraConPaquete([pieza({ formato: 'reel' })], { post: 0 })).toEqual([
      { formato: 'reel', esperadas: 0, hay: 1, faltan: -1 },
    ]);
  });

  it('un formato pactado en cero y sin piezas no se reporta', () => {
    expect(cuadraConPaquete([], { post: 0, reel: 0 })).toEqual([]);
  });

  it('sin paquete definido no hay nada que avisar', () => {
    expect(cuadraConPaquete([pieza({ formato: 'post' })], {})).toEqual([
      { formato: 'post', esperadas: 0, hay: 1, faltan: -1 },
    ]);
    expect(cuadraConPaquete([], {})).toEqual([]);
  });

  it('reporta en el orden de FORMATOS, para que el aviso no baile', () => {
    const piezas = [pieza({ formato: 'historia' }), pieza({ formato: 'carrusel' })];
    const diferencias = cuadraConPaquete(piezas, { post: 1, carrusel: 2, historia: 2 });
    expect(diferencias.map((d) => d.formato)).toEqual(['post', 'carrusel', 'historia']);
  });
});

describe('estadoLoteSegunPiezas', () => {
  it('aprobada cuando todas las piezas lo están', () => {
    const piezas = [pieza({ estadoCliente: 'aprobada' }), pieza({ estadoCliente: 'aprobada' })];
    expect(estadoLoteSegunPiezas(piezas)).toBe('aprobada');
  });

  it('pendiente mientras falte alguna por revisar', () => {
    const piezas = [pieza({ estadoCliente: 'aprobada' }), pieza({ estadoCliente: 'pendiente' })];
    expect(estadoLoteSegunPiezas(piezas)).toBe('pendiente');
  });

  it('cambios manda sobre pendiente: una sola pieza devuelta regresa el lote al operador', () => {
    const piezas = [pieza({ estadoCliente: 'cambios' }), pieza({ estadoCliente: 'pendiente' })];
    expect(estadoLoteSegunPiezas(piezas)).toBe('cambios');
  });

  it('un lote sin piezas sigue pendiente, no aprobado', () => {
    expect(estadoLoteSegunPiezas([])).toBe('pendiente');
  });
});

describe('periodoValido', () => {
  it('acepta YYYY-MM con mes de 01 a 12', () => {
    expect(periodoValido('2026-09')).toBe(true);
    expect(periodoValido('2026-01')).toBe(true);
    expect(periodoValido('2026-12')).toBe(true);
  });

  it('rechaza meses fuera de rango', () => {
    expect(periodoValido('2026-00')).toBe(false);
    expect(periodoValido('2026-13')).toBe(false);
  });

  it('rechaza formatos que no son YYYY-MM', () => {
    expect(periodoValido('2026-9')).toBe(false);
    expect(periodoValido('26-09')).toBe(false);
    expect(periodoValido('2026-09-01')).toBe(false);
    expect(periodoValido('2026/09')).toBe(false);
    expect(periodoValido(' 2026-09 ')).toBe(false);
    expect(periodoValido('')).toBe(false);
  });

  it('rechaza lo que no es texto', () => {
    expect(periodoValido(null)).toBe(false);
    expect(periodoValido(202609)).toBe(false);
    expect(periodoValido(undefined)).toBe(false);
  });
});
