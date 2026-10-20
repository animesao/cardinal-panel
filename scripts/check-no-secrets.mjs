#!/usr/bin/env node
/**
 * Проверка перед пушем: в отслеживаемых файлах не должно быть секретов.
 *   node scripts/check-no-secrets.mjs
 */
import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const tracked = git('ls-files').split('\n').filter(Boolean);
console.log(`отслеживаемых файлов: ${tracked.length}`);

const problems = [];

// 1. Файлы, которые не должны попадать в репозиторий.
const forbiddenPatterns = [
  /^\.env$/,
  /^\.env\.(?!example$)/,
  /^data\//,
  /\.sqlite$/,
  /node_modules\//,
  /^\.output\//,
  /^release\//,
  /\.log$/,
];
for (const file of tracked) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(file)) problems.push(`файл в репозитории: ${file} (${pattern})`);
  }
}

// 2. Значения, похожие на секреты: присваивание литерала непустой строки.
const secretPatterns = [
  {
    name: 'NEXTAUTH_SECRET с литералом',
    regex: /NEXTAUTH_SECRET\s*[=:]\s*['"][^'"\s]{8,}['"]/g,
  },
  {
    name: 'DB_PASSWORD с литералом',
    regex: /DB_PASSWORD\s*[=:]\s*['"][^'"\s]{4,}['"]/g,
  },
  {
    name: 'GITHUB_TOKEN с литералом',
    regex: /GITHUB_TOKEN\s*[=:]\s*['"][^'"\s]{8,}['"]/g,
  },
  {
    name: 'похожий на GitHub-токен',
    regex: /gh[pousr]_[A-Za-z0-9]{20,}/g,
  },
  {
    name: 'приватный SSH-ключ',
    regex: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/g,
  },
];

// Файлы-исключения: в примерах плейсхолдеры — это норма.
const allowlist = [
  '.env.example',
  'CHANGELOG.md',
  'README.md',
  'install.sh',
  'packaging/systemd/cardinal-panel.service',
];

for (const file of tracked) {
  if (allowlist.includes(file)) continue;
  if (!/\.(ts|js|mjs|vue|json|yml|yaml|sh|toml|service|dockerfile)$/i.test(file) && !/Dockerfile|compose/.test(file)) {
    continue;
  }
  let content;
  try {
    content = git('show', `:${file}`);
  } catch {
    continue;
  }
  for (const { name, regex } of secretPatterns) {
    const matches = content.match(regex);
    if (matches) {
      problems.push(`${file}: ${name} → ${matches.length} совпадение(й)`);
    }
  }
}

if (problems.length) {
  console.error('НАЙДЕНЫ ПРОБЛЕМЫ:');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('[check-no-secrets] OK: секретов в отслеживаемых файлах нет');
