import type { APIRoute } from 'astro';
import { cerrarSesion } from '@/lib/auth';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get('sesion')?.value;
  if (token) await cerrarSesion(token);
  cookies.delete('sesion', { path: '/' });
  return redirect('/login');
};
