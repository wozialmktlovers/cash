import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, shareLinks } from '@/db';

export function generarTokenShare(): string {
  return randomBytes(32).toString('base64url');
}

export type DocumentoTipo = 'research' | 'growth';

export async function crearShareLink(
  documentoId: string,
  documentoTipo: DocumentoTipo = 'research',
): Promise<string> {
  const token = generarTokenShare();
  await db.insert(shareLinks).values({ token, documentoId, documentoTipo });
  return token;
}

export async function resolverShareLink(
  token: string,
): Promise<{ documentoId: string; documentoTipo: DocumentoTipo } | null> {
  const [l] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!l || l.revocado) return null;
  await db.update(shareLinks)
    .set({ visitas: sql`${shareLinks.visitas} + 1` })
    .where(eq(shareLinks.token, token));
  return { documentoId: l.documentoId, documentoTipo: l.documentoTipo as DocumentoTipo };
}

export async function revocarShareLink(token: string): Promise<void> {
  await db.update(shareLinks).set({ revocado: true }).where(eq(shareLinks.token, token));
}
