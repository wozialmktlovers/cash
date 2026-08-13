import { execSync } from 'node:child_process';

console.log('Aplicando migraciones...');
execSync('node scripts/migrate.mjs', { stdio: 'inherit' });

console.log('Iniciando servidor...');
await import('../dist/server/entry.mjs');
