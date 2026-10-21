#!/usr/bin/env node
/**
 * scripts/e2e-server.mjs — поднимает собранную панель для E2E-тестов.
 *
 * 1. готовит чистую БД (миграции) и создаёт администратора,
 * 2. запускает .output/server/index.mjs с нужным окружением,
 * 3. живёт, пока процесс не убит (Playwright управляет через webServer).
 *
 * Скрипт НЕ пишет секреты в репозиторий: пароль администратора —
 * тестовый, база — во временном каталоге.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.E2E_PORT || 3111);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export const E2E_ADMIN_EMAIL = 'e2e-admin@example.com';
export const E2E_ADMIN_PASSWORD = 'E2e-Panel-Password-123';

if (!existsSync(path.join(ROOT, '.output', 'server', 'index.mjs'))) {
  console.error('[e2e-server] нет сборки .output/ — выполните npm run build');
  process.exit(1);
}

const dataDir = mkdtempSync(path.join(tmpdir(), 'cardinal-panel-e2e-'));
const sqlitePath = path.join(dataDir, 'panel.sqlite');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  NITRO_HOST: '127.0.0.1',
  NITRO_PORT: String(PORT),
  DB_DIALECT: 'sqlite',
  SQLITE_PATH: sqlitePath,
  NEXTAUTH_SECRET: 'e2e-secret-not-used-anywhere-else-0123456789',
  NEXTAUTH_URL: BASE_URL,
  AUTH_ORIGIN: `${BASE_URL}/api/auth`,
  NUXT_PANEL_URL: BASE_URL,
  TRUSTED_PROXY: '127.0.0.1,::1',
  DEBUG: 'false',
};

// 1. Миграции.
console.log('[e2e-server] applying migrations');
execFileSync('node', ['scripts/migrate-sqlite.mjs'], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});

// 2. Администратор.
console.log('[e2e-server] creating the admin');
execFileSync(
  'node',
  [
    'scripts/create-admin.mjs',
    `--email=${E2E_ADMIN_EMAIL}`,
    `--password=${E2E_ADMIN_PASSWORD}`,
    '--name=e2e',
  ],
  { cwd: ROOT, env, stdio: 'inherit' },
);

// 3. Сервер.
console.log(`[e2e-server] starting on ${BASE_URL}`);
const child = spawn('node', ['.output/server/index.mjs'], {
  cwd: ROOT,
  env,
  stdio: ['ignore', 'inherit', 'inherit'],
});

const shutdown = (code = 0) => {
  try {
    child.kill('SIGTERM');
  } catch {
    /* уже мёртв */
  }
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code);
};
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
child.on('exit', (code) => {
  rmSync(dataDir, { recursive: true, force: true });
  process.exit(code ?? 0);
});
