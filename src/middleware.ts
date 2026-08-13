import { defineMiddleware } from 'astro:middleware';
import { validarSesion } from '@/lib/auth';
import { mismoOrigen, requiereVerificacion } from '@/lib/csrf';
import { arrancarWorker } from '@/research/worker';

arrancarWorker();

const PUBLICAS = [/^\/login$/, /^\/api\/login$/, /^\/p\//];

export const onRequest = defineMiddleware(async (ctx, next) => {
  const ruta = ctx.url.pathname;

  // Sustituye a security.checkOrigin, que no funciona detrás del proxy de Railway.
  if (requiereVerificacion(ctx.request.method) && !mismoOrigen(ctx.request)) {
    return new Response('Origen no permitido', { status: 403 });
  }

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
