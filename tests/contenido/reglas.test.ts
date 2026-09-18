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
  enlaceWeb,
  ESQUEMAS_ARTE,
  type PiezaRevisable,
  type LoteRevisable,
} from '@/contenido/reglas';
import { ESTADOS } from '@/flujo/reglas';

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

/** Un lote compartido y esperando al cliente: el caso del que hablan las reglas. */
const lote = (over: Partial<LoteRevisable> = {}): LoteRevisable => ({
  compartidoEn: mx('2026-09-11T17:00:00'),
  limiteRevision: mx('2026-09-15T23:59:59.999'),
  estado: 'en_revision',
  // El contenido se tocó por última vez ANTES de compartirlo, que es el mes
  // normal: se arma, se reparte y se espera al cliente.
  contenidoActualizadoEn: mx('2026-09-11T16:00:00'),
  ...over,
});

describe('constantes', () => {
  it('FORMATOS y ESTADOS_REVISION traen los valores del diseño en orden', () => {
    expect(FORMATOS).toEqual(['post', 'carrusel', 'reel', 'historia']);
    expect(ESTADOS_REVISION).toEqual(['pendiente', 'aprobada', 'cambios']);
  });

  it('«pendiente» y «cambios» son de la pieza: la columna del lote no los admite', () => {
    // El error que originó este cambio: el lote se comparaba contra
    // 'pendiente', un valor que su columna (`estado_etapa`) no puede tomar, así
    // que sobre una fila real la comparación siempre fallaba en silencio.
    // 'aprobada' sí está en los dos vocabularios, y es justo lo que los vuelve
    // fáciles de confundir.
    expect(ESTADOS).not.toContain('pendiente');
    expect(ESTADOS).not.toContain('cambios');
    expect(ESTADOS).toContain('aprobada');
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
    expect(loteAutoAprobado(lote({ estado: 'con_cambios' }), mx('2026-09-30T09:00:00'))).toBe(false);
  });

  it('un lote que volvió al operador tampoco vence, aunque conserve el compartido de antes', () => {
    // `en_proceso` es el lote que se está armando o que se reabrió para atender
    // los cambios del cliente: no le toca al cliente, así que su fecha límite
    // vieja no puede aprobarlo por la puerta de atrás.
    expect(loteAutoAprobado(lote({ estado: 'en_proceso' }), mx('2026-09-30T09:00:00'))).toBe(false);
  });

  it('solo `en_revision` se auto-aprueba, de todos los estados que puede tener la columna', () => {
    const vencido = mx('2026-09-30T09:00:00');
    const seAprueban = ESTADOS.filter((estado) => loteAutoAprobado(lote({ estado }), vencido));
    expect(seAprueban).toEqual(['en_revision']);
  });

  /**
   * La invariante que deja de depender de por dónde pasó el lote: **el plazo
   * solo vale sobre el contenido que se compartió**. Sustituye a ir limpiando
   * `limite_revision` en cada camino que reabría un mes, que es lo que se había
   * intentado cuatro veces dejando al menos uno abierto.
   */
  describe('y solo si el contenido sigue siendo el que se compartió', () => {
    const vencido = mx('2026-09-30T09:00:00');

    it('si el contenido se movió después del reparto, el plazo ya no vale', () => {
      const tocado = lote({ contenidoActualizadoEn: mx('2026-09-12T10:00:00') });
      expect(loteAutoAprobado(tocado, vencido)).toBe(false);
    });

    it('el empate cuenta como compartió lo que había: se aprueba', () => {
      // Guardar la última pieza y repartir el mes en el mismo instante es
      // repartir esa pieza, no adelantarse a ella.
      const l = lote();
      expect(loteAutoAprobado({ ...l, contenidoActualizadoEn: l.compartidoEn }, vencido)).toBe(true);
    });

    it('un segundo antes del reparto sigue siendo contenido compartido', () => {
      const l = lote();
      const justoAntes = new Date(l.compartidoEn!.getTime() - 1000);
      expect(loteAutoAprobado({ ...l, contenidoActualizadoEn: justoAntes }, vencido)).toBe(true);
    });

    it('sin fecha de contenido no consta que se tocara, y el plazo vale', () => {
      // La columna es `NOT NULL` en la base, así que esto solo llega de una fila
      // anterior a la columna o de un doble de pruebas. Se lee como «no consta
      // que se tocara»: es el comportamiento de antes de la invariante, y no
      // deja lotes congelados sin que nadie pueda desbloquearlos.
      expect(loteAutoAprobado(lote({ contenidoActualizadoEn: null }), vencido)).toBe(true);
    });
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

  it('sigue en revisión mientras falte alguna pieza por revisar', () => {
    const piezas = [pieza({ estadoCliente: 'aprobada' }), pieza({ estadoCliente: 'pendiente' })];
    expect(estadoLoteSegunPiezas(piezas)).toBe('en_revision');
  });

  it('con_cambios manda sobre en_revision: una sola pieza devuelta regresa el lote al operador', () => {
    const piezas = [pieza({ estadoCliente: 'cambios' }), pieza({ estadoCliente: 'pendiente' })];
    expect(estadoLoteSegunPiezas(piezas)).toBe('con_cambios');
  });

  it('un lote sin piezas sigue en revisión, no aprobado', () => {
    expect(estadoLoteSegunPiezas([])).toBe('en_revision');
  });

  it('devuelve estados de etapa, que es lo que la columna del lote admite', () => {
    // Es el punto de todo el cambio: lo que sale de aquí se escribe en
    // `contenido_lotes.estado` y `sincronizarEtapa` lo copia a `cliente_etapas`
    // sin traducirlo, así que tiene que estar en el enum de la etapa.
    const salidas = [
      estadoLoteSegunPiezas([]),
      estadoLoteSegunPiezas([pieza({ estadoCliente: 'pendiente' })]),
      estadoLoteSegunPiezas([pieza({ estadoCliente: 'cambios' })]),
      estadoLoteSegunPiezas([pieza({ estadoCliente: 'aprobada' })]),
    ];
    for (const salida of salidas) expect(ESTADOS).toContain(salida);
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

/**
 * La segunda línea de defensa del enlace del arte. La primera es el esquema de
 * alta (`arteSchema`, src/contenido/piezas.ts), pero `contenido_piezas.arte` es
 * `jsonb` y nadie lo revalida al leerlo, así que el entregable y la pantalla
 * interna preguntan aquí antes de poner nada en un `href` o un `src`.
 */
describe('enlaceWeb', () => {
  it('solo admite http y https', () => {
    expect(ESQUEMAS_ARTE).toEqual(['http:', 'https:']);
  });

  it('devuelve el enlace tal cual, sin normalizarlo', () => {
    const url = 'https://videos.ejemplo.mx/reel-3.mp4?t=10';
    expect(enlaceWeb(url)).toBe(url);
    expect(enlaceWeb('http://ejemplo.mx')).toBe('http://ejemplo.mx');
  });

  it('descarta los esquemas que ejecutan o leen del disco', () => {
    expect(enlaceWeb('javascript:alert(1)')).toBeNull();
    expect(enlaceWeb('JAVASCRIPT:alert(1)')).toBeNull();
    expect(enlaceWeb('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(enlaceWeb('vbscript:msgbox(1)')).toBeNull();
    expect(enlaceWeb('file:///etc/passwd')).toBeNull();
    expect(enlaceWeb('mailto:alguien@ejemplo.mx')).toBeNull();
  });

  it('no se deja engañar por los espacios y tabs que el navegador ignora', () => {
    // El navegador los borra antes de resolver el `href`, así que un
    // `/^https?:\/\//` sobre el texto crudo diría «esto no empieza por http»
    // y dejaría el enlace intacto en el atributo. `URL` los borra igual.
    expect(enlaceWeb(' javascript:alert(1)')).toBeNull();
    expect(enlaceWeb('jav\tascript:alert(1)')).toBeNull();
    expect(enlaceWeb('\njavascript:alert(1)')).toBeNull();
  });

  it('lo que no es una URL, o no es texto, no pasa', () => {
    expect(enlaceWeb('')).toBeNull();
    expect(enlaceWeb('//ejemplo.mx/a.mp4')).toBeNull();
    expect(enlaceWeb('ejemplo.mx/a.mp4')).toBeNull();
    expect(enlaceWeb(null)).toBeNull();
    expect(enlaceWeb(undefined)).toBeNull();
  });
});
