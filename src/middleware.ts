import { defineMiddleware } from 'astro:middleware';
import { validarSesion } from '@/lib/auth';
import { mismoOrigen, requiereVerificacion } from '@/lib/csrf';
import { rutaPermitida, rutaPublica } from '@/lib/permisos';
import { arrancarWorker } from '@/research/worker';

arrancarWorker();

export const onRequest = defineMiddleware(async (ctx, next) => {
  const ruta = ctx.url.pathname;

  // Sustituye a security.checkOrigin, que no funciona detrás del proxy de Railway.
  if (requiereVerificacion(ctx.request.method) && !mismoOrigen(ctx.request)) {
    return new Response('Origen no permitido', { status: 403 });
  }

  if (rutaPublica(ruta)) return next();

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

  ctx.locals.userId = sesion.id;
  ctx.locals.usuario = sesion;

  const acceso = rutaPermitida(sesion.rol, ruta);
  if (acceso === 'prohibido') {
    return ruta.startsWith('/api/')
      ? new Response(JSON.stringify({ error: 'Prohibido' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      : ctx.redirect('/');
  }
  if (acceso === 'redirigir-portal') return ctx.redirect('/portal');

  return next();
});
