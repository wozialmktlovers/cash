import { execSync } from 'node:child_process';
import { bootstrapAdmin } from './bootstrap-admin.mjs';

console.log('Aplicando migraciones...');
execSync('node scripts/migrate.mjs', { stdio: 'inherit' });

// Solo hace algo si ADMIN_EMAIL y ADMIN_PASSWORD están definidas.
await bootstrapAdmin();

console.log('Iniciando servidor...');
await import('../dist/server/entry.mjs');
