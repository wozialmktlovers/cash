import { defineMiddleware } from 'astro:middleware';
import { validarSesion } from '@/lib/auth';
import { arrancarWorker } from '@/research/worker';

arrancarWorker();

const PUBLICAS = [/^\/login$/, /^\/api\/login$/, /^\/p\//];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const ruta = ctx.url.pathname;
  if (PUBLICAS.some((r) => r.test(ruta))) return next();

  const token = ctx.cookies.get('sesion')?.value ?? '';
  const sesion = await validarSesion(token);

  if (!sesion) {
    if (ruta.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }
    return ctx.redirect('/login');
  }

  ctx.locals.userId = sesion.userId;
  return next();
});
