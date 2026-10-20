#!/usr/bin/env node
/**
 * Симуляция установки cardinal-panel в песочнице: повторяет шаги
 * install.sh (распаковка → перенос в INSTALL_DIR → запуск сервера)
 * без systemd, чтобы проверить раскладку файлов до выкладки на VPS.
 *
 *   node scripts/simulate-install.mjs
 */
import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const SANDBOX = path.join(os.tmpdir(), 'cardinal-panel-install-sim');
const INSTALL_DIR = path.join(SANDBOX, 'opt', 'cardinal-panel');
const DATA_DIR = path.join(SANDBOX, 'var', 'lib', 'cardinal-panel');
const PORT = 3131;

// Секрет генерируется на каждый прогон: в репозитории не остаётся
// ни одного литерала, похожего на настоящий ключ.
const SIM_SECRET = randomBytes(32).toString('base64url');

const steps = [];
const step = (name, ok, detail = '') => {
  steps.push([name, ok, detail]);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
};

async function main() {
  const version = (await readFile(path.join(ROOT, 'VERSION'), 'utf8')).trim();
  const archive = path.join(ROOT, 'release', `cardinal-panel-${version}.tar.gz`);
  if (!existsSync(archive)) {
    console.error(
      `[simulate-install] нет release/cardinal-panel-${version}.tar.gz — выполните npm run release:package`,
    );
    process.exit(1);
  }

  await rm(SANDBOX, { recursive: true, force: true });
  await mkdir(INSTALL_DIR, { recursive: true });
  await mkdir(DATA_DIR, { recursive: true });

  // 1. Распаковка
  execFileSync('tar', ['-xzf', archive, '-C', SANDBOX], { stdio: 'inherit' });
  const stage = path.join(SANDBOX, 'cardinal-panel');
  step('архив распакован', existsSync(stage));

  // 2. Переносы — ровно как в install.sh
  for (const dir of ['.output', 'scripts', 'server', 'packaging']) {
    await cp(path.join(stage, dir), path.join(INSTALL_DIR, dir), { recursive: true });
  }
  for (const file of ['package.json', 'VERSION', '.env.example']) {
    await cp(path.join(stage, file), path.join(INSTALL_DIR, file));
  }
  // Файлы, нужные режиму cardinal: образ и compose-шаблон.
  await cp(path.join(stage, 'Dockerfile.cardinal'), path.join(INSTALL_DIR, 'Dockerfile.cardinal'));
  step('.output перенесён', existsSync(path.join(INSTALL_DIR, '.output', 'server', 'index.mjs')));
  step('packaging перенесён', existsSync(path.join(INSTALL_DIR, 'packaging', 'systemd', 'cardinal-panel.service')));
  step('cardinal-образ в пакете', existsSync(path.join(INSTALL_DIR, 'Dockerfile.cardinal')));
  step(
    'cardinal compose-шаблон в пакете',
    existsSync(path.join(INSTALL_DIR, 'packaging', 'cardinal', 'cardinal-panel.toml')),
  );
  step('миграции перенесены', existsSync(path.join(INSTALL_DIR, 'server', 'db', 'migrations', 'sqlite')));
  step('скрипт миграций на месте', existsSync(path.join(INSTALL_DIR, 'scripts', 'migrate-sqlite.mjs')));

  // 2b. Всё, что копирует Dockerfile.cardinal, должно быть в пакете.
  const dockerfile = await readFile(path.join(INSTALL_DIR, 'Dockerfile.cardinal'), 'utf8');
  const copySources = [...dockerfile.matchAll(/^COPY\s+(\S+)/gm)].map((m) => m[1]);
  const missing = copySources.filter(
    (source) => !existsSync(path.join(INSTALL_DIR, source.replace(/\/$/, ''))),
  );
  step('все COPY-источники Dockerfile.cardinal есть в пакете', missing.length === 0, missing.join(', '));

  // 3. Конфиг как в install.sh
  const conf = path.join(SANDBOX, 'etc', 'cardinal-panel', 'panel.env');
  await mkdir(path.dirname(conf), { recursive: true });
  await writeFile(
    conf,
    [
      `NEXTAUTH_SECRET="${SIM_SECRET}"`,
      `SQLITE_PATH="${path.join(DATA_DIR, 'panel.sqlite').replace(/\\/g, '/')}"`,
      'DB_DIALECT="sqlite"',
      'NITRO_HOST="127.0.0.1"',
      `NITRO_PORT="${PORT}"`,
      '',
    ].join('\n'),
    'utf8',
  );
  step('конфиг создан', existsSync(conf));

  // 4. Миграции
  try {
    execFileSync('node', ['scripts/migrate-sqlite.mjs'], {
      cwd: INSTALL_DIR,
      env: {
        ...process.env,
        DB_DIALECT: 'sqlite',
        SQLITE_PATH: path.join(DATA_DIR, 'panel.sqlite'),
      },
      stdio: 'pipe',
    });
    step('миграции применены', true);
  } catch (error) {
    step('миграции применены', false, String(error.stdout || error.message).slice(0, 300));
  }
  step('база создана', existsSync(path.join(DATA_DIR, 'panel.sqlite')));

  // 5. Запуск сервера из установленной раскладки
  const child = spawn('node', ['.output/server/index.mjs'], {
    cwd: INSTALL_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(PORT),
      DB_DIALECT: 'sqlite',
      SQLITE_PATH: path.join(DATA_DIR, 'panel.sqlite'),
      NEXTAUTH_SECRET: SIM_SECRET,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });

  await new Promise((resolve) => setTimeout(resolve, 8000));
  let health = null;
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    health = { status: response.status, body: await response.json() };
  } catch (error) {
    health = { status: 0, body: { error: String(error.message) } };
  }
  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 800));

  step(
    'сервер поднялся из установленной раскладки',
    health.status === 200,
    `HTTP ${health.status} ${JSON.stringify(health.body).slice(0, 160)}`,
  );
  step('health отдаёт версию', health.body?.version === version, `version=${health.body?.version}`);
  step('health видит базу', health.body?.database === 'ok');

  if (health.status !== 200) {
    console.log('\n--- вывод сервера ---\n' + output.slice(-2000));
  }

  const failed = steps.filter(([, ok]) => !ok).length;
  console.log(
    failed === 0
      ? '\n--- установка симулирована успешно ---'
      : `\n--- провалов: ${failed} ---`,
  );
  await rm(SANDBOX, { recursive: true, force: true });
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`[simulate-install] ошибка: ${error.message}`);
  process.exit(1);
});
