// Проверка: принимает ли панель запросы с Host, отличным от AUTH_ORIGIN.
// Если нет — доступ по «другому» имени (например panel.local) сломает вход.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const dataDir = mkdtempSync(path.join(tmpdir(), 'panel-host-'));
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NITRO_HOST: '127.0.0.1',
  NITRO_PORT: String(PORT),
  DB_DIALECT: 'sqlite',
  SQLITE_PATH: path.join(dataDir, 'panel.sqlite'),
  // Публичный адрес — как будто панель открыта по имени
  NEXTAUTH_SECRET: 'host-check-secret-0123456789abcdefghij',
  NEXTAUTH_URL: 'http://panel.example.com',
  AUTH_ORIGIN: 'http://panel.example.com/api/auth',
  NUXT_PANEL_URL: 'http://panel.example.com',
  TRUSTED_PROXY: '127.0.0.1,::1',
};

const child = spawn('node', ['.output/server/index.mjs'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (c) => { log += c; });
child.stderr.on('data', (c) => { log += c; });

await new Promise((r) => setTimeout(r, 6000));

async function probe(host) {
  try {
    const response = await fetch(`${BASE}/api/auth/session`, {
      headers: { Host: host },
      redirect: 'manual',
    });
    const body = await response.text();
    return { status: response.status, body: body.slice(0, 120) };
  } catch (error) {
    return { status: 0, body: String(error.message) };
  }
}

console.log('AUTH_ORIGIN = http://panel.example.com/api/auth\n');
for (const host of ['panel.example.com', '192.168.0.105', 'panel.local', 'localhost:3199']) {
  const result = await probe(host);
  console.log(`Host: ${host.padEnd(20)} → HTTP ${result.status}  ${result.body.replace(/\n/g, ' ')}`);
}

child.kill('SIGTERM');
await new Promise((r) => setTimeout(r, 500));
rmSync(dataDir, { recursive: true, force: true });
