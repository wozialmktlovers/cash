// Las dependencias del desarrollo mensual resueltas contra la base: hay una
// investigación con datos y un mapa de pilares con temas para este cliente.
// Es el único lugar que hace esas dos consultas, para que todos los puntos de
// entrada (abrir el lote, dar de alta piezas, proponer temas, generar el mes,
// propuestas de copy, la ficha, la pantalla del mes y `iniciar`) digan lo
// mismo con las mismas palabras. La regla pura vive en `dependenciasCumplidas`
// (./reglas.ts).

import { eq } from 'drizzle-orm';
import { db, researchResults, pilaresResults } from '@/db';
import { investigacionUtil, mapaUtil } from '@/lib/precheck';
import { dependenciasCumplidas, type EtapaCliente } from './reglas';

export type DependenciasMes = {
  ok: boolean;
  razon: string;
  hayInvestigacionConDatos: boolean;
  hayMapaDePilares: boolean;
};

/** ¿Puede este cliente crear o generar contenido mensual? La razón, si no, ya viene redactada. */
export async function dependenciasDelMes(clientId: string, etapas: EtapaCliente[] = []): Promise<DependenciasMes> {
  const [investigaciones, mapas] = await Promise.all([
    db.select({ datos: researchResults.datos, version: researchResults.version }).from(researchResults).where(eq(researchResults.clientId, clientId)),
    db.select({ datos: pilaresResults.datos, version: pilaresResults.version }).from(pilaresResults).where(eq(pilaresResults.clientId, clientId)),
  ]);
  const hayInvestigacion = Boolean(investigacionUtil(investigaciones));
  const hayMapa = Boolean(mapaUtil(mapas));
  const r = dependenciasCumplidas('desarrollo_mensual', etapas, hayInvestigacion, hayMapa);
  return { ...r, hayInvestigacionConDatos: hayInvestigacion, hayMapaDePilares: hayMapa };
}
