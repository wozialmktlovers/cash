import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db, sessions } from '@/db';

const DIAS_SESION = 30;

export async function hashPassword(plano: string): Promise<string> {
  return hash(plano, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(hashGuardado: string, plano: string): Promise<boolean> {
  try { return await verify(hashGuardado, plano); } catch { return false; }
}

export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function crearSesion(userId: string): Promise<string> {
  const id = generarToken();
  const expiresAt = new Date(Date.now() + DIAS_SESION * 86400_000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function validarSesion(token: string): Promise<{ userId: string } | null> {
  if (!token) return null;
  const [s] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);
  if (!s) return null;
  if (s.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }
  return { userId: s.userId };
}

export async function cerrarSesion(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function limpiarSesionesVencidas(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
