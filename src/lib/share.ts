import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, shareLinks } from '@/db';

export function generarTokenShare(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Lo que puede haber al otro lado de un token público.
 *
 * `contenido` (el entregable del mes, diseño §7) no es como los otros tres: no
 * apunta a una fila de `research_results` / `growth_results` / `pilares_results`
 * con su `datos`, sino al **lote** (`contenido_lotes.id`), y el documento se
 * arma al vuelo con sus piezas. Por eso `src/lib/visibilidad.ts` mantiene su
 * propio `DocumentoTipo` con solo los tres de siempre: ahí «documento» quiere
 * decir «fila con datos y versiones», y el lote no lo es.
 */
export type DocumentoTipo = 'research' | 'growth' | 'pilares' | 'contenido';

export async function crearShareLink(
  documentoId: string,
  documentoTipo: DocumentoTipo = 'research',
): Promise<string> {
  const token = generarTokenShare();
  await db.insert(shareLinks).values({ token, documentoId, documentoTipo });
  return token;
}

/**
 * A qué documento abre un token, SIN contar la visita.
 *
 * Es para las peticiones que cuelgan de una visita que ya se contó: las
 * imágenes del entregable, que el navegador pide solas después de abrir la
 * página. Si cada arte sumara, `visitas` diría cuántas imágenes tiene el
 * documento y no cuánta gente lo abrió.
 *
 * Un token revocado devuelve `null` igual que uno que no existe: confirmar que
 * existió le diría algo a quien solo está probando tokens.
 */
export async function leerShareLink(
  token: string,
): Promise<{ documentoId: string; documentoTipo: DocumentoTipo } | null> {
  const [l] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!l || l.revocado) return null;
  return { documentoId: l.documentoId, documentoTipo: l.documentoTipo as DocumentoTipo };
}

/** Lo mismo, contando la visita: es lo que llama la página del documento. */
export async function resolverShareLink(
  token: string,
): Promise<{ documentoId: string; documentoTipo: DocumentoTipo } | null> {
  const link = await leerShareLink(token);
  if (!link) return null;
  await db.update(shareLinks)
    .set({ visitas: sql`${shareLinks.visitas} + 1` })
    .where(eq(shareLinks.token, token));
  return link;
}

export async function revocarShareLink(token: string): Promise<void> {
  await db.update(shareLinks).set({ revocado: true }).where(eq(shareLinks.token, token));
}
