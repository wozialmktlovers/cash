import { describe, it, expect } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { esperaAutorizacionDelAdmin, esperaAlCliente } from '@/lib/pendientes';

/**
 * `en_revision` quiere decir dos cosas distintas según la etapa: en el flujo de
 * siempre, «el admin tiene que autorizar»; en el lote mensual, «se le compartió
 * al cliente y se espera su respuesta». `sincronizarEtapa` copia el estado del
 * lote a `cliente_etapas` sin traducirlo, así que la separación tiene que
 * hacerla quien consulta.
 *
 * Aquí se mira el SQL que sale de las dos condiciones, sin base de datos:
 * `sqlToQuery` compila el fragmento con el dialecto de Postgres y no abre
 * ninguna conexión. Es lo que permite fijar la regla en una prueba, porque el
 * criterio vive en SQL y no en TypeScript — y vive en SQL a propósito: tenerlo
 * además en una función pura sería la segunda copia que estas tres pantallas
 * (contador de la barra, `/pendientes` e Inicio) llevan tiempo evitando.
 */
const compilar = (fragmento: Parameters<PgDialect['sqlToQuery']>[0]) => new PgDialect().sqlToQuery(fragmento);

describe('esperaAutorizacionDelAdmin', () => {
  const { sql, params } = compilar(esperaAutorizacionDelAdmin());

  it('sigue pidiendo en_revision y contratada', () => {
    expect(params).toContain('en_revision');
    expect(sql).toContain('"contratada"');
    expect(params).toContain(true);
  });

  it('deja fuera el lote mensual, que en ese estado espera al cliente y no al admin', () => {
    expect(params).toContain('desarrollo_mensual');
    expect(sql).toMatch(/"etapa"\s*<>/);
  });

  it('no excluye ninguna otra etapa: las tres del flujo de siempre siguen entrando', () => {
    const etapasExcluidas = params.filter((p) =>
      ['investigacion', 'pilares', 'manual_campana'].includes(p as string));
    expect(etapasExcluidas).toEqual([]);
  });
});

describe('esperaAlCliente', () => {
  const { sql, params } = compilar(esperaAlCliente());

  it('es justo lo contrario: el lote mensual en_revision y contratado', () => {
    expect(params).toContain('desarrollo_mensual');
    expect(params).toContain('en_revision');
    expect(sql).toMatch(/"etapa"\s*=/);
    expect(sql).not.toMatch(/"etapa"\s*<>/);
  });
});

/**
 * La invariante que sostiene los tres números: lo que el admin ve en
 * `/pendientes` y lo que cuenta el badge rojo salen de la MISMA condición, no
 * de dos copias. Si alguien vuelve a escribir el `and(...)` a mano en uno de
 * los dos sitios, esto no lo atrapa — lo que sí atrapa es que las dos
 * condiciones sean complementarias, que es la otra mitad del arreglo: un mes
 * `en_revision` cae en una o en la otra, nunca en las dos ni en ninguna.
 */
describe('las dos condiciones se reparten el `en_revision` sin solaparse', () => {
  it('lo que una exige de la etapa, la otra lo prohíbe', () => {
    const admin = compilar(esperaAutorizacionDelAdmin());
    const cliente = compilar(esperaAlCliente());
    expect(admin.params).toContain('desarrollo_mensual');
    expect(cliente.params).toContain('desarrollo_mensual');
    expect(admin.sql).toMatch(/"etapa"\s*<>/);
    expect(cliente.sql).toMatch(/"etapa"\s*=/);
    // Las dos hablan del mismo estado: si una cambiara de estado, dejarían de
    // repartirse nada y un mes podría no salir en ningún sitio.
    expect(admin.params).toContain('en_revision');
    expect(cliente.params).toContain('en_revision');
  });
});
