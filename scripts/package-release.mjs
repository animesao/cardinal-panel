#!/usr/bin/env node
/**
 * Собирает релизный пакет панели в release/:
 *   release/cardinal-panel-<version>.tar.gz   — .output + миграции + скрипты
 *   release/cardinal-panel-<version>.tar.gz.sha256
 *   release/cardinal-panel-<version>.sbom.json — SPDX
 *
 * Запускается в CI после `npm run build`:
 *   node scripts/package-release.mjs
 */
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  cp,
  readdir,
  stat,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const RELEASE_DIR = path.join(ROOT, 'release');
const OUTPUT_DIR = path.join(ROOT, '.output');

/** Что попадает в пакет: путь внутри архива → источник. */
const PAYLOAD = [
  // Точка в имени обязательна: Nitro ищет сборку по пути .output/, а
  // install.sh кладёт её именно туда.
  ['.output/', OUTPUT_DIR],
  ['scripts/', path.join(ROOT, 'scripts')],
  ['packaging/', path.join(ROOT, 'packaging')],
  ['server/db/migrations/', path.join(ROOT, 'server', 'db', 'migrations')],
  ['package.json', path.join(ROOT, 'package.json')],
  ['VERSION', path.join(ROOT, 'VERSION')],
  ['.env.example', path.join(ROOT, '.env.example')],
  ['Dockerfile', path.join(ROOT, 'Dockerfile')],
  ['docker-compose.yml', path.join(ROOT, 'docker-compose.yml')],
];

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/** Минимальный SPDX-документ по перечню зависимостей. */
async function buildSbom(version) {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const lockRaw = await readFile(path.join(ROOT, 'package-lock.json'), 'utf8');
  const lock = JSON.parse(lockRaw);
  const packages = lock.packages ?? {};

  const relationships = [
    { spdxElementId: 'SPDXRef-Package-cardinal-panel', relatedSpdxElement: 'SPDXRef-Package-npm', relationshipType: 'DEPENDS_ON' },
  ];
  const files = [];

  for (const [pathKey, entry] of Object.entries(packages)) {
    if (!pathKey || !entry.version) continue;
    const name = entry.name ?? pathKey.replace(/^node_modules\//, '');
    const id = `SPDXRef-Package-${name.replace(/[^A-Za-z0-9.-]/g, '-')}-${entry.version}`;
    files.push({
      SPDXID: id,
      name,
      versionInfo: entry.version,
      downloadLocation: 'NOASSERTION',
      filesAnalyzed: false,
      licenseConcluded: entry.license ?? 'NOASSERTION',
      licenseDeclared: entry.license ?? 'NOASSERTION',
      copyrightText: 'NOASSERTION',
      supplier: 'NOASSERTION',
    });
    relationships.push({
      spdxElementId: 'SPDXRef-Package-cardinal-panel',
      relatedSpdxElement: id,
      relationshipType: 'DEPENDS_ON',
    });
  }

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: `cardinal-panel-${version}`,
    documentNamespace: `https://github.com/animesao/cardinal-panel/releases/tag/v${version}`,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: cardinal-panel package-release.mjs'],
    },
    packages: [
      {
        SPDXID: 'SPDXRef-Package-cardinal-panel',
        name: pkg.name,
        versionInfo: version,
        downloadLocation: 'NOASSERTION',
        filesAnalyzed: false,
        licenseConcluded: 'Apache-2.0',
        licenseDeclared: 'Apache-2.0',
        copyrightText: 'NOASSERTION',
        supplier: 'Organization: animesao',
      },
      ...files,
    ],
    relationships,
  };
}

async function main() {
  const version = (await readFile(path.join(ROOT, 'VERSION'), 'utf8')).trim();
  if (!await exists(OUTPUT_DIR)) {
    console.error('[package-release] нет .output/ — сначала выполните npm run build');
    process.exit(1);
  }

  await rm(RELEASE_DIR, { recursive: true, force: true });
  await mkdir(RELEASE_DIR, { recursive: true });

  const stageDir = path.join(RELEASE_DIR, 'stage');
  const pkgRoot = path.join(stageDir, 'cardinal-panel');
  await mkdir(pkgRoot, { recursive: true });

  for (const [target, source] of PAYLOAD) {
    if (!await exists(source)) {
      console.warn(`[package-release] пропущено (нет источника): ${source}`);
      continue;
    }
    const destination = path.join(pkgRoot, target);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }

  // Служебные файлы, без которых панель не поднимется.
  await writeFile(
    path.join(pkgRoot, 'INSTALL.md'),
    [
      '# Установка cardinal-panel',
      '',
      '```bash',
      'tar -xzf cardinal-panel-' + version + '.tar.gz',
      'cd cardinal-panel',
      'npm ci --omit=dev --ignore-scripts',
      'cp .env.example .env   # заполнить секреты',
      'node scripts/migrate-sqlite.mjs',
      '```',
      '',
      'Подробности: раздел «Установка» в README.md.',
      '',
    ].join('\n'),
    'utf8',
  );

  const archiveName = `cardinal-panel-${version}.tar.gz`;
  const archivePath = path.join(RELEASE_DIR, archiveName);

  // tar доступен в git-bash и в CI (ubuntu). На Windows используем bsdtar.
  const tarCommand = process.platform === 'win32' ? 'tar' : 'tar';
  execFileSync(tarCommand, [
    '-czf',
    archivePath,
    '-C',
    stageDir,
    'cardinal-panel',
  ], { stdio: 'inherit' });

  await rm(stageDir, { recursive: true, force: true });

  const digest = await sha256(archivePath);
  await writeFile(`${archivePath}.sha256`, `${digest}  ${archiveName}\n`, 'utf8');

  const sbom = await buildSbom(version);
  const sbomPath = path.join(RELEASE_DIR, `cardinal-panel-${version}.sbom.json`);
  await writeFile(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`, 'utf8');

  const entries = await readdir(RELEASE_DIR);
  console.log(`[package-release] версия ${version}`);
  for (const entry of entries.sort()) {
    const size = (await stat(path.join(RELEASE_DIR, entry))).size;
    console.log(`  ${entry} (${(size / 1024).toFixed(1)} KiB)`);
  }
  console.log(`[package-release] sha256: ${digest}`);
}

main().catch((error) => {
  console.error(`[package-release] ошибка: ${error.message}`);
  process.exit(1);
});
