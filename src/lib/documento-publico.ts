import { and, eq } from 'drizzle-orm';
import { db, researchResults, growthResults, clients, clientLinks } from '@/db';
import { resolverShareLink } from '@/lib/share';
import { renderizarPresentacion } from '@/render/presentation';
import { renderizarManual } from '@/render/growth/manual';
import { slugificar } from '@/lib/slug';

/**
 * Resuelve un token público y rinde su documento.
 *
 * Compartido por las dos rutas: la antigua `/p/<token>` y la nueva
 * `/p/<negocio>/<token>`. La primera se conserva porque puede haber links ya
 * repartidos, y redirige a la forma con nombre.
 */
export async function resolverDocumentoPublico(token: string): Promise<
  | { tipo: 'html'; html: string; slug: string }
  | { tipo: 'no-encontrado' }
> {
  // Un token revocado o inexistente devuelve lo mismo: confirmar que existió
  // filtraría información a quien solo está probando tokens.
  const link = await resolverShareLink(token);
  if (!link) return { tipo: 'no-encontrado' };

  const tabla = link.documentoTipo === 'growth' ? growthResults : researchResults;
  const [r] = await db.select().from(tabla).where(eq(tabla.id, link.documentoId)).limit(1);
  if (!r) return { tipo: 'no-encontrado' };

  const [c] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  if (!c) return { tipo: 'no-encontrado' };

  const fecha = r.createdAt.toISOString().slice(0, 10);

  const [sitio] = link.documentoTipo === 'growth'
    ? await db.select().from(clientLinks)
        .where(and(eq(clientLinks.clientId, c.id), eq(clientLinks.tipo, 'sitio'))).limit(1)
    : [undefined];

  // El link público nunca lleva barra de operador: es lo que ve el cliente.
  const html = link.documentoTipo === 'growth'
    ? renderizarManual(r.datos as any, {
        cliente: c.nombre, producto: c.producto, fecha,
        ciudad: c.ciudad ?? undefined,
        destino: sitio?.url,
        creadoEn: r.createdAt,
      })
    : renderizarPresentacion(r.datos as any, { cliente: c.nombre, giro: c.giro, fecha });

  return { tipo: 'html', html, slug: slugificar(c.nombre) };
}
