#!/usr/bin/env node
/**
 * Синхронизирует версию между файлом VERSION и package.json.
 *
 *   node scripts/sync-version.mjs            — читает VERSION, пишет в package.json
 *   node scripts/sync-version.mjs --check    — только проверка (для CI)
 *
 * Источник истины — файл VERSION: он короче и его читает установщик.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const VERSION_FILE = path.join(ROOT, 'VERSION');
const PACKAGE_FILE = path.join(ROOT, 'package.json');

const checkOnly = process.argv.includes('--check');

async function readVersion() {
  const raw = await readFile(VERSION_FILE, 'utf8');
  const version = raw.trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`некорректная версия в VERSION: "${version}" (нужен SemVer X.Y.Z)`);
  }
  return version;
}

async function main() {
  const version = await readVersion();
  const pkgRaw = await readFile(PACKAGE_FILE, 'utf8');
  const pkg = JSON.parse(pkgRaw);
  const current = pkg.version ?? '(нет)';

  if (checkOnly) {
    if (current !== version) {
      console.error(
        `[sync-version] РАСХОЖДЕНИЕ: VERSION=${version}, package.json=${current}`,
      );
      console.error('[sync-version] выполните: npm run release:version');
      process.exit(1);
    }
    console.log(`[sync-version] OK: версия ${version} совпадает в VERSION и package.json`);
    return;
  }

  if (current === version) {
    console.log(`[sync-version] версия уже ${version}`);
    return;
  }
  pkg.version = version;
  await writeFile(PACKAGE_FILE, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  console.log(`[sync-version] package.json: ${current} → ${version}`);
}

main().catch((error) => {
  console.error(`[sync-version] ошибка: ${error.message}`);
  process.exit(1);
});
