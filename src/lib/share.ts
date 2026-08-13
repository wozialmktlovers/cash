import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db, shareLinks } from '@/db';

export function generarTokenShare(): string {
  return randomBytes(32).toString('base64url');
}

export async function crearShareLink(resultId: string): Promise<string> {
  const token = generarTokenShare();
  await db.insert(shareLinks).values({ token, resultId });
  return token;
}

export async function resolverShareLink(token: string): Promise<{ resultId: string } | null> {
  const [l] = await db.select().from(shareLinks).where(eq(shareLinks.token, token)).limit(1);
  if (!l || l.revocado) return null;
  await db.update(shareLinks)
    .set({ visitas: sql`${shareLinks.visitas} + 1` })
    .where(eq(shareLinks.token, token));
  return { resultId: l.resultId };
}

export async function revocarShareLink(token: string): Promise<void> {
  await db.update(shareLinks).set({ revocado: true }).where(eq(shareLinks.token, token));
}
