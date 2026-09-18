import type { APIRoute } from 'astro';
import contenido from '@/manual/manual.html?raw';

/**
 * Manual de uso para el equipo (admin y operador). Es una página autónoma,
 * con su propio estilo, así que se sirve tal cual en lugar de pasar por el
 * layout. La sesión y el rol los cuida el middleware: `/manual` no es
 * pública y al rol cliente lo manda a su portal.
 */
const pagina = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex"></head><body>${contenido}</body></html>`;

export const GET: APIRoute = () =>
  new Response(pagina, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, max-age=300' } });
