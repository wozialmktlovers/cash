import { execSync } from 'node:child_process';
import { bootstrapAdmin } from './bootstrap-admin.mjs';
import { sembrarEjemplo } from './sembrar-ejemplo.mjs';

console.log('Aplicando migraciones...');
execSync('node scripts/migrate.mjs', { stdio: 'inherit' });

// Solo hace algo si ADMIN_EMAIL y ADMIN_PASSWORD están definidas.
await bootstrapAdmin();

// Investigación real de ejemplo. Idempotente: si ya está, no la duplica.
if (process.env.SEMBRAR_EJEMPLO === '1') {
  try {
    await sembrarEjemplo();
  } catch (e) {
    console.error('[ejemplo] no se pudo sembrar:', e instanceof Error ? e.message : e);
  }
}

console.log('Iniciando servidor...');
await import('../dist/server/entry.mjs');
