// Quién puede proponer, editar y autorizar los temas del mes. Es una acción
// del FLUJO del desarrollo mensual, no de la ficha: la pueden hacer los
// responsables de la etapa (contenido y diseño) y el admin; cualquier otro
// operador ve todo pero no toca. Reutiliza `esResponsableDeEtapa`
// (src/flujo/responsables.ts), la misma regla que decide las acciones de las
// otras etapas.

import { and, eq } from 'drizzle-orm';
import { db, clienteEtapas } from '@/db';
import { esResponsableDeEtapa } from '@/flujo/responsables';
import type { UsuarioSesion } from '@/lib/permisos';

export const RAZON_SIN_PERMISO_TEMAS =
  'Solo los responsables del desarrollo mensual (contenido y diseño) o un administrador pueden elegir y autorizar los temas del mes.';

export async function puedeElegirTemas(u: UsuarioSesion, clientId: string): Promise<boolean> {
  if (!u.activo) return false;
  if (u.rol === 'admin') return true;
  if (u.rol !== 'operador') return false;
  const [etapa] = await db.select({ id: clienteEtapas.id }).from(clienteEtapas)
    .where(and(eq(clienteEtapas.clientId, clientId), eq(clienteEtapas.etapa, 'desarrollo_mensual'))).limit(1);
  return etapa ? esResponsableDeEtapa(etapa.id, u.id) : false;
}
