import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  server: { port: Number(process.env.PORT) || 4321, host: true },
  // La comprobación propia de Astro compara el Origin contra el esquema que ve
  // el proceso. Detrás de un proxy que termina TLS (Railway) la app se ve como
  // http, así que rechaza el `Origin: https://…` que manda cualquier navegador:
  // 403 en todos los formularios. La sustituye el guardia de src/middleware.ts,
  // que compara el host reenviado por el proxy y sí funciona en producción.
  security: { checkOrigin: false },
});
