import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db, users } from '@/db';
import { verifyPassword, crearSesion } from '@/lib/auth';

const intentos = new Map<string, { n: number; hasta: number }>();
const MAX = 3, VENTANA = 5 * 60_000, BLOQUEO = 15 * 60_000;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');

  const ahora = Date.now();
  const reg = intentos.get(email);
  if (reg && reg.n >= MAX && reg.hasta > ahora) {
    return redirect('/login?error=bloqueado');
  }

  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const ok = u ? await verifyPassword(u.passwordHash, password) : false;

  if (!ok) {
    const vigente = reg && reg.hasta > ahora;
    const n = (vigente ? reg.n : 0) + 1;
    intentos.set(email, { n, hasta: n >= MAX ? ahora + BLOQUEO : ahora + VENTANA });
    return redirect(n >= MAX ? '/login?error=bloqueado' : '/login?error=1');
  }

  intentos.delete(email);
  const token = await crearSesion(u!.id);
  cookies.set('sesion', token, {
    httpOnly: true, secure: import.meta.env.PROD, sameSite: 'lax',
    path: '/', maxAge: 30 * 86400,
  });
  return redirect('/');
};
